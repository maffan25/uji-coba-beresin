/* inbox.js (v4.9) — Inbox Terpadu: satu tempat untuk semua hal yang perlu ditindaklanjuti dari seluruh modul.
   Sumber   : Task, Kalender, Academic (tugas, ujian), Work (pekerjaan, tugas kerja, tagihan), Organization, Project, Goal.
   Aksi     : Selesai · Jadwalkan ulang · Buka sumber (+ Urungkan). Ketuk baris = langsung ke modul sumbernya.
   Keamanan : data diubah lewat objek hidup milik tiap modul (MO.apps / MO.acadData) lalu disimpan oleh modul itu sendiri,
              jadi tidak ada data yang tertimpa. Status baca/bintang/arsip/tunda disimpan terpisah di 'mo-inbox-v1'. */
(function () {
  'use strict';
  var D = document, root = D.documentElement, MO = window.MyOffice = window.MyOffice || {};
  var btn = D.getElementById('inboxBtn'); if (!btn) return;
  var dot = btn.querySelector('.dot');
  var KEY = 'mo-inbox-v1', HORIZON = 7, EVT_DAYS = 3, PAGE = 40, THR = 88, GLIM = 3;

  /* ---------- util ---------- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var today = function () { return ymd(new Date()); };
  var addDay = function (s, n) { var a = s.split('-'); return ymd(new Date(+a[0], a[1] - 1, +a[2] + n, 12)); };
  var dayDiff = function (a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+x[0], x[1] - 1, +x[2]) - Date.UTC(+y[0], y[1] - 1, +y[2])) / 864e5); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var fd = function (s) { var a = s.split('-'); return +a[2] + ' ' + BLN[a[1] - 1]; };
  var fdw = function (s) { var a = s.split('-'); return HARI[new Date(+a[0], a[1] - 1, +a[2], 12).getDay()] + ', ' + fd(s); };
  var rp = function (n) { return 'Rp ' + Math.round(+n || 0).toLocaleString('id-ID'); };
  var parse = function (v) { var m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(String(v || '')); return m ? { d: m[1], t: m[2] != null ? pad(+m[2]) + ':' + m[3] : '' } : null; };
  var DONE = /^(Selesai|Done|Tercapai|Completed)$/i, CANC = /^(Dibatalkan|Archived|Batal|Cancelled)$/i;
  var fin = function (s) { return DONE.test(s || '') || CANC.test(s || ''); };
  var svg = function (p, c) { return '<svg class="' + (c || 'ib-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    check: '<path d="M20 6 9 17l-5-5"/>', clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    arch: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    open: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    read: '<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    all: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    tugas: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    kerja: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    tagihan: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
    proyek: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    agenda: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    chev: '<path d="m9 18 6-6-6-6"/>', calc: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18m-9 3.5 2 2 3.5-3.5"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>'
  };
  var CATS = [['all', 'Semua', '#5b8cff'], ['tugas', 'Tugas', '#3b82f6'], ['kerja', 'Pekerjaan', '#f5a524'], ['tagihan', 'Tagihan', '#ef7d3b'], ['proyek', 'Proyek', '#18b57a'], ['agenda', 'Agenda', '#e5589b']];
  var TILE = { tugas: '#22b573', kerja: '#f59e0b', tagihan: '#ef7d3b', proyek: '#f5b82e', agenda: '#ef5b5b' };
  var CC = {}; CATS.forEach(function (c) { CC[c[0]] = c; });

  /* ---------- status inbox (baca / bintang / arsip / tunda) ---------- */
  var S = (function () { var o; try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { } o = o && typeof o === 'object' ? o : {}; ['read', 'star', 'gone', 'snz'].forEach(function (k) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; }); return o; })();
  var saveS = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

  /* ---------- akses data modul (objek hidup, disimpan oleh modulnya sendiri) ---------- */
  var STORES = { task: 'mo-task-v1', cal: 'mo-cal-v1', work: 'mo-work-v1', org: 'mo-org-v1', proj: 'mo-proj-v1', goal: 'mo-goal-v1', acad: 'mo-acad-v1' };
  var FB = {};   /* cadangan bila objek hidup belum ada (jarang) */
  function data(sk) {
    if (sk === 'acad') { if (MO.acadData) return MO.acadData.D(); }
    else { var ap = MO.apps && MO.apps[STORES[sk]]; if (ap) return ap.D; }
    if (!FB[sk]) { try { FB[sk] = JSON.parse(localStorage.getItem(STORES[sk])) || {}; } catch (e) { FB[sk] = {}; } }
    return FB[sk];
  }
  function persist(sk) {
    if (sk === 'acad' && MO.acadData) return MO.acadData.save();
    var ap = MO.apps && MO.apps[STORES[sk]]; if (ap) return ap.save();
    try { localStorage.setItem(STORES[sk], JSON.stringify(FB[sk])); } catch (e) { }
  }
  function locate(it) { return (data(it.sk)[it.arr] || []).filter(function (x) { return x.id === it.id; })[0]; }
  function patch(it, ch) {
    var rec = locate(it); if (!rec) return null;
    var snap = {}, had = {};
    Object.keys(ch).forEach(function (k) { had[k] = Object.prototype.hasOwnProperty.call(rec, k); snap[k] = rec[k]; rec[k] = ch[k]; });
    persist(it.sk);
    return function () { var r = locate(it); if (!r) return; Object.keys(ch).forEach(function (k) { if (had[k]) r[k] = snap[k]; else delete r[k]; }); persist(it.sk); };
  }

  /* ---------- kumpulkan semua yang perlu ditindaklanjuti ---------- */
  function collect() {
    var td = today(), out = [];
    function add(o) {
      var p = parse(o.date), diff = p ? dayDiff(p.d, td) : null;
      if (diff !== null) { if (diff > (o.win || HORIZON)) return; if (o.up && diff < 0) return; }
      else if (!o.undated) return;
      o.k = o.sk + ':' + o.id + (o.sub ? ':' + o.sub : '');
      o.d = p ? p.d : ''; o.t = p ? p.t : ''; o.diff = diff;
      o.ts = p ? new Date(+p.d.slice(0, 4), +p.d.slice(5, 7) - 1, +p.d.slice(8, 10), p.t ? +p.t.slice(0, 2) : 23, p.t ? +p.t.slice(3, 5) : 59).getTime() : 0;
      out.push(o);
    }
    var T = data('task').task || [], C = data('cal'), A = data('acad'), W = data('work'), O = data('org'), P = data('proj'), G = data('goal');
    var done = function () { return { status: 'Done', doneAt: today() }; }, sel = function (s) { return function () { return { status: s }; }; };

    T.forEach(function (t) {
      if (fin(t.status) || t.parentId || !t.due) return;
      var kind = t.kind || 'todo', date = t.due + (t.dueTime ? 'T' + t.dueTime : '');
      var sn = [t.category, t.priority === 'High' ? 'Prioritas tinggi' : ''].filter(Boolean).join(' · ');
      if (kind === 'event') {
        if (t.confirmed) return;
        add({ sk: 'task', arr: 'task', id: t.id, cat: 'agenda', mod: 'Agenda', title: t.title, snip: (sn ? sn + ' · ' : '') + 'Belum dikonfirmasi', route: '#task', date: date, win: EVT_DAYS, up: 1, dkey: 'due', comp: function () { return { confirmed: true }; }, cl: 'Konfirmasi' });
      } else add({ sk: 'task', arr: 'task', id: t.id, cat: kind === 'project' ? 'proyek' : 'tugas', mod: kind === 'project' ? 'Proyek' : 'Task', title: t.title, snip: sn || (kind === 'project' ? 'Proyek di Task' : 'To-do belum selesai'), route: '#task', date: date, dkey: 'due', comp: done });
    });

    (C.ev || []).forEach(function (e) {
      if (e.tk || e.ax || !e.start || e.confirmed) return;
      var d = String(e.start).slice(0, 10), tm = e.allDay ? '' : (e.startTime || '');
      add({ sk: 'cal', arr: 'ev', id: e.id, cat: 'agenda', mod: 'Kalender', title: e.title, snip: [tm ? tm + (e.endTime ? '–' + e.endTime : '') : 'Seharian', e.location, 'Belum dikonfirmasi'].filter(Boolean).join(' · '), route: '#calendar', date: d + (tm ? 'T' + tm : ''), win: EVT_DAYS, up: 1, cal: 1, comp: function () { return { confirmed: true }; }, cl: 'Konfirmasi' });
    });

    var cs = {}; (A.course || []).forEach(function (c) { cs[c.id] = c; });
    (A.task || []).forEach(function (x) {
      if (fin(x.status) || x.done || !x.deadline) return;
      var c = cs[x.courseId];
      add({ sk: 'acad', arr: 'task', id: x.id, cat: 'tugas', mod: 'Tugas kuliah', title: x.title, snip: [c && c.name, x.type].filter(Boolean).join(' · ') || 'Tugas kuliah belum selesai', route: '#academic', tab: 'task', date: x.deadline, dkey: 'deadline', comp: sel('Selesai') });
    });
    (A.exam || []).forEach(function (x) {
      if (x.done || (x.score !== '' && x.score != null) || !x.date) return;
      var c = cs[x.courseId];
      add({ sk: 'acad', arr: 'exam', id: x.id, cat: 'agenda', mod: x.type === 'Presentasi' ? 'Presentasi' : 'Ujian', title: (x.type || 'Ujian') + (c ? ' — ' + c.name : ''), snip: [x.room, 'Persiapan ujian'].filter(Boolean).join(' · '), route: '#academic', tab: 'exam', date: x.date, up: 1, dkey: 'date', comp: function () { return { done: true }; } });
    });

    (W.job || []).forEach(function (j) {
      if (CANC.test(j.status || '')) return;
      if (!DONE.test(j.status || '')) add({ sk: 'work', arr: 'job', id: j.id, cat: 'kerja', mod: 'Pekerjaan', title: j.title, snip: [j.status, +j.income > 0 ? rp(j.income) : ''].filter(Boolean).join(' · ') || 'Pekerjaan berjalan', route: '#work', date: j.deadline, dkey: 'deadline', comp: sel('Selesai') });
      if (+j.income > 0 && j.incomeStatus === 'Sudah ditagih') add({ sk: 'work', arr: 'job', id: j.id, sub: 'pay', cat: 'tagihan', mod: 'Tagihan', title: 'Menunggu pembayaran · ' + j.title, snip: rp(j.income) + ' sudah ditagih, belum diterima', route: '#work', undated: 1, comp: function () { return { incomeStatus: 'Sudah diterima' }; }, cl: 'Sudah dibayar' });
      if (+j.income > 0 && j.incomeStatus === 'Belum ditagih' && /^(Selesai|Review)$/i.test(j.status || '')) add({ sk: 'work', arr: 'job', id: j.id, sub: 'inv', cat: 'tagihan', mod: 'Tagihan', title: 'Perlu ditagih · ' + j.title, snip: rp(j.income) + ' · pekerjaan ' + String(j.status).toLowerCase() + ', belum ditagih', route: '#work', undated: 1, comp: function () { return { incomeStatus: 'Sudah ditagih' }; }, cl: 'Sudah ditagih' });
    });
    (W.wtask || []).forEach(function (x) {
      if (fin(x.status) || !x.deadline) return;
      var j = (W.job || []).filter(function (q) { return q.id === x.jobId; })[0];
      add({ sk: 'work', arr: 'wtask', id: x.id, cat: 'kerja', mod: 'Tugas kerja', title: x.title, snip: (j && j.title) || 'Tugas kerja belum selesai', route: '#work', date: x.deadline, dkey: 'deadline', comp: sel('Selesai') });
    });
    (O.followup || []).forEach(function (f) {
      if (fin(f.status) || !f.due) return;
      add({ sk: 'org', arr: 'followup', id: f.id, cat: 'kerja', mod: 'Organisasi', title: f.task, snip: 'Tindak lanjut rapat · ' + (f.status || 'Belum'), route: '#organization', date: f.due, dkey: 'due', comp: sel('Selesai') });
    });

    (P.proj || []).forEach(function (p) {
      if (fin(p.status) || !p.target) return;
      add({ sk: 'proj', arr: 'proj', id: p.id, cat: 'proyek', mod: 'Proyek', title: p.name, snip: 'Target proyek · ' + (p.status || 'Berjalan'), route: '#project', date: p.target, dkey: 'target', comp: sel('Selesai') });
    });
    (P.ptask || []).forEach(function (x) {
      if (fin(x.status) || !x.due) return;
      var p = (P.proj || []).filter(function (q) { return q.id === x.projId; })[0];
      add({ sk: 'proj', arr: 'ptask', id: x.id, cat: 'proyek', mod: 'Tugas proyek', title: x.title, snip: (p && p.name) || 'Tugas proyek', route: '#project', date: x.due, dkey: 'due', comp: sel('Selesai') });
    });
    (P.ms || []).forEach(function (m) {
      if (m.done || !m.date) return;
      var p = (P.proj || []).filter(function (q) { return q.id === m.projId; })[0];
      add({ sk: 'proj', arr: 'ms', id: m.id, cat: 'proyek', mod: 'Milestone', title: m.title, snip: (p && p.name) || 'Milestone proyek', route: '#project', date: m.date, dkey: 'date', comp: function () { return { done: true, doneAt: today() }; }, cl: 'Tercapai' });
    });
    (G.goal || []).forEach(function (g) {
      if (fin(g.status) || !g.deadline) return;
      add({ sk: 'goal', arr: 'goal', id: g.id, cat: 'proyek', mod: 'Goal', title: g.name, snip: [g.horizon, g.status].filter(Boolean).join(' · ') || 'Goal', route: '#goal', date: g.deadline, dkey: 'deadline', comp: sel('Tercapai'), cl: 'Tercapai' });
    });
    return out;
  }

  /* ---------- keadaan tampilan ---------- */
  var st = { mode: 'inbox', cat: 'all', q: '', lim: PAGE, hid: false, sel: {}, busy: 0, dirty: 0, exp: {} };
  var ALL = [], VIS = [], HID = [];
  function classify() {
    var td = today(); ALL = collect(); VIS = []; HID = [];
    ALL.forEach(function (it) {
      var gone = S.gone[it.k], snz = S.snz[it.k];
      if (gone !== undefined && gone !== it.d) { delete S.gone[it.k]; gone = undefined; }   /* tanggal sumber berubah → muncul lagi */
      if (snz && snz <= td) { delete S.snz[it.k]; snz = undefined; }
      it.hid = gone !== undefined ? 'Diarsipkan' : snz ? 'Ditunda sampai ' + fd(snz) : '';
      it.unread = !S.read[it.k]; it.star = !!S.star[it.k];
      (it.hid ? HID : VIS).push(it);
    });
  }
  function grp(it) { return it.diff === null ? 'act' : it.diff < 0 ? 'late' : it.diff === 0 ? 'today' : 'next'; }
  var GR = { late: ['Terlambat', 0], today: ['Hari ini', 1], act: ['Perlu tindak lanjut', 2], next: ['Segera', 3] };
  function dateLabel(it) {
    if (it.diff === null) return { t: it.cat === 'tagihan' ? 'Tagihan' : '', c: 'act' };
    if (it.diff < 0) return { t: 'Lewat ' + (-it.diff) + ' hr', c: 'late' };
    if (it.diff === 0) return { t: it.t || 'Hari ini', c: 'today' };
    if (it.diff === 1) return { t: 'Besok' + (it.t ? ' ' + it.t : ''), c: 'soon' };
    return { t: fd(it.d) + (it.t ? ' ' + it.t : ''), c: it.diff <= 2 ? 'soon' : 'week' };
  }
  function listFor(arr) {
    var q = st.q.trim().toLowerCase();
    return arr.filter(function (it) { return (st.cat === 'all' || it.cat === st.cat) && (!q || (it.title + ' ' + it.snip + ' ' + it.mod).toLowerCase().indexOf(q) > -1); })
      .sort(function (a, b) { return (GR[grp(a)][1] - GR[grp(b)][1]) || ((b.star ? 1 : 0) - (a.star ? 1 : 0)) || (a.ts - b.ts) || a.title.localeCompare(b.title); });
  }
  var byK = function (k) { return ALL.filter(function (x) { return x.k === k; })[0]; };
  var selKeys = function () { return Object.keys(st.sel).filter(function (k) { return st.sel[k] && byK(k); }); };

  /* ---------- DOM ---------- */
  var ov, win, body, topEl, searchEl, selEl, tabsEl, snack, sheet, menu, built = 0, isOpen = false, snackT = 0, undoFns = null, suppress = 0;
  function build() {
    ov = D.createElement('div'); ov.className = 'ib-ov'; ov.hidden = true;
    ov.innerHTML =
      '<section class="ib-win" role="dialog" aria-modal="true" aria-label="Inbox"><div class="ib-glow" aria-hidden="true"></div>' +
      '<header class="ib-hd"><div class="ib-hero"><svg class="ib-logo" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-inbox"/></svg><div class="ib-ht"><h2 class="ib-h2">Inbox</h2><p class="ib-sub"></p></div></div>' +
      '<div class="ib-hb"><button class="ib-ib ib-sbtn" data-a="search" aria-label="Cari di Inbox">' + svg(IC.search) + '</button>' +
      '<button class="ib-ib" data-a="menu" aria-label="Opsi lainnya" aria-haspopup="menu">' + svg(IC.more) + '</button>' +
      '<button class="ib-ib ib-xb" data-a="close" aria-label="Tutup Inbox">' + svg(IC.x) + '</button></div></header>' +
      '<label class="ib-search" hidden>' + svg(IC.search) + '<input type="search" id="ibQ" placeholder="Telusuri di Inbox" autocomplete="off" spellcheck="false" aria-label="Telusuri di Inbox"></label>' +
      '<header class="ib-sel" hidden><button class="ib-ib" data-a="unsel" aria-label="Batalkan pilihan">' + svg(IC.x) + '</button><b class="ib-n"></b><span class="ib-sp"></span>' +
      '<button class="ib-ib" data-a="s-done" aria-label="Selesai" title="Selesai">' + svg(IC.check) + '</button>' +
      '<button class="ib-ib" data-a="s-resched" aria-label="Jadwalkan ulang" title="Jadwalkan ulang">' + svg(IC.clock) + '</button>' +
      '<button class="ib-ib" data-a="s-read" aria-label="Tandai dibaca" title="Tandai dibaca">' + svg(IC.read) + '</button>' +
      '<button class="ib-ib" data-a="s-arch" aria-label="Arsipkan" title="Arsipkan">' + svg(IC.arch) + '</button></header>' +
      '<nav class="ib-modes" role="tablist" aria-label="Tampilan">' +
      '<button class="ib-mode" role="tab" data-a="mode" data-m="inbox"><i></i>Inbox</button>' +
      '<button class="ib-mode" role="tab" data-a="mode" data-m="planner"><i></i>Smart Planner<em hidden></em></button>' +
      '<button class="ib-mode" role="tab" data-a="mode" data-m="insight"><i></i>Insight<em hidden></em></button>' +
      '<button class="ib-mode" role="tab" data-a="mode" data-m="activity"><i></i>Riwayat Aktivitas</button></nav>' +
      '<nav class="ib-tabs" role="tablist" aria-label="Kategori"></nav>' +
      '<div class="ib-body" tabindex="-1"></div>' +
      '<div class="ib-snack" hidden role="status" aria-live="polite"><span></span><button data-a="undo">Urungkan</button></div>' +
      '<div class="ib-menu" hidden role="menu"></div>' +
      '<div class="ib-sheet" hidden><div class="ib-sh-bg" data-a="sheet-x"></div><div class="ib-sh" role="dialog" aria-modal="true"></div></div></section>';
    D.body.appendChild(ov);
    win = ov.firstChild; body = ov.querySelector('.ib-body'); topEl = ov.querySelector('.ib-hd'); searchEl = ov.querySelector('.ib-search'); selEl = ov.querySelector('.ib-sel'); tabsEl = ov.querySelector('.ib-tabs');
    snack = ov.querySelector('.ib-snack'); sheet = ov.querySelector('.ib-sheet'); menu = ov.querySelector('.ib-menu');
    ov.addEventListener('click', onClick);
    ov.querySelector('#ibQ').addEventListener('input', function (e) { st.q = e.target.value; st.lim = PAGE; renderList(); });
    ov.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('ib-rc')) { e.preventDefault(); rowOpen(e.target.parentNode.dataset.k); } });
    swipe(); built = 1;
  }

  function renderHead() {
    var n = VIS.filter(function (it) { var g = grp(it); return g === 'late' || g === 'today'; }).length;
    ov.querySelector('.ib-sub').textContent = n ? n + ' perlu tindakan' : 'Semua beres';
  }
  function renderTabs() {
    if (st.mode !== 'inbox') return;
    var tot = {}; VIS.forEach(function (it) { tot[it.cat] = (tot[it.cat] || 0) + 1; tot.all = (tot.all || 0) + 1; });
    tabsEl.innerHTML = CATS.map(function (c) {
      return '<button role="tab" class="ib-tab" data-a="tab" data-c="' + c[0] + '" aria-selected="' + (st.cat === c[0]) + '" style="--tc:' + c[2] + '"><i></i><span>' + c[1] + '</span><em>' + (tot[c[0]] || 0) + '</em></button>';
    }).join('');
  }
  function rowHtml(it) {
    var dl = dateLabel(it), on = !!st.sel[it.k], cl = it.cl || 'Selesai', tc = TILE[it.cat] || '#4f7cff', rs = it.diff === null ? 'Tunda' : 'Jadwalkan ulang';
    return '<div class="ib-row' + (it.unread ? ' un' : '') + (on ? ' on' : '') + '" data-k="' + esc(it.k) + '">' +
      '<div class="ib-bg r">' + svg(IC.check) + '<span>' + esc(cl) + '</span></div><div class="ib-bg l"><span>' + rs + '</span>' + svg(IC.clock) + '</div>' +
      '<div class="ib-rc" role="button" tabindex="0" aria-label="' + esc(it.mod + ': ' + it.title) + '">' +
      '<span class="ib-tile" style="--c:' + tc + '">' + (on ? svg(IC.check) : svg(IC[it.cat])) + '</span>' +
      '<div class="ib-tx"><div class="ib-l1"><span class="ib-tag">' + esc(it.mod) + '</span>' + (dl.t ? '<span class="ib-dt c-' + dl.c + '">' + esc(dl.t) + '</span>' : '') + '</div><div class="ib-l2">' + esc(it.title) + '</div><div class="ib-l3">' + esc(it.snip) + '</div></div>' +
      '<div class="ib-act"><button data-a="done" title="' + esc(cl) + '" aria-label="' + esc(cl) + '">' + svg(IC.check) + '</button><button data-a="resched" title="' + rs + '" aria-label="' + rs + '">' + svg(IC.clock) + '</button><button data-a="open" title="Buka sumber" aria-label="Buka sumber" class="go">' + svg(IC.chev) + '</button></div></div></div>';
  }
  function hidRowHtml(it) {
    return '<div class="ib-row hr" data-k="' + esc(it.k) + '"><div class="ib-rc"><span class="ib-tile" style="--c:' + (TILE[it.cat] || '#4f7cff') + '">' + svg(IC[it.cat]) + '</span><div class="ib-tx"><div class="ib-l1"><span class="ib-tag">' + esc(it.mod) + '</span></div><div class="ib-l2">' + esc(it.title) + '</div><div class="ib-l3">' + esc(it.hid) + '</div></div><button class="ib-rs" data-a="restore">Kembalikan</button></div></div>';
  }
  function renderList() {
    if (!built || st.mode !== 'inbox') return;
    var top = body.scrollTop, h = '', q = st.q.trim().toLowerCase();
    var arr = st.hid ? HID.slice().sort(function (a, b) { return a.ts - b.ts; }).filter(function (it) { return (st.cat === 'all' || it.cat === st.cat) && (!q || (it.title + ' ' + it.mod).toLowerCase().indexOf(q) > -1); }) : listFor(VIS);
    arr = arr.slice(0, 300);
    if (st.hid) h += '<div class="ib-note"><b>Diarsipkan &amp; ditunda</b><button data-a="hidx">Kembali ke Inbox</button></div>';
    else if (!S.hint && VIS.length) h += '<div class="ib-hint"><span>Ketuk kartu untuk membuka sumbernya. Ketuk <b>✓</b> = selesai, <b>jam</b> = jadwal ulang. Geser kartu atau tekan lama untuk pilih beberapa.</span><button data-a="hint" aria-label="Tutup petunjuk">' + svg(IC.x) + '</button></div>';
    if (!arr.length) {
      h += '<div class="ib-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-inbox"/></svg><b>' + (st.q ? 'Tidak ada hasil' : st.hid ? 'Tidak ada yang disembunyikan' : 'Semua beres!') + '</b><p>' + (st.q ? 'Coba kata kunci lain.' : st.hid ? 'Item yang diarsipkan atau ditunda muncul di sini.' : 'Tidak ada yang perlu ditindaklanjuti di kategori ini.') + '</p></div>';
    } else if (st.hid) {
      arr.forEach(function (it) { h += hidRowHtml(it); });
    } else {
      var by = {}; arr.forEach(function (it) { (by[grp(it)] = by[grp(it)] || []).push(it); });
      ['late', 'today', 'act', 'next'].forEach(function (g) {
        var list = by[g]; if (!list) return;
        var ex = !!st.exp[g] || !!q, shown = ex ? list : list.slice(0, GLIM);
        h += '<section class="ib-grp g-' + g + '"><div class="ib-gh"><span class="ib-gi">' + svg(IC.calc) + '</span><b>' + GR[g][0] + '</b><em>' + list.length + '</em><span class="ib-sp"></span>' +
          (list.length > GLIM && !q ? '<button class="ib-gl" data-a="gexp" data-g="' + g + '">' + (ex ? 'Ringkas' : 'Lihat semua') + svg(IC.chev) + '</button>' : '') + '</div>';
        shown.forEach(function (it) { h += rowHtml(it); });
        h += '</section>';
      });
    }
    if (!st.hid && HID.length) h += '<button class="ib-foot" data-a="hidv">Diarsipkan &amp; ditunda (' + HID.length + ')</button>';
    body.innerHTML = h; if (top) body.scrollTop = top;
  }
  function renderBar() {
    if (st.mode !== 'inbox') return;
    var n = selKeys().length; topEl.hidden = !!n; selEl.hidden = !n; if (n) selEl.querySelector('.ib-n').textContent = n + ' dipilih';
    ov.classList.toggle('selmode', !!n);
  }
  var HOST = { go: function (r, tab, acad) { goRoute(r, tab, acad); }, mode: function (m) { setMode(m); }, toast: function (m, u) { toast(m, u); } };
  function renderModes() {
    ov.classList.toggle('sm-on', st.mode !== 'inbox');
    var c = null; if (MO.smart) { try { c = MO.smart.counts(); } catch (e) { } }
    ov.querySelectorAll('.ib-mode').forEach(function (b) {
      var m = b.dataset.m, on = m === st.mode; b.setAttribute('aria-selected', on);
      if (on && b.scrollIntoView) { try { var bx = b.parentNode; bx.scrollLeft = Math.max(0, b.offsetLeft - (bx.clientWidth - b.offsetWidth) / 2); } catch (e) { } }
      var em = b.querySelector('em'); if (!em) return;
      var n = c ? (m === 'planner' ? c.sess : c.crit + c.warn) : 0; em.hidden = !n; em.textContent = n; em.className = m === 'insight' && c && c.crit ? 'hot' : '';
    });
  }
  function mountSmart() {
    topEl.hidden = false; selEl.hidden = true; ov.classList.remove('selmode'); searchEl.hidden = true;
    if (st.mode === 'activity') { if (MO.activity) MO.activity.mount(body, HOST); else body.innerHTML = '<div class="ib-empty"><b>Riwayat belum termuat</b><p>Muat ulang halaman.</p></div>'; return; }
    if (MO.smart) MO.smart.mount(body, st.mode, HOST); else body.innerHTML = '<div class="ib-empty"><b>Planner belum termuat</b><p>Muat ulang halaman.</p></div>';
  }
  function unmountExt() { if (MO.smart) MO.smart.unmount(); if (MO.activity) MO.activity.unmount(); }
  function setMode(m) {
    if (!built || (m !== 'inbox' && m !== 'planner' && m !== 'insight' && m !== 'activity')) m = 'inbox';
    if (m === st.mode && isOpen) { render(); return; }
    if (st.mode !== 'inbox') unmountExt();
    st.mode = m; st.sel = {}; if (m === 'inbox') body.scrollTop = 0; render(); if (m !== 'inbox') body.scrollTop = 0;
  }
  function render() {
    if (!built) return; classify(); renderHead(); renderModes();
    if (st.mode !== 'inbox') { mountSmart(); return; }
    renderTabs(); renderBar(); renderList();
  }

  /* ---------- badge di tombol header ---------- */
  var lastN = -1;
  function badge() {
    var n = VIS.filter(function (it) { return it.unread; }).length;
    if (dot) {
      dot.classList.add('n'); dot.hidden = !n; dot.textContent = n > 99 ? '99+' : n; dot.setAttribute('aria-label', n + ' belum dibaca');
      if (lastN >= 0 && n > lastN) { dot.classList.remove('bump'); void dot.offsetWidth; dot.classList.add('bump'); }
    }
    btn.title = n ? 'Inbox · ' + n + ' belum dibaca' : 'Inbox'; btn.setAttribute('aria-label', n ? 'Inbox, ' + n + ' belum dibaca' : 'Inbox');
    lastN = n;
  }
  var rt = 0;
  function refresh(force) {
    if (isOpen && (st.busy || ov.querySelector('.ib-row.drag'))) { st.dirty = 1; return; }
    if (isOpen) render(); else { classify(); }
    badge(); st.dirty = 0;
  }
  function soon() { clearTimeout(rt); rt = setTimeout(function () { if (!D.hidden) refresh(); }, 250); }

  /* ---------- aksi ---------- */
  function toast(msg, undo) {
    if (!built) return; clearTimeout(snackT); undoFns = undo || null;
    snack.querySelector('span').textContent = msg; snack.querySelector('button').hidden = !undo; snack.hidden = false; snack.classList.remove('in'); void snack.offsetWidth; snack.classList.add('in');
    snackT = setTimeout(function () { snack.hidden = true; undoFns = null; }, undo ? 6500 : 2600);
  }
  function after(msg, fns, keepSel) {
    fns = fns.filter(Boolean); if (!keepSel) st.sel = {};
    st.dirty = 0; classify(); badge();
    if (isOpen) { renderTabs(); renderBar(); renderList(); toast(msg, fns.length ? fns : null); }
  }
  function markRead(k, v) { if (v === false) delete S.read[k]; else S.read[k] = 1; }
  function actDone(its) {
    var fns = [], n = 0, miss = 0;
    its.forEach(function (it) { var u = patch(it, it.comp()); if (u) { fns.push(u); n++; markRead(it.k); } else miss++; });
    saveS(); after(n ? (n > 1 ? n + ' item ' : '') + (its.length === 1 && its[0].cl ? its[0].cl.toLowerCase() : 'selesai') + (miss ? ' · ' + miss + ' tidak ditemukan' : '') : 'Sumber tidak ditemukan', n ? fns.concat(function () { saveS(); }) : []);
  }
  function setDate(its, nd) {
    var fns = [], n = 0;
    its.forEach(function (it) {
      if (it.dkey || it.cal) {
        var rec = locate(it); if (!rec) return;
        var ch = {};
        if (it.cal) { var s = String(rec.start || ''), delta = dayDiff(nd, s.slice(0, 10)); ch.start = nd + s.slice(10); if (rec.end) { var e = String(rec.end); ch.end = addDay(e.slice(0, 10), delta) + e.slice(10); } }
        else ch[it.dkey] = nd + String(rec[it.dkey] || '').slice(10);
        var u = patch(it, ch); if (u) { fns.push(u); n++; }
      } else { var had = S.snz[it.k]; S.snz[it.k] = nd; fns.push(function () { if (had) S.snz[it.k] = had; else delete S.snz[it.k]; saveS(); }); n++; }
      markRead(it.k);
    });
    saveS(); closeSheet();
    after(n ? (its[0].dkey || its[0].cal ? 'Dijadwalkan ulang ke ' : 'Ditunda sampai ') + fdw(nd) : 'Sumber tidak ditemukan', fns);
  }
  function actArch(its) {
    var fns = []; its.forEach(function (it) { var had = S.gone[it.k]; S.gone[it.k] = it.d; markRead(it.k); fns.push(function () { if (had !== undefined) S.gone[it.k] = had; else delete S.gone[it.k]; saveS(); }); });
    saveS(); after(its.length > 1 ? its.length + ' item diarsipkan' : 'Diarsipkan', fns);
  }
  function actRead(its) {
    var all = its.every(function (it) { return !it.unread; });
    its.forEach(function (it) { markRead(it.k, all ? false : true); }); saveS(); after(all ? 'Ditandai belum dibaca' : 'Ditandai dibaca', []);
  }
  function openSheet(its) {
    var dated = its.some(function (it) { return it.dkey || it.cal; }), sh = sheet.querySelector('.ib-sh'), td = today(), opts = [];
    if (dated) opts.push(['Hari ini', td]);
    opts.push(['Besok', addDay(td, 1)], ['Lusa', addDay(td, 2)], ['Minggu depan', addDay(td, 7)]);
    sh.innerHTML = '<div class="ib-grab"></div><h3>' + (dated ? 'Jadwalkan ulang ke' : 'Tunda sampai') + '</h3><p>' + (its.length > 1 ? its.length + ' item dipilih' : esc(its[0].title)) + '</p>' +
      opts.map(function (o) { return '<button class="ib-opt" data-a="pickd" data-d="' + o[1] + '"><span>' + o[0] + '</span><small>' + fdw(o[1]) + '</small></button>'; }).join('') +
      '<label class="ib-opt ib-cus"><span>Pilih tanggal…</span><input type="date" min="' + td + '" value="' + addDay(td, 3) + '" data-a="cus" aria-label="Pilih tanggal"></label>';
    sheet._its = its.map(function (x) { return x.k; }); st.busy = 1; sheet.hidden = false;
  }
  function closeSheet() { if (sheet) { sheet.hidden = true; sheet._its = null; } st.busy = 0; }
  function sheetItems() { return (sheet._its || []).map(byK).filter(Boolean); }

  function rowOpen(k) {
    var it = byK(k); if (!it) return;
    if (selKeys().length) { st.sel[k] = !st.sel[k]; renderBar(); renderList(); return; }
    markRead(k); saveS(); go(it);
  }
  function go(it) {
    if (it.sk === 'acad' && MO.acadData && MO.acadData.focus) { try { MO.acadData.focus(it.arr, it.id); } catch (e) { } }   /* v5.2: buka kampus pemilik item */
    goRoute(it.route, it.tab || 'task', it.sk === 'acad');
  }
  function goRoute(route, tab, acad) {
    var r = MO.routes && MO.routes[route], ac = (acad || route === '#academic') && MO.acadGo;
    if (!r && !ac) { toast('Menu belum tersedia'); return; }
    window.__cuSkip = Date.now() + 1800; if (window.__bsJump) window.__bsJump();
    hide(); classify(); badge();
    if (ac) MO.acadGo(tab || 'dash'); else r();
  }

  function onClick(e) {
    if (suppress > Date.now()) { e.preventDefault(); return; }
    if (!menu.hidden && !e.target.closest('.ib-menu') && !e.target.closest('[data-a="menu"]')) menu.hidden = true;
    var b = e.target.closest('[data-a]'), row = e.target.closest('.ib-row'), k = row && row.dataset.k, it = k && byK(k), a = b && b.dataset.a;
    if (!a) { if (it && !row.classList.contains('hr')) { if (e.shiftKey || e.ctrlKey || e.metaKey) { st.sel[k] = !st.sel[k]; renderBar(); return renderList(); } rowOpen(k); } return; }
    if (a === 'cus') return;
    e.stopPropagation();
    switch (a) {
      case 'close': return hide();
      case 'mode': return setMode(b.dataset.m);
      case 'search': searchEl.hidden = !searchEl.hidden; if (!searchEl.hidden) { var qi = ov.querySelector('#ibQ'); try { qi.focus(); } catch (x) { } } else { st.q = ''; ov.querySelector('#ibQ').value = ''; renderList(); } return;
      case 'gexp': st.exp[b.dataset.g] = !st.exp[b.dataset.g]; return renderList();
      case 'menu': return openMenu();
      case 'tab': st.cat = b.dataset.c; st.lim = PAGE; renderTabs(); renderList(); body.scrollTop = 0; return;
      case 'more': st.lim += 60; return renderList();
      case 'hint': S.hint = 1; saveS(); return renderList();
      case 'hidv': st.hid = true; st.lim = PAGE; renderList(); body.scrollTop = 0; return;
      case 'hidx': st.hid = false; st.lim = PAGE; renderList(); return;
      case 'undo': var f = undoFns; undoFns = null; snack.hidden = true; if (f) { f.slice().reverse().forEach(function (fn) { try { fn(); } catch (x) { } }); saveS(); classify(); badge(); renderTabs(); renderList(); } return;
      case 'unsel': st.sel = {}; renderBar(); return renderList();
      case 's-done': return actDone(selKeys().map(byK));
      case 's-resched': return openSheet(selKeys().map(byK));
      case 's-read': return actRead(selKeys().map(byK));
      case 's-arch': return actArch(selKeys().map(byK));
      case 'sheet-x': return closeSheet();
      case 'pickd': return setDate(sheetItems(), b.dataset.d);
      case 'm-allread': menu.hidden = true; VIS.forEach(function (x) { S.read[x.k] = 1; }); saveS(); return after('Semua ditandai dibaca', []);
      case 'm-hid': menu.hidden = true; st.hid = true; st.lim = PAGE; return renderList();
      case 'm-ref': menu.hidden = true; refresh(); return toast('Disegarkan');
    }
    if (!it) return;
    if (a === 'pick') { st.sel[k] = !st.sel[k]; renderBar(); return renderList(); }
    if (a === 'star') { if (S.star[k]) delete S.star[k]; else S.star[k] = 1; saveS(); it.star = !it.star; return renderList(); }
    if (a === 'done') return rowOut(row, function () { actDone([it]); });
    if (a === 'resched') return openSheet([it]);
    if (a === 'open') { markRead(k); saveS(); return go(it); }
    if (a === 'arch') return rowOut(row, function () { actArch([it]); });
    if (a === 'restore') { delete S.gone[k]; delete S.snz[k]; saveS(); classify(); badge(); renderTabs(); renderList(); return toast('Dikembalikan ke Inbox'); }
  }
  D.addEventListener('change', function (e) { var t = e.target; if (t && t.dataset && t.dataset.a === 'cus' && ov && ov.contains(t) && t.value) setDate(sheetItems(), t.value); });
  function rowOut(row, fn) { if (!row) return fn(); row.classList.add('out'); setTimeout(fn, 190); }
  function openMenu() {
    menu.innerHTML = '<button role="menuitem" data-a="m-allread">' + svg(IC.read) + 'Tandai semua dibaca</button><button role="menuitem" data-a="m-hid">' + svg(IC.arch) + 'Diarsipkan &amp; ditunda (' + HID.length + ')</button><button role="menuitem" data-a="m-ref">' + svg(IC.refresh) + 'Segarkan</button>';
    menu.hidden = !menu.hidden;
  }

  /* ---------- geser (kanan = selesai, kiri = jadwal ulang) & tekan lama = pilih ---------- */
  function swipe() {
    var sw = null;
    function reset(animate) {
      if (!sw) return; clearTimeout(sw.lp); var rc = sw.rc, row = sw.row;
      rc.style.transition = animate ? 'transform .18s cubic-bezier(.2,.8,.3,1)' : ''; rc.style.transform = '';
      row.classList.remove('drag', 'r', 'l', 'arm'); setTimeout(function () { rc.style.transition = ''; }, 200); sw = null;
    }
    body.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' || sw) return;
      var rc = e.target.closest('.ib-rc'); if (!rc || rc.parentNode.classList.contains('hr') || e.target.closest('.ib-act')) return;
      sw = { rc: rc, row: rc.parentNode, x: e.clientX, y: e.clientY, dx: 0, lock: 0, id: e.pointerId };
      sw.lp = setTimeout(function () { if (!sw || sw.lock) return; var k = sw.row.dataset.k; suppress = Date.now() + 600; if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) { } reset(); st.sel[k] = !st.sel[k]; renderBar(); renderList(); }, 480);
    });
    body.addEventListener('pointermove', function (e) {
      if (!sw || e.pointerId !== sw.id) return;
      var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (!sw.lock) {
        if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
        if (Math.abs(dx) > 9 || Math.abs(dy) > 9) clearTimeout(sw.lp);
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) { sw.lock = 1; sw.row.classList.add('drag'); try { sw.rc.setPointerCapture(e.pointerId); } catch (x) { } } else return;
      }
      sw.dx = dx; sw.rc.style.transform = 'translate3d(' + dx + 'px,0,0)';
      sw.row.classList.toggle('r', dx > 0); sw.row.classList.toggle('l', dx < 0); sw.row.classList.toggle('arm', Math.abs(dx) > THR);
    });
    function end(e) {
      if (!sw || e.pointerId !== sw.id) return; clearTimeout(sw.lp);
      var s = sw, dx = s.dx, k = s.row.dataset.k;
      if (!s.lock) { sw = null; return; }
      suppress = Date.now() + 350;
      if (e.type === 'pointercancel' || Math.abs(dx) <= THR) return reset(true);
      var it = byK(k); sw.rc.style.transition = 'transform .16s ease-out'; sw.rc.style.transform = 'translate3d(' + (dx > 0 ? 110 : -110) + '%,0,0)';
      setTimeout(function () { reset(); if (!it) return; if (dx > 0) { s.row.classList.add('out'); setTimeout(function () { actDone([it]); }, 120); } else openSheet([it]); }, 120);
    }
    body.addEventListener('pointerup', end); body.addEventListener('pointercancel', end);
    body.addEventListener('contextmenu', function (e) { if (e.target.closest('.ib-rc') && root.classList.contains('touch')) e.preventDefault(); });
  }

  /* ---------- buka / tutup ---------- */
  function show(m) {
    if (!built) build();
    var n = D.getElementById('notif'); if (n) n.classList.remove('open');
    var p = D.getElementById('panel'); if (p) p.classList.remove('open');
    st.mode = (m === 'planner' || m === 'insight' || m === 'activity') ? m : 'inbox'; st.cat = 'all'; st.q = ''; st.exp = {}; searchEl.hidden = true; st.lim = PAGE; st.hid = false; st.sel = {}; st.busy = 0; ov.querySelector('#ibQ').value = '';
    sheet.hidden = true; menu.hidden = true; snack.hidden = true;
    /* bersihkan sisa status untuk item yang sudah tidak ada */
    classify(); var keep = {}; ALL.forEach(function (x) { keep[x.k] = 1; });
    ['read', 'star', 'gone', 'snz'].forEach(function (m) { Object.keys(S[m]).forEach(function (k) { if (!keep[k]) delete S[m][k]; }); }); saveS();
    root.classList.add('win-open'); isOpen = true; btn.setAttribute('aria-expanded', 'true');
    render(); ov.hidden = false; badge(); body.scrollTop = 0;
    requestAnimationFrame(function () { var x = ov.querySelector('.ib-ib'); if (x && !ov.hidden) try { x.focus({ preventScroll: true }); } catch (e) { } });
  }
  function hide() {
    if (!built || !isOpen) return; isOpen = false; unmountExt(); closeSheet(); menu.hidden = true; st.sel = {}; btn.setAttribute('aria-expanded', 'false');
    ov.hidden = true; clearTimeout(snackT); undoFns = null;
  }
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#inboxBtn'); if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault(); isOpen ? hide() : show();
  }, true);
  D.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen) return;
    if (MO.smart && MO.smart.sheetOpen()) return;
    /* tidak menghentikan event: pengelola kunci scroll milik aplikasi ikut mendengar Esc untuk melepas kunci */
    if (!sheet.hidden) { closeSheet(); return; }
    if (!menu.hidden) { menu.hidden = true; return; }
    if (selKeys().length) { st.sel = {}; renderBar(); renderList(); return; }
    hide();
  }, true);

  /* ---------- sinkron otomatis ---------- */
  try {
    var _set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k) { var r = _set.apply(this, arguments); if (/^mo-/.test(k) && k !== KEY && k !== 'mo-fired' && k !== 'mo-smart-v1' && k !== 'mo-activity-v1') soon(); return r; };
  } catch (e) { }
  window.addEventListener('storage', soon); window.addEventListener('focus', soon);
  D.addEventListener('visibilitychange', function () { if (!D.hidden) refresh(); });
  setInterval(function () { if (!D.hidden && !st.busy) refresh(); }, 30000);
  setTimeout(function () { refresh(); }, 500); refresh();
  window.BeresinInbox = { refresh: refresh, open: function (m) { if (isOpen) setMode(m || 'inbox'); else show(m); }, close: hide, items: function () { return VIS; } };
})();
