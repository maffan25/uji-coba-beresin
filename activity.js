/* activity.js (v5.2) — Riwayat Aktivitas: catatan otomatis semua kegiatan yang kamu lakukan di seluruh modul.
   Cara kerja : membandingkan data tiap modul (mo-*-v1) sebelum & sesudah disimpan, lalu mencatat yang BARU, SELESAI,
                BERUBAH STATUS, DIJADWALKAN ULANG, DIGANTI NAMA, DIHAPUS. Tanpa mengubah kode modul lama.
   Keamanan   : hanya MEMBACA data modul. Satu-satunya yang ditulis = 'mo-activity-v1' (maks. 500 catatan, ikut Cadangan data).
   Ringan     : perbandingan dijalankan 400 ms setelah penyimpanan terakhir (debounce), bukan di setiap penyimpanan. */
(function () {
  'use strict';
  var D = document, MO = window.MyOffice = window.MyOffice || {};
  if (MO.activity) return;
  var KEY = 'mo-activity-v1', MAX = 500, GAP = 120000;

  /* ---------- util ---------- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var DONE = /^(Selesai|Done|Tercapai|Completed)$/i, CANC = /^(Dibatalkan|Archived|Batal|Cancelled)$/i;
  var fdate = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if (!m) return String(s || ''); var t = String(s).length > 10 ? ' ' + String(s).slice(11, 16) : ''; return +m[3] + ' ' + BLN[m[2] - 1] + t; };
  var clock = function (ts) { var d = new Date(ts); return pad(d.getHours()) + '.' + pad(d.getMinutes()); };

  /* ---------- peta modul & koleksi yang dicatat ---------- */
  var STORES = {
    'mo-task-v1': { m: 'task', route: '#task', arr: { task: 'Task' } },
    'mo-cal-v1': { m: 'cal', route: '#calendar', arr: { ev: 'Kalender' } },
    'mo-work-v1': { m: 'work', route: '#work', arr: { job: 'Pekerjaan', wtask: 'Tugas kerja', log: 'Jam kerja' } },
    'mo-org-v1': { m: 'org', route: '#organization', arr: { meeting: 'Rapat', followup: 'Tindak lanjut' } },
    'mo-proj-v1': { m: 'proj', route: '#project', arr: { proj: 'Proyek', ptask: 'Tugas proyek', ms: 'Milestone' } },
    'mo-goal-v1': { m: 'goal', route: '#goal', arr: { goal: 'Goal', gtask: 'Tugas goal', ms: 'Milestone goal' } },
    'mo-acad-v1': { m: 'acad', route: '#academic', arr: { course: 'Mata kuliah', task: 'Tugas kuliah', exam: 'Ujian', study: 'Waktu belajar' }, tabs: { task: 'task', exam: 'exam', study: 'fokus', course: 'dash' } },
    'mo-docs-v1': { m: 'docs', route: '#documents', arr: { file: 'Dokumen' } },
    'mo-fin-v1': { m: 'fin', route: '#finance', arr: { tx: 'Transaksi' } }
  };
  var MODN = { task: 'Task', cal: 'Kalender', work: 'Work', org: 'Organisasi', proj: 'Proyek', goal: 'Goal', acad: 'Academic', docs: 'Dokumen', fin: 'Finance' };
  var DATEK = { due: 'Tenggat', deadline: 'Tenggat', target: 'Target', date: 'Tanggal', start: 'Mulai' }, DATEO = ['due', 'deadline', 'target', 'start', 'date'];

  function labelOf(arr, it, root) {
    if (arr === 'exam') { var c = (root.course || []).filter(function (x) { return x.id === it.courseId; })[0]; return (it.type || 'Ujian') + (c ? ' — ' + c.name : ''); }
    if (arr === 'study') { var c2 = (root.course || []).filter(function (x) { return x.id === it.courseId; })[0]; return (c2 ? c2.name : 'Belajar') + (it.topic ? ' — ' + it.topic : '') + (it.minutes ? ' · ' + it.minutes + ' mnt' : ''); }
    if (arr === 'log') { var j = (root.job || []).filter(function (x) { return x.id === it.jobId; })[0]; return (j ? j.title : 'Pekerjaan') + (it.hours ? ' · ' + it.hours + ' jam' : ''); }
    if (arr === 'tx') return (it.note || it.title || it.category || it.type || 'Transaksi') + (it.amount ? ' · Rp ' + Math.round(+it.amount).toLocaleString('id-ID') : '');
    if (arr === 'file') return it.name || it.title || it.fileName || '';
    return it.title || it.name || it.task || '';
  }
  function snapOf(key, root) {
    var cfg = STORES[key], out = {};
    Object.keys(cfg.arr).forEach(function (a) {
      (Array.isArray(root[a]) ? root[a] : []).forEach(function (it) {
        if (!it || it.id == null || it.sp || it.parentId) return;
        var lb = labelOf(a, it, root); if (!lb) return;
        var dk = '', dv = ''; for (var i = 0; i < DATEO.length; i++) if (it[DATEO[i]]) { dk = DATEO[i]; dv = String(it[DATEO[i]]).slice(0, 16) + (it.dueTime && dk === 'due' ? ' ' + it.dueTime : ''); break; }
        var st = typeof it.status === 'string' ? it.status : (it.done === true ? 'Selesai' : '');
        out[a + ':' + it.id] = { a: a, n: lb, s: st, dk: dk, dv: dv };
      });
    });
    return out;
  }

  /* ---------- log ---------- */
  var L = (function () { var o; try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { } return o && Array.isArray(o.log) ? o : { log: [] }; })();
  var saveT = 0;
  function saveL() { clearTimeout(saveT); saveT = setTimeout(function () { if (L.log.length > MAX) L.log.length = MAX; try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) { } }, 250); }
  function push(ev) {
    var now = Date.now(); ev.t = now; ev.id = now.toString(36) + Math.random().toString(36).slice(2, 5);
    if (ev.ref && ev.k !== 'del') {
      for (var i = 0; i < L.log.length && i < 12; i++) {
        var p = L.log[i]; if (now - p.t > GAP) break; if (p.ref !== ev.ref) continue;
        if (p.k === 'new' && (ev.k === 'rename' || ev.k === 'move' || ev.k === 'status')) { if (ev.k === 'rename') p.n = ev.to; return; }
        if (p.k === ev.k && (ev.k === 'move' || ev.k === 'status' || ev.k === 'rename')) {
          p.to = ev.to; p.t = now; if (p.from === p.to) L.log.splice(i, 1); return;
        }
        if (p.k === 'done' && ev.k === 'status') return;
      }
    }
    L.log.unshift(ev);
  }

  var snaps = {}, pend = {}, timer = 0, ready = false, listeners = [];
  function diff(key, root, old) {
    var nw = snapOf(key, root), cfg = STORES[key], news = [], dels = [];
    Object.keys(nw).forEach(function (r) {
      var n = nw[r], o = old[r], ty = cfg.arr[n.a], base = { m: cfg.m, ty: ty, a: n.a, ref: key + '|' + r, n: n.n };
      if (!o) { news.push(Object.assign(base, { k: 'new', dk: n.dk, to: n.dv })); return; }
      if (n.s !== o.s && n.s !== '') {
        if (DONE.test(n.s) && !DONE.test(o.s)) push(Object.assign(base, { k: 'done', from: o.s, to: n.s }));
        else if (CANC.test(n.s) && !CANC.test(o.s)) push(Object.assign(base, { k: 'cancel', from: o.s, to: n.s }));
        else push(Object.assign(base, { k: 'status', from: o.s || '—', to: n.s }));
      }
      if (n.dv && o.dv && n.dv !== o.dv && n.dk === o.dk) push(Object.assign(base, { k: 'move', dk: n.dk, from: o.dv, to: n.dv }));
      if (n.n !== o.n && o.n) push(Object.assign(base, { k: 'rename', from: o.n, to: n.n }));
    });
    Object.keys(old).forEach(function (r) { if (!nw[r]) dels.push(Object.assign({ m: cfg.m, ty: cfg.arr[old[r].a], a: old[r].a, ref: key + '|' + r, n: old[r].n, k: 'del' })); });
    var grp = function (arr, k) {
      if (arr.length <= 3) return arr.forEach(push);
      var by = {}; arr.forEach(function (e) { (by[e.a] = by[e.a] || []).push(e); });
      Object.keys(by).forEach(function (a) { var g = by[a]; if (g.length <= 3) return g.forEach(push); push({ m: g[0].m, ty: g[0].ty, a: a, k: k, n: g.length + ' ' + g[0].ty.toLowerCase(), cnt: g.length }); });
    };
    grp(news, 'new'); grp(dels, 'del');
    snaps[key] = nw;
  }
  function flush() {
    timer = 0; var changed = 0;
    Object.keys(pend).forEach(function (key) {
      delete pend[key];
      var raw; try { raw = JSON.parse(localStorage.getItem(key)); } catch (e) { return; }
      if (!raw || typeof raw !== 'object') return;
      if (!snaps[key]) { snaps[key] = snapOf(key, raw); return; }
      var before = L.log.length; diff(key, raw, snaps[key]); changed = 1;
    });
    if (changed) { saveL(); listeners.forEach(function (f) { try { f(); } catch (e) { } }); }
  }
  function baseline() {
    Object.keys(STORES).forEach(function (key) {
      if (snaps[key]) return;
      try { var raw = JSON.parse(localStorage.getItem(key)); if (raw && typeof raw === 'object') snaps[key] = snapOf(key, raw); } catch (e) { }
    });
    ready = true;
  }
  try {
    var _set = Storage.prototype.setItem, _rm = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k) {
      if (this === localStorage && STORES[k]) {
        if (!snaps[k]) { try { var o = JSON.parse(localStorage.getItem(k)); if (o && typeof o === 'object') snaps[k] = snapOf(k, o); } catch (e) { } }
        pend[k] = 1; clearTimeout(timer); timer = setTimeout(flush, 400);
      }
      return _set.apply(this, arguments);
    };
  } catch (e) { }
  if (window.requestIdleCallback) requestIdleCallback(baseline, { timeout: 1500 }); else setTimeout(baseline, 800);
  window.addEventListener('pagehide', function () { if (timer) flush(); });

  /* ---------- tampilan ---------- */
  var IC = {
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'
  };
  var svg = function (p, c) { return '<svg class="' + (c || 'ac-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var V = { c: null, host: null, lim: 60, open: {}, f: 'all' };
  var FILT = [['all', 'Semua'], ['new', 'Dibuat'], ['done', 'Selesai'], ['edit', 'Diubah'], ['del', 'Dihapus']];
  var kindOf = function (e) { return e.k === 'new' ? 'new' : e.k === 'done' ? 'done' : e.k === 'del' || e.k === 'cancel' ? 'del' : 'edit'; };

  function dayLabel(ts) {
    var d = new Date(ts), td = new Date(), y = new Date(); y.setDate(td.getDate() - 1);
    var base = HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear();
    return ymd(d) === ymd(td) ? 'Hari ini · ' + base : ymd(d) === ymd(y) ? 'Kemarin · ' + base : base;
  }
  function profile() { var s = {}; try { s = JSON.parse(localStorage.getItem('mo-settings-v1')) || {}; } catch (e) { } return s; }
  function avatar() {
    var s = profile();
    return '<span class="ac-av"' + (s.photo ? ' style="background-image:url(&quot;' + esc(s.photo) + '&quot;)"' : '') + '>' + (s.photo ? '' : esc((s.nick || 'K').charAt(0).toUpperCase())) + '</span>';
  }
  function chips(e) {
    var ch = function (t, c) { return '<span class="ac-chip' + (c ? ' ' + c : '') + '">' + esc(t) + '</span>'; };
    if (e.k === 'status' || e.k === 'done' || e.k === 'cancel') {
      var cls = function (s) { return DONE.test(s) ? 'ok' : CANC.test(s) ? 'bad' : /proses|jalan|progress|review/i.test(s) ? 'warn' : ''; };
      return '<div class="ac-box"><div class="ac-kv"><small>Status:</small><div class="ac-ch">' + ch(e.from || '—', cls(e.from || '')) + '<span class="ac-ar">→</span>' + ch(e.to, cls(e.to)) + '</div></div></div>';
    }
    if (e.k === 'move') return '<div class="ac-box"><div class="ac-kv"><small>' + esc(DATEK[e.dk] || 'Tanggal') + ':</small><div class="ac-ch"><b class="ac-old">' + esc(fdate(e.from)) + '</b><span class="ac-ar">→</span><b>' + esc(fdate(e.to)) + '</b></div></div></div>';
    return '';
  }
  function entryHtml(e) {
    var knd = e.k, node, txt, box = '', nm = '<a class="ac-ln" data-ac="go" data-id="' + esc(e.id) + '">' + esc(e.n) + '</a>';
    if (knd === 'new') {
      node = '<span class="ac-nd av">' + avatar() + '</span>';
      txt = '<b>Kamu</b> membuat ' + esc((e.ty || '').toLowerCase()) + ' ' + nm;
      if (e.cnt) txt = '<b>Kamu</b> membuat <b>' + esc(e.n) + '</b>';
      if (e.to) {
        var op = V.open[e.id] !== false, bx = '<div class="ac-box"><div class="ac-kv"><small>' + esc(DATEK[e.dk] || 'Tanggal') + ':</small><div class="ac-ch"><b>' + esc(fdate(e.to)) + '</b></div></div></div>';
        box = (op ? bx : '') + '<button class="ac-hide" data-ac="hide" data-id="' + esc(e.id) + '">' + (op ? 'Sembunyikan' : 'Detail') + '</button>';
      }
    } else if (knd === 'done') { node = '<span class="ac-nd ok"><i></i></span>'; txt = '<b>' + esc(e.n) + '</b> ' + (e.ty === 'Milestone' || e.ty === 'Milestone goal' ? 'tercapai' : 'selesai'); box = ''; }
    else if (knd === 'cancel') { node = '<span class="ac-nd warn"><i class="sq"></i></span>'; txt = nm + ' dibatalkan'; box = chips(e); }
    else if (knd === 'del') { node = '<span class="ac-nd bad">' + svg(IC.trash, 'ac-ni') + '</span>'; txt = '<b>Kamu</b> menghapus ' + (e.cnt ? '<b>' + esc(e.n) + '</b>' : esc((e.ty || '').toLowerCase()) + ' <b>' + esc(e.n) + '</b>'); }
    else if (knd === 'move') { node = '<span class="ac-nd ed">' + svg(IC.cal, 'ac-ni') + '</span>'; txt = nm + ' dijadwalkan ulang'; box = chips(e); }
    else if (knd === 'rename') { node = '<span class="ac-nd ed">' + svg(IC.pencil, 'ac-ni') + '</span>'; txt = '<b>' + esc(e.from) + '</b> diganti nama menjadi ' + nm; }
    else { node = '<span class="ac-nd ed">' + svg(IC.pencil, 'ac-ni') + '</span>'; txt = nm + ' status diubah'; box = chips(e); }
    return '<div class="ac-it k-' + kindOf(e) + '">' + node + '<div class="ac-tx"><div class="ac-t1">' + txt + '</div><div class="ac-t2">' + clock(e.t) + ' · ' + esc(e.ty || MODN[e.m] || '') + '</div>' + box + '</div></div>';
  }
  function html() {
    var all = L.log.filter(function (e) { return V.f === 'all' || kindOf(e) === V.f; });
    var h = '<div class="ac-view"><div class="ac-flt" role="tablist" aria-label="Filter riwayat">' + FILT.map(function (f) { return '<button role="tab" data-ac="flt" data-f="' + f[0] + '" aria-selected="' + (V.f === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>';
    if (!all.length) {
      h += '<div class="ac-empty">' + svg(IC.hist, 'ac-ei') + '<b>' + (L.log.length ? 'Tidak ada catatan di filter ini' : 'Belum ada riwayat') + '</b><p>' + (L.log.length ? 'Pilih filter lain.' : 'Mulai sekarang, setiap tugas, pekerjaan, rapat, proyek, dan target yang kamu buat, selesaikan, ubah, atau hapus akan tercatat di sini otomatis.') + '</p></div></div>';
      return h;
    }
    var shown = all.slice(0, V.lim), last = '';
    h += '<div class="ac-tl">';
    shown.forEach(function (e) { var dl = dayLabel(e.t); if (dl !== last) { last = dl; h += '<div class="ac-day"><span>' + esc(dl) + '</span></div>'; } h += entryHtml(e); });
    h += '</div>';
    if (all.length > shown.length) h += '<button class="ac-more" data-ac="more">Tampilkan lebih banyak (' + (all.length - shown.length) + ')</button>';
    h += '<p class="ac-foot">Riwayat dicatat otomatis di perangkat ini dan ikut Cadangan data. <button data-ac="clear">Hapus riwayat</button></p></div>';
    return h;
  }
  function render() { if (!V.c) return; var top = V.c.scrollTop; V.c.innerHTML = html(); if (top) V.c.scrollTop = top; }
  function onClick(e) {
    var b = e.target.closest && e.target.closest('[data-ac]'); if (!b || !V.c || !V.c.contains(b)) return;
    var a = b.dataset.ac; e.stopPropagation();
    if (a === 'flt') { V.f = b.dataset.f; V.lim = 60; render(); if (V.c) V.c.scrollTop = 0; return; }
    if (a === 'more') { V.lim += 80; return render(); }
    if (a === 'hide') { var id = b.dataset.id; V.open[id] = V.open[id] === false; return render(); }
    if (a === 'clear') { if (confirm('Hapus seluruh riwayat aktivitas? Data tugas, pekerjaan, dan lainnya tidak terpengaruh.')) { L.log = []; saveL(); render(); } return; }
    if (a === 'go') {
      var ev = L.log.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!ev || ev.k === 'del') return;
      var key = (ev.ref || '').split('|')[0], cfg = STORES[key]; if (!cfg || !V.host) return;
      if (key === 'mo-acad-v1' && MO.acadData && MO.acadData.focus) { try { var rp = (ev.ref || '').split('|')[1] || '', ix = rp.indexOf(':'); MO.acadData.focus(rp.slice(0, ix), rp.slice(ix + 1)); } catch (e) { } }   /* v5.4: buka kampus pemilik item */
      V.host.go(cfg.route, cfg.tabs && cfg.tabs[ev.a] || 'task', key === 'mo-acad-v1');
    }
  }
  function mount(c, host) {
    V.c = c; V.host = host; if (!c._ac) { c._ac = 1; c.addEventListener('click', onClick); }
    listeners = [render]; render();
  }
  function unmount() { V.c = null; V.host = null; listeners = []; }

  MO.activity = { mount: mount, unmount: unmount, count: function () { return L.log.length; }, log: function () { return L.log.slice(); }, flush: flush };
})();
