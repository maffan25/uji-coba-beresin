/* =====================================================================
   COSMOS v2 — manajer latar (Angkasa / Pixel), sapaan glitch, bounce klik.
   Ringan: sprite dipra-render, 30 fps (20 fps di mode hemat), berhenti
   saat tab tersembunyi atau jendela modul terbuka. Tanpa dependensi.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var TAU = Math.PI * 2;
  var S = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  };
  var MO = window.MyOffice = window.MyOffice || {};

  /* ================= Mode hemat ================= */
  var lite = S.get('mo-lite');
  if (lite === null) lite = ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) ? '1' : '0';
  function setLite(v, save) {
    lite = v ? '1' : '0'; root.dataset.lite = lite;
    if (save) S.set('mo-lite', lite);
    var b = $('liteBtn'); if (b) b.setAttribute('aria-checked', lite === '1');
    if (cur && cur.resize) cur.resize();          // jumlah bintang menyesuaikan
  }
  root.dataset.lite = lite;

  /* ================= Manajer engine ================= */
  var cv = $('cosmos'), ctx = cv && cv.getContext('2d');
  var engines = {}, cur = null, curName = '', raf = 0, last = 0, slow = 0, nFrames = 0;
  MO.cosmos = {
    register: function (name, eng) { engines[name] = eng; if (root.dataset.wall === name) select(); },
    cv: cv, ctx: ctx, reduce: reduce, rand: rand, TAU: TAU,
    isLite: function () { return lite === '1'; },
    setLite: setLite
  };

  function paused() { return document.hidden || document.body.style.overflow === 'hidden'; }

  function loop(now) {
    if (!cur) { raf = 0; return; }                 // tanpa engine: hentikan loop (hemat CPU)
    raf = requestAnimationFrame(loop);
    if (paused()) { last = now; return; }
    var step = lite === '1' ? 50 : 33;
    if (now - last < step - 2) return;
    var dt = Math.min(.06, (now - last) / 1000); last = now;
    var t0 = performance.now();
    cur.frame(now, dt);
    // pengaman: jika perangkat lambat, otomatis pindah ke mode hemat
    if (lite !== '1') {
      var cost = performance.now() - t0;
      slow += cost > 14 ? 1 : -1; if (slow < 0) slow = 0;
      if (++nFrames > 90 && slow > 60) setLite(true, false);
    }
  }

  function select() {
    var name = root.dataset.wall, e = engines[name] || null;
    if (e === cur) return;
    if (cur && cur.stop) cur.stop();
    cur = e; curName = name;
    if (!cv) return;
    cv.classList.remove('ready', 'px');
    if (cur) {
      cur.start();
      if (!raf && !reduce) raf = requestAnimationFrame(loop);
      if (reduce) cur.frame(performance.now(), 0);
      requestAnimationFrame(function () { cv.classList.add('ready'); });
    }
  }
  if (cv) {
    new MutationObserver(select).observe(root, { attributes: true, attributeFilter: ['data-wall'] });
    var rt; window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { if (cur && cur.resize) { cur.resize(); if (reduce) cur.frame(performance.now(), 0); } }, 160);
    });
  }


  /* ================= Sapaan glitch ================= */
  var gl = $('glitch'), greet = $('greet'), src = $('hiName'), dotsBox = $('greetDots');
  var GLYPH = '!<>-_\\/[]{}=+*^?#%&01';
  var idx = -1, current = '', busy = false, holdTimer = 0, dots = [];

  function dayWord() {
    var h = new Date().getHours();
    return h < 4 ? 'Selamat dini hari' : h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  }
  function phrases() {
    var raw = (src && src.textContent || 'Assalamu’alaikum,').trim().replace(/,\s*$/, '');
    var m = raw.match(/^Assalamu’alaikum,?\s*(.*)$/), name = m ? m[1].trim() : '';
    var pix = false;
    return [raw, 'Semangat hari ini!', dayWord() + (name ? ', ' + name : ''),
      pix ? 'Ayo lari, jangan lompat sendiri' : 'Siap meluncur?', 'Selamat datang di Beresin', 'Plan · Execute · Achieve'];
  }
  function setText(t) { gl.textContent = t; gl.setAttribute('data-text', t); }

  function scramble(to, done) {
    if (reduce) { setText(to); current = to; return done && done(); }
    busy = true;
    var from = current, len = Math.max(from.length, to.length), t0 = performance.now(), dur = 600 + len * 8, lastDraw = 0;
    gl.classList.add('on'); greet.classList.remove('scan'); void greet.offsetWidth; greet.classList.add('scan');
    (function step(now) {
      if (now - lastDraw < 42 && now - t0 < dur) return requestAnimationFrame(step);   // ±24 gambar/detik cukup
      lastDraw = now;
      var p = Math.min(1, (now - t0) / dur), out = '';
      for (var i = 0; i < len; i++) {
        var b = to.charAt(i), lock = (i / len) * .8 + .1;
        if (p >= lock + .12) out += b;
        else if (b === ' ' && from.charAt(i) === ' ') out += ' ';
        else out += GLYPH.charAt((Math.random() * GLYPH.length) | 0);
      }
      if (p > .9) out = out.slice(0, to.length);
      setText(out);
      if (p < 1) requestAnimationFrame(step);
      else { setText(to); current = to; busy = false; setTimeout(function () { gl.classList.remove('on'); }, 140); done && done(); }
    })(t0);
  }
  function mark(i) { dots.forEach(function (d, k) { d.classList.toggle('on', k === i); }); }
  function next() {
    clearTimeout(holdTimer);
    if (document.documentElement.classList.contains('win-open')) { holdTimer = setTimeout(next, 1500); return; }
    var list = phrases();
    if (dots.length !== list.length && dotsBox) {
      dotsBox.innerHTML = ''; dots = list.map(function () { var d = document.createElement('i'); dotsBox.appendChild(d); return d; });
    }
    idx = (idx + 1) % list.length; mark(idx);
    scramble(list[idx], function () { holdTimer = setTimeout(next, 3800); });
  }
  function micro() {                               // glitch kilat sesekali saat teks ditahan
    setTimeout(micro, rand(4000, 8000));
    if (reduce || lite === '1' || busy || document.hidden || paused()) return;
    gl.classList.add('on'); setTimeout(function () { if (!busy) gl.classList.remove('on'); }, 180);
  }
  if (gl && greet) {
    greet.addEventListener('click', function () { if (!busy) next(); });
    setTimeout(function () { current = ''; next(); setTimeout(micro, 3000); }, 380);
  }

  /* Efek klik (tekan + riak + pantul) ditangani fx.js — duplikat di sini dihapus. */

  var lb = $('liteBtn');
  if (lb) { lb.setAttribute('aria-checked', lite === '1'); lb.addEventListener('click', function () { setLite(lite !== '1', true); }); }

  select();
})();
;
/* =====================================================================
   HUD — Pencarian cepat (Ctrl/Cmd+K atau "/") dan panel Pengingat.
   Membaca data nyata dari localStorage semua modul. Dimuat sebelum
   academic.js supaya klik tombol Cari/Notifikasi tidak jatuh ke
   toast "Coming soon" lama.
   ===================================================================== */
(function () {
  'use strict';
  var MO = window.MyOffice = window.MyOffice || {}; MO.routes = MO.routes || {};
  var $ = function (id) { return document.getElementById(id); };
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var cut = function (v, n) { return String(v || '').slice(0, n); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addD(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function diffD(a, b) { return Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 864e5); }
  function fmt(s) { try { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); } catch (e) { return s; } }
  var DONE = /^(Selesai|Done|Tercapai)$/, CANC = /^(Dibatalkan|Archived)$/;

  /* ---------- Kumpulkan data dari semua modul ---------- */
  function gather() {
    var out = [], A = ls('mo-acad-v1'), W = ls('mo-work-v1'), O = ls('mo-org-v1'), P = ls('mo-proj-v1'), T = ls('mo-task-v1'), G = ls('mo-goal-v1'), Cal = ls('mo-cal-v1');
    var put = function (mod, route, title, status, due) { if (title) out.push({ mod: mod, route: route, title: String(title), status: status || '', due: cut(due, 10) }); };
    (T.task || []).forEach(function (t) { put('Task', '#task', t.title, t.status, t.due); });
    (A.task || []).forEach(function (t) { put('Tugas kuliah', '#academic', t.title, t.status, t.deadline); });
    (A.course || []).forEach(function (c) { put('Mata kuliah', '#academic', c.name, '', ''); });
    (A.exam || []).forEach(function (e) {
      var c = (A.course || []).filter(function (x) { return x.id === e.courseId; })[0], done = e.score !== '' && e.score != null;
      put('Ujian', '#academic', (e.type || 'Ujian') + (c ? ' — ' + c.name : ''), done ? 'Selesai' : 'Belum', e.date);
    });
    (W.job || []).forEach(function (j) { put('Pekerjaan', '#work', j.title, j.status, j.deadline); });
    (W.wtask || []).forEach(function (t) { put('Tugas kerja', '#work', t.title, t.status, t.deadline); });
    (O.followup || []).forEach(function (f) { put('Organisasi', '#organization', f.task, f.status, f.due); });
    (P.proj || []).forEach(function (p) { put('Proyek', '#project', p.name, p.status, p.target); });
    (P.ptask || []).forEach(function (t) { put('Tugas proyek', '#project', t.title, t.status, t.due); });
    (G.goal || []).forEach(function (g) { put('Goal', '#goal', g.name, g.status, g.deadline); });
    (Cal.ev || []).forEach(function (e) { put('Kalender', '#calendar', e.title, '', e.start); });
    return out;
  }
  function open_(route) { if (MO.routes[route]) MO.routes[route](); else if (MO.msg) MO.msg('Menu', 'Belum tersedia'); }

  var navItems = function () {
    return [].map.call(document.querySelectorAll('.nav a'), function (a) {
      var u = a.querySelector('use');
      return { title: a.textContent.replace(/\s+/g, ' ').trim(), route: a.getAttribute('href'), icon: u ? u.getAttribute('href') : '#i-doc' };
    });
  };
  var svg = function (id) { return '<svg class="ic" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="' + id + '"/></svg>'; };

  /* ================= Pencarian ================= */
  var ov, input, list, sel = 0, rows = [], prevOverflow = '';
  function buildSearch() {
    ov = document.createElement('div'); ov.className = 'sp-ov'; ov.hidden = true;
    ov.innerHTML = '<div class="sp" role="dialog" aria-modal="true" aria-label="Pencarian">' +
      '<div class="sp-in">' + svg('#i-search') + '<input type="text" id="spIn" placeholder="Cari menu, tugas, proyek, goal…" autocomplete="off" spellcheck="false" aria-label="Cari"><kbd>Esc</kbd></div>' +
      '<div class="sp-list" id="spList" role="listbox"></div>' +
      '<div class="sp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> pilih</span><span><kbd>Enter</kbd> buka</span><span><kbd>Esc</kbd> tutup</span></div></div>';
    document.body.appendChild(ov);
    input = ov.querySelector('input'); list = ov.querySelector('.sp-list');
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeSearch(); });
    input.addEventListener('input', function () { sel = 0; render(); });
    list.addEventListener('mousemove', function (e) { var r = e.target.closest('.sp-r'); if (r) { sel = +r.dataset.i; paint(); } });
    list.addEventListener('click', function (e) { var r = e.target.closest('.sp-r'); if (r) pick(+r.dataset.i); });
  }
  function mark(text, q) {
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.split(/\s+/)[0]);
    if (i < 0 || !q.split(/\s+/)[0]) return esc(text);
    var L = q.split(/\s+/)[0].length;
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + L)) + '</mark>' + esc(text.slice(i + L));
  }
  function render() {
    var q = input.value.trim().toLowerCase(), toks = q ? q.split(/\s+/) : [], td = ymd(new Date());
    var menu = navItems().filter(function (m) { var h = m.title.toLowerCase(); return toks.every(function (t) { return h.indexOf(t) >= 0; }); });
    var data = gather(), hit;
    if (toks.length) {
      hit = data.filter(function (d) { var h = (d.title + ' ' + d.mod).toLowerCase(); return toks.every(function (t) { return h.indexOf(t) >= 0; }); })
        .sort(function (a, b) { return (a.title.toLowerCase().indexOf(toks[0]) === 0 ? 0 : 1) - (b.title.toLowerCase().indexOf(toks[0]) === 0 ? 0 : 1); });
    } else {                                           // kosong: tampilkan yang paling mendesak
      hit = data.filter(function (d) { return d.due && d.due >= td && !DONE.test(d.status) && !CANC.test(d.status); })
        .sort(function (a, b) { return a.due.localeCompare(b.due); });
    }
    hit = hit.slice(0, 8);
    rows = menu.slice(0, toks.length ? 6 : 11).map(function (m) { return { g: 'Menu', title: m.title, sub: '', route: m.route, icon: m.icon }; })
      .concat(hit.map(function (d) { return { g: toks.length ? 'Data' : 'Mendatang', title: d.title, sub: d.mod + (d.due ? ' · ' + fmt(d.due) : '') + (d.status ? ' · ' + d.status : ''), route: d.route, icon: '#i-task' }; }));
    var html = '', lastG = '';
    if (!rows.length) html = '<div class="sp-empty">Tidak ada hasil untuk “' + esc(input.value.trim()) + '”.<small>Coba kata kunci lain, misalnya nama tugas atau modul.</small></div>';
    rows.forEach(function (r, i) {
      if (r.g !== lastG) { html += '<div class="sp-g">' + r.g + '</div>'; lastG = r.g; }
      html += '<button type="button" class="sp-r" role="option" data-i="' + i + '" style="--i:' + i + '">' + svg(r.icon) +
        '<span class="sp-t"><b>' + mark(r.title, q) + '</b>' + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span><i class="sp-go" aria-hidden="true">Buka</i></button>';
    });
    list.innerHTML = html; paint();
  }
  function paint() {
    [].forEach.call(list.querySelectorAll('.sp-r'), function (r) {
      var on = +r.dataset.i === sel; r.classList.toggle('on', on); r.setAttribute('aria-selected', on);
      if (on) { var t = r.offsetTop, b = t + r.offsetHeight; if (t < list.scrollTop) list.scrollTop = t - 30; else if (b > list.scrollTop + list.clientHeight) list.scrollTop = b - list.clientHeight + 8; }
    });
  }
  function pick(i) { var r = rows[i]; if (!r) return; closeSearch(); setTimeout(function () { open_(r.route); }, 60); }
  function openSearch() {
    closeNotif(); if (!ov) buildSearch();
    prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ov.hidden = false; input.value = ''; sel = 0; render(); input.focus();
  }
  function closeSearch() { if (!ov || ov.hidden) return; ov.hidden = true; document.body.style.overflow = prevOverflow; }

  /* ================= Pengingat ================= */
  var np, npOpen = false;
  function buildNotif() {
    np = document.createElement('section'); np.className = 'np'; np.hidden = true; np.setAttribute('role', 'dialog'); np.setAttribute('aria-label', 'Pengingat');
    np.innerHTML = '<header><div><b>Pengingat</b><small id="npSub"></small></div></header><div class="np-body" id="npBody"></div>' +
      '<footer><button type="button" class="np-all">Buka status semua kegiatan</button></footer>';
    document.body.appendChild(np);
    np.addEventListener('click', function (e) {
      var it = e.target.closest('.np-i'); if (it) { var r = it.dataset.r; closeNotif(); setTimeout(function () { open_(r); }, 60); return; }
      if (e.target.closest('.np-all')) { closeNotif(); setTimeout(function () { open_('#settings'); }, 60); }
    });
  }
  function groups() {
    var td = ymd(new Date()), lim = addD(td, 3), L = [], T = [], S = [];
    gather().forEach(function (d) {
      if (!d.due || DONE.test(d.status) || CANC.test(d.status) || d.mod === 'Mata kuliah') return;
      if (d.due < td) L.push(d); else if (d.due === td) T.push(d); else if (d.due <= lim) S.push(d);
    });
    var by = function (a, b) { return a.due.localeCompare(b.due); };
    return { late: L.sort(by), today: T, soon: S.sort(by), td: td };
  }
  function rel(d, td) { var n = diffD(d, td); return n < 0 ? 'Terlambat ' + (-n) + ' hari' : n === 0 ? 'Hari ini' : n === 1 ? 'Besok' : n + ' hari lagi'; }
  function renderNotif() {
    var g = groups(), total = g.late.length + g.today.length + g.soon.length, i = 0, html = '';
    $('npSub').textContent = total ? total + ' perlu perhatian' : 'Semua terkendali';
    [['late', 'Lewat tenggat', g.late], ['today', 'Hari ini', g.today], ['soon', '3 hari ke depan', g.soon]].forEach(function (s) {
      if (!s[2].length) return;
      html += '<div class="np-g ' + s[0] + '">' + s[1] + '<i>' + s[2].length + '</i></div>';
      s[2].forEach(function (d) {
        html += '<button type="button" class="np-i ' + s[0] + '" data-r="' + esc(d.route) + '" style="--i:' + (i++) + '"><span class="np-bar"></span><span class="np-t"><b>' + esc(d.title) + '</b><small>' + esc(d.mod) + ' · ' + fmt(d.due) + '</small></span><em>' + rel(d.due, g.td) + '</em></button>';
      });
    });
    if (!total) html = '<div class="np-empty"><b>Tidak ada tenggat mendesak</b><small>Tugas, ujian, dan acara yang jatuh tempo dalam 3 hari akan muncul di sini.</small></div>';
    $('npBody').innerHTML = html;
  }
  function openNotif() {
    closeSearch(); if (!np) buildNotif(); renderNotif(); np.hidden = false; npOpen = true;
    var b = document.querySelector('.tools button[aria-label="Notifikasi"]'); if (b) b.setAttribute('aria-expanded', 'true');
  }
  function closeNotif() {
    if (!np || np.hidden) return; np.hidden = true; npOpen = false;
    var b = document.querySelector('.tools button[aria-label="Notifikasi"]'); if (b) b.setAttribute('aria-expanded', 'false');
  }
  function badge() {
    return; /* angka lonceng kini dikelola revisi5.js */
    var g = groups(), n = g.late.length + g.today.length, d = document.querySelector('.tools .dot');
    if (!d) return;
    d.classList.add('n'); d.hidden = !n; d.textContent = n > 9 ? '9+' : n; d.setAttribute('aria-label', n + ' pengingat');
  }

  /* ---------- Pengait ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.tools button');
    if (b) {
      var lab = b.getAttribute('aria-label');
      if (lab === 'Cari') { e.preventDefault(); e.stopImmediatePropagation(); openSearch(); return; }
      if (lab === 'Notifikasi') { e.preventDefault(); e.stopImmediatePropagation(); npOpen ? closeNotif() : openNotif(); return; }
    }
    if (npOpen && np && !np.contains(e.target)) closeNotif();
  }, true);

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName) || (e.target && e.target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ov && !ov.hidden ? closeSearch() : openSearch(); return; }
    if (e.key === '/' && !typing && !(ov && !ov.hidden)) { e.preventDefault(); openSearch(); return; }
    if (ov && !ov.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSearch(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(rows.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      return;
    }
    if (npOpen && e.key === 'Escape') { e.stopPropagation(); closeNotif(); }
  }, true);

  badge(); setInterval(badge, 30000);
  window.addEventListener('focus', badge);
  MO.hud = { badge: badge, search: openSearch };
})();
;
/* MyOffice — Academic Management (data tersimpan di localStorage perangkat) */
(function () {
  'use strict';
  var KEY = 'mo-acad-v1';
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var has = function (v) { return v !== '' && v != null && !isNaN(+v); };
  var fmt = function (n) { return n == null ? '—' : String(Math.round(n * 100) / 100); };
  var fdate = function (v, t) {
    if (!v) return '—';
    var d = new Date(v); if (isNaN(d)) return v;
    return d.toLocaleString('id-ID', t === 'd' ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  /* ---------- Data ---------- */
  function seed() {
    return {
      cfg: {
        confirmed: false, normalize: true,
        scale: [{ l: 'A', min: 85, p: 4 }, { l: 'A-', min: 80, p: 3.7 }, { l: 'B+', min: 75, p: 3.3 }, { l: 'B', min: 70, p: 3 },
          { l: 'B-', min: 65, p: 2.7 }, { l: 'C+', min: 60, p: 2.3 }, { l: 'C', min: 55, p: 2 }, { l: 'D', min: 40, p: 1 }, { l: 'E', min: 0, p: 0 }],
        cats: [{ n: 'Tugas', w: 30 }, { n: 'Kuis', w: 10 }, { n: 'UTS', w: 25 }, { n: 'UAS', w: 35 },
          { n: 'Presentasi', w: 0 }, { n: 'Ujian lisan', w: 0 }, { n: 'Ujian praktik', w: 0 }]
      },
      sem: [{ id: uid(), name: 'Ganjil 2026/2027', target: '', notes: '', active: true }],
      course: [], task: [], exam: [], study: []
    };
  }
  /* ===== v5.2 KAMPUS (awal) =====
     RAW = seluruh data (format lama tetap: cfg/sem/course/task/exam/study berisi SEMUA kampus, jadi Kalender/Inbox/Planner tetap membaca utuh),
           ditambah campuses[] dan campusSel. Semester membawa campusId; mata kuliah -> semester; tugas/ujian/belajar -> mata kuliah.
     D   = tampilan KAMPUS TERPILIH saja (objek kerja seperti sebelumnya, jadi seluruh kode Academic di bawah tidak perlu diubah).
     Rumus nilai (cfg), IP, IPK, dan analisis dihitung dari D sehingga tiap kampus terpisah. */
  var RAW; try { RAW = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!RAW || !RAW.cfg) RAW = seed(); else (function (S) { for (var k in S) if (RAW[k] === undefined) RAW[k] = S[k]; })(seed());
  var MAIN = 'main', CKEYS = ['sem', 'course', 'task', 'exam', 'study'], D, REST;
  CKEYS.forEach(function (k) { if (!Array.isArray(RAW[k])) RAW[k] = []; });
  if (!Array.isArray(RAW.campuses)) RAW.campuses = [];
  RAW.campuses = [{ id: MAIN, name: (RAW.campuses.filter(function (c) { return c && c.id === MAIN; })[0] || {}).name || 'Kampus utama' }]
    .concat(RAW.campuses.filter(function (c) { return c && c.id && c.id !== MAIN; }));
  var campById = function (id) { return RAW.campuses.filter(function (c) { return c.id === id; })[0]; };
  var semCamp = function (s) { return s && s.campusId && campById(s.campusId) ? s.campusId : MAIN; };
  /* pisahkan data: d = milik kampus id, r = milik kampus lain (objek record sama, bukan salinan) */
  function split(id) {
    var d = { sem: [], course: [], task: [], exam: [], study: [] }, r = { sem: [], course: [], task: [], exam: [], study: [] }, sc = {}, cc = {};
    RAW.sem.forEach(function (s) { var c = semCamp(s); sc[s.id] = c; (c === id ? d : r).sem.push(s); });
    RAW.course.forEach(function (x) { var c = sc[x.semId] || MAIN; cc[x.id] = c; (c === id ? d : r).course.push(x); });
    ['task', 'exam', 'study'].forEach(function (k) { RAW[k].forEach(function (x) { ((cc[x.courseId] || MAIN) === id ? d : r)[k].push(x); }); });
    return { d: d, r: r };
  }
  function campCfg(id) { var cp = campById(id); if (id === MAIN) return RAW.cfg; if (cp && !cp.cfg) cp.cfg = seed().cfg; return cp ? cp.cfg : seed().cfg; }
  function scopeTo(id) {
    if (!campById(id)) id = MAIN;
    RAW.campusSel = id;
    var sp = split(id); sp.d.cfg = campCfg(id); D = sp.d; REST = sp.r;
  }
  function commit() {
    CKEYS.forEach(function (k) { RAW[k] = REST[k].concat(D[k]); });
    if (RAW.campusSel === MAIN) RAW.cfg = D.cfg; else { var cp = campById(RAW.campusSel); if (cp) cp.cfg = D.cfg; }
  }
  scopeTo(RAW.campusSel);
  function save() { commit(); try { localStorage.setItem(KEY, JSON.stringify(RAW)); } catch (e) { msg('Peringatan', 'Data tidak bisa disimpan di browser ini.'); } }
  /* ===== v5.2 KAMPUS (akhir) ===== */
  var by = function (arr, id) { return arr.filter(function (x) { return x.id === id; })[0]; };
  var cname = function (id) { var c = by(D.course, id); return c ? c.name : '—'; };

  /* ---------- Perhitungan (sepenuhnya mengikuti konfigurasi) ---------- */
  var TASKTYPES = ['Tugas', 'Proyek', 'Laporan', 'Kuis', 'Presentasi', 'Lainnya'];
  var EXAMTYPES = ['UTS', 'UAS', 'Kuis', 'Presentasi', 'Ujian lisan', 'Ujian praktik'];
  function catOf(type) { return D.cfg.cats.some(function (c) { return c.n === type; }) ? type : 'Tugas'; }
  function scored(cid) {
    var o = [];
    D.task.forEach(function (t) { if (t.courseId === cid && has(t.score)) o.push({ c: catOf(t.type), s: +t.score, w: +t.weight > 0 ? +t.weight : 1 }); });
    D.exam.forEach(function (e) { if (e.courseId === cid && has(e.score)) o.push({ c: e.type, s: +e.score, w: +e.weight > 0 ? +e.weight : 1 }); });
    return o;
  }
  function finalScore(c) {
    if (has(c.manual)) return +c.manual;
    if (!D.cfg.confirmed) return null;
    var it = scored(c.id), num = 0, den = 0, all = 0;
    D.cfg.cats.forEach(function (k) {
      var w = +k.w || 0; all += w;
      var xs = it.filter(function (i) { return i.c === k.n; });
      if (!xs.length || !w) return;
      var sw = 0, ss = 0; xs.forEach(function (i) { sw += i.w; ss += i.s * i.w; });
      num += w * (ss / sw); den += w;
    });
    if (!den) return null;
    return D.cfg.normalize ? num / den : num / (all || 100);
  }
  function letter(s) {
    if (s == null || !D.cfg.confirmed) return null;
    var sc = D.cfg.scale.slice().sort(function (a, b) { return b.min - a.min; });
    return sc.filter(function (r) { return s >= r.min; })[0] || null;
  }
  function ip(cs) {
    var a = 0, b = 0;
    cs.forEach(function (c) { var L = letter(finalScore(c)), k = +c.sks || 0; if (L && k) { a += L.p * k; b += k; } });
    return b ? a / b : null;
  }
  var ptOf = function (l) { var r = D.cfg.scale.filter(function (x) { return x.l === l; })[0]; return r ? r.p : null; };

  /* ---------- Skema form ---------- */
  var activeSems = function (cur) {
    return [['', '— Pilih semester aktif —']].concat(D.sem.filter(function (s) { return s.active || s.id === cur; })
      .map(function (s) { return [s.id, s.name + (s.active ? '' : ' (tidak aktif)')]; }));
  };
  var courseOpts = function () { return [['', '— Pilih mata kuliah —']].concat(D.course.map(function (c) { return [c.id, c.name]; })); };
  var opt = function (a) { return a.map(function (x) { return [x, x]; }); };
  var SPEC = {
    sem: {
      title: 'Semester', def: { active: true }, fields: [
        { k: 'name', l: 'Semester', t: 'text', ph: 'Ganjil 2026/2027', req: 1, full: 1 },
        { k: 'target', l: 'Target IP semester', t: 'number', step: '0.01', min: 0, max: 4 },
        { k: 'active', l: 'Status semester', t: 'select', bool: 1, o: [['true', 'Aktif'], ['false', 'Tidak aktif']] },
        { k: 'notes', l: 'Catatan semester', t: 'textarea', full: 1 }]
    },
    course: {
      title: 'Mata Kuliah', def: {}, fields: [
        { k: 'name', l: 'Nama mata kuliah', t: 'text', req: 1, full: 1 },
        { k: 'code', l: 'Kode mata kuliah', t: 'text' },
        { k: 'sks', l: 'Jumlah SKS', t: 'number', min: 0, step: '1' },
        { k: 'lecturer', l: 'Nama dosen', t: 'text', full: 1 },
        { k: 'schedule', l: 'Jadwal', t: 'text', ph: 'Senin 08:00–09:40' },
        { k: 'room', l: 'Ruangan / tautan kelas', t: 'text', ph: 'R.204 atau https://…' },
        { k: 'semId', l: 'Semester (hanya semester aktif)', t: 'select', req: 1, o: activeSems, full: 1 },
        { k: 'targetGrade', l: 'Target nilai (huruf)', t: 'select', o: function () { return [['', '—']].concat(D.cfg.scale.map(function (r) { return [r.l, r.l]; })); } },
        { k: 'manual', l: 'Nilai akhir manual (0–100, opsional)', t: 'number', min: 0, max: 100 },
        { k: 'logo', l: 'Logo mata kuliah', t: 'logo', full: 1 },
        { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }]
    },
    task: {
      title: 'Tugas', def: { status: 'Belum dikerjakan', priority: 'Sedang', type: 'Tugas' }, fields: [
        { k: 'title', l: 'Judul tugas', t: 'text', req: 1, full: 1 },
        { k: 'courseId', l: 'Mata kuliah', t: 'select', o: courseOpts, req: 1 },
        { k: 'type', l: 'Jenis tugas', t: 'select', o: opt(TASKTYPES) },
        { k: 'desc', l: 'Deskripsi', t: 'textarea', full: 1 },
        { k: 'deadline', l: 'Deadline', t: 'datetime-local' },
        { k: 'status', l: 'Status', t: 'select', o: opt(['Belum dikerjakan', 'Sedang dikerjakan', 'Selesai']) },
        { k: 'priority', l: 'Prioritas', t: 'select', o: opt(['Rendah', 'Sedang', 'Tinggi']) },
        { k: 'score', l: 'Nilai (jika ada)', t: 'number', min: 0, max: 100 },
        { k: 'weight', l: 'Bobot nilai (jika diketahui)', t: 'number', min: 0 },
        { k: 'link', l: 'Tautan / lampiran', t: 'url', ph: 'https://…' },
        { k: 'notes', l: 'Catatan pengerjaan', t: 'textarea', full: 1 }]
    },
    exam: {
      title: 'Ujian', def: { type: 'UTS' }, fields: [
        { k: 'type', l: 'Jenis ujian', t: 'select', o: opt(EXAMTYPES), req: 1 },
        { k: 'courseId', l: 'Mata kuliah', t: 'select', o: courseOpts, req: 1 },
        { k: 'date', l: 'Tanggal & waktu', t: 'datetime-local' },
        { k: 'room', l: 'Ruangan / tautan', t: 'text' },
        { k: 'topics', l: 'Materi ujian', t: 'textarea', full: 1 },
        { k: 'score', l: 'Nilai (jika ada)', t: 'number', min: 0, max: 100 },
        { k: 'weight', l: 'Bobot nilai (jika diketahui)', t: 'number', min: 0 },
        { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }]
    },
    study: {
      title: 'Waktu Belajar', def: { minutes: 60 }, fields: [
        { k: 'courseId', l: 'Mata kuliah', t: 'select', o: courseOpts, req: 1, full: 1 },
        { k: 'date', l: 'Tanggal', t: 'date', req: 1 },
        { k: 'minutes', l: 'Durasi (menit)', t: 'number', min: 1, step: '1', req: 1 },
        { k: 'notes', l: 'Catatan', t: 'text', full: 1 }]
    }
  };

  /* ---------- DOM dasar (tema Academy dashboard) ---------- */
  function el(cls, html) { var d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; }
  var cpEl, ov, body, sideEl, subEl, hiEl, dotEl, tab = 'dash', tf = 'Semua', ef = 'Semua', cf = 'Semua', rng = 'Hari ini', q = '', draft = null;
  var T0 = new Date(), cal = { y: T0.getFullYear(), m: T0.getMonth() }, sel = today();
  var TABS = [['dash', 'Dashboard', 'dash'], ['course', 'Mata Kuliah', 'book'], ['trk', 'Jejak Semester', 'route'], ['sem', 'Semester', 'cal'], ['task', 'Tugas', 'task'],
    ['exam', 'Ujian', 'exam'], ['exam2', 'Exam', 'quiz'], ['fokus', 'Fokus Belajar', 'clock'], ['ana', 'Analitik', 'chart'], ['cfg', 'Formula Nilai', 'set']];
  var PAGE = { course: 'Mata Kuliah', trk: 'Jejak Semester', sem: 'Semester', task: 'Tugas', exam: 'Ujian', exam2: 'Exam', fokus: 'Fokus Belajar', ana: 'Analitik', cfg: 'Formula Nilai' };
  var PALETTE = ['#ffe24a', '#cfe6ff', '#ffd3d3', '#d6f0c4', '#e4d8ff', '#ffe0bd', '#c9f0e8'];
  var ICO = {
    dash: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    task: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    exam: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    set: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    quiz: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 9h8M8 13h4"/><circle cx="16.5" cy="16.5" r="2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    pen: '<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    l: '<path d="m15 18-6-6 6-6"/>', r: '<path d="m9 18 6-6-6-6"/>',
    route: '<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8"/>',
    flag: '<path d="M5 22V4M5 4h11l-2 4 2 4H5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    up: '<path d="M7 17 17 7M8 7h9v9"/>', down: '<path d="M17 7 7 17M16 17H7V8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', flat: '<path d="M5 12h14"/>'
  };
  function ic(n) { return '<svg class="ad-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[n] + '</svg>'; }
  var MARK = '<svg class="ad-mk" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="9" height="9" rx="2.5" fill="#1e1b3a"/><rect x="13" y="2" width="9" height="9" rx="2.5" fill="#ffe24a"/><rect x="2" y="13" width="9" height="9" rx="2.5" fill="#ffe24a"/><rect x="13" y="13" width="9" height="9" rx="2.5" fill="#1e1b3a"/></svg>';
  var prof = function () { try { return JSON.parse(localStorage.getItem('mo-settings-v1')) || {}; } catch (e) { return {}; } };
  var ipf = function (v) { return v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2); };
  var fshort = function (v) {
    if (!v) return '—'; var d = new Date(v); if (isNaN(d)) return v;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + (String(v).length > 10 ? ', ' + pad2(d.getHours()) + '.' + pad2(d.getMinutes()) : '');
  };
  var pad2 = function (n) { return ('0' + n).slice(-2); };
  var dstr = function (y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); };
  var DAYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

  function build() {
    ov = el('ad-ov', '<section class="ad-win" role="dialog" aria-modal="true" aria-label="Academic Management">' +
      '<aside class="ad-nav"><div class="ad-logo">' + MARK + '<span><small>BERESIN</small><b>ACADEMY</b></span></div>' +
      '<nav class="ad-menu" aria-label="Menu Academic">' + TABS.map(function (t) {
        return '<button class="ad-nl" data-act="tab" data-t="' + t[0] + '">' + ic(t[2]) + '<span>' + t[1] + '</span>' + (t[0] === 'task' ? '<span class="ad-bdg" id="acBdg" hidden></span>' : '') + '</button>';
      }).join('') + '</nav>' +
      '<button class="ad-nl ad-closeNav" data-act="close">' + ic('x') + '<span>Tutup</span></button>' +
      '<div class="ad-help"><i>?</i><b>Pusat bantuan</b><p>Bingung cara hitung nilai &amp; IP? Atur formula penilaian kampusmu.</p><button data-act="help">Atur formula</button></div></aside>' +
      '<div class="ad-main"><header class="ad-top"><div class="ad-hi"><h1 id="acHi"></h1><p id="acSub"></p></div>' +
      '<label class="ad-search">' + ic('search') + '<input id="acQ" type="search" placeholder="Cari mata kuliah, tugas, ujian…" aria-label="Cari" autocomplete="off"></label>' +
      '<button class="ad-ib" data-act="bell" aria-label="Pengingat">' + ic('bell') + '<i id="acDot" hidden></i></button>' +
      '<button class="ad-ib" data-act="close" aria-label="Tutup">' + ic('x') + '</button></header>' +
      '<div class="ad-cp" id="acCp"></div><div class="ad-body" id="acBody"></div></div>' +
      '<aside class="ad-side" id="acSide" aria-label="Profil dan jadwal"></aside></section>');
    ov.hidden = true; document.body.appendChild(ov);
    body = ov.querySelector('#acBody'); cpEl = ov.querySelector('#acCp'); sideEl = ov.querySelector('#acSide'); subEl = ov.querySelector('#acSub'); hiEl = ov.querySelector('#acHi'); dotEl = ov.querySelector('#acDot');
    ov.addEventListener('click', onClick);
    ov.addEventListener('scroll', stkOnScroll, true);   /* v6.1: scroll tidak menggelembung, jadi pakai capture */
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    var qt; ov.addEventListener('input', function (e) { if (e.target.id === 'acQ') { q = e.target.value.trim(); clearTimeout(qt); qt = setTimeout(renderBody, 140); } });
    ov.addEventListener('change', function (e) {
      if (e.target.id === 'acRng') { rng = e.target.value; renderBody(); }
      var ds = e.target.dataset || {};
      if (ds.act === 'mdate' || ds.act === 'tstart') {
        var c = by(D.course, ds.id); if (!c) return; var t = trk(c);
        if (ds.act === 'mdate') t.m[+ds.i].d = e.target.value; else t.start = e.target.value;
        save(); renderBody();
      }
    });
    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('role') === 'button') e.target.click();
    });
  }
  function warmLogos() { D.course.forEach(function (c) { if (c.logo) logoSrc(c); }); }   /* v4.8: semua logo dipersiapkan sebelum kartu (yang disaring Semua/Aktif/Selesai) muncul */
  function open() { if (!ov) build(); ov.hidden = false; document.body.style.overflow = 'hidden'; sel = today(); warmLogos(); render(); }
  function close() { if (ov) ov.hidden = true; document.body.style.overflow = ''; }

  /* ---------- Data turunan untuk dashboard ---------- */
  var colOf = function (c) { var i = D.course.indexOf(c); return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]; };
  /* v4.7: logo data-URL → blob URL (cache). HTML kecil, dan <img> yang dibuat ulang memakai URL sama sehingga tidak muncul belakangan */
  var LG = {};
  function logoSrc(c) {
    var u = c.logo; if (!u || u.indexOf('data:') !== 0 || !window.URL || !URL.createObjectURL) return u;
    var e = LG[c.id]; if (e && e.s === u) return e.u;
    try {
      var m = /^data:([^;,]+);base64,(.*)$/.exec(u); if (!m) return u;
      var bin = atob(m[2]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([arr], { type: m[1] })); LG[c.id] = { s: u, u: url };
      var im = new Image(); im.src = url; LG[c.id].im = im; if (im.decode) im.decode().catch(function () { });   /* v4.8: objek Image disimpan supaya hasil decode tidak dibuang */
      return url;
    } catch (x) { return u; }
  }
  function tile(c, cls) {
    return '<i class="ad-tile' + (cls ? ' ' + cls : '') + (c.logo ? ' has-logo' : '') + '" style="background:' + (c.logo ? '#fff' : colOf(c)) + '">' +
      (c.logo ? '<img src="' + esc(logoSrc(c)) + '" alt="" decoding="sync">' : esc(ini(c))) + '</i>';
  }
  function ini(c) {
    var s = (c.code || '').replace(/[^A-Za-z0-9]/g, '');
    if (s.length >= 2) return s.slice(0, 2).toUpperCase();
    var w = String(c.name || '?').trim().split(/\s+/);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] || '').charAt(1))).toUpperCase();
  }
  function prog(c) {
    var ts = D.task.filter(function (t) { return t.courseId === c.id; }), dn = ts.filter(function (t) { return t.status === 'Selesai'; }).length;
    return { n: ts.length, d: dn, p: ts.length ? Math.round(dn / ts.length * 100) : 0 };
  }
  function hrs(cid) {
    var m = D.study.filter(function (s) { return s.courseId === cid; }).reduce(function (a, s) { return a + (+s.minutes || 0); }, 0);
    return (Math.round(m / 6) / 10) + 'j';
  }
  var inActive = function (c) { var s = by(D.sem, c.semId); return !!(s && s.active); };
  function courseList() {
    return D.course.filter(function (c) {
      var p = prog(c);
      if (cf === 'Aktif') return inActive(c) && !(p.n && p.p === 100);
      if (cf === 'Selesai') return p.n > 0 && p.p === 100;
      return true;
    });
  }
  var pending = function () { return D.task.filter(function (t) { return t.status !== 'Selesai'; }); };
  var isLate = function (t) { return !!(t.deadline && t.status !== 'Selesai' && new Date(t.deadline) < new Date()); };
  function left(dl) {
    if (!dl) return '—';
    var ms = new Date(dl) - new Date(); if (isNaN(ms)) return '—';
    if (ms < 0) return '<span class="neg">Terlambat</span>';
    var m = Math.floor(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
    return d ? d + ' hari ' + h + ' jam' : h ? h + ' jam ' + (m % 60) + ' mnt' : (m % 60) + ' mnt';
  }
  function events() {
    var o = [];
    D.task.forEach(function (t) { if (t.deadline && t.status !== 'Selesai') o.push({ d: t.deadline.slice(0, 10), t: t.deadline.slice(11, 16), title: t.title, sub: cname(t.courseId) + ' · Tenggat tugas', k: 't' }); });
    D.exam.forEach(function (e) { if (e.date) o.push({ d: e.date.slice(0, 10), t: e.date.slice(11, 16), title: e.type + ' · ' + cname(e.courseId), sub: e.room || 'Ujian', k: 'e' }); });
    return o;
  }
  function classesOn(ds) {
    var wd = new Date(ds + 'T00:00:00').getDay(), o = [];
    D.course.forEach(function (c) {
      if (!inActive(c) || !c.schedule) return;
      var s = String(c.schedule).toLowerCase().replace(/['’`]/g, ''), i = s.indexOf(DAYS[wd]);
      if (i < 0) return;
      var m = s.slice(i).match(/(\d{1,2})[:.](\d{2})/);
      o.push({ d: ds, t: m ? pad2(m[1]) + ':' + m[2] : '', title: c.name, sub: (c.room ? c.room + ' · ' : '') + 'Kuliah', k: 'c' });
    });
    return o;
  }

  /* ---------- Render ---------- */
  function render() { renderNav(); renderBody(); renderSide(); }
  function renderNav() {
    var s = prof(), pn = pending().length, late = D.task.filter(isLate).length;
    ov.querySelectorAll('.ad-nl[data-t]').forEach(function (b) { if (b.dataset.t === tab && !q) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var bd = ov.querySelector('#acBdg'); bd.hidden = !pn; bd.textContent = pn > 99 ? '99+' : pn;
    dotEl.hidden = !late;
    hiEl.textContent = 'Halo, ' + (s.nick || 'Mahasiswa') + ' 👋';
    var act = D.sem.filter(function (x) { return x.active; }).map(function (x) { return x.name; });
    subEl.textContent = (RAW.campuses.length > 1 ? campById(RAW.campusSel).name + ' · ' : '') + (act.length ? 'Semester aktif: ' + act.join(', ') : 'Belum ada semester aktif');
    renderCamp();
  }
  function renderBody() {
    var top = body.scrollTop;
    ov.querySelectorAll('.ad-nl[data-t]').forEach(function (b) { if (b.dataset.t === tab && !q) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var v = q ? vSearch() : tab === 'dash' ? vDash() : '<div class="ad-sh"><h2 class="ad-h">' + PAGE[tab] + '</h2></div>' + ({ course: vCourse, trk: vTrk, sem: vSem, task: vTask, exam: vExam, exam2: function () { return MO.examView ? MO.examView() : ''; }, fokus: function () { return MO.studyView ? MO.studyView() : ''; }, ana: vAna, cfg: vCfg })[tab]();
    window.__morph(body, v); if (q) body.scrollTop = 0; else if (top) body.scrollTop = top;
    if (!q && tab === 'course') stkInit();   /* v6.1: pasang ulang posisi tumpukan kartu setelah render */
  }
  var warn = function () {
    return D.cfg.confirmed ? '' : '<div class="ac-warn"><span>Rumus nilai belum dikonfigurasi, jadi huruf mutu, IP, dan IPK belum dihitung. Atur skala nilai dan bobot sesuai kampus Anda.</span><button class="ac-btn sm" data-act="tab" data-t="cfg">Buka Formula Nilai</button></div>';
  };
  var btns = function (e, id) {
    return '<div class="ac-acts"><button class="ac-btn sm" data-act="edit" data-e="' + e + '" data-id="' + id + '">Edit</button><button class="ac-btn sm danger" data-act="del" data-e="' + e + '" data-id="' + id + '">Hapus</button></div>';
  };
  var empty = function (t) { return '<div class="ac-empty">' + t + '</div>'; };
  var link = function (v) { return /^https?:\/\//i.test(v || '') ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v.replace(/^https?:\/\//i, '').slice(0, 40)) + '</a>' : esc(v); };

  /* ---------- Dashboard ---------- */
  /* warna sampul per mata kuliah: [pekat, muda] */
  var CV = [['#d29512', '#fff0c2'], ['#2f7d6d', '#d6efe7'], ['#4a5fc1', '#dde4ff'], ['#c4566a', '#ffdfe4'], ['#7b5bc4', '#e9e0ff'], ['#d4752c', '#ffe4cd'], ['#5b9a3a', '#e0f2d0']];
  var cvOf = function (c) { var i = D.course.indexOf(c); return CV[(i < 0 ? 0 : i) % CV.length]; };
  function ring(p) {
    var C = 2 * Math.PI * 17;
    return '<span class="dv-ring" role="img" aria-label="Tugas selesai ' + p + ' persen"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="17"/><circle class="fg" cx="22" cy="22" r="17" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p / 100)).toFixed(1) + '"/></svg><b>' + p + '<small>%</small></b></span>';
  }
  /* selisih hari kalender (bukan jam) agar "Besok" benar walau tenggatnya pukul 23.59 */
  function rel(dl) {
    if (!dl) return { u: 'none', t: 'Tanpa tenggat', n: 99 };
    var d = new Date(dl); if (isNaN(d)) return { u: 'none', t: 'Tanpa tenggat', n: 99 };
    var a = new Date(); a.setHours(0, 0, 0, 0); var b = new Date(d); b.setHours(0, 0, 0, 0);
    var n = Math.round((b - a) / 864e5);
    if (d < new Date()) return { u: 'hot', t: 'Terlambat', n: -1 };
    if (n === 0) return { u: 'hot', t: 'Hari ini', n: 0 };
    if (n === 1) return { u: 'hot', t: 'Besok', n: 1 };
    return { u: n <= 3 ? 'warm' : 'cool', t: n + ' hari lagi', n: n };
  }
  var clock = function (v) { return v && String(v).length > 10 ? String(v).slice(11, 16).replace(':', '.') : ''; };
  function cCard(c, manage) {
    var p = prog(c), f = finalScore(c), L = letter(f), done = p.n > 0 && p.p === 100, v = cvOf(c);
    var lab = done ? 'Semua tugas selesai' : L ? 'Nilai ' + L.l + ' · ' + fmt(f) : p.n ? 'Sedang berjalan' : 'Belum ada tugas';
    var lc = done || L ? 'ok' : p.n ? 'blue' : 'mute';
    return '<div class="ad-cc dv-cv' + (done ? ' fin' : '') + '" style="--cv:' + v[0] + ';--cl:' + v[1] + '" role="button" tabindex="0" data-act="edit" data-e="course" data-id="' + c.id + '" aria-label="Edit ' + esc(c.name) + '">' +
      '<div class="dv-cap">' + tile(c) + '<span class="dv-code">' + esc(c.code || 'Tanpa kode') + '</span><span class="dv-sks">' + esc(c.sks || 0) + ' SKS</span></div>' +
      '<div class="dv-cb"><div class="dv-nm"><b>' + esc(c.name) + '</b><small>' + esc(c.lecturer || 'Dosen belum diisi') + '</small></div>' +
      '<div class="dv-st">' + ring(p.p) + '<div class="dv-sx"><div class="ad-lv ' + lc + '">' + lab + '</div>' +
      '<div class="dv-mt" title="Tugas selesai · jam belajar"><span>' + ic('check') + p.d + '/' + p.n + ' tugas</span><span>' + ic('clock') + hrs(c.id) + '</span></div></div></div>' +
      (c.schedule ? '<div class="dv-sc">' + ic('cal') + '<span>' + esc(c.schedule) + '</span></div>' : '') +
      (manage ? btns('course', c.id) : '') + '</div></div>';
  }
  function cTabs() {
    return '<div class="ad-t2"><div>' + ['Semua', 'Aktif', 'Selesai'].map(function (x) { return '<button class="t" data-act="cf" data-v="' + x + '" aria-pressed="' + (x === cf) + '">' + x + '</button>'; }).join('') + '</div>' +
      (tab === 'dash' ? '<button class="ad-more" data-act="tab" data-t="course">Lihat semua</button>' : '') + '</div>';
  }
  var addCard = '<button class="ad-add" data-act="add" data-e="course">' + ic('plus') + 'Tambah mata kuliah</button>';
  var PRI = { Tinggi: ['hi', 'up'], Sedang: ['mid', 'flat'], Rendah: ['lo', 'down'] };
  var PRIO = { Tinggi: 0, Sedang: 1, Rendah: 2 };

  /* panel fokus: tugas paling dekat + ringkasan angka */
  function focusPanel() {
    var P = pending().sort(function (a, b) { return (a.deadline || '9').localeCompare(b.deadline || '9'); }), t = P[0], late = D.task.filter(isLate).length, td = today();
    var ex = D.exam.filter(function (e) { return e.date && !e.done && e.date.slice(0, 10) >= td; }).sort(function (a, b) { return a.date.localeCompare(b.date); })[0];
    var exn = ex ? Math.round((new Date(ex.date.slice(0, 10)) - new Date(td)) / 864e5) : null;
    var wk = new Date(); wk.setDate(wk.getDate() - 6); var w0 = dstr(wk.getFullYear(), wk.getMonth(), wk.getDate());
    var mins = D.study.filter(function (s) { return s.date >= w0; }).reduce(function (a, s) { return a + (+s.minutes || 0); }, 0);
    var stats = '<div class="dv-stats"><div><b>' + P.length + '</b><small>Tugas aktif</small></div><div' + (late ? ' class="hot"' : '') + '><b>' + late + '</b><small>Terlambat</small></div>' +
      '<div><b>' + (exn == null ? '—' : exn === 0 ? 'Hari ini' : 'H-' + exn) + '</b><small>' + (ex ? esc(ex.type) + ' terdekat' : 'Ujian terdekat') + '</small></div><div><b>' + (Math.round(mins / 6) / 10) + 'j</b><small>Belajar 7 hari</small></div></div>';
    var main;
    if (!D.course.length) main = '<div class="dv-fm"><h3>Mulai dari mata kuliah pertamamu</h3><p>Tambahkan mata kuliah, lalu catat tugas dan ujiannya di sini.</p><div class="dv-fb"><button class="dv-go" data-act="add" data-e="course">' + ic('plus') + 'Tambah mata kuliah</button></div></div>';
    else if (!t) main = '<div class="dv-fm"><h3>Semua tugas sudah beres</h3><p>Tidak ada tenggat yang menunggu. Waktu yang pas untuk mengulang materi.</p><div class="dv-fb"><button class="dv-go" data-act="add" data-e="task">' + ic('plus') + 'Catat tugas baru</button></div></div>';
    else {
      var r = rel(t.deadline), c = by(D.course, t.courseId);
      main = '<div class="dv-fm"><div class="dv-cd ' + r.u + '"><span>' + r.t + '</span>' + (t.deadline ? '<small>' + fdate(t.deadline, 'd') + (clock(t.deadline) ? ', ' + clock(t.deadline) : '') + '</small>' : '') + '</div>' +
        '<h3>' + esc(t.title) + '</h3><p>' + esc(c ? c.name : '—') + ' · ' + esc(t.type) + '</p>' +
        '<div class="dv-fb"><button class="dv-go" data-act="done" data-id="' + t.id + '">' + ic('check') + 'Tandai selesai</button><button class="dv-gh" data-act="edit" data-e="task" data-id="' + t.id + '">Ubah jadwal</button></div></div>';
    }
    return '<section class="dv-hero" aria-label="Fokus berikutnya">' + main + stats + '</section>';
  }

  function railHtml(L) { return L.slice(0, 3).map(function (c) { return cCard(c); }).join('') + (L.length < 3 ? addCard : ''); }
  /* v4.7: pindah Semua/Aktif/Selesai hanya memperbarui pill + daftar kartu, bagian dashboard lain tidak disentuh */
  function renderCf() {
    warmLogos();
    if (q) return renderBody();
    var tabs = body.querySelector('.ad-t2'), L = courseList();
    if (!tabs) return renderBody();
    var rail = tab === 'dash' ? body.querySelector('.dv-rail') : null, grid = tab === 'course' && L.length ? body.querySelector('.ad-cg:not(.dv-rail)') : null;
    if (!rail && !grid) return renderBody();
    [].forEach.call(tabs.querySelectorAll('[data-act="cf"]'), function (b) { b.setAttribute('aria-pressed', b.dataset.v === cf ? 'true' : 'false'); });
    if (rail) {
      var sub = body.querySelector('#dvSub'); if (sub) sub.textContent = L.length + ' mata kuliah · ' + L.reduce(function (a, c) { return a + (+c.sks || 0); }, 0) + ' SKS';
      window.__morph(rail, railHtml(L)); rail.scrollLeft = 0;
    } else window.__morph(grid, L.map(function (c) { return cCard(c, true); }).join(''));
  }
  function vDash() {
    var h = warn(), L = courseList(), sks = L.reduce(function (a, c) { return a + (+c.sks || 0); }, 0);
    h += focusPanel();
    h += '<div class="ad-sh"><h2 class="ad-h">Mata Kuliah</h2><span class="dv-sub" id="dvSub">' + L.length + ' mata kuliah · ' + sks + ' SKS</span></div>' + cTabs();
    h += '<div class="ad-cg dv-rail">' + railHtml(L) + '</div>';

    var up = pending().sort(function (a, b) { return (a.deadline || '9').localeCompare(b.deadline || '9'); });
    h += '<div class="ad-sh"><h2 class="ad-h sm">Tugas Mendatang</h2>' + (up.length > 3 ? '<button class="ad-more" data-act="tab" data-t="task">Lihat semua (' + up.length + ')</button>' : '') + '</div>';
    h += up.length ? '<div class="dv-tl">' + up.slice(0, 3).map(function (t) {
      var c = by(D.course, t.courseId), r = rel(t.deadline), d = t.deadline ? new Date(t.deadline) : null, ok = d && !isNaN(d);
      return '<div class="dv-ti ' + r.u + '"><div class="dv-dt">' + (ok ? '<b>' + d.getDate() + '</b><small>' + d.toLocaleDateString('id-ID', { month: 'short' }) + '</small>' : '<b>—</b><small>&nbsp;</small>') + '</div>' +
        '<div class="dv-tb">' + (c ? tile(c) : '<i class="ad-tile" style="background:' + PALETTE[0] + '">' + ic('task') + '</i>') +
        '<div class="ad-tt"><b>' + esc(t.title) + '</b><small>' + esc(cname(t.courseId)) + ' · ' + esc(t.type) + '</small></div>' +
        '<span class="dv-pill ' + r.u + '">' + r.t + (clock(t.deadline) && r.n >= 0 && r.n <= 1 ? ' · ' + clock(t.deadline) : '') + '</span>' +
        '<div class="dv-ac"><button class="ad-bo" data-act="edit" data-e="task" data-id="' + t.id + '">Ubah jadwal</button><button class="ad-bg" data-act="done" data-id="' + t.id + '">Tandai selesai</button></div></div></div>';
    }).join('') + '</div>' : '<div class="ad-none">' + (D.course.length ? 'Semua tugas sudah beres. Santai dulu ☕' : 'Tambahkan mata kuliah dulu, lalu catat tugasnya.') + '</div>';

    var wk = new Date(); wk.setDate(wk.getDate() + 7); var lim = dstr(wk.getFullYear(), wk.getMonth(), wk.getDate()), td = today();
    var ht = pending().filter(function (t) {
      if (rng === 'Semua') return true; if (!t.deadline) return false;
      var d = t.deadline.slice(0, 10); return rng === 'Hari ini' ? d <= td : d <= lim;
    }).sort(function (a, b) { return (PRIO[a.priority] - PRIO[b.priority]) || (a.deadline || '9').localeCompare(b.deadline || '9'); });
    h += '<div class="ad-sh"><h2 class="ad-h sm">Tugas Prioritas</h2><div class="ad-rg"><select id="acRng" class="ad-sel" aria-label="Rentang waktu">' +
      ['Hari ini', 'Minggu ini', 'Semua'].map(function (x) { return '<option' + (x === rng ? ' selected' : '') + '>' + x + '</option>'; }).join('') +
      '</select><button class="ad-addl" data-act="add" data-e="task">Tambah ' + ic('plus') + '</button></div></div>';
    h += ht.length ? '<div class="dv-pg">' + ht.slice(0, 4).map(function (t) {
      var pr = PRI[t.priority] || PRI.Sedang, c = by(D.course, t.courseId), v = c ? cvOf(c) : CV[0];
      return '<div class="dv-pc ' + pr[0] + '" style="--cv:' + v[0] + '"><div class="dv-ph"><span class="ad-pri ' + pr[0] + '">' + esc(t.priority || 'Sedang') + ' ' + ic(pr[1]) + '</span>' +
        '<button class="ad-chk" data-act="done" data-id="' + t.id + '" aria-label="Tandai selesai" title="Tandai selesai">' + ic('check') + '</button></div>' +
        '<h4 data-act="edit" data-e="task" data-id="' + t.id + '" role="button" tabindex="0">' + esc(t.title) + '</h4>' +
        '<p>' + esc(t.desc || t.notes || 'Belum ada deskripsi untuk tugas ini.') + '</p>' +
        '<div class="dv-pf"><span class="dv-cn"><i></i>' + esc(c ? c.name : '—') + '</span><span class="dv-due">' + ic('cal') + fdate(t.deadline, 'd') + (isLate(t) ? ' · terlambat' : '') + '</span></div></div>';
    }).join('') + '</div>' + (ht.length > 4 ? '<p class="ad-sm" style="margin-top:10px">+' + (ht.length - 4) + ' tugas lain di rentang ini. <button class="ad-more" data-act="tab" data-t="task" style="text-decoration:underline">Buka semua tugas</button></p>' : '')
      : '<div class="ad-none">Tidak ada tugas di rentang “' + esc(rng) + '” 🎉</div>';
    return h;
  }

  /* ---------- Mata kuliah: TUMPUKAN KARTU per kampus (v6.1) ----------
     Tiap kampus = satu box. Kartu bertumpuk seperti kertas di dalam box (hanya tepi atasnya yang terlihat).
     Menggulir box memilih kartu: kartu terpilih naik keluar dari box dan tampil penuh, kartu lain turun/masuk ke tumpukan.
     Gulir memakai scroll asli browser (momentum, snap, keyboard, sentuh) -> posisi gulir dipetakan ke transform kartu. */
  var STK = { P: 26, GAP: 14, STEP: 72, PANEL: 70 }, stkIdx = {}, stkTm = 0;
  var BOXC = [['#c99a56', '#7d5a2e', '#f1dfb8'], ['#5f86b8', '#34557f', '#d2e1f4'], ['#6c9d78', '#3f6a4c', '#d3ebd9'], ['#b9768c', '#7d4357', '#f5d6e0'], ['#8a78c0', '#55468a', '#e0d9f5'], ['#c77a4f', '#86492a', '#f6dcc9']];
  function withCamp(id, fn) {
    var sD = D, sR = REST, sp = split(id); sp.d.cfg = campCfg(id); D = sp.d; REST = sp.r;
    try { return fn(); } finally { D = sD; REST = sR; }
  }
  function stkBox(cp, bi) {
    var col = BOXC[bi % BOXC.length];
    return withCamp(cp.id, function () {
      var L = courseList(), sks = L.reduce(function (a, c) { return a + (+c.sks || 0); }, 0), n = L.length;
      var cards = L.map(function (c, i) {
        return '<div class="stk-card" data-act="stkgo" data-i="' + i + '">' + cCard(c, true) +
          '<div class="stk-tag" aria-hidden="true"><b>' + esc(c.name) + '</b></div></div>';
      }).join('');
      var sp = ''; for (var i = 0; i < Math.max(n, 1); i++) sp += '<div class="stk-sp"></div>';
      var emptyMsg = !n ? '<div class="stk-none">' + (D.course.length ? 'Tidak ada mata kuliah di filter ini.' : 'Belum ada mata kuliah di kampus ini.') + '</div>' : '';
      return '<section class="stk-box" data-camp="' + esc(cp.id) + '" style="--bx:' + col[0] + ';--bxd:' + col[1] + ';--bxl:' + col[2] + '" aria-label="Box ' + esc(cp.name) + '">' +
        '<div class="stk-hd"><div><b>' + esc(cp.name) + '</b><small>' + n + ' mata kuliah · ' + sks + ' SKS</small></div>' +
        '<button class="ac-btn sm" data-act="add" data-e="course">' + ic('plus') + ' Mata kuliah</button></div>' +
        '<div class="stk-view" tabindex="0" role="group" aria-label="Tumpukan mata kuliah ' + esc(cp.name) + '. Gulir atau tekan panah atas/bawah untuk memilih.">' +
        '<div class="stk-stage"><div class="stk-tray"></div>' + emptyMsg + cards +
        '<div class="stk-front"><div class="stk-plate"><small>Kampus ' + (bi + 1) + '</small><b>' + esc(cp.name) + '</b></div>' +
        '<div class="stk-nav"><button type="button" data-act="stknav" data-v="-1" aria-label="Kartu sebelumnya"' + (n < 2 ? ' disabled' : '') + '>' + ic('r') + '</button>' +
        '<span class="stk-ct">' + (n ? '1 / ' + n : '0') + '</span>' +
        '<button type="button" data-act="stknav" data-v="1" aria-label="Kartu berikutnya"' + (n < 2 ? ' disabled' : '') + '>' + ic('r') + '</button></div></div></div>' +
        sp + '</div></section>';
    });
  }
  function vCourse() {
    var h = '<div class="ac-bar"><p class="ac-hint">Gulir kotak kampus untuk memilih kartu — yang terpilih naik ke atas. Ketuk kartu terpilih untuk mengedit. Mata kuliah baru hanya bisa ditambahkan ke semester yang berstatus aktif.</p><button class="ac-btn pri" data-act="add" data-e="course">+ Mata kuliah</button></div>' + cTabs();
    return h + '<div class="stk-grid">' + RAW.campuses.map(stkBox).join('') + '</div>';
  }
  /* posisi tiap kartu dari posisi gulir p (pecahan = sedang berpindah). d = jarak kartu dari kartu terpilih */
  function stkPos(box, p) {
    var P = STK.P, home = box._home, cards = box._cards, n = cards.length, idx = Math.max(0, Math.min(n - 1, Math.round(p)));
    var yp = function (sg, m) { return home + sg * (Math.min(m, 2.2) - 0.5) * P; };
    for (var i = 0; i < n; i++) {
      var d = i - p, a = Math.abs(d), sg = d > 0 ? -1 : 1, y, e;
      if (a >= 1) y = yp(sg, a); else { e = a * a * (3 - 2 * a); y = e * yp(sg, 1); }
      var sc = 1 - 0.022 * Math.min(a, 3), op = a <= 2.2 ? 1 : Math.max(0, 1 - (a - 2.2) * 1.4);
      var rot = ((i * 53) % 9 - 4) * 0.2 * Math.min(a, 1), tg = Math.max(0, Math.min(1, (a - 0.3) / 0.5));
      var c = cards[i], st = c.style;
      st.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
      st.opacity = op.toFixed(2); st.zIndex = Math.round(500 - d * 10); st.setProperty('--tg', tg.toFixed(2));
      var on = i === idx;
      if (c._on !== on) { c._on = on; c.classList.toggle('is-on', on); c._in.inert = !on; if (!on) c._in.setAttribute('aria-hidden', 'true'); else c._in.removeAttribute('aria-hidden'); }
    }
    if (box._idx !== idx) { box._idx = idx; stkIdx[box.dataset.camp] = idx; if (box._ct) box._ct.textContent = (idx + 1) + ' / ' + n; }
  }
  function stkLayout(box) {
    var view = box.querySelector('.stk-view'), stage = box.querySelector('.stk-stage'), P = STK.P;
    var cards = [].slice.call(box.querySelectorAll('.stk-card')), n = cards.length, ch = 0;
    cards.forEach(function (c) { c.style.height = ''; c._in = c.firstElementChild; c._tag = c.querySelector('.stk-tag'); c._on = null; ch = Math.max(ch, c.offsetHeight); });
    if (!n) ch = 110;
    cards.forEach(function (c) { c.style.height = ch + 'px'; });
    var home = ch + STK.GAP + 1.7 * P, B = Math.round(home + 2.7 * P + STK.PANEL);
    box._home = home; box._cards = cards; box._ct = box.querySelector('.stk-ct'); box._idx = -1;
    box.style.setProperty('--b', B + 'px'); box.style.setProperty('--tt', (ch + STK.GAP - 10) + 'px'); box.style.setProperty('--pn', STK.PANEL + 'px');
    view.style.height = B + 'px'; stage.style.height = B + 'px'; stage.style.marginBottom = -B + 'px';
    var sp = box.querySelectorAll('.stk-sp'); for (var i = 0; i < sp.length; i++) sp[i].style.height = (i < sp.length - 1 ? STK.STEP : B) + 'px';
    var keep = Math.max(0, Math.min(n - 1, stkIdx[box.dataset.camp] || 0));
    view.scrollTop = keep * STK.STEP;
    stkPos(box, n ? view.scrollTop / STK.STEP : 0);
  }
  function stkInit() {
    var bs = body.querySelectorAll('.stk-box'); for (var i = 0; i < bs.length; i++) stkLayout(bs[i]);
    if (document.fonts && document.fonts.ready && !stkInit.f) { stkInit.f = 1; document.fonts.ready.then(function () { if (ov && !ov.hidden && tab === 'course' && !q) stkInit(); }); }
  }
  function stkGo(box, i, smooth) {
    var view = box.querySelector('.stk-view'), n = box._cards ? box._cards.length : 0; if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    view.scrollTo({ top: i * STK.STEP, behavior: smooth === false ? 'auto' : 'smooth' });
  }
  var stkRaf = 0, stkQ = {};
  function stkOnScroll(e) {
    var v = e.target; if (!v || !v.classList || !v.classList.contains('stk-view')) return;
    var box = v.closest('.stk-box'); if (!box || !box._cards) return;
    stkQ[box.dataset.camp] = box; if (stkRaf) return;
    stkRaf = requestAnimationFrame(function () { stkRaf = 0; var q2 = stkQ; stkQ = {}; for (var k in q2) { var b = q2[k]; if (b._cards) stkPos(b, b.querySelector('.stk-view').scrollTop / STK.STEP); } });
  }
  window.addEventListener('resize', function () { clearTimeout(stkTm); stkTm = setTimeout(function () { if (ov && !ov.hidden && tab === 'course' && !q) stkInit(); }, 160); });

  /* ---------- Jejak Semester: cek ricek 16 pertemuan, absensi, ujian & presentasi (tersambung ke Kalender) ---------- */
  var NM = 16, trkOpen = null, ATT = [['H', 'Hadir'], ['I', 'Izin'], ['S', 'Sakit'], ['A', 'Alpa']];
  function trk(c) {
    var t = c.trk; if (!t || !t.m) t = c.trk = { start: '', m: [] };
    for (var i = 0; i < NM; i++) if (!t.m[i]) t.m[i] = { n: 0, a: '', d: '' };
    return t;
  }
  function trkStat(c) {
    var t = trk(c), n = 0, h = 0, rec = 0, met = 0;
    t.m.forEach(function (m) { if (m.n) n++; if (m.a) { rec++; if (m.a === 'H') h++; } if (m.n || m.a) met++; });
    return { n: n, h: h, rec: rec, met: met, pct: rec ? Math.round(h / rec * 100) : null };
  }
  var exOf = function (cid) { return D.exam.filter(function (e) { return e.courseId === cid; }).sort(function (a, b) { return (a.date || '9').localeCompare(b.date || '9'); }); };
  var isPres = function (e) { return e.type === 'Presentasi'; };
  function exRow(e) {
    var past = e.date && e.date.slice(0, 10) < today() && !e.done;
    return '<div class="tr-ex' + (e.done ? ' done' : '') + '"><label class="tr-ck"><input type="checkbox" data-act="exdone" data-id="' + e.id + '"' + (e.done ? ' checked' : '') + ' aria-label="Tandai selesai"><span></span></label>' +
      '<span class="tr-kind ' + (isPres(e) ? 'pr' : 'ex') + '">' + esc(e.type) + '</span>' +
      '<div class="tr-exm"><b>' + (e.date ? fshort(e.date) : 'Belum dijadwalkan') + '</b><small>' + (e.date ? '<i class="tr-cal">' + ic('cal') + 'Di Kalender</i>' : 'Isi tanggal agar muncul di Kalender') + (past ? ' · <em>lewat</em>' : '') + (e.room ? ' · ' + esc(e.room) : '') + '</small></div>' +
      '<button class="ac-btn sm" data-act="edit" data-e="exam" data-id="' + e.id + '">Atur</button></div>';
  }
  function milestone(c, type, label) {
    var xs = exOf(c.id).filter(function (e) { return e.type === type; });
    return '<div class="tr-ms"><span class="tr-flag">' + ic('flag') + '</span><div><b>' + label + '</b><small>' + (xs.length ? xs.map(function (e) { return e.date ? fshort(e.date) : 'belum dijadwalkan'; }).join(' · ') : 'Belum ada jadwal') + '</small></div>' +
      (xs.length ? '<button class="ac-btn sm" data-act="edit" data-e="exam" data-id="' + xs[0].id + '">Atur</button>' : '<button class="ac-btn sm" data-act="add" data-e="exam" data-course="' + c.id + '" data-type="' + type + '">+ Jadwalkan</button>') + '</div>';
  }
  function meet(c, i) {
    var m = trk(c).m[i], ok = m.n || m.a;
    return '<div class="tr-mt' + (ok ? ' on' : '') + '"><span class="tr-no">' + (i + 1) + '</span>' +
      '<label class="tr-ck"><input type="checkbox" data-act="mn" data-id="' + c.id + '" data-i="' + i + '"' + (m.n ? ' checked' : '') + ' title="Catatan sudah ada" aria-label="Catatan pertemuan ' + (i + 1) + '"><span></span></label>' +
      '<div class="tr-att" role="group" aria-label="Absensi pertemuan ' + (i + 1) + '">' + ATT.map(function (a) {
        return '<button data-act="ma" data-id="' + c.id + '" data-i="' + i + '" data-v="' + a[0] + '" data-k="' + a[0] + '" title="' + a[1] + '" aria-pressed="' + (m.a === a[0]) + '">' + a[0] + '</button>';
      }).join('') + '</div>' +
      '<input type="date" class="tr-dt" data-act="mdate" data-id="' + c.id + '" data-i="' + i + '" value="' + esc(m.d || '') + '" aria-label="Tanggal pertemuan ' + (i + 1) + '"></div>';
  }
  function trkCard(c) {
    var st = trkStat(c), open = trkOpen === c.id, ex = exOf(c.id), pres = ex.filter(isPres), t = trk(c);
    var low = st.pct != null && st.pct < 75, nxt = ex.filter(function (e) { return e.date && !e.done && e.date.slice(0, 10) >= today(); })[0];
    var h = '<article class="tr-cc' + (open ? ' open' : '') + '"><header class="tr-hd" data-act="tx" data-id="' + c.id + '" role="button" tabindex="0" aria-expanded="' + open + '">' +
      '<span class="tr-tl" data-act="tlogo" data-id="' + c.id + '" role="button" tabindex="0" title="Ganti logo mata kuliah">' + tile(c, 'big') + '<u>' + ic('pen') + '</u></span>' +
      '<div class="tr-nm"><b>' + esc(c.name) + '</b><small>' + esc(c.lecturer || 'Dosen belum diisi') + (c.schedule ? ' · ' + esc(c.schedule) : '') + '</small></div>' +
      '<div class="tr-sm"><div class="tr-r"><small>Pertemuan</small><b>' + st.met + '<i>/' + NM + '</i></b></div>' +
      '<div class="tr-r"><small>Catatan</small><b>' + st.n + '<i>/' + NM + '</i></b></div>' +
      '<div class="tr-r' + (low ? ' warn' : '') + '"><small>Kehadiran</small><b>' + (st.pct == null ? '—' : st.pct + '<i>%</i>') + '</b></div></div>' +
      '<span class="tr-chev">' + ic('r') + '</span></header>' +
      '<div class="tr-pb" role="progressbar" aria-valuenow="' + Math.round(st.met / NM * 100) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + (st.met / NM * 100) + '%"></i></div>';
    if (!open) return h + '<div class="tr-peek">' + (nxt ? '<span class="tr-kind ' + (isPres(nxt) ? 'pr' : 'ex') + '">' + esc(nxt.type) + '</span> ' + fshort(nxt.date) : 'Belum ada ujian/presentasi mendatang') + (low ? ' · <em>Kehadiran di bawah 75%</em>' : '') + '</div></article>';
    h += '<div class="tr-body"><div class="tr-tools"><label>Mulai kuliah <input type="date" data-act="tstart" data-id="' + c.id + '" value="' + esc(t.start || '') + '"></label>' +
      '<button class="ac-btn sm" data-act="mfill" data-id="' + c.id + '">Isi tanggal mingguan</button>' +
      '<button class="ac-btn sm" data-act="mall" data-id="' + c.id + '">Centang semua catatan</button>' +
      '<button class="ac-btn sm danger" data-act="mclr" data-id="' + c.id + '">Reset</button></div>' +
      '<div class="tr-leg"><span><i class="ck"></i>Kotak = catatan sudah ada</span><span><i class="h"></i>H = Hadir</span><span><i class="i"></i>I = Izin</span><span><i class="s"></i>S = Sakit</span><span><i class="a"></i>A = Alpa</span></div>' +
      '<div class="tr-grid"><div>';
    for (var i = 0; i < 8; i++) h += meet(c, i);
    h += milestone(c, 'UTS', 'UTS · Ujian Tengah Semester') + '</div><div>';
    for (i = 8; i < NM; i++) h += meet(c, i);
    h += milestone(c, 'UAS', 'UAS · Ujian Akhir Semester') + '</div></div>' +
      '<div class="tr-sec"><h4>' + ic('flag') + 'Presentasi &amp; ujian lainnya</h4><div><button class="ac-btn sm" data-act="add" data-e="exam" data-course="' + c.id + '" data-type="Presentasi">+ Presentasi</button> <button class="ac-btn sm" data-act="add" data-e="exam" data-course="' + c.id + '" data-type="Kuis">+ Kuis / ujian</button></div></div>';
    var rest = ex.filter(function (e) { return e.type !== 'UTS' && e.type !== 'UAS'; });
    h += rest.length ? '<div class="tr-exl">' + rest.map(exRow).join('') + '</div>' : '<p class="tr-none">Belum ada presentasi atau ujian lain. Tambahkan, lalu otomatis muncul di Kalender.</p>';
    var fix = ex.filter(function (e) { return e.type === 'UTS' || e.type === 'UAS'; });
    if (fix.length) h += '<div class="tr-exl">' + fix.map(exRow).join('') + '</div>';
    return h + '</div></article>';
  }
  function vTrk() {
    var L = D.course.filter(inActive), act = D.sem.filter(function (x) { return x.active; });
    var h = '<div class="tr-hero"><div><small>Cek ricek perjalanan</small><h3>16 pertemuan, satu layar.</h3><p>Centang catatan, catat absensi, dan jadwalkan ujian atau presentasi. Semua yang bertanggal otomatis tampil di Kalender.</p></div>';
    if (L.length) {
      var all = L.map(trkStat), pc = all.filter(function (x) { return x.pct != null; }), avg = pc.length ? Math.round(pc.reduce(function (a, x) { return a + x.pct; }, 0) / pc.length) : null;
      var nt = all.reduce(function (a, x) { return a + x.n; }, 0), up = 0;
      L.forEach(function (c) { exOf(c.id).forEach(function (e) { if (e.date && !e.done && e.date.slice(0, 10) >= today()) up++; }); });
      h += '<div class="tr-kp"><div><b>' + L.length + '</b><small>Mata kuliah</small></div><div><b>' + nt + '<i>/' + L.length * NM + '</i></b><small>Catatan</small></div><div><b>' + (avg == null ? '—' : avg + '%') + '</b><small>Rata-rata hadir</small></div><div><b>' + up + '</b><small>Ujian/presentasi</small></div></div>';
    }
    h += '</div>';
    if (!act.length) return h + empty('Belum ada semester aktif. Aktifkan semester di menu Semester.');
    if (!L.length) return h + empty('Belum ada mata kuliah di semester aktif. Tambahkan lewat menu Mata Kuliah.');
    if (trkOpen === null) trkOpen = L[0].id;
    return h + '<div class="tr-list">' + L.map(trkCard).join('') + '</div>';
  }
  function readLogo(file, cb) {
    if (!file || !/^image\//.test(file.type)) return msg('Logo', 'Pilih file gambar.');
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var S = 160, cv = document.createElement('canvas'), x = cv.getContext('2d'), r = Math.min(im.width, im.height) || 1, sx = (im.width - r) / 2, sy = (im.height - r) / 2;
        cv.width = cv.height = S; x.drawImage(im, sx, sy, r, r, 0, 0, S, S);
        var u = cv.toDataURL('image/webp', .9); if (u.indexOf('data:image/webp') !== 0) u = cv.toDataURL('image/png');
        cb(u);
      };
      im.onerror = function () { msg('Logo', 'Gambar tidak bisa dibaca.'); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  var lgIn;
  function pickLogo(cid) {
    if (!lgIn) { lgIn = document.createElement('input'); lgIn.type = 'file'; lgIn.accept = 'image/*'; lgIn.hidden = true; document.body.appendChild(lgIn); }
    lgIn.value = ''; lgIn.onchange = function () {
      readLogo(lgIn.files[0], function (u) { var c = by(D.course, cid); if (c) { c.logo = u; save(); render(); msg('Logo diganti', c.name); } });
    };
    lgIn.click();
  }
  function vSearch() {
    var s = q.toLowerCase(), m = function () { for (var i = 0; i < arguments.length; i++) if (String(arguments[i] || '').toLowerCase().indexOf(s) >= 0) return true; return false; };
    var cs = D.course.filter(function (c) { return m(c.name, c.code, c.lecturer, c.room); });
    var ts = D.task.filter(function (t) { return m(t.title, t.desc, t.notes, t.type, cname(t.courseId)); });
    var xs = D.exam.filter(function (e) { return m(e.type, e.topics, e.notes, cname(e.courseId)); });
    var h = '<div class="ad-sh"><h2 class="ad-h">Hasil untuk “' + esc(q) + '”</h2></div>';
    if (!cs.length && !ts.length && !xs.length) return h + empty('Tidak ada yang cocok.');
    if (cs.length) h += '<h3 class="ac-h">Mata kuliah (' + cs.length + ')</h3><div class="ad-cg">' + cs.map(function (c) { return cCard(c); }).join('') + '</div>';
    if (ts.length) h += '<h3 class="ac-h">Tugas (' + ts.length + ')</h3>' + ts.map(function (t) {
      return '<div class="ac-item' + (t.status === 'Selesai' ? ' done' : '') + '"><div><button class="t" data-act="edit" data-e="task" data-id="' + t.id + '">' + esc(t.title) + '</button><small>' + esc(cname(t.courseId)) + ' · ' + fdate(t.deadline) + ' · ' + esc(t.status) + '</small></div></div>';
    }).join('');
    if (xs.length) h += '<h3 class="ac-h">Ujian (' + xs.length + ')</h3>' + xs.map(function (e) {
      return '<div class="ac-item"><div><button class="t" data-act="edit" data-e="exam" data-id="' + e.id + '">' + esc(e.type) + ' — ' + esc(cname(e.courseId)) + '</button><small>' + fdate(e.date) + '</small></div></div>';
    }).join('');
    return h;
  }

  /* ---------- Panel kanan: profil, kalender, jadwal, pengingat ---------- */
  function renderSide() {
    var s = prof(), nm = s.nick || 'Mahasiswa', cs = D.course.filter(inActive), ipS = ip(cs), ipK = ip(D.course);
    var act = D.sem.filter(function (x) { return x.active; })[0];
    var h = '<section class="ad-sec"><div class="ad-sh2"><h3>Profil</h3><button class="ad-pen" data-act="prof" aria-label="Ubah profil">' + ic('pen') + '</button></div>' +
      '<div class="ad-pf"><div class="ad-av"' + (s.photo ? ' style="background-image:url(&quot;' + esc(s.photo) + '&quot;)"' : '') + '>' + (s.photo ? '' : esc(nm.charAt(0).toUpperCase())) + '</div>' +
      '<h4>' + esc(nm) + '</h4><small>' + esc((RAW.campuses.length > 1 ? campById(RAW.campusSel).name + ' · ' : '') + (act ? act.name : 'Belum ada semester aktif')) + '</small>' +
      '<div class="ad-ipk"><span>IP semester<b>' + ipf(ipS) + '</b></span><span>IPK<b>' + ipf(ipK) + '</b></span></div></div>';

    var first = new Date(cal.y, cal.m, 1), start = first.getDay(), dim = new Date(cal.y, cal.m + 1, 0).getDate(), rows = Math.ceil((start + dim) / 7), ev = events(), mk = {}, td = today();
    ev.forEach(function (e) { (mk[e.d] = mk[e.d] || {})[e.k] = 1; });
    var cells = '';
    for (var i = 0; i < rows * 7; i++) {
      var dt = new Date(cal.y, cal.m, i - start + 1), ds = dstr(dt.getFullYear(), dt.getMonth(), dt.getDate()), mm = mk[ds];
      cells += '<button class="ad-d' + (dt.getMonth() !== cal.m ? ' out' : '') + (ds === td ? ' td' : '') + (ds === sel ? ' sel' : '') + '" data-act="day" data-v="' + ds + '" aria-label="' + ds + '"' + (ds === sel ? ' aria-pressed="true"' : '') + '>' + dt.getDate() +
        (mm ? '<span class="dt">' + (mm.t ? '<u></u>' : '') + (mm.e ? '<u class="e"></u>' : '') + '</span>' : '') + '</button>';
    }
    h += '</section><section class="ad-sec"><div class="ad-cal"><div class="ad-calh"><span>' + new Date(cal.y, cal.m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) + '</span>' +
      '<div><button data-act="calnav" data-v="-1" aria-label="Bulan sebelumnya">' + ic('l') + '</button><button data-act="calnav" data-v="1" aria-label="Bulan berikutnya">' + ic('r') + '</button></div></div>' +
      '<div class="ad-wd">' + ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="ad-dg">' + cells + '</div></div></section>';

    var list = classesOn(sel).concat(ev.filter(function (e) { return e.d === sel; })).sort(function (a, b) { return (a.t || '99').localeCompare(b.t || '99'); });
    h += '<section class="ad-sec"><div class="ad-sh2"><h3>Jadwal</h3><button class="ad-more" data-act="tab" data-t="exam">Lihat semua</button></div>' +
      '<div class="ad-dl">' + new Date(sel + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>' +
      (list.length ? list.slice(0, 5).map(function (e) {
        return '<div class="ad-sc"><div class="tm">' + (e.t || '—') + '</div><div class="tx"><b>' + esc(e.title) + '</b><small>' + esc(e.sub) + '</small></div></div>';
      }).join('') : '<p class="ad-sm">Tidak ada jadwal di tanggal ini. Isi kolom “Jadwal” mata kuliah (mis. Senin 08:00) agar jam kuliah muncul otomatis.</p>') + '</section>';

    var now = new Date(), rem = [];
    D.exam.forEach(function (e) { if (e.date && new Date(e.date) >= now) rem.push({ w: e.date, t: e.type + ' — ' + cname(e.courseId), late: 0 }); });
    D.task.forEach(function (t) { if (t.status !== 'Selesai' && t.deadline && new Date(t.deadline) - now < 2 * 864e5) rem.push({ w: t.deadline, t: t.title, late: new Date(t.deadline) < now }); });
    rem.sort(function (a, b) { return a.w.localeCompare(b.w); });
    h += '<section class="ad-sec"><div class="ad-sh2"><h3>Pengingat</h3></div>' + (rem.length ? rem.slice(0, 4).map(function (r) {
      return '<div class="ad-rm"><span class="ic' + (r.late ? ' late' : '') + '">' + ic(r.late ? 'bell' : 'cal') + '</span><div><b>' + esc(r.t) + '</b><small>' + (r.late ? 'Terlambat · ' : '') +
        new Date(r.w).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) + '</small></div></div>';
    }).join('') : '<p class="ad-sm">Belum ada ujian mendatang atau tugas yang mendekati tenggat.</p>') + '</section>';
    window.__morph(sideEl, h);
  }

  function vSem() {
    var h = warn() + '<div class="ac-bar"><p class="ac-hint">Atur semester, target IP, catatan, dan status aktif. Daftar mata kuliah beserta dosen dan nilainya muncul di tiap semester.</p><button class="ac-btn pri" data-act="add" data-e="sem">+ Semester</button></div>';
    if (!D.sem.length) h += empty('Belum ada semester. Tambahkan yang pertama.');
    D.sem.forEach(function (s) {
      var cs = D.course.filter(function (c) { return c.semId === s.id; }), v = ip(cs), sks = cs.reduce(function (a, c) { return a + (+c.sks || 0); }, 0);
      h += '<article class="ac-card"><div class="ac-row"><div><h3>Semester: ' + esc(s.name) +
        '<button class="ac-badge ' + (s.active ? 'on' : '') + '" data-act="togsem" data-id="' + s.id + '" title="Klik untuk ubah status">' + (s.active ? 'Aktif' : 'Tidak aktif') + '</button></h3></div>' + btns('sem', s.id) + '</div>' +
        '<div class="ac-meta"><span>Target IP: <b>' + (has(s.target) ? fmt(+s.target) : '—') + '</b></span><span>IP saat ini: <b>' + fmt(v) + '</b></span><span>Mata kuliah: <b>' + cs.length + '</b></span><span>Total SKS: <b>' + sks + '</b></span></div>' +
        (s.notes ? '<div class="ac-notes">' + esc(s.notes) + '</div>' : '');
      if (cs.length) {
        h += '<div class="ac-tblwrap"><table class="ac-tbl"><tr><th>Mata kuliah</th><th>Dosen</th><th>SKS</th><th>Nilai</th><th>Huruf</th></tr>' +
          cs.map(function (c) { var f = finalScore(c), L = letter(f); return '<tr class="ac-click" data-act="edit" data-e="course" data-id="' + c.id + '"><td>' + esc(c.name) + (c.code ? ' <small>(' + esc(c.code) + ')</small>' : '') + '</td><td>' + esc(c.lecturer || '—') + '</td><td>' + esc(c.sks || '—') + '</td><td>' + fmt(f) + '</td><td>' + (L ? L.l : '—') + '</td></tr>'; }).join('') + '</table></div>';
      } else h += '<p class="ac-hint">Belum ada mata kuliah di semester ini.</p>';
      if (s.active) h += '<div style="margin-top:10px"><button class="ac-btn sm" data-act="add" data-e="course" data-sem="' + s.id + '">+ Mata kuliah</button></div>';
      h += '</article>';
    });
    return h;
  }
  function chips(list, cur, f) {
    return '<div class="ac-chips">' + list.map(function (x) { return '<button class="ac-chip" aria-pressed="' + (x === cur) + '" data-act="filt" data-f="' + f + '" data-v="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>';
  }
  function vTask() {
    var L = D.task.filter(function (t) { return tf === 'Semua' || t.status === tf; }).sort(function (a, b) { return (a.deadline || '9').localeCompare(b.deadline || '9'); });
    var h = '<div class="ac-bar"><p class="ac-hint">Centang kotak untuk menandai tugas selesai. Klik judul untuk mengedit.</p><button class="ac-btn pri" data-act="add" data-e="task">+ Tugas</button></div>' + chips(['Semua', 'Belum dikerjakan', 'Sedang dikerjakan', 'Selesai'], tf, 'tf');
    if (!L.length) return h + empty(D.course.length ? 'Tidak ada tugas.' : 'Tambahkan mata kuliah terlebih dahulu, lalu catat tugasnya.');
    L.forEach(function (t) {
      var late = t.deadline && t.status !== 'Selesai' && new Date(t.deadline) < new Date();
      h += '<div class="ac-item' + (t.status === 'Selesai' ? ' done' : '') + '"><input type="checkbox" data-act="tgtask" data-id="' + t.id + '"' + (t.status === 'Selesai' ? ' checked' : '') + ' aria-label="Selesai"><div>' +
        '<button class="t" data-act="edit" data-e="task" data-id="' + t.id + '">' + esc(t.title) + '</button>' +
        '<span class="ac-badge ' + (t.priority === 'Tinggi' ? 'hi' : t.priority === 'Sedang' ? 'mid' : '') + '">' + esc(t.priority) + '</span><span class="ac-badge">' + esc(t.type) + '</span>' + (late ? '<span class="ac-badge late">Terlambat</span>' : '') +
        '<small>' + esc(cname(t.courseId)) + ' · Deadline: ' + fdate(t.deadline) + ' · ' + esc(t.status) + (has(t.score) ? ' · Nilai: ' + t.score : '') + (has(t.weight) ? ' · Bobot: ' + t.weight : '') + '</small>' +
        (t.desc ? '<small>' + esc(t.desc) + '</small>' : '') + (t.link ? '<small>' + link(t.link) + '</small>' : '') + (t.notes ? '<small>Catatan: ' + esc(t.notes) + '</small>' : '') + '</div>' + btns('task', t.id) + '</div>';
    });
    return h;
  }
  function vExam() {
    var L = D.exam.filter(function (e) { return ef === 'Semua' || e.type === ef; }).sort(function (a, b) { return (a.date || '9').localeCompare(b.date || '9'); });
    var h = '<div class="ac-bar"><p class="ac-hint">UTS, UAS, kuis, presentasi, ujian lisan, dan ujian praktik.</p><button class="ac-btn pri" data-act="add" data-e="exam">+ Ujian</button></div>' + chips(['Semua'].concat(EXAMTYPES), ef, 'ef');
    if (!L.length) return h + empty(D.course.length ? 'Tidak ada ujian.' : 'Tambahkan mata kuliah terlebih dahulu.');
    L.forEach(function (e) {
      var past = e.date && new Date(e.date) < new Date();
      h += '<div class="ac-item"><div><button class="t" data-act="edit" data-e="exam" data-id="' + e.id + '">' + esc(e.type) + ' — ' + esc(cname(e.courseId)) + '</button>' + (past ? '' : (e.date ? '<span class="ac-badge mid">Mendatang</span>' : '')) +
        '<small>' + fdate(e.date) + (e.room ? ' · ' + link(e.room) : '') + (has(e.score) ? ' · Nilai: ' + e.score : '') + (has(e.weight) ? ' · Bobot: ' + e.weight : '') + '</small>' +
        (e.topics ? '<small>Materi: ' + esc(e.topics) + '</small>' : '') + (e.notes ? '<small>' + esc(e.notes) + '</small>' : '') + '</div>' + btns('exam', e.id) + '</div>';
    });
    return h;
  }
  function vAna() {
    var act = D.course.filter(function (c) { var s = by(D.sem, c.semId); return s && s.active; });
    var pend = D.task.filter(function (t) { return t.status !== 'Selesai'; }), late = pend.filter(function (t) { return t.deadline && new Date(t.deadline) < new Date(); });
    var up = D.exam.filter(function (e) { return e.date && new Date(e.date) >= new Date(); }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var sc = D.task.filter(function (t) { return has(t.score); }).length + D.exam.filter(function (e) { return has(e.score); }).length;
    var h = warn() + '<div class="ac-grid">' +
      '<div class="ac-stat"><b>' + act.length + '</b><span>Mata kuliah aktif</span></div>' +
      '<div class="ac-stat"><b>' + pend.length + '</b><span>Tugas belum selesai' + (late.length ? ' (' + late.length + ' terlambat)' : '') + '</span></div>' +
      '<div class="ac-stat"><b>' + up.length + '</b><span>Ujian mendatang' + (up[0] ? ' · berikutnya ' + fdate(up[0].date, 'd') : '') + '</span></div>' +
      '<div class="ac-stat"><b>' + sc + '</b><span>Nilai yang sudah dimasukkan</span></div></div>';
    // waktu belajar
    var tot = {}, all = 0; D.study.forEach(function (s) { tot[s.courseId] = (tot[s.courseId] || 0) + (+s.minutes || 0); all += +s.minutes || 0; });
    var ids = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; }), mx = ids.length ? tot[ids[0]] : 1;
    var hm = function (m) { return Math.floor(m / 60) + 'j ' + (m % 60) + 'm'; };
    h += '<div class="ac-bar"><div class="ac-h" style="margin:0">Distribusi waktu belajar' + (all ? ' · total ' + hm(all) : '') + '</div><button class="ac-btn sm" data-act="add" data-e="study">+ Catat waktu belajar</button></div>';
    h += ids.length ? '<div class="ac-bars">' + ids.map(function (id) { return '<div class="ac-bar2"><span>' + esc(cname(id)) + '</span><div class="ac-track"><i style="width:' + (tot[id] / mx * 100) + '%"></i></div><span>' + hm(tot[id]) + ' (' + Math.round(tot[id] / all * 100) + '%)</span></div>'; }).join('') + '</div>'
      : '<p class="ac-hint">Belum ada catatan waktu belajar.</p>';
    if (D.study.length) h += '<div class="ac-tblwrap"><table class="ac-tbl"><tr><th>Tanggal</th><th>Mata kuliah</th><th>Durasi</th><th></th></tr>' +
      D.study.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 8).map(function (s) { return '<tr><td>' + fdate(s.date, 'd') + '</td><td>' + esc(cname(s.courseId)) + '</td><td>' + s.minutes + ' mnt</td><td><button class="ac-btn sm" data-act="edit" data-e="study" data-id="' + s.id + '">Edit</button> <button class="ac-btn sm danger" data-act="del" data-e="study" data-id="' + s.id + '">Hapus</button></td></tr>'; }).join('') + '</table></div>';
    // target vs hasil
    h += '<div class="ac-h">Perbandingan target dan hasil</div>';
    if (!D.cfg.confirmed) h += '<p class="ac-hint">Tersedia setelah formula nilai dikonfigurasi.</p>';
    else {
      var rows = act.filter(function (c) { return c.targetGrade || finalScore(c) != null; });
      var top = Math.max.apply(null, D.cfg.scale.map(function (r) { return r.p; }).concat([1]));
      h += rows.length ? '<div class="ac-legend"><span><i></i>Target</span><span><i class="alt"></i>Hasil saat ini</span></div><div class="ac-bars">' + rows.map(function (c) {
        var tp = ptOf(c.targetGrade), L = letter(finalScore(c));
        return '<div class="ac-bar2"><span>' + esc(c.name) + '</span><div class="ac-pair"><div class="ac-track"><i style="width:' + ((tp || 0) / top * 100) + '%"></i></div><div class="ac-track"><i class="alt" style="width:' + ((L ? L.p : 0) / top * 100) + '%"></i></div></div><span>' + esc(c.targetGrade || '—') + ' → ' + (L ? L.l : '—') + '</span></div>';
      }).join('') + '</div>' : '<p class="ac-hint">Isi target nilai atau nilai tugas/ujian agar perbandingan muncul.</p>';
      var sr = D.sem.filter(function (s) { return s.active && has(s.target); });
      if (sr.length) h += '<div class="ac-meta" style="margin-top:14px">' + sr.map(function (s) { return '<span>' + esc(s.name) + ' — target IP <b>' + fmt(+s.target) + '</b>, saat ini <b>' + fmt(ip(D.course.filter(function (c) { return c.semId === s.id; }))) + '</b></span>'; }).join('') + '</div>';
    }
    var ipk = ip(D.course);
    h += '<div class="ac-meta" style="margin-top:10px"><span>IPK (semua semester): <b>' + fmt(ipk) + '</b></span></div>';
    return h;
  }
  function vCfg() {
    if (!draft) draft = JSON.parse(JSON.stringify(D.cfg));
    var c = draft, sum = c.cats.reduce(function (a, k) { return a + (+k.w || 0); }, 0);
    var h = '<div class="ac-bar"><p class="ac-hint">Nilai akhir, huruf mutu, IP, dan IPK hanya dihitung memakai pengaturan ini. Nilai awalnya hanya contoh — sesuaikan dengan aturan kampus/dosen Anda, lalu simpan.</p>' +
      '<span class="ac-badge ' + (D.cfg.confirmed ? 'on' : '') + '">' + (D.cfg.confirmed ? 'Formula aktif' : 'Belum aktif') + '</span></div><div class="ac-cfg" id="cfgForm">';
    h += '<div><div class="ac-h" style="margin-top:0">Skala nilai (huruf mutu)</div><table class="ac-tbl"><tr><th>Huruf</th><th>Nilai min</th><th>Poin</th><th></th></tr>' +
      c.scale.map(function (r, i) { return '<tr><td><input data-s="l" data-i="' + i + '" value="' + esc(r.l) + '"></td><td><input type="number" data-s="min" data-i="' + i + '" value="' + esc(r.min) + '"></td><td><input type="number" step="0.01" data-s="p" data-i="' + i + '" value="' + esc(r.p) + '"></td><td><button class="ac-btn sm danger" data-act="cfgdel" data-k="scale" data-i="' + i + '">×</button></td></tr>'; }).join('') +
      '</table><button class="ac-btn sm" style="margin-top:8px" data-act="cfgadd" data-k="scale">+ Baris</button></div>';
    h += '<div><div class="ac-h" style="margin-top:0">Komponen & bobot nilai akhir (%)</div><table class="ac-tbl"><tr><th>Komponen</th><th>Bobot</th><th></th></tr>' +
      c.cats.map(function (r, i) { return '<tr><td><input data-c="n" data-i="' + i + '" value="' + esc(r.n) + '"></td><td><input type="number" data-c="w" data-i="' + i + '" value="' + esc(r.w) + '"></td><td><button class="ac-btn sm danger" data-act="cfgdel" data-k="cats" data-i="' + i + '">×</button></td></tr>'; }).join('') +
      '</table><button class="ac-btn sm" style="margin-top:8px" data-act="cfgadd" data-k="cats">+ Komponen</button>' +
      '<p class="ac-sum">Total bobot: <b>' + fmt(sum) + '%</b>. Tugas dengan jenis selain nama komponen dihitung sebagai "Tugas"; Kuis, Presentasi, UTS, UAS, dll. mengikuti nama komponen.</p>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12.5px"><input type="checkbox" id="cfgNorm"' + (c.normalize ? ' checked' : '') + ' style="width:auto;margin-top:3px"><span>Abaikan komponen yang belum punya nilai (bobot dinormalisasi). Jika dimatikan, komponen kosong dihitung 0.</span></label></div></div>' +
      '<div class="ac-foot" style="padding:18px 0 0"><button class="ac-btn" data-act="cfgreset">Muat ulang</button><button class="ac-btn pri" data-act="cfgsave">Simpan & aktifkan formula</button></div>';
    return h;
  }
  function readCfg() {
    if (!draft) return;
    body.querySelectorAll('[data-s]').forEach(function (i) { var r = draft.scale[+i.dataset.i]; if (r) r[i.dataset.s] = i.dataset.s === 'l' ? i.value : (i.value === '' ? 0 : +i.value); });
    body.querySelectorAll('[data-c]').forEach(function (i) { var r = draft.cats[+i.dataset.i]; if (r) r[i.dataset.c] = i.dataset.c === 'n' ? i.value : (i.value === '' ? 0 : +i.value); });
    var n = body.querySelector('#cfgNorm'); if (n) draft.normalize = n.checked;
  }

  /* ---------- Form modal ---------- */
  function fld(f, v) {
    var at = 'id="f_' + f.k + '" name="' + f.k + '"' + (f.req ? ' required' : ''), inp;
    if (f.t === 'logo') {
      return '<div class="full ad-logofld"><span>' + f.l + '</span><div class="ad-lgrow">' +
        '<i class="ad-tile big" id="lgPrev">' + (v ? '<img src="' + esc(v) + '" alt="">' : '—') + '</i>' +
        '<div><input type="hidden" id="f_logo" name="logo" value="' + esc(v) + '">' +
        '<input type="file" id="lgFile" accept="image/*" hidden>' +
        '<button type="button" class="ac-btn sm" data-lg="pick">Unggah gambar</button> ' +
        '<button type="button" class="ac-btn sm danger" data-lg="clear">Hapus logo</button>' +
        '<small>PNG/JPG/SVG. Otomatis diperkecil agar hemat memori.</small></div></div></div>';
    }
    if (f.t === 'textarea') inp = '<textarea ' + at + ' rows="3">' + esc(v) + '</textarea>';
    else if (f.t === 'select') {
      var o = typeof f.o === 'function' ? f.o(v) : f.o;
      inp = '<select ' + at + '>' + o.map(function (p) { return '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(v) ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('') + '</select>';
    } else {
      var x = f.t === 'number' ? ' step="' + (f.step || 'any') + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') : '';
      inp = '<input ' + at + ' type="' + f.t + '" value="' + esc(v) + '"' + x + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
    }
    return '<label class="' + (f.full ? 'full' : '') + '"><span>' + f.l + (f.req ? ' *' : '') + '</span>' + inp + '</label>';
  }
  function openForm(ent, id, preset) {
    var sp = SPEC[ent], it = id ? by(D[ent], id) : Object.assign({}, sp.def, preset || {});
    if (ent === 'study' && !id) it.date = today();
    var m = el('ac-ov ac-ov2 ad-skin', '<form class="ac-win ac-form" novalidate><header><h2>' + (id ? 'Edit ' : 'Tambah ') + sp.title + '</h2><button type="button" class="ac-x" data-x aria-label="Tutup">×</button></header>' +
      '<div class="ac-fields">' + sp.fields.map(function (f) { var v = it[f.k]; if (f.bool) v = String(v !== false); return fld(f, v == null ? '' : v); }).join('') + '</div>' +
      '<footer><button type="button" class="ac-btn" data-x>Batal</button><button class="ac-btn pri">Simpan</button></footer></form>');
    document.body.appendChild(m);
    var off = function () { m.remove(); };
    m.addEventListener('mousedown', function (e) { if (e.target === m) off(); });
    m.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-x')) off();
      var lg = e.target.getAttribute && e.target.getAttribute('data-lg'), hid = m.querySelector('#f_logo'), pv = m.querySelector('#lgPrev'), fi = m.querySelector('#lgFile');
      if (lg === 'pick') fi.click();
      if (lg === 'clear') { hid.value = ''; pv.textContent = '—'; }
    });
    var lf = m.querySelector('#lgFile');
    if (lf) lf.addEventListener('change', function () {
      readLogo(lf.files[0], function (u) { m.querySelector('#f_logo').value = u; m.querySelector('#lgPrev').innerHTML = '<img src="' + u + '" alt="">'; });
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); off(); } });
    m.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, bad = null, rec = id ? it : { id: uid() };
      if (!id && ent === 'sem') rec.campusId = RAW.campusSel;   /* v5.2: semester milik kampus terpilih */
      sp.fields.forEach(function (fd) {
        var inp = f.elements[fd.k], v = inp.value.trim();
        if (fd.req && !v && !bad) bad = inp;
        rec[fd.k] = fd.bool ? v === 'true' : fd.t === 'number' ? (v === '' ? '' : +v) : v;
      });
      if (bad) { bad.focus(); bad.reportValidity && bad.reportValidity(); return; }
      if (!id) D[ent].push(rec);
      save(); off(); render();
    });
    var first = m.querySelector('input,select,textarea'); if (first) first.focus();
  }
  function del(ent, id) {
    var it = by(D[ent], id); if (!it) return;
    var extra = ent === 'sem' ? ' Semua mata kuliah di semester ini beserta tugas dan ujiannya ikut terhapus.' : ent === 'course' ? ' Tugas, ujian, dan catatan belajarnya ikut terhapus.' : '';
    if (!confirm('Hapus "' + (it.name || it.title || SPEC[ent].title) + '"?' + extra)) return;
    var rm = function (cid) { ['task', 'exam', 'study'].forEach(function (k) { D[k] = D[k].filter(function (x) { return x.courseId !== cid; }); }); };
    if (ent === 'sem') { D.course.filter(function (c) { return c.semId === id; }).forEach(function (c) { rm(c.id); }); D.course = D.course.filter(function (c) { return c.semId !== id; }); }
    if (ent === 'course') rm(id);
    D[ent] = D[ent].filter(function (x) { return x.id !== id; });
    save(); render();
  }

  /* ===== v5.2 KAMPUS: bilah pilihan, form, ganti/hapus, API untuk modul lain ===== */
  function renderCamp() {
    if (!cpEl) return;
    var cs = RAW.campuses, sel = RAW.campusSel, cur = campById(sel) || cs[0];
    var h = '<div class="cp-bar" role="group" aria-label="Kampus"><span class="cp-lb">Kampus</span><div class="cp-chips">' +
      cs.map(function (c) { return '<button class="cp-chip" data-act="camp" data-v="' + esc(c.id) + '" aria-pressed="' + (c.id === sel) + '">' + esc(c.name) + '</button>'; }).join('') +
      '</div><button class="cp-ic" data-act="campedit" aria-label="Atur kampus ' + esc(cur.name) + '" title="Ganti nama atau hapus kampus ini">' + ic('pen') + '</button>' +
      '<button class="cp-add" data-act="campadd" title="Tambah kampus lain (opsional)">' + ic('plus') + '<span>Kampus</span></button></div>' +
      (cs.length > 1 ? '<p class="cp-hint">Mata kuliah, nilai, IP/IPK, dan analisis di bawah hanya untuk <b>' + esc(cur.name) + '</b>. Kampus lain terpisah.</p>' : '');
    window.__morph(cpEl, h);
  }
  function resetView() { draft = null; trkOpen = null; cf = tf = ef = 'Semua'; q = ''; var qi = ov && ov.querySelector('#acQ'); if (qi) qi.value = ''; }
  /* ganti kampus aktif (tanpa render) */
  function useCamp(id) {
    if (!campById(id) || id === RAW.campusSel) return false;
    save(); scopeTo(id); save(); resetView(); warmLogos(); return true;
  }
  function switchCamp(id) {
    if (!useCamp(id)) return;
    render(); body.scrollTop = 0;
  }
  function campForm(id) {
    var cp = id ? campById(id) : null; if (id && !cp) return;
    var m = el('ac-ov ac-ov2 ad-skin', '<form class="ac-win ac-form" novalidate><header><h2>' + (cp ? 'Atur kampus' : 'Tambah kampus') + '</h2><button type="button" class="ac-x" data-x aria-label="Tutup">×</button></header>' +
      '<div class="ac-fields"><label class="full"><span>Nama kampus *</span><input id="f_cname" name="name" type="text" value="' + esc(cp ? cp.name : '') + '" placeholder="mis. Universitas Indonesia" maxlength="60"></label>' +
      '<p class="ac-hint full">' + (cp ? 'Mengganti nama tidak mengubah data.' : 'Kampus baru mulai kosong: semester, mata kuliah, rumus nilai, IP/IPK, dan analisisnya berdiri sendiri, tidak digabung dengan kampus lain.') + '</p></div>' +
      '<footer>' + (cp && cp.id !== MAIN ? '<button type="button" class="ac-btn danger" data-delcamp>Hapus kampus</button>' : '') +
      '<button type="button" class="ac-btn" data-x>Batal</button><button class="ac-btn pri">Simpan</button></footer></form>');
    document.body.appendChild(m);
    var off = function () { m.remove(); };
    m.addEventListener('mousedown', function (e) { if (e.target === m) off(); });
    m.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-x')) off();
      if (e.target.hasAttribute('data-delcamp')) { off(); delCamp(cp.id); }
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); off(); } });
    m.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = e.target.elements.name, v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      if (RAW.campuses.some(function (c) { return c.id !== (cp && cp.id) && c.name.toLowerCase() === v.toLowerCase(); })) { inp.focus(); return msg('Nama sudah dipakai', 'Pakai nama kampus yang berbeda.'); }
      if (cp) { cp.name = v; save(); off(); render(); return; }
      var nc = { id: uid(), name: v, cfg: seed().cfg };
      save(); RAW.campuses.push(nc); scopeTo(nc.id); save(); resetView(); off();
      tab = 'sem'; render(); body.scrollTop = 0; msg('Kampus ditambahkan', 'Buat semester pertama untuk ' + v + '.');
    });
    var f = m.querySelector('input'); if (f) { f.focus(); f.select && f.select(); }
  }
  function delCamp(id) {
    var cp = campById(id); if (!cp || id === MAIN) return;
    commit(); var sp = split(id), n = sp.d.course.length;
    if (!confirm('Hapus kampus "' + cp.name + '"?' + (sp.d.sem.length || n ? ' ' + sp.d.sem.length + ' semester, ' + n + ' mata kuliah beserta tugas, ujian, catatan belajar, dan rumus nilainya ikut terhapus. Kampus lain tidak terpengaruh.' : ''))) return;
    CKEYS.forEach(function (k) { RAW[k] = sp.r[k]; });
    RAW.campuses = RAW.campuses.filter(function (c) { return c.id !== id; });
    scopeTo(MAIN); save(); resetView(); render(); body.scrollTop = 0;
  }
  /* pindah ke kampus yang memiliki record tertentu (dipakai Inbox/Planner saat membuka item) */
  function focusRec(arr, id) {
    if (!id || CKEYS.indexOf(arr) < 0) return;
    commit();
    for (var i = 0; i < RAW.campuses.length; i++) {
      var cid = RAW.campuses[i].id;
      if (split(cid).d[arr].some(function (x) { return x.id === id; })) { if (cid !== RAW.campusSel) useCamp(cid); return; }
    }
  }
  /* seluruh kampus digabung HANYA untuk pembaca jadwal (Inbox, Planner, Kalender); record = objek yang sama sehingga perubahan tersimpan */
  function allView() {
    var v = { cfg: RAW.cfg, campuses: RAW.campuses, campusSel: RAW.campusSel };
    CKEYS.forEach(function (k) { v[k] = REST[k].concat(D[k]); });
    return v;
  }
  /* data satu kampus (default: kampus terpilih) dengan rumus nilainya sendiri; dipakai Analytics */
  function slice(cid) {
    commit();
    var cp = campById(cid || RAW.campusSel) || RAW.campuses[0], sp = split(cp.id).d;
    sp.id = cp.id; sp.name = cp.name; sp.cfg = campCfg(cp.id); sp.multi = RAW.campuses.length > 1;
    return sp;
  }
  /* ===== v5.2 KAMPUS (akhir blok UI) ===== */

  /* ---------- Event ---------- */
  function onClick(e) {
    var b = e.target.closest('[data-act]'); if (!b || !ov.contains(b)) return;
    var a = b.dataset.act, d = b.dataset;
    if (a === 'close') return close();
    /* v6.1: aksi dari dalam box kampus lain -> pindah kampus dulu (filter Semua/Aktif/Selesai dipertahankan) */
    var bx = b.closest('.stk-box');
    if (bx && a !== 'stkgo' && a !== 'stknav' && bx.dataset.camp !== RAW.campusSel) { var cf0 = cf; if (useCamp(bx.dataset.camp)) { cf = cf0; renderNav(); } }
    if (a === 'stkgo') { if (bx && !d.i) return; if (bx) stkGo(bx, +d.i); return; }
    if (a === 'stknav') { if (bx) stkGo(bx, (bx._idx || 0) + (+d.v)); return; }
    if (a === 'camp') return switchCamp(d.v);          /* v5.2 */
    if (a === 'campadd') return campForm();
    if (a === 'campedit') return campForm(RAW.campusSel);
    if (a === 'tab') {
      if (tab === 'cfg') readCfg();
      tab = d.t; q = ''; var qi = ov.querySelector('#acQ'); if (qi) qi.value = '';
      render(); body.scrollTop = 0; return;
    }
    if (a === 'help') { tab = 'cfg'; q = ''; render(); body.scrollTop = 0; return; }
    if (a === 'bell') { if (tab === 'cfg') readCfg(); tab = 'task'; tf = 'Semua'; q = ''; var q2 = ov.querySelector('#acQ'); if (q2) q2.value = ''; render(); body.scrollTop = 0; return; }
    if (a === 'cf') { if (cf === d.v) return; cf = d.v; return renderCf(); }
    if (a === 'tx') { trkOpen = trkOpen === d.id ? '' : d.id; return renderBody(); }
    if (a === 'tlogo') { e.stopPropagation(); return pickLogo(d.id); }
    if (a === 'mn' || a === 'ma') {
      var mc = by(D.course, d.id); if (!mc) return; var mm = trk(mc).m[+d.i];
      if (a === 'mn') mm.n = mm.n ? 0 : 1; else mm.a = mm.a === d.v ? '' : d.v;
      save(); return renderBody();
    }
    if (a === 'mdate' || a === 'tstart') return;
    if (a === 'mall') { var ac = by(D.course, d.id), tt = trk(ac), allOn = tt.m.every(function (x) { return x.n; }); tt.m.forEach(function (x) { x.n = allOn ? 0 : 1; }); save(); return renderBody(); }
    if (a === 'mclr') { if (!confirm('Reset catatan, absensi, dan tanggal 16 pertemuan mata kuliah ini?')) return; var rc = by(D.course, d.id); rc.trk = null; trk(rc); save(); return renderBody(); }
    if (a === 'mfill') {
      var fc = by(D.course, d.id), ft = trk(fc); if (!ft.start) return msg('Isi dulu', 'Tentukan tanggal mulai kuliah.');
      var b0 = new Date(ft.start + 'T00:00:00'); ft.m.forEach(function (x, i) { if (!x.d) { var z = new Date(b0); z.setDate(z.getDate() + 7 * i); x.d = dstr(z.getFullYear(), z.getMonth(), z.getDate()); } });
      save(); return renderBody();
    }
    if (a === 'exdone') { var xe = by(D.exam, d.id); if (xe) { xe.done = !xe.done; save(); } return renderBody(); }
    if (a === 'done') { var dt = by(D.task, d.id); if (dt) { dt.status = 'Selesai'; save(); } return render(); }
    if (a === 'day') { sel = d.v; var dd = new Date(d.v + 'T00:00:00'); cal = { y: dd.getFullYear(), m: dd.getMonth() }; return renderSide(); }
    if (a === 'calnav') { var nd = new Date(cal.y, cal.m + (+d.v), 1); cal = { y: nd.getFullYear(), m: nd.getMonth() }; return renderSide(); }
    if (a === 'prof') { close(); if (MO.routes['#settings']) MO.routes['#settings'](); return; }
    if (a === 'add') {
      if (d.e === 'course' && !D.sem.some(function (s) { return s.active; })) return msg('Belum ada semester aktif', 'Aktifkan atau buat semester terlebih dahulu.');
      if ((d.e === 'task' || d.e === 'exam' || d.e === 'study') && !D.course.length) return msg('Belum ada mata kuliah', 'Tambahkan mata kuliah terlebih dahulu.');
      return openForm(d.e, null, d.sem ? { semId: d.sem } : d.course ? { courseId: d.course, type: d.type || 'UTS' } : null);
    }
    if (a === 'edit') return openForm(d.e, d.id);
    if (a === 'del') return del(d.e, d.id);
    if (a === 'togsem') { var s = by(D.sem, d.id); s.active = !s.active; save(); return render(); }
    if (a === 'tgtask') { var t = by(D.task, d.id); t.status = e.target.checked ? 'Selesai' : 'Belum dikerjakan'; save(); return render(); }
    if (a === 'filt') { if (d.f === 'tf') tf = d.v; else ef = d.v; return render(); }
    if (a === 'cfgadd') { readCfg(); draft[d.k].push(d.k === 'scale' ? { l: '', min: 0, p: 0 } : { n: '', w: 0 }); return render(); }
    if (a === 'cfgdel') { readCfg(); draft[d.k].splice(+d.i, 1); return render(); }
    if (a === 'cfgreset') { draft = null; return render(); }
    if (a === 'cfgsave') {
      readCfg();
      var okS = draft.scale.length && draft.scale.every(function (r) { return r.l.trim(); });
      var sum = draft.cats.reduce(function (x, k) { return x + (+k.w || 0); }, 0);
      if (!okS) return msg('Belum bisa disimpan', 'Skala nilai harus berisi minimal satu baris dan semua hurufnya terisi.');
      if (!draft.cats.length || sum <= 0) return msg('Belum bisa disimpan', 'Total bobot komponen harus lebih dari 0.');
      if (!draft.normalize && sum !== 100 && !confirm('Total bobot ' + sum + '%, bukan 100%. Nilai akhir akan dihitung dibagi ' + sum + '. Lanjutkan?')) return;
      draft.confirmed = true; D.cfg = draft; draft = null; save(); msg('Tersimpan', 'Formula nilai aktif dan dipakai di seluruh perhitungan.'); return render();
    }
  }

  /* ---------- Dialog singkat & Coming soon ---------- */
  var MO = window.MyOffice = window.MyOffice || {}; MO.routes = MO.routes || {};
  MO.routes['#academic'] = function () { open(); };
  var dlg, tm;
  function msg(title, text) {
    if (!dlg) { dlg = el('ac-soon', '<div><small></small><b></b></div>'); dlg.hidden = true; document.body.appendChild(dlg); dlg.addEventListener('click', function () { dlg.hidden = true; }); }
    dlg.querySelector('small').textContent = title; dlg.querySelector('b').textContent = text;
    dlg.hidden = false; clearTimeout(tm); tm = setTimeout(function () { dlg.hidden = true; }, 2200);
  }
  MO.msg = function (t, x) { msg(t, x); };
  MO.acadGo = function (t, cid) { if (!ov) build(); if (cid) useCamp(cid); tab = t || 'dash'; q = ''; open(); };   /* v5.2: cid opsional = kampus tujuan */
  MO.acadRender = function () { if (ov && !ov.hidden) renderBody(); };
  MO.acadData = { D: allView, save: save, scoped: function () { return D; }, focus: focusRec };   /* v4.9: dipakai Inbox. v5.2: D() = semua kampus (hanya untuk jadwal); scoped() = kampus terpilih */
  MO.acadSlice = slice; MO.acadCampuses = function () { return RAW.campuses.map(function (c) { return { id: c.id, name: c.name }; }); };
  function soon(label) {
    if (!dlg) msg('', '');
    msg(label || '', 'Coming s0000000n');
    dlg.querySelector('b').style.fontSize = '';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('.nav a');
    if (a) {
      e.preventDefault(); e.stopPropagation();
      var h = a.getAttribute('href');
      if (h === '#academic') return open();
      if (MO.routes[h]) return MO.routes[h]();
      return soon(a.textContent.replace(/\s+/g, ' ').trim());
    }
    var t = e.target.closest('.tools button');
    if (t && t.id !== 'themeBtn') {
      if (t.classList.contains('avatar') && MO.routes['#settings']) return MO.routes['#settings']();
      soon(t.getAttribute('aria-label') || '');
    }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (dlg && !dlg.hidden) dlg.hidden = true;
    else if (ov && !ov.hidden && !document.querySelector('.ac-ov2')) close();
  });
})();
;
/* MyOffice — Exam: latihan & ujian pilihan ganda dari bank soal (hasil tersimpan di localStorage) */
(function () {
  'use strict';
  var MO = window.MyOffice = window.MyOffice || {};
  var HK = 'mo-exam-v1', BK = 'mo-exam-banks-v1', LT = ['A', 'B', 'C', 'D', 'E', 'F'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var say = function (t, x) { if (MO.msg) MO.msg(t, x); };
  var rd = function (k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  var wr = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { say('Peringatan', 'Data tidak bisa disimpan di browser ini.'); } };
  var p2 = function (n) { return ('0' + n).slice(-2); };
  var clock = function (s) { s = Math.max(0, Math.round(s)); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + p2(Math.floor(s % 3600 / 60)) + ':' + p2(s % 60); };
  var hist = rd(HK), mine = rd(BK), view = 'lib', cfg = null, S = null, R = null, tm = null, folder = null;
  var gid = function (i) { return document.getElementById(i); };

  function shuf(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rerender(top) { if (MO.acadRender) MO.acadRender(); var b = gid('acBody'); if (b && top !== false) b.scrollTop = 0; }

  /* ---------- Bank soal ---------- */
  function norm(b) {
    if (!b || !Array.isArray(b.questions)) return null;
    var qs = [];
    b.questions.forEach(function (x) {
      if (!x || !x.q || !Array.isArray(x.o) || x.o.length < 2) return;
      var a = typeof x.a === 'string' ? LT.indexOf(x.a.trim().toUpperCase()) : +x.a;
      if (!(a >= 0 && a < x.o.length)) return;
      qs.push({ q: String(x.q), o: x.o.map(String), a: a, e: x.e ? String(x.e) : '' });
    });
    return qs.length ? { id: String(b.id || 'u' + Date.now().toString(36)), title: String(b.title || 'Bank soal'), course: b.course ? String(b.course) : '', questions: qs } : null;
  }
  function banks() {
    var out = [];
    (window.MO_EXAM_BANKS || []).forEach(function (b) { var n = norm(b); if (n) { n.builtin = true; out.push(n); } });
    return out.concat(mine);
  }
  var bankOf = function (id) { return banks().filter(function (b) { return b.id === id; })[0]; };
  function stat(id) {
    var h = hist.filter(function (x) { return x.bank === id && !x.redo; });
    return { n: h.length, best: h.length ? Math.max.apply(null, h.map(function (x) { return x.pct; })) : 0 };
  }

  /* ---------- Tampilan: folder mata kuliah & daftar bank ---------- */
  var FI = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  function groups() {
    var g = {}, order = [];
    banks().forEach(function (b) { var c = b.course || 'Lainnya'; if (!g[c]) { g[c] = []; order.push(c); } g[c].push(b); });
    return order.map(function (c) { return { name: c, banks: g[c] }; });
  }
  function vLib() {
    var bs = banks(), gs = groups(), cur = folder && gs.filter(function (g) { return g.name === folder; })[0];
    if (!cur) folder = null;
    var h = '<div class="ac-bar"><p class="ac-hint">' + (cur ? 'Pilih bank soal, atur mode, lalu mulai.' : 'Pilih folder mata kuliah untuk mulai berlatih.') + '</p><button class="ac-btn pri" data-ex="import">+ Impor soal</button></div>';
    if (S) {
      var dn = S.ans.filter(function (x) { return x >= 0; }).length;
      h += '<div class="ex-resume"><span>Sesi <b>' + esc(S.title) + '</b> masih berjalan, ' + dn + ' dari ' + S.qs.length + ' soal terjawab.</span><button class="ac-btn pri sm" data-ex="resume">Lanjutkan</button></div>';
    }
    if (!bs.length) return h + '<div class="ac-empty">Belum ada bank soal. Impor file JSON untuk mulai berlatih.</div>';
    if (cur) {
      return h + '<button class="ex-back" data-ex="folders">‹ Semua mata kuliah</button><h3 class="ex-fh">' + esc(cur.name) + '</h3><div class="ex-bg">' + cur.banks.map(function (b) {
        var s = stat(b.id);
        return '<article class="ex-bk"><div class="ex-bt"><b>' + esc(b.title) + '</b><small>' + b.questions.length + ' soal</small></div>' +
          '<div class="ex-bs">' + (s.n ? '<div class="ex-bar" role="img" aria-label="Skor terbaik ' + s.best + '"><i style="width:' + s.best + '%"></i></div><small>Skor terbaik <b>' + s.best + '</b>, dikerjakan ' + s.n + 'x</small>' : '<small>Belum pernah dikerjakan</small>') + '</div>' +
          '<div class="ex-ba"><button class="ac-btn pri sm" data-ex="setup" data-id="' + esc(b.id) + '">Mulai</button>' + (b.builtin ? '' : '<button class="ac-btn sm danger" data-ex="delbank" data-id="' + esc(b.id) + '">Hapus</button>') + '</div></article>';
      }).join('') + '</div>';
    }
    h += '<div class="ex-bg">' + gs.map(function (g) {
      var n = g.banks.reduce(function (t, b) { return t + b.questions.length; }, 0);
      return '<button class="ex-fd" data-ex="folder" data-c="' + esc(g.name) + '"><span class="ex-fi">' + FI + '</span><b>' + esc(g.name) + '</b><small>' + g.banks.length + ' bank soal, ' + n + ' soal</small></button>';
    }).join('') + '</div>';
    if (hist.length) {
      h += '<div class="ad-sh"><h2 class="ad-h sm">Riwayat terakhir</h2></div><div class="ex-hist">' + hist.slice(0, 6).map(function (x) {
        return '<div class="ex-hr"><div><b>' + esc(x.title) + '</b><small>' + new Date(x.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ', ' + (x.mode === 'ujian' ? 'ujian' : 'latihan') + '</small></div><span>' + x.correct + '/' + x.n + '</span><b class="ex-hp">' + x.pct + '</b></div>';
      }).join('') + '</div>';
    }
    return h;
  }

  /* ---------- Tampilan: pengaturan ---------- */
  function vSetup() {
    var b = bankOf(cfg.id); if (!b) { view = 'lib'; return vLib(); }
    var N = b.questions.length, ns = [10, 20, 30, 50].filter(function (n) { return n < N; }), cnt = cfg.n === 'all' ? N : Math.min(+cfg.n, N);
    var M = [['latihan', 'Latihan', 'Jawaban benar dan pembahasan langsung muncul setelah kamu memilih.'], ['ujian', 'Ujian', 'Berwaktu. Jawaban bisa diubah, hasil dan pembahasan muncul setelah selesai.']];
    return '<button class="ex-back" data-ex="lib">‹ Kembali ke folder</button><div class="ex-set"><h3>' + esc(b.title) + '</h3><p class="ac-hint">' + N + ' soal tersedia</p>' +
      '<div class="ex-modes">' + M.map(function (m) { return '<button class="ex-mode" data-ex="mode" data-v="' + m[0] + '" aria-pressed="' + (cfg.mode === m[0]) + '"><b>' + m[1] + '</b><span>' + m[2] + '</span></button>'; }).join('') + '</div>' +
      '<div class="ex-row"><label class="ex-f"><span>Jumlah soal</span><select id="exN"><option value="all"' + (cfg.n === 'all' ? ' selected' : '') + '>Semua (' + N + ')</option>' + ns.map(function (n) { return '<option value="' + n + '"' + (String(cfg.n) === String(n) ? ' selected' : '') + '>' + n + ' soal</option>'; }).join('') + '</select></label>' +
      (cfg.mode === 'ujian' ? '<label class="ex-f"><span>Waktu (menit)</span><input id="exMin" type="number" min="1" step="1" value="' + (cfg.min || cnt) + '"' + (cfg.min ? ' data-t="1"' : '') + '></label>' : '') + '</div>' +
      '<label class="ex-ck"><input type="checkbox" id="exSh"' + (cfg.sh ? ' checked' : '') + '><span>Acak urutan soal</span></label>' +
      '<label class="ex-ck"><input type="checkbox" id="exSo"' + (cfg.so ? ' checked' : '') + '><span>Acak urutan pilihan<small>Matikan bila ada pilihan seperti "semua jawaban benar".</small></span></label>' +
      '<button class="ac-btn pri ex-go" data-ex="start">Mulai ' + (cfg.mode === 'ujian' ? 'ujian' : 'latihan') + '</button></div>';
  }
  function readCfg() { if (gid('exN')) { cfg.n = gid('exN').value; cfg.sh = gid('exSh').checked; cfg.so = gid('exSo').checked; } }

  /* ---------- Sesi ---------- */
  function start(id, title, src, o) {
    var idx = src.map(function (_, i) { return i; }); if (o.sh) shuf(idx);
    var qs = idx.slice(0, o.n).map(function (i) {
      var q = src[i], op = q.o.map(function (t, k) { return { t: t, k: k }; }); if (o.so) shuf(op);
      return { q: q.q, o: op.map(function (x) { return x.t; }), a: op.map(function (x) { return x.k; }).indexOf(q.a), e: q.e };
    });
    S = { bank: id, title: title, mode: o.mode, redo: !!o.redo, qs: qs, ans: qs.map(function () { return -1; }), flag: {}, cur: 0, t0: Date.now(), end: o.mode === 'ujian' ? Date.now() + o.min * 6e4 : 0 };
    clearInterval(tm); tm = setInterval(tick, 1000); view = 'run'; rerender();
  }
  var timeTxt = function () { return S.end ? clock((S.end - Date.now()) / 1000) : clock((Date.now() - S.t0) / 1000); };
  function tick() {
    if (!S) return clearInterval(tm);
    if (S.end && Date.now() >= S.end) { say('Waktu habis', 'Jawaban dikumpulkan otomatis.'); return finish(true); }
    var e = gid('exTm'); if (e) { e.textContent = timeTxt(); e.classList.toggle('low', !!S.end && S.end - Date.now() < 6e4); }
  }
  function pick(k) {
    var q = S.qs[S.cur]; if (k >= q.o.length) return;
    if (S.mode === 'latihan') { if (S.ans[S.cur] >= 0) return; S.ans[S.cur] = k; } else S.ans[S.cur] = S.ans[S.cur] === k ? -1 : k;
    rerender(false);
  }
  function go(i) { if (i < 0 || i >= S.qs.length) return; S.cur = i; rerender(); }
  function finish(auto) {
    var un = S.ans.filter(function (x) { return x < 0; }).length;
    if (!auto && un && !confirm(un + ' soal belum dijawab. Selesaikan sekarang?')) return;
    clearInterval(tm);
    var ok = S.qs.filter(function (q, i) { return S.ans[i] === q.a; }).length;
    var r = { bank: S.bank, title: S.title, date: new Date().toISOString(), mode: S.mode, redo: S.redo, n: S.qs.length, correct: ok, pct: Math.round(ok / S.qs.length * 100), dur: Math.round((Date.now() - S.t0) / 1000) };
    hist.unshift(r); hist = hist.slice(0, 200); wr(HK, hist);
    R = { r: r, s: S }; S = null; view = 'res'; rerender();
  }

  /* ---------- Tampilan: mengerjakan ---------- */
  function vRun() {
    var q = S.qs[S.cur], a = S.ans[S.cur], lock = S.mode === 'latihan' && a >= 0, dn = S.ans.filter(function (x) { return x >= 0; }).length;
    var h = '<div class="ex-hd"><div><b>' + esc(S.title) + '</b><small>Mode ' + S.mode + ', ' + dn + ' dari ' + S.qs.length + ' terjawab</small></div><span class="ex-tm" id="exTm" role="timer">' + timeTxt() + '</span><button class="ac-btn" data-ex="quit">Keluar</button><button class="ac-btn pri" data-ex="finish">Selesai</button></div>';
    h += '<div class="ex-cols"><section class="ex-card"><div class="ex-qn">Soal ' + (S.cur + 1) + ' dari ' + S.qs.length + (S.flag[S.cur] ? ', ditandai' : '') + '</div><p class="ex-q">' + esc(q.q) + '</p><div class="ex-opts">' +
      q.o.map(function (t, k) {
        var c = lock ? (k === q.a ? ' ok' : k === a ? ' bad' : ' dim') : k === a ? ' sel' : '';
        return '<button class="ex-o' + c + '" data-ex="pick" data-k="' + k + '"' + (lock ? ' disabled' : '') + '><i>' + LT[k] + '</i><span>' + esc(t) + '</span></button>';
      }).join('') + '</div>';
    if (lock) h += '<div class="ex-exp ' + (a === q.a ? 'ok' : 'bad') + '" role="status"><b>' + (a === q.a ? 'Benar' : 'Belum tepat') + '</b><p>Jawaban yang benar: ' + LT[q.a] + '. ' + esc(q.o[q.a]) + '</p>' + (q.e ? '<p>' + esc(q.e) + '</p>' : '') + '</div>';
    h += '<div class="ex-nv"><button class="ac-btn" data-ex="prev"' + (S.cur ? '' : ' disabled') + '>Sebelumnya</button><button class="ac-btn" data-ex="flag" aria-pressed="' + !!S.flag[S.cur] + '">' + (S.flag[S.cur] ? 'Lepas tanda' : 'Tandai ragu') + '</button><button class="ac-btn pri" data-ex="next"' + (S.cur < S.qs.length - 1 ? '' : ' disabled') + '>Berikutnya</button></div></section>' +
      '<aside class="ex-sheet"><h4>Lembar jawaban</h4><div class="ex-grid">' + S.qs.map(function (x, i) {
        var v = S.ans[i], c = (i === S.cur ? ' cur' : '') + (v >= 0 ? (S.mode === 'latihan' ? (v === x.a ? ' ok' : ' bad') : ' on') : '') + (S.flag[i] ? ' fl' : '');
        return '<button class="ex-g' + c + '" data-ex="go" data-i="' + i + '" aria-label="Soal ' + (i + 1) + (S.flag[i] ? ', ditandai' : '') + '">' + (i + 1) + '</button>';
      }).join('') + '</div><p class="ex-lg">Tanda titik kecil berarti soal ditandai ragu. Pintasan: A–E untuk memilih, panah kiri/kanan untuk pindah soal.</p></aside></div>';
    return h;
  }

  /* ---------- Tampilan: hasil ---------- */
  function vRes() {
    var r = R.r, s = R.s, blank = s.ans.filter(function (x) { return x < 0; }).length, bad = r.n - r.correct - blank;
    var h = '<div class="ex-sum"><div class="ex-pct"><b>' + r.pct + '</b><small>skor dari 100</small></div><div class="ex-st"><h3>' + esc(r.title) + '</h3><p>' + r.correct + ' benar, ' + bad + ' salah, ' + blank + ' kosong</p><p class="ac-hint">Mode ' + r.mode + ', waktu ' + clock(r.dur) + '</p>' +
      '<div class="ex-act">' + (r.n - r.correct ? '<button class="ac-btn pri" data-ex="redo">Ulangi ' + (r.n - r.correct) + ' soal yang belum benar</button>' : '') + (r.redo ? '' : '<button class="ac-btn" data-ex="setup" data-id="' + esc(r.bank) + '">Kerjakan lagi</button>') + '<button class="ac-btn" data-ex="lib">Kembali ke bank soal</button></div></div></div>';
    h += '<div class="ex-strip">' + s.qs.map(function (q, i) { var v = s.ans[i]; return '<button class="ex-g ' + (v < 0 ? 'skip' : v === q.a ? 'ok' : 'bad') + '" data-ex="jump" data-i="' + i + '" aria-label="Soal ' + (i + 1) + '">' + (i + 1) + '</button>'; }).join('') + '</div>';
    h += '<div class="ad-sh"><h2 class="ad-h sm">Pembahasan</h2></div>' + s.qs.map(function (q, i) {
      var v = s.ans[i], st = v < 0 ? 'skip' : v === q.a ? 'ok' : 'bad';
      return '<article class="ex-ri ' + st + '" id="exr' + i + '"><header><span>Soal ' + (i + 1) + '</span><em>' + (st === 'ok' ? 'Benar' : st === 'bad' ? 'Salah' : 'Tidak dijawab') + '</em></header><p class="ex-q sm">' + esc(q.q) + '</p><ul class="ex-rl">' +
        q.o.map(function (t, k) { return '<li class="' + (k === q.a ? 'ok' : k === v ? 'bad' : '') + '"><i>' + LT[k] + '</i><span>' + esc(t) + '</span>' + (k === q.a ? '<b>Jawaban benar</b>' : k === v ? '<b>Jawabanmu</b>' : '') + '</li>'; }).join('') + '</ul>' +
        (q.e ? '<div class="ex-exp"><p>' + esc(q.e) + '</p></div>' : '') + '</article>';
    }).join('');
    return h;
  }

  /* ---------- Impor bank soal ---------- */
  function openImport() {
    var m = document.createElement('div'); m.className = 'ex-ov ac-ov2';
    m.innerHTML = '<form class="ex-imp" novalidate><header><h3>Impor bank soal</h3><button type="button" class="ac-x" data-x aria-label="Tutup">×</button></header>' +
      '<p class="ac-hint">Pilih file .json atau tempel isinya. Bank dengan id yang sama akan diperbarui.</p><input type="file" id="exFile" accept=".json,application/json">' +
      '<textarea id="exJson" rows="9" spellcheck="false" aria-label="Isi JSON" placeholder=\'{"id":"bank-1","title":"Judul","course":"Mata kuliah","questions":[{"q":"Soal","o":["Pilihan A","Pilihan B"],"a":0,"e":"Pembahasan"}]}\'></textarea>' +
      '<p class="ex-err" id="exErr" hidden></p><footer><button type="button" class="ac-btn" data-x>Batal</button><button class="ac-btn pri">Impor</button></footer></form>';
    document.body.appendChild(m);
    var off = function () { m.remove(); }, err = m.querySelector('#exErr'), ta = m.querySelector('#exJson');
    m.addEventListener('mousedown', function (e) { if (e.target === m) off(); });
    m.addEventListener('click', function (e) { if (e.target.hasAttribute('data-x')) off(); });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); off(); } });
    m.querySelector('#exFile').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { ta.value = fr.result; }; fr.readAsText(f); });
    m.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data; try { data = JSON.parse(ta.value); } catch (x) { err.textContent = 'Isi bukan JSON yang valid. Periksa tanda kutip dan koma.'; err.hidden = false; return; }
      var ok = (Array.isArray(data) ? data : [data]).map(norm).filter(Boolean);
      if (!ok.length) { err.textContent = 'Tidak ada soal valid. Setiap soal butuh q, o (minimal 2 pilihan), dan a (indeks atau huruf jawaban).'; err.hidden = false; return; }
      ok.forEach(function (b) { mine = mine.filter(function (x) { return x.id !== b.id; }); mine.push(b); });
      wr(BK, mine); off(); say('Tersimpan', ok.length + ' bank soal ditambahkan'); view = 'lib'; rerender();
    });
    ta.focus();
  }

  /* ---------- Event ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ex]'); if (!b) return;
    var a = b.dataset.ex, d = b.dataset;
    if (a === 'import') return openImport();
    if (a === 'lib') { view = 'lib'; return rerender(); }
    if (a === 'folders') { folder = null; view = 'lib'; return rerender(); }
    if (a === 'folder') { folder = d.c; view = 'lib'; return rerender(); }
    if (a === 'setup') { var sb = bankOf(d.id); if (sb) folder = sb.course || 'Lainnya'; cfg = { id: d.id, mode: 'latihan', n: 'all', min: '', sh: true, so: false }; view = 'setup'; return rerender(); }
    if (a === 'mode') { readCfg(); cfg.mode = d.v; return rerender(false); }
    if (a === 'start') {
      readCfg(); var bk = bankOf(cfg.id); if (!bk) return;
      if (S && !confirm('Sesi yang sedang berjalan akan diganti. Lanjutkan?')) return;
      var n = cfg.n === 'all' ? bk.questions.length : Math.min(+cfg.n, bk.questions.length);
      return start(bk.id, bk.title, bk.questions, { mode: cfg.mode, n: n, min: Math.max(1, +cfg.min || n), sh: cfg.sh, so: cfg.so });
    }
    if (a === 'resume') { view = 'run'; return rerender(); }
    if (a === 'delbank') { if (confirm('Hapus bank soal ini dari perangkat? Riwayat skor tetap tersimpan.')) { mine = mine.filter(function (x) { return x.id !== d.id; }); wr(BK, mine); rerender(false); } return; }
    if (a === 'jump') { var t = gid('exr' + d.i); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (a === 'redo') {
      var wrong = R.s.qs.filter(function (q, i) { return R.s.ans[i] !== q.a; });
      return start(R.r.bank, R.r.title + ' (ulangi)', wrong, { mode: 'latihan', n: wrong.length, sh: true, so: false, redo: true });
    }
    if (!S) return;
    if (a === 'pick') return pick(+d.k);
    if (a === 'go') return go(+d.i);
    if (a === 'prev') return go(S.cur - 1);
    if (a === 'next') return go(S.cur + 1);
    if (a === 'flag') { S.flag[S.cur] = !S.flag[S.cur]; return rerender(false); }
    if (a === 'finish') return finish(false);
    if (a === 'quit') { if (!confirm('Keluar dari sesi ini? Jawabanmu tidak akan disimpan.')) return; clearInterval(tm); S = null; view = 'lib'; return rerender(); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'exMin' && cfg) { e.target.dataset.t = '1'; cfg.min = e.target.value; } });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'exN' || !cfg) return;
    var m = gid('exMin'), bk = bankOf(cfg.id); if (m && !m.dataset.t && bk) m.value = e.target.value === 'all' ? bk.questions.length : e.target.value;
  });
  document.addEventListener('keydown', function (e) {
    var t = gid('exTm'); if (!S || view !== 'run' || !t || !t.offsetParent || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var k = e.key.toLowerCase(), i = 'abcdef'.indexOf(k); if (k.length !== 1) i = -1;
    if (i >= 0 && i < S.qs[S.cur].o.length) { pick(i); e.preventDefault(); }
    else if (e.key === 'ArrowRight') go(S.cur + 1); else if (e.key === 'ArrowLeft') go(S.cur - 1);
  });

  MO.examView = function () { return view === 'setup' && cfg ? vSetup() : view === 'run' && S ? vRun() : view === 'res' && R ? vRes() : vLib(); };
})();
;
/* MyOffice — Work Office, Organization, Project Management (data di localStorage perangkat) */
(function () {
  'use strict';
  var MO = window.MyOffice = window.MyOffice || {}; MO.routes = MO.routes || {};
  var SKIP = { skip: 1 };   /* v4.6: nilai balik act() = jangan simpan & render ulang jendela ini */
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var has = function (v) { return v !== '' && v != null && !isNaN(+v); };
  var fmt = function (n) { return n == null ? '—' : String(Math.round(n * 10) / 10); };
  var rp = function (n) { return 'Rp ' + Math.round(+n || 0).toLocaleString('id-ID'); };
  var fd = function (v) { if (!v) return '—'; var d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
  var todayS = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var by = function (a, id) { return a.filter(function (x) { return x.id === id; })[0]; };
  var el = function (c, h) { var d = document.createElement('div'); d.className = c; d.innerHTML = h; return d; };
  var link = function (v) { return /^https?:\/\//i.test(v || '') ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v.replace(/^https?:\/\//i, '').slice(0, 40)) + '</a>' : esc(v || ''); };
  var btns = function (e, id) { return '<div class="ac-acts"><button class="ac-btn sm" data-act="edit" data-e="' + e + '" data-id="' + id + '">Edit</button><button class="ac-btn sm danger" data-act="del" data-e="' + e + '" data-id="' + id + '">Hapus</button></div>'; };
  var empty = function (t) { return '<div class="ac-empty">' + t + '</div>'; };
  var bar = function (t, b) { return '<div class="ac-bar"><p class="ac-hint">' + t + '</p>' + (b || '') + '</div>'; };
  var add = function (e, label, pk, pv) { return '<button class="ac-btn pri" data-act="add" data-e="' + e + '"' + (pk ? ' data-pk="' + pk + '" data-pv="' + pv + '"' : '') + '>+ ' + label + '</button>'; };
  var chips = function (list, cur, f) { return '<div class="ac-chips">' + list.map(function (x) { return '<button class="ac-chip" aria-pressed="' + (x === cur) + '" data-act="filt" data-f="' + f + '" data-v="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>'; };
  var prog = function (p) { return p == null ? '<small>Belum ada data</small>' : '<div class="ac-track"><i style="width:' + Math.min(100, p) + '%"></i></div>'; };
  var opt = function (a) { return a.map(function (x) { return [x, x]; }); };
  var stat = function (b, s) { return '<div class="ac-stat"><b>' + b + '</b><span>' + s + '</span></div>'; };
  var badge = function (t, c) { return '<span class="ac-badge ' + (c || '') + '">' + esc(t) + '</span>'; };

  /* ---------- Kerangka jendela generik ---------- */
  function App(title, key, seed, def) {
    var app = {}, D, ov, body, st = {};
    try { D = JSON.parse(localStorage.getItem(key)); } catch (e) { }
    D = D || {}; (function (S) { for (var k in S) if (D[k] === undefined) D[k] = S[k]; })(seed()); app.D = D; app.st = st;
    var C = def(app), tab = C.tabs[0][0];
    var save = app.save = function () { try { localStorage.setItem(key, JSON.stringify(D)); } catch (e) { MO.msg('Peringatan', 'Data tidak bisa disimpan di browser ini.'); } };
    (MO.apps = MO.apps || {})[key] = app;   /* v4.9: Inbox mengubah data lewat objek hidup modul (bukan langsung ke localStorage) */

    function build() {
      ov = el('ac-ov' + (C.skin ? ' ' + C.skin : ''), '<section class="ac-win" role="dialog" aria-modal="true" aria-label="' + title + '"><header><div><h2>' + title + '</h2><p></p></div><button class="ac-x" data-act="close" aria-label="Tutup">×</button></header>' +
        (C.tabs.length > 1 ? '<nav class="ac-tabs">' + C.tabs.map(function (t) { return '<button class="ac-tab" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav>' : '') + '<div class="ac-body"></div></section>');
      ov.hidden = true; document.body.appendChild(ov); body = ov.querySelector('.ac-body');
      ov.addEventListener('click', onClick);
      ov.addEventListener('input', function (e) {
        var k = e.target.dataset && e.target.dataset.in; if (!k) return;
        st[k] = e.target.value; var pos = e.target.selectionStart; render();
        var n = body.querySelector('[data-in="' + k + '"]'); if (n && n.tagName === 'INPUT' && n.type === 'text' || n && n.type === 'search') { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } }
      });
      ov.addEventListener('change', function (e) {
        var t = e.target, a = t.dataset && t.dataset.chg; if (!a || !C.act) return;
        C.act(a, Object.assign({}, t.dataset, { v: t.value }), t); save(); render();
      });
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ov.hidden && !document.querySelector('.ac-ov2, .ac-soon:not([hidden])')) close(); });
    }
    function open() { if (!ov) build(); ov.hidden = false; document.body.style.overflow = 'hidden'; render(); requestAnimationFrame(function () { var x = ov.hidden ? null : ov.querySelector('.ac-x'); if (x) x.focus({ preventScroll: true }); }); }   /* v4.6: fokus ditunda agar tidak memaksa layout di klik */
    function close() { if (ov) ov.hidden = true; document.body.style.overflow = ''; }
    function render() {
      if (app.onChange) app.onChange();
      if (!ov) return;
      C.tabs.forEach(function (t) { var b = ov.querySelector('[data-t="' + t[0] + '"]'); if (b) b.setAttribute('aria-selected', t[0] === tab); });
      ov.querySelector('header p').textContent = C.sub ? C.sub() : '';
      var top = body.scrollTop;
      window.__morph(body, C.tabs.filter(function (t) { return t[0] === tab; })[0][2]());
      if (top) body.scrollTop = top; /* v4.4: tanpa set scrollTop saat sudah di atas (menghindari layout sinkron) */
    }
    function fld(f, v) {
      var at = 'id="f_' + f.k + '" name="' + f.k + '"' + (f.req ? ' required' : ''), inp;
      if (f.t === 'textarea') inp = '<textarea ' + at + ' rows="3">' + esc(v) + '</textarea>';
      else if (f.t === 'select') { var o = typeof f.o === 'function' ? f.o(v) : f.o; inp = '<select ' + at + '>' + o.map(function (p) { return '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(v) ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('') + '</select>'; }
      else inp = '<input ' + at + ' type="' + f.t + '" value="' + esc(v) + '"' + (f.t === 'number' ? ' step="' + (f.step || 'any') + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
      return '<label class="' + (f.full ? 'full' : '') + '"><span>' + f.l + (f.req ? ' *' : '') + '</span>' + inp + '</label>';
    }
    function form(ent, id, preset) {
      var sp = C.specs[ent], it = id ? by(D[ent], id) : Object.assign({}, sp.def, preset || {});
      if (!id && ent === 'log') it.date = todayS();
      var before = id ? JSON.parse(JSON.stringify(it)) : null;
      var m = el('ac-ov ac-ov2' + (C.skin ? ' ' + C.skin : ''), '<form class="ac-win ac-form" novalidate><header><h2>' + (id ? 'Edit ' : 'Tambah ') + sp.title + '</h2><button type="button" class="ac-x" data-x aria-label="Tutup">×</button></header><div class="ac-fields">' +
        sp.fields.map(function (f) { var v = it[f.k]; if (f.bool) v = String(!!v); return fld(f, v == null ? '' : v); }).join('') + '</div><footer><button type="button" class="ac-btn" data-x>Batal</button><button class="ac-btn pri">Simpan</button></footer></form>');
      document.body.appendChild(m);
      var off = function () { m.remove(); };
      m.addEventListener('mousedown', function (e) { if (e.target === m) off(); });
      m.addEventListener('click', function (e) { if (e.target.hasAttribute('data-x')) off(); });
      m.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); off(); } });
      m.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, bad = null, rec = id ? Object.assign({}, it) : { id: uid() };
        sp.fields.forEach(function (fd2) {
          var inp = f.elements[fd2.k], v = inp.value.trim();
          if (fd2.req && !v && !bad) bad = inp;
          rec[fd2.k] = fd2.bool ? v === 'true' : fd2.t === 'number' ? (v === '' ? '' : +v) : v;
        });
        if (bad) { bad.focus(); if (bad.reportValidity) bad.reportValidity(); return; }
        var err = C.validate && C.validate(ent, rec, !id); if (err) { MO.msg('Periksa data', err); return; }
        if (id) Object.assign(it, rec); else D[ent].push(rec);
        if (C.saved) C.saved(ent, id ? it : rec, !id, before);
        save(); off(); render();
      });
      var first = m.querySelector('input,select,textarea'); if (first) first.focus();
    }
    function rm(ent, id) {
      ((C.cascade || {})[ent] || []).forEach(function (c) { D[c[0]].filter(function (x) { return x[c[1]] === id; }).forEach(function (x) { rm(c[0], x.id); }); });
      D[ent] = D[ent].filter(function (x) { return x.id !== id; });
    }
    function del(ent, id) {
      var it = by(D[ent], id); if (!it) return;
      var blk = C.canDel && C.canDel(ent, id); if (blk) return MO.msg('Tidak bisa dihapus', blk);
      if (!confirm('Hapus "' + (it.name || it.title || it.item || it.task || C.specs[ent].title) + '"?' + ((C.cascade || {})[ent] ? ' Data turunannya ikut terhapus.' : ''))) return;
      rm(ent, id); if (st.proj === id) st.proj = null; save(); render();
    }
    function onClick(e) {
      var b = e.target.closest('[data-act]'); if (!b || !ov.contains(b)) return;
      var a = b.dataset.act, d = b.dataset;
      if (a === 'close') return close();
      if (a === 'tab') { tab = d.t; return render(); }
      if (a === 'add') {
        var g = C.guard && C.guard(d.e); if (g) return MO.msg(g[0], g[1]);
        var pre = {}; if (d.pk) pre[d.pk] = d.pv; if (d.pre) pre = Object.assign(pre, JSON.parse(d.pre)); return form(d.e, null, pre);
      }
      if (a === 'edit') return form(d.e, d.id);
      if (a === 'del') return del(d.e, d.id);
      if (a === 'filt') { st[d.f] = d.v; return render(); }
      if (C.act && C.act(a, d, e.target, e) === SKIP) return;
      save(); render();
    }
    app.form = form; app.render = render; app.del = del; app.close = close;
    return { open: open, app: app };
  }

  /* =====================================================
     WORK OFFICE
     ===================================================== */
  var work = App('Work Office', 'mo-work-v1', function () { return { client: [], job: [], wtask: [], log: [], wdoc: [] }; }, function (app) {
    var D = app.D, st = app.st;
    var JS = ['Prospek', 'Berjalan', 'Review', 'Selesai', 'Dibatalkan'], IS = ['Tidak relevan', 'Belum ditagih', 'Sudah ditagih', 'Sudah diterima'], TS = ['Belum dikerjakan', 'Sedang dikerjakan', 'Selesai'];
    var DT = ['Kontrak', 'Invoice', 'Brief', 'Deliverable', 'Lainnya'];
    var jobOpts = function () { return [['', '— Pilih pekerjaan —']].concat(D.job.map(function (j) { return [j.id, j.title]; })); };
    var jn = function (id) { var j = by(D.job, id); return j ? j.title : '—'; };
    var cn = function (id) { var c = by(D.client, id); return c ? c.name : 'Tanpa klien'; };
    var hrs = function (id) { return D.log.filter(function (l) { return l.jobId === id; }).reduce(function (a, l) { return a + (+l.hours || 0); }, 0); };
    var jp = function (id) { var t = D.wtask.filter(function (x) { return x.jobId === id; }); return t.length ? t.filter(function (x) { return x.status === 'Selesai'; }).length / t.length * 100 : null; };
    var specs = {
      client: { title: 'Klien', def: {}, fields: [{ k: 'name', l: 'Nama klien / pemberi kerja', t: 'text', req: 1, full: 1 }, { k: 'contact', l: 'Kontak (email / telepon)', t: 'text', full: 1 }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      job: { title: 'Pekerjaan', def: { status: 'Berjalan', incomeStatus: 'Tidak relevan' }, fields: [
        { k: 'title', l: 'Nama pekerjaan / proyek', t: 'text', req: 1, full: 1 },
        { k: 'clientId', l: 'Klien', t: 'select', o: function () { return [['', '— Internal / tanpa klien —']].concat(D.client.map(function (c) { return [c.id, c.name]; })); } },
        { k: 'status', l: 'Status', t: 'select', o: opt(JS) },
        { k: 'desc', l: 'Deskripsi', t: 'textarea', full: 1 },
        { k: 'deadline', l: 'Tenggat waktu', t: 'date' }, { k: 'estHours', l: 'Estimasi durasi (jam)', t: 'number', min: 0, step: '0.25' },
        { k: 'income', l: 'Pendapatan pekerjaan (Rp)', t: 'number', min: 0 }, { k: 'incomeStatus', l: 'Status pendapatan', t: 'select', o: opt(IS) },
        { k: 'txRef', l: 'Referensi transaksi keuangan (opsional)', t: 'text', full: 1, ph: 'ID/nomor transaksi di modul Finance nanti' },
        { k: 'notes', l: 'Catatan pekerjaan', t: 'textarea', full: 1 }] },
      wtask: { title: 'Tugas', def: { status: 'Belum dikerjakan' }, fields: [
        { k: 'title', l: 'Daftar tugas — judul', t: 'text', req: 1, full: 1 }, { k: 'jobId', l: 'Pekerjaan', t: 'select', o: jobOpts, req: 1 }, { k: 'status', l: 'Status', t: 'select', o: opt(TS) },
        { k: 'deadline', l: 'Tenggat waktu', t: 'date' }, { k: 'estHours', l: 'Estimasi (jam)', t: 'number', min: 0, step: '0.25' }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      log: { title: 'Jam Kerja', def: {}, fields: [
        { k: 'jobId', l: 'Pekerjaan', t: 'select', o: jobOpts, req: 1, full: 1 }, { k: 'date', l: 'Tanggal', t: 'date', req: 1 }, { k: 'hours', l: 'Durasi (jam)', t: 'number', req: 1, min: 0, step: '0.25' }, { k: 'notes', l: 'Catatan', t: 'text', full: 1 }] },
      wdoc: { title: 'Dokumen', def: { type: 'Lainnya' }, fields: [
        { k: 'title', l: 'Nama dokumen', t: 'text', req: 1, full: 1 }, { k: 'jobId', l: 'Pekerjaan', t: 'select', o: jobOpts }, { k: 'type', l: 'Jenis', t: 'select', o: opt(DT) },
        { k: 'link', l: 'Tautan / lampiran', t: 'url', full: 1, ph: 'https://…' }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] }
    };
    var tabs = [
      ['client', 'Klien', function () {
        return bar('Daftar klien dan pemberi kerja.', add('client', 'Klien')) + (D.client.length ? D.client.map(function (c) {
          return '<article class="ac-card"><div class="ac-row"><div><h3>' + esc(c.name) + '</h3><small style="opacity:.7">' + esc(c.contact || '') + '</small></div>' + btns('client', c.id) + '</div><div class="ac-meta"><span>Pekerjaan: <b>' + D.job.filter(function (j) { return j.clientId === c.id; }).length + '</b></span></div>' + (c.notes ? '<div class="ac-notes">' + esc(c.notes) + '</div>' : '') + '</article>';
        }).join('') : empty('Belum ada klien.'));
      }],
      ['job', 'Pekerjaan', function () {
        var L = D.job.filter(function (j) { return !st.js || st.js === 'Semua' || j.status === st.js; }).sort(function (a, b) { return (a.deadline || '9').localeCompare(b.deadline || '9'); });
        var h = bar('Progres dihitung dari tugas yang benar-benar selesai.', add('job', 'Pekerjaan')) + chips(['Semua'].concat(JS), st.js || 'Semua', 'js');
        if (!L.length) return h + empty('Belum ada pekerjaan.');
        return h + L.map(function (j) {
          var p = jp(j.id), tn = D.wtask.filter(function (x) { return x.jobId === j.id; }), late = j.deadline && j.deadline < todayS() && j.status !== 'Selesai' && j.status !== 'Dibatalkan', a = hrs(j.id);
          return '<article class="ac-card"><div class="ac-row"><div><h3>' + esc(j.title) + badge(j.status, j.status === 'Selesai' ? 'on' : '') + (late ? badge('Lewat tenggat', 'late') : '') + '</h3><small style="opacity:.7">' + esc(cn(j.clientId)) + '</small></div>' + btns('job', j.id) + '</div>' +
            '<div class="ac-meta"><span>Tenggat: <b>' + fd(j.deadline) + '</b></span><span>Jam: <b>' + fmt(a) + ' / ' + (has(j.estHours) ? fmt(+j.estHours) : '—') + '</b> (aktual / estimasi)</span>' + (+j.income > 0 && j.incomeStatus !== 'Tidak relevan' ? '<span>Pendapatan pekerjaan: <b>' + rp(j.income) + '</b> · ' + esc(j.incomeStatus) + '</span>' : '') + '</div>' +
            prog(p) + (p != null ? '<small>' + tn.filter(function (x) { return x.status === 'Selesai'; }).length + ' dari ' + tn.length + ' tugas selesai (' + fmt(p) + '%)</small>' : '') +
            (j.desc ? '<div class="ac-notes">' + esc(j.desc) + '</div>' : '') + (j.notes ? '<div class="ac-notes">Catatan: ' + esc(j.notes) + '</div>' : '') +
            '<div style="margin-top:8px"><button class="ac-btn sm" data-act="add" data-e="wtask" data-pk="jobId" data-pv="' + j.id + '">+ Tugas</button> <button class="ac-btn sm" data-act="add" data-e="log" data-pk="jobId" data-pv="' + j.id + '">+ Jam kerja</button></div></article>';
        }).join('');
      }],
      ['task', 'Tugas', function () {
        var L = D.wtask.filter(function (t) { return !st.ts || st.ts === 'Semua' || t.status === st.ts; }).sort(function (a, b) { return (a.deadline || '9').localeCompare(b.deadline || '9'); });
        var h = bar('Centang untuk menandai selesai.', add('wtask', 'Tugas')) + chips(['Semua'].concat(TS), st.ts || 'Semua', 'ts');
        if (!L.length) return h + empty('Belum ada tugas.');
        return h + L.map(function (t) {
          var late = t.deadline && t.deadline < todayS() && t.status !== 'Selesai';
          return '<div class="ac-item' + (t.status === 'Selesai' ? ' done' : '') + '"><input type="checkbox" data-act="tgw" data-id="' + t.id + '"' + (t.status === 'Selesai' ? ' checked' : '') + ' aria-label="Selesai"><div><button class="t" data-act="edit" data-e="wtask" data-id="' + t.id + '">' + esc(t.title) + '</button>' + (late ? badge('Terlambat', 'late') : '') +
            '<small>' + esc(jn(t.jobId)) + ' · Tenggat: ' + fd(t.deadline) + ' · Estimasi: ' + (has(t.estHours) ? t.estHours + ' jam' : '—') + ' · ' + esc(t.status) + '</small>' + (t.notes ? '<small>' + esc(t.notes) + '</small>' : '') + '</div>' + btns('wtask', t.id) + '</div>';
        }).join('');
      }],
      ['log', 'Jam Kerja', function () {
        var tot = D.log.reduce(function (a, l) { return a + (+l.hours || 0); }, 0), h = bar('Catat jam kerja aktual dan bandingkan dengan estimasi.', add('log', 'Jam kerja'));
        if (!D.log.length) return h + empty('Belum ada catatan jam kerja.');
        h += '<div class="ac-grid">' + stat(fmt(tot), 'Total jam tercatat') + stat(D.job.filter(function (j) { return hrs(j.id) > 0; }).length, 'Pekerjaan dengan jam tercatat') + '</div><div class="ac-bars">';
        D.job.filter(function (j) { return hrs(j.id) > 0; }).forEach(function (j) {
          var a = hrs(j.id), e = +j.estHours || 0, mx = Math.max(a, e, 1);
          h += '<div class="ac-bar2"><span>' + esc(j.title) + '</span><div class="ac-pair"><div class="ac-track"><i style="width:' + a / mx * 100 + '%"></i></div>' + (e ? '<div class="ac-track"><i class="alt" style="width:' + e / mx * 100 + '%"></i></div>' : '') + '</div><span>' + fmt(a) + ' / ' + (e ? fmt(e) : '—') + ' jam</span></div>';
        });
        h += '</div><div class="ac-legend" style="margin-top:8px"><span><i></i>Aktual</span><span><i class="alt"></i>Estimasi</span></div><div class="ac-tblwrap"><table class="ac-tbl"><tr><th>Tanggal</th><th>Pekerjaan</th><th>Jam</th><th>Catatan</th><th></th></tr>' +
          D.log.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).map(function (l) { return '<tr><td>' + fd(l.date) + '</td><td>' + esc(jn(l.jobId)) + '</td><td>' + l.hours + '</td><td>' + esc(l.notes || '') + '</td><td>' + '<button class="ac-btn sm" data-act="edit" data-e="log" data-id="' + l.id + '">Edit</button> <button class="ac-btn sm danger" data-act="del" data-e="log" data-id="' + l.id + '">Hapus</button></td></tr>'; }).join('') + '</table></div>';
        return h;
      }],
      ['doc', 'Dokumen', function () {
        var L = D.wdoc.filter(function (d) { return !st.dt || st.dt === 'Semua' || d.type === st.dt; }), h = bar('Dokumen pendukung pekerjaan.', add('wdoc', 'Dokumen')) + chips(['Semua'].concat(DT), st.dt || 'Semua', 'dt');
        if (!L.length) return h + empty('Belum ada dokumen.');
        return h + L.map(function (d) { return '<div class="ac-item"><div><b>' + esc(d.title) + '</b>' + badge(d.type) + '<small>' + esc(jn(d.jobId)) + (d.link ? ' · ' + link(d.link) : '') + '</small>' + (d.notes ? '<small>' + esc(d.notes) + '</small>' : '') + '</div>' + btns('wdoc', d.id) + '</div>'; }).join('');
      }],
      ['inc', 'Pendapatan', function () {
        var js = D.job.filter(function (j) { return +j.income > 0 && j.incomeStatus !== 'Tidak relevan'; });
        var sum = function (s) { return js.filter(function (j) { return j.incomeStatus === s; }).reduce(function (a, j) { return a + +j.income; }, 0); };
        return '<div class="ac-warn" style="border-color:rgba(127,140,170,.5);background:rgba(127,140,170,.1)"><span><b>Dipisahkan dari pemasukan pribadi.</b> Angka di sini hanya pendapatan pekerjaan. Tidak ada yang otomatis masuk ke pemasukan pribadi; hubungan ke modul keuangan nanti lewat referensi transaksi per pekerjaan.</span></div>' +
          '<div class="ac-grid">' + stat(rp(sum('Sudah diterima')), 'Sudah diterima') + stat(rp(sum('Sudah ditagih')), 'Sudah ditagih, belum diterima') + stat(rp(sum('Belum ditagih')), 'Belum ditagih') + '</div>' +
          (js.length ? '<div class="ac-tblwrap"><table class="ac-tbl"><tr><th>Pekerjaan</th><th>Klien</th><th>Jumlah</th><th>Status</th><th>Ref. transaksi</th></tr>' + js.map(function (j) { return '<tr class="ac-click" data-act="edit" data-e="job" data-id="' + j.id + '"><td>' + esc(j.title) + '</td><td>' + esc(cn(j.clientId)) + '</td><td>' + rp(j.income) + '</td><td>' + esc(j.incomeStatus) + '</td><td>' + esc(j.txRef || '—') + '</td></tr>'; }).join('') + '</table></div>' : empty('Belum ada pekerjaan dengan pendapatan. Isi di form Pekerjaan.'));
      }]
    ];
    return {
      skin: 'wo-skin', specs: specs, tabs: tabs, sub: function () { return 'Pendapatan pekerjaan terpisah dari pemasukan pribadi'; },
      cascade: { client: [], job: [['wtask', 'jobId'], ['log', 'jobId'], ['wdoc', 'jobId']] },
      guard: function (e) { if (['wtask', 'log'].indexOf(e) > -1 && !D.job.length) return ['Belum ada pekerjaan', 'Tambahkan pekerjaan terlebih dahulu.']; },
      act: function (a, d, t) { if (a === 'tgw') { var x = by(D.wtask, d.id); x.status = t.checked ? 'Selesai' : 'Belum dikerjakan'; } }
    };
  });

  /* =====================================================
     ORGANIZATION
     ===================================================== */
  var org = App('Organization', 'mo-org-v1', function () { return { org: [], meeting: [], followup: [], budget: [], odoc: [] }; }, function (app) {
    var D = app.D, st = app.st;
    var FS = ['Belum', 'Berjalan', 'Selesai'], OD = ['Proposal', 'Notulen', 'Laporan pertanggungjawaban', 'Surat', 'Materi presentasi', 'Dokumen lainnya'];
    var orgOpts = function () { return [['', '— Pilih organisasi —']].concat(D.org.map(function (o) { return [o.id, o.name]; })); };
    var on = function (id) { var o = by(D.org, id); return o ? o.name : '—'; };
    var specs = {
      org: { title: 'Organisasi', def: {}, fields: [{ k: 'name', l: 'Nama organisasi', t: 'text', req: 1, full: 1 }, { k: 'period', l: 'Periode kepengurusan', t: 'text', ph: '2025–2026' }, { k: 'role', l: 'Jabatan saya', t: 'text' }, { k: 'desc', l: 'Deskripsi', t: 'textarea', full: 1 }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      meeting: { title: 'Rapat', def: {}, fields: [{ k: 'title', l: 'Nama rapat', t: 'text', req: 1, full: 1 }, { k: 'orgId', l: 'Organisasi', t: 'select', o: orgOpts, req: 1 }, { k: 'date', l: 'Tanggal rapat', t: 'date', req: 1 }, { k: 'agenda', l: 'Agenda', t: 'textarea', full: 1 }, { k: 'notes', l: 'Catatan rapat', t: 'textarea', full: 1 }, { k: 'decisions', l: 'Keputusan', t: 'textarea', full: 1 }] },
      followup: { title: 'Tindak Lanjut', def: { status: 'Belum' }, fields: [{ k: 'task', l: 'Tindak lanjut', t: 'text', req: 1, full: 1 }, { k: 'meetingId', l: 'Rapat', t: 'select', req: 1, o: function () { return [['', '— Pilih rapat —']].concat(D.meeting.map(function (m) { return [m.id, m.title + ' (' + fd(m.date) + ')']; })); }, full: 1 }, { k: 'pic', l: 'Penanggung jawab', t: 'text' }, { k: 'due', l: 'Tenggat', t: 'date' }, { k: 'status', l: 'Status', t: 'select', o: opt(FS) }] },
      budget: { title: 'Pos Anggaran', def: {}, fields: [{ k: 'item', l: 'Pos / keterangan anggaran', t: 'text', req: 1, full: 1 }, { k: 'orgId', l: 'Organisasi', t: 'select', o: orgOpts, req: 1 }, { k: 'date', l: 'Tanggal', t: 'date' }, { k: 'planned', l: 'Rencana anggaran (Rp)', t: 'number', min: 0 }, { k: 'actual', l: 'Pengeluaran aktual (Rp)', t: 'number', min: 0 }, { k: 'proof', l: 'Catatan bukti transaksi', t: 'textarea', full: 1 }, { k: 'link', l: 'Tautan bukti', t: 'url', full: 1 }] },
      odoc: { title: 'Dokumen', def: { type: 'Proposal' }, fields: [{ k: 'title', l: 'Judul dokumen', t: 'text', req: 1, full: 1 }, { k: 'orgId', l: 'Organisasi', t: 'select', o: orgOpts, req: 1 }, { k: 'type', l: 'Jenis', t: 'select', o: opt(OD), req: 1 }, { k: 'date', l: 'Tanggal', t: 'date' }, { k: 'link', l: 'Tautan / lampiran', t: 'url', ph: 'https://…' }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] }
    };
    var tabs = [
      ['org', 'Profil', function () {
        return bar('Profil organisasi yang Anda ikuti.', add('org', 'Organisasi')) + (D.org.length ? D.org.map(function (o) {
          return '<article class="ac-card"><div class="ac-row"><div><h3>' + esc(o.name) + '</h3></div>' + btns('org', o.id) + '</div><div class="ac-meta"><span>Periode: <b>' + esc(o.period || '—') + '</b></span><span>Jabatan: <b>' + esc(o.role || '—') + '</b></span><span>Rapat: <b>' + D.meeting.filter(function (m) { return m.orgId === o.id; }).length + '</b></span><span>Dokumen: <b>' + D.odoc.filter(function (m) { return m.orgId === o.id; }).length + '</b></span></div>' + (o.desc ? '<div class="ac-notes">' + esc(o.desc) + '</div>' : '') + (o.notes ? '<div class="ac-notes">Catatan: ' + esc(o.notes) + '</div>' : '') + '</article>';
        }).join('') : empty('Belum ada organisasi.'));
      }],
      ['meet', 'Rapat', function () {
        var h = bar('Agenda, catatan, keputusan, dan tindak lanjut beserta penanggung jawabnya.', add('meeting', 'Rapat'));
        if (!D.meeting.length) return h + empty('Belum ada rapat.');
        return h + D.meeting.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).map(function (m) {
          var fs = D.followup.filter(function (f) { return f.meetingId === m.id; });
          return '<article class="ac-card"><div class="ac-row"><div><h3>' + esc(m.title) + '</h3><small style="opacity:.7">' + esc(on(m.orgId)) + ' · ' + fd(m.date) + '</small></div>' + btns('meeting', m.id) + '</div>' +
            (m.agenda ? '<div class="ac-notes"><b>Agenda</b>\n' + esc(m.agenda) + '</div>' : '') + (m.notes ? '<div class="ac-notes"><b>Catatan</b>\n' + esc(m.notes) + '</div>' : '') + (m.decisions ? '<div class="ac-notes"><b>Keputusan</b>\n' + esc(m.decisions) + '</div>' : '') +
            fs.map(function (f) { return '<div class="ac-item' + (f.status === 'Selesai' ? ' done' : '') + '" style="margin-bottom:6px"><input type="checkbox" data-act="tgf" data-id="' + f.id + '"' + (f.status === 'Selesai' ? ' checked' : '') + ' aria-label="Selesai"><div><button class="t" data-act="edit" data-e="followup" data-id="' + f.id + '">' + esc(f.task) + '</button><small>PJ: ' + esc(f.pic || '—') + ' · Tenggat: ' + fd(f.due) + ' · ' + esc(f.status) + '</small></div><button class="ac-btn sm danger" data-act="del" data-e="followup" data-id="' + f.id + '">×</button></div>'; }).join('') +
            '<button class="ac-btn sm" data-act="add" data-e="followup" data-pk="meetingId" data-pv="' + m.id + '">+ Tindak lanjut</button></article>';
        }).join('');
      }],
      ['bud', 'Anggaran', function () {
        var h = bar('Selisih = rencana − aktual. Anggaran organisasi tidak tercampur dengan keuangan pribadi.', add('budget', 'Pos anggaran'));
        if (!D.budget.length) return h + empty('Belum ada pos anggaran.');
        return h + D.org.filter(function (o) { return D.budget.some(function (b) { return b.orgId === o.id; }); }).map(function (o) {
          var bs = D.budget.filter(function (b) { return b.orgId === o.id; }), P = 0, A = 0;
          bs.forEach(function (b) { P += +b.planned || 0; A += +b.actual || 0; });
          var diff = function (x) { return '<b style="color:' + (x < 0 ? '#d0443e' : 'inherit') + '">' + (x < 0 ? '−' : '') + rp(Math.abs(x)) + '</b>'; };
          return '<article class="ac-card"><h3>' + esc(o.name) + '</h3><div class="ac-meta"><span>Rencana: <b>' + rp(P) + '</b></span><span>Aktual: <b>' + rp(A) + '</b></span><span>Selisih: ' + diff(P - A) + (P - A < 0 ? ' (melebihi anggaran)' : ' (sisa)') + '</span></div>' +
            '<div class="ac-tblwrap"><table class="ac-tbl"><tr><th>Pos</th><th>Rencana</th><th>Aktual</th><th>Selisih</th><th>Bukti</th></tr>' + bs.map(function (b) { return '<tr class="ac-click" data-act="edit" data-e="budget" data-id="' + b.id + '"><td>' + esc(b.item) + '</td><td>' + rp(b.planned) + '</td><td>' + rp(b.actual) + '</td><td>' + diff((+b.planned || 0) - (+b.actual || 0)) + '</td><td>' + esc(b.proof || '') + (b.link ? ' ' + link(b.link) : '') + '</td></tr>'; }).join('') + '</table></div></article>';
        }).join('');
      }],
      ['doc', 'Dokumen', function () {
        var L = D.odoc.filter(function (d) { return !st.od || st.od === 'Semua' || d.type === st.od; }), h = bar('Proposal, notulen, LPJ, surat, materi presentasi, dan dokumen lain.', add('odoc', 'Dokumen')) + chips(['Semua'].concat(OD), st.od || 'Semua', 'od');
        if (!L.length) return h + empty('Belum ada dokumen.');
        return h + L.map(function (d) { return '<div class="ac-item"><div><b>' + esc(d.title) + '</b>' + badge(d.type) + '<small>' + esc(on(d.orgId)) + ' · ' + fd(d.date) + (d.link ? ' · ' + link(d.link) : '') + '</small>' + (d.notes ? '<small>' + esc(d.notes) + '</small>' : '') + '</div>' + btns('odoc', d.id) + '</div>'; }).join('');
      }]
    ];
    return {
      skin: 'es-skin', specs: specs, tabs: tabs, sub: function () { return D.org.length ? D.org.map(function (o) { return o.name; }).join(' · ') : 'Belum ada organisasi'; },
      cascade: { org: [['meeting', 'orgId'], ['budget', 'orgId'], ['odoc', 'orgId']], meeting: [['followup', 'meetingId']] },
      guard: function (e) {
        if (['meeting', 'budget', 'odoc'].indexOf(e) > -1 && !D.org.length) return ['Belum ada organisasi', 'Tambahkan profil organisasi terlebih dahulu.'];
        if (e === 'followup' && !D.meeting.length) return ['Belum ada rapat', 'Tambahkan rapat terlebih dahulu.'];
      },
      act: function (a, d, t) { if (a === 'tgf') { by(D.followup, d.id).status = t.checked ? 'Selesai' : 'Belum'; } }
    };
  });

  /* =====================================================
     PROJECT MANAGEMENT
     ===================================================== */
  var proj = App('Project Management', 'mo-proj-v1', function () { return { proj: [], ptask: [], ms: [], pfile: [] }; }, function (app) {
    var D = app.D, st = app.st;
    if (!D.promo || !D.promo.length) D.promo = [{ id: 'promo', emoji: '🏁', title: 'Tuntaskan dulu, baru rayakan', text: 'Pilih satu proyek dan selesaikan hari ini.', btn: 'Buka sorotan' }];
    var PC = { Akademik: ['🎓', '#3d6bff', '#8ab4ff'], Pekerjaan: ['💼', '#1d2233', '#4a5675'], Organisasi: ['🏛️', '#0f9d7c', '#6fe0bd'], Pribadi: ['⭐', '#ff6a3d', '#ffb36b'] };
    var pc = function (p) { return PC[p.area] || PC.Pribadi; }, live = function (p) { return p.status !== 'Selesai' && p.status !== 'Dibatalkan'; };
    var PRN = { Tinggi: 0, Sedang: 1, Rendah: 2 }, prk = function (p) { return PRN[p.priority] == null ? 1 : PRN[p.priority]; };
    var AREAS = ['Akademik', 'Pekerjaan', 'Organisasi', 'Pribadi'], PS = ['Rencana', 'Berjalan', 'Ditunda', 'Selesai', 'Dibatalkan'], TS = ['Belum', 'Dikerjakan', 'Selesai'];
    var PV = [['overview', 'Project Overview'], ['board', 'Task Board'], ['timeline', 'Timeline'], ['ms', 'Milestones'], ['files', 'Files & Notes'], ['ana', 'Progress Analytics']];
    var projOpts = function () { return [['', '— Pilih proyek —']].concat(D.proj.map(function (p) { return [p.id, p.name]; })); };
    var log = function (id, m) { var p = by(D.proj, id); if (p) { p.hist = p.hist || []; p.hist.unshift({ t: new Date().toISOString(), m: m }); p.hist = p.hist.slice(0, 100); } };
    var tasksOf = function (id) { return D.ptask.filter(function (t) { return t.projId === id; }); };
    var msOf = function (id) { return D.ms.filter(function (t) { return t.projId === id; }); };
    function pp(p) {
      var ms = p.basis === 'ms', a = ms ? msOf(p.id) : tasksOf(p.id), dn = a.filter(function (x) { return ms ? x.done : x.status === 'Selesai'; }).length;
      return { n: a.length, done: dn, pct: a.length ? dn / a.length * 100 : null, unit: ms ? 'milestone' : 'tugas' };
    }
    var specs = {
      proj: { title: 'Proyek', def: { area: 'Pribadi', status: 'Rencana', priority: 'Sedang', basis: 'tasks' }, fields: [
        { k: 'name', l: 'Nama proyek', t: 'text', req: 1, full: 1 }, { k: 'desc', l: 'Deskripsi', t: 'textarea', full: 1 },
        { k: 'area', l: 'Area', t: 'select', o: opt(AREAS) }, { k: 'status', l: 'Status', t: 'select', o: opt(PS) }, { k: 'priority', l: 'Prioritas', t: 'select', o: opt(['Rendah', 'Sedang', 'Tinggi']) },
        { k: 'basis', l: 'Progres dihitung dari', t: 'select', o: [['tasks', 'Tugas yang selesai'], ['ms', 'Milestone yang selesai']] },
        { k: 'start', l: 'Tanggal mulai', t: 'date' }, { k: 'target', l: 'Target selesai', t: 'date' }, { k: 'budget', l: 'Anggaran (Rp, jika perlu)', t: 'number', min: 0, full: 1 }, { k: 'emoji', l: 'Emoji sampul', t: 'text', ph: '🎓' }, { k: 'pin', l: 'Utamakan di banner Sorotan', t: 'select', bool: 1, o: [['false', 'Tidak'], ['true', 'Ya']] }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      ptask: { title: 'Tugas', def: { status: 'Belum' }, fields: [{ k: 'title', l: 'Judul tugas', t: 'text', req: 1, full: 1 }, { k: 'projId', l: 'Proyek', t: 'select', o: projOpts, req: 1 }, { k: 'status', l: 'Status', t: 'select', o: opt(TS) }, { k: 'due', l: 'Tenggat', t: 'date' }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      ms: { title: 'Milestone', def: { done: false }, fields: [{ k: 'title', l: 'Milestone', t: 'text', req: 1, full: 1 }, { k: 'projId', l: 'Proyek', t: 'select', o: projOpts, req: 1 }, { k: 'date', l: 'Tanggal target', t: 'date' }, { k: 'done', l: 'Status', t: 'select', bool: 1, o: [['false', 'Belum tercapai'], ['true', 'Tercapai']] }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      promo: { title: 'Kartu Promo', def: {}, fields: [{ k: 'title', l: 'Judul', t: 'text', req: 1, full: 1 }, { k: 'emoji', l: 'Emoji', t: 'text' }, { k: 'btn', l: 'Teks tombol', t: 'text' }, { k: 'text', l: 'Kalimat pendukung', t: 'text', full: 1 }] },
      pfile: { title: 'Dokumen / Catatan', def: { kind: 'Dokumen' }, fields: [{ k: 'title', l: 'Judul', t: 'text', req: 1, full: 1 }, { k: 'projId', l: 'Proyek', t: 'select', o: projOpts, req: 1 }, { k: 'kind', l: 'Jenis', t: 'select', o: opt(['Dokumen', 'Catatan']) }, { k: 'link', l: 'Tautan dokumen', t: 'url', full: 1, ph: 'https://…' }, { k: 'text', l: 'Isi catatan', t: 'textarea', full: 1 }] }
    };

    function banner(p, n) {
      var g = pp(p), c = pc(p);
      return '<section class="pj-ban" style="--c1:' + c[1] + ';--c2:' + c[2] + '"><span class="pj-bem">' + esc(p.emoji || c[0]) + '</span><div class="pj-bt"><span class="pj-tag">' + esc(p.area) + ' · ' + esc(p.status) + '</span><h3>' + esc(p.name) + '</h3><p>' + (g.pct == null ? 'Belum ada ' + g.unit + ' — progres belum bisa dihitung' : g.done + ' dari ' + g.n + ' ' + g.unit + ' selesai (' + fmt(g.pct) + '%)') + '</p><div class="pj-bb"><button class="pj-or" data-act="openp" data-id="' + p.id + '">Buka proyek</button><button class="pj-gh" data-act="edit" data-e="proj" data-id="' + p.id + '">Edit</button></div></div>' +
        (n > 1 ? '<div class="pj-arr"><button data-act="bnav" data-d="-1" aria-label="Sorotan sebelumnya">‹</button><button data-act="bnav" data-d="1" aria-label="Sorotan berikutnya">›</button></div>' : '') + '</section>';
    }
    function list() {
      var ar = st.pa || 'Semua', q = (st.pq || '').toLowerCase().trim(), T = todayS(), set = {}; try { set = JSON.parse(localStorage.getItem('mo-settings-v1')) || {}; } catch (e) { }
      var L = D.proj.filter(function (p) { return (ar === 'Semua' || p.area === ar) && (!q || (p.name + ' ' + (p.desc || '')).toLowerCase().indexOf(q) > -1); });
      var nav = '<nav class="pj-nav"><div class="pj-tabs">' + ['Semua'].concat(AREAS).map(function (x) { return '<button aria-pressed="' + (x === ar) + '" data-act="filt" data-f="pa" data-v="' + x + '">' + (x === 'Semua' ? 'Beranda' : x) + '</button>'; }).join('') + '</div><input type="text" data-in="pq" placeholder="Cari proyek…" value="' + esc(st.pq || '') + '" aria-label="Cari proyek">' + add('proj', 'Proyek') + '</nav>';
      if (!D.proj.length) return nav + empty('Belum ada proyek. Tekan "+ Proyek" untuk memulai.');
      if (!L.length) return nav + empty('Tidak ada proyek yang cocok dengan filter atau pencarian.');
      var lv = L.filter(live), F = (lv.length ? lv : L).slice().sort(function (a, b) { return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || prk(a) - prk(b) || (a.target || '9').localeCompare(b.target || '9'); });
      var bi = ((st.bi || 0) % F.length + F.length) % F.length, fp = F[bi], ids = {}, it = [];
      L.forEach(function (p) { ids[p.id] = 1; if (live(p) && p.target) it.push({ d: p.target, t: p.name, p: p, e: 'proj', id: p.id, k: 'Target proyek' }); });
      D.ms.forEach(function (m) { if (ids[m.projId] && !m.done && m.date) it.push({ d: m.date, t: m.title, p: by(D.proj, m.projId), e: 'ms', id: m.id, k: 'Milestone' }); });
      D.ptask.forEach(function (t) { if (ids[t.projId] && t.status !== 'Selesai' && t.due) it.push({ d: t.due, t: t.title, p: by(D.proj, t.projId), e: 'ptask', id: t.id, k: 'Tugas' }); });
      it.sort(function (a, b) { return a.d.localeCompare(b.d); });
      var nx = it.filter(function (x) { return x.d >= T; })[0] || it[0];
      var nd = nx && nx.p ? '<section class="pj-nd"><span class="pj-tag">' + nx.k + (nx.d < T ? ' · terlambat' : '') + '</span><h3>' + esc(nx.t) + '</h3><p>' + esc(nx.p.name) + ' · ' + fd(nx.d) + '</p><div class="pj-bb"><button class="pj-or" data-act="openp" data-id="' + nx.p.id + '">Lihat proyek</button><button class="pj-gh" data-act="edit" data-e="' + nx.e + '" data-id="' + nx.id + '">Edit</button></div></section>' : '<section class="pj-nd"><h3>Belum ada tenggat</h3><p>Isi target selesai proyek, tanggal milestone, atau tenggat tugas agar muncul di sini.</p></section>';
      var top = L.filter(live).sort(function (a, b) { return prk(a) - prk(b) || (a.target || '9').localeCompare(b.target || '9'); }).slice(0, 5);
      var tbl = '<section class="pj-top"><h4 class="pj-h">5 proyek teratas</h4><div class="pj-th"><span>No</span><span>Proyek</span><span class="pj-c">Prioritas</span><span class="pj-c">Target</span><span>Progres</span><span></span></div>' + (top.length ? top.map(function (p, i) {
        var g = pp(p), c = pc(p);
        return '<div class="pj-tr' + (i === 0 ? ' hot' : '') + '" data-act="openp" data-id="' + p.id + '"><span>' + (i + 1) + '</span><span class="pj-n"><i style="background:linear-gradient(135deg,' + c[1] + ',' + c[2] + ')">' + esc(p.emoji || c[0]) + '</i><b><button class="t" data-act="openp" data-id="' + p.id + '">' + esc(p.name) + '</button><small>' + esc(p.area) + ' · ' + esc(p.status) + '</small></b></span><span class="pj-c">' + esc(p.priority) + '</span><span class="pj-c">' + fd(p.target) + '</span><span>' + (g.pct == null ? '—' : Math.round(g.pct) + '%') + '</span><span><button class="ac-btn sm" data-act="edit" data-e="proj" data-id="' + p.id + '">Edit</button></span></div>';
      }).join('') : '<p class="ac-hint">Tidak ada proyek aktif pada filter ini.</p>') + '</section>';
      var cards = '<section class="pj-an"><h4 class="pj-h">Progres semua proyek · ' + L.length + '</h4><div class="pj-cards">' + L.map(function (p) {
        var g = pp(p), c = pc(p);
        return '<article class="pj-pc" style="--c1:' + c[1] + ';--c2:' + c[2] + '" data-act="openp" data-id="' + p.id + '"><button class="pj-ed" data-act="edit" data-e="proj" data-id="' + p.id + '" aria-label="Edit ' + esc(p.name) + '">✎</button><span class="pj-pe">' + esc(p.emoji || c[0]) + '</span><button class="t" data-act="openp" data-id="' + p.id + '">' + esc(p.name) + '</button><small>' + (g.pct == null ? 'Belum ada ' + g.unit : g.done + '/' + g.n + ' ' + g.unit) + '</small><em>' + (g.pct == null ? '—' : Math.round(g.pct)) + '</em></article>';
      }).join('') + '</div></section>';
      var ps = D.proj.map(pp).filter(function (g) { return g.pct != null; }), avg = ps.length ? Math.round(ps.reduce(function (a, g) { return a + g.pct; }, 0) / ps.length) : null, P = D.promo[0];
      var side = '<aside class="pj-side"><div class="pj-me"><span class="pj-av" style="' + (set.photo ? 'background-image:url(&quot;' + esc(set.photo) + '&quot;)' : '') + '"></span><b>' + esc(set.nick || 'Pengguna') + '</b><small>Pengelola proyek</small><div class="pj-st"><span>📁 ' + D.proj.filter(live).length + ' <small>aktif</small></span><span>📈 ' + (avg == null ? '—' : avg + '%') + ' <small>rata-rata</small></span><span>✅ ' + D.ptask.filter(function (t) { return t.status === 'Selesai'; }).length + ' <small>tugas selesai</small></span></div></div>' +
        '<div class="pj-promo"><button class="pj-pen" data-act="edit" data-e="promo" data-id="promo" aria-label="Ubah kartu promo">✎</button><span>' + esc(P.emoji || '🏁') + '</span><b>' + esc(P.title) + '</b><small>' + esc(P.text || '') + '</small><button class="pj-or" ' + (fp ? 'data-act="openp" data-id="' + fp.id + '"' : 'data-act="add" data-e="proj"') + '>' + esc(P.btn || 'Buka sorotan') + '</button></div></aside>';
      return nav + '<div class="pj-wrap">' + side + '<div class="pj-main"><div class="pj-row2"><div><h4 class="pj-h">Sorotan</h4>' + banner(fp, F.length) + '</div><div><h4 class="pj-h">Tenggat terdekat</h4>' + nd + '</div></div>' + tbl + cards + '</div></div>';
    }
    function detail(p) {
      var v = st.pv || 'overview';
      var g0 = pp(p), c0 = pc(p);
      var h = '<button class="ac-btn sm ac-back" data-act="openp" data-id="">← Semua proyek</button><section class="pj-hero"><span class="pj-hem">' + esc(p.emoji || c0[0]) + '</span><div class="pj-ht"><h3>' + esc(p.name) + '</h3><div>' + badge(p.area) + badge(p.status, p.status === 'Selesai' ? 'on' : '') + badge(p.priority, p.priority === 'Tinggi' ? 'hi' : p.priority === 'Sedang' ? 'mid' : '') + '</div><div class="pj-bar"><i style="width:' + (g0.pct || 0) + '%"></i></div><small>' + (g0.pct == null ? 'Belum ada ' + g0.unit + ' — progres belum bisa dihitung' : g0.done + ' dari ' + g0.n + ' ' + g0.unit + ' selesai (' + fmt(g0.pct) + '%)') + '</small></div>' + btns('proj', p.id) + '</section>' +
        '<div class="ac-chips pj-tabs">' + PV.map(function (x) { return '<button class="ac-chip" aria-pressed="' + (x[0] === v) + '" data-act="pv" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      return h + ({ overview: vOv, board: vBoard, timeline: vTL, ms: vMs, files: vFiles, ana: vAna })[v](p);
    }
    function vOv(p) {
      var g = pp(p), nm = msOf(p.id).filter(function (m) { return !m.done && m.date; }).sort(function (a, b) { return a.date.localeCompare(b.date); })[0];
      return '<div class="ac-grid">' + stat(g.pct == null ? '—' : fmt(g.pct) + '%', 'Progres (' + g.unit + ' selesai)') + stat(tasksOf(p.id).length, 'Tugas') + stat(msOf(p.id).length, 'Milestone') + stat(has(p.budget) ? rp(p.budget) : '—', 'Anggaran') + '</div>' +
        (g.pct == null ? '' : prog(g.pct)) + '<small class="pj-hint">' + (g.pct == null ? 'Tambahkan ' + g.unit + ' agar progres bisa dihitung.' : g.done + ' dari ' + g.n + ' ' + g.unit + ' selesai') + '</small>' +
        '<div class="ac-meta" style="margin-top:14px"><span>Area: <b>' + esc(p.area) + '</b></span><span>Status: <b>' + esc(p.status) + '</b></span><span>Prioritas: <b>' + esc(p.priority) + '</b></span><span>Mulai: <b>' + fd(p.start) + '</b></span><span>Target: <b>' + fd(p.target) + '</b></span>' + (nm ? '<span>Milestone berikutnya: <b>' + esc(nm.title) + ' (' + fd(nm.date) + ')</b></span>' : '') + '</div>' +
        (p.desc ? '<div class="ac-notes">' + esc(p.desc) + '</div>' : '') + (p.notes ? '<div class="ac-notes"><b>Catatan</b>\n' + esc(p.notes) + '</div>' : '') +
        '<div class="ac-h">Riwayat perubahan</div>' + ((p.hist || []).length ? '<div class="ac-tblwrap"><table class="ac-tbl">' + p.hist.slice(0, 30).map(function (x) { return '<tr><td style="white-space:nowrap;opacity:.7">' + new Date(x.t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</td><td>' + esc(x.m) + '</td></tr>'; }).join('') + '</table></div>' : '<p class="ac-hint">Belum ada riwayat.</p>');
    }
    function vBoard(p) {
      var T = tasksOf(p.id);
      return bar('Pindahkan tugas dengan tombol panah. Tugas di kolom "Selesai" menambah progres.', add('ptask', 'Tugas', 'projId', p.id)) + '<div class="kb">' + TS.map(function (s, i) {
        return '<div><h4>' + (s === 'Belum' ? 'Belum dikerjakan' : s === 'Dikerjakan' ? 'Sedang dikerjakan' : 'Selesai') + ' · ' + T.filter(function (t) { return t.status === s; }).length + '</h4>' + T.filter(function (t) { return t.status === s; }).map(function (t) {
          var late = t.due && t.due < todayS() && s !== 'Selesai';
          return '<div class="kc"><button class="t" data-act="edit" data-e="ptask" data-id="' + t.id + '">' + esc(t.title) + '</button><small>' + (t.due ? 'Tenggat ' + fd(t.due) : 'Tanpa tenggat') + (late ? ' · <b style="color:#d0443e">terlambat</b>' : '') + '</small><div class="ac-acts">' +
            (i > 0 ? '<button class="ac-btn sm" data-act="mv" data-id="' + t.id + '" data-d="-1" aria-label="Mundur">←</button>' : '') + (i < 2 ? '<button class="ac-btn sm" data-act="mv" data-id="' + t.id + '" data-d="1" aria-label="Maju">→</button>' : '') + '<button class="ac-btn sm danger" data-act="del" data-e="ptask" data-id="' + t.id + '">×</button></div></div>';
        }).join('') + '</div>';
      }).join('') + '</div>';
    }
    function vTL(p) {
      var ms = msOf(p.id).filter(function (m) { return m.date; }), ts = tasksOf(p.id).filter(function (t) { return t.due; });
      var T = function (x) { return new Date(x).getTime(); }, pts = [p.start, p.target].concat(ms.map(function (m) { return m.date; }), ts.map(function (t) { return t.due; })).filter(Boolean).map(T);
      if (pts.length < 2) return empty('Isi tanggal mulai, target selesai, atau tanggal milestone/tugas agar timeline muncul.');
      var now = Date.now(), all = pts.concat([now]), mn = Math.min.apply(null, all), mx = Math.max.apply(null, all); if (mx === mn) mx = mn + 864e5;
      var pos = function (t) { return ((t - mn) / (mx - mn) * 96 + 2).toFixed(1); }, nowEl = '<i class="tl-now" style="left:' + pos(now) + '%" title="Hari ini"></i>';
      var h = '<div class="tl-row"><span><b>Proyek</b></span><div class="tl-track">' + (p.start && p.target ? '<i class="tl-bar" style="left:' + pos(T(p.start)) + '%;width:' + (pos(T(p.target)) - pos(T(p.start))) + '%"></i>' : '') + nowEl + '</div></div>';
      ms.forEach(function (m) { h += '<div class="tl-row"><span title="' + esc(m.title) + '">◆ ' + esc(m.title) + '</span><div class="tl-track"><i class="tl-dot d' + (m.done ? ' ok' : '') + '" style="left:' + pos(T(m.date)) + '%"></i>' + nowEl + '</div></div>'; });
      ts.forEach(function (t) { h += '<div class="tl-row"><span title="' + esc(t.title) + '">' + esc(t.title) + '</span><div class="tl-track"><i class="tl-dot' + (t.status === 'Selesai' ? ' ok' : '') + '" style="left:' + pos(T(t.due)) + '%"></i>' + nowEl + '</div></div>'; });
      return h + '<div class="ac-legend" style="margin-top:12px"><span>' + fd(new Date(mn)) + ' → ' + fd(new Date(mx)) + '</span><span style="color:#d0443e">| hari ini</span><span>◆ milestone · ● tugas (hijau = selesai)</span></div>';
    }
    function vMs(p) {
      var L = msOf(p.id).sort(function (a, b) { return (a.date || '9').localeCompare(b.date || '9'); });
      return bar('Centang saat milestone tercapai.', add('ms', 'Milestone', 'projId', p.id)) + (L.length ? L.map(function (m) {
        var late = m.date && m.date < todayS() && !m.done;
        return '<div class="ac-item' + (m.done ? ' done' : '') + '"><input type="checkbox" data-act="tgm" data-id="' + m.id + '"' + (m.done ? ' checked' : '') + ' aria-label="Tercapai"><div><button class="t" data-act="edit" data-e="ms" data-id="' + m.id + '">' + esc(m.title) + '</button>' + (late ? badge('Terlambat', 'late') : '') + '<small>Target: ' + fd(m.date) + '</small>' + (m.notes ? '<small>' + esc(m.notes) + '</small>' : '') + '</div>' + btns('ms', m.id) + '</div>';
      }).join('') : empty('Belum ada milestone.'));
    }
    function vFiles(p) {
      var L = D.pfile.filter(function (f) { return f.projId === p.id; });
      return bar('Dokumen (tautan) dan catatan proyek.', add('pfile', 'Dokumen / catatan', 'projId', p.id)) + (p.notes ? '<div class="ac-card"><b>Catatan proyek</b><div class="ac-notes">' + esc(p.notes) + '</div></div>' : '') +
        (L.length ? L.map(function (f) { return '<div class="ac-item"><div><b>' + esc(f.title) + '</b>' + badge(f.kind) + (f.link ? '<small>' + link(f.link) + '</small>' : '') + (f.text ? '<div class="ac-notes">' + esc(f.text) + '</div>' : '') + '</div>' + btns('pfile', f.id) + '</div>'; }).join('') : empty('Belum ada dokumen atau catatan.'));
    }
    function vAna(p) {
      var T = tasksOf(p.id), M = msOf(p.id), g = pp(p), td = T.filter(function (t) { return t.status === 'Selesai'; }).length, md = M.filter(function (m) { return m.done; }).length;
      var od = T.filter(function (t) { return t.due && t.due < todayS() && t.status !== 'Selesai'; }).length, om = M.filter(function (m) { return m.date && m.date < todayS() && !m.done; }).length;
      var h = '<div class="ac-grid">' + stat(g.pct == null ? '—' : fmt(g.pct) + '%', 'Progres resmi (' + g.unit + ')') + stat(T.length ? fmt(td / T.length * 100) + '%' : '—', 'Tugas selesai (' + td + '/' + T.length + ')') + stat(M.length ? fmt(md / M.length * 100) + '%' : '—', 'Milestone tercapai (' + md + '/' + M.length + ')') + stat(od + om, 'Terlambat (' + od + ' tugas, ' + om + ' milestone)') + '</div>';
      h += '<div class="ac-h">Tugas per status</div><div class="ac-bars">' + TS.map(function (s) { var n = T.filter(function (t) { return t.status === s; }).length; return '<div class="ac-bar2"><span>' + s + '</span><div class="ac-track"><i style="width:' + (T.length ? n / T.length * 100 : 0) + '%"></i></div><span>' + n + '</span></div>'; }).join('') + '</div>';
      if (p.start && p.target && p.target > p.start) {
        var el2 = (Date.now() - new Date(p.start)) / (new Date(p.target) - new Date(p.start)) * 100, e = Math.max(0, Math.min(100, el2));
        h += '<div class="ac-h">Waktu berjalan vs progres</div><div class="ac-legend"><span><i></i>Progres</span><span><i class="alt"></i>Waktu berjalan</span></div><div class="ac-pair"><div class="ac-track"><i style="width:' + (g.pct || 0) + '%"></i></div><div class="ac-track"><i class="alt" style="width:' + e + '%"></i></div></div>' +
          '<p class="ac-hint" style="margin-top:8px">' + (g.pct == null ? 'Progres belum bisa dibandingkan karena belum ada ' + g.unit + '.' : 'Waktu terpakai ' + fmt(e) + '%, progres ' + fmt(g.pct) + '%.') + '</p>';
      }
      return h + '<p class="ac-hint" style="margin-top:14px">Progres resmi = ' + g.unit + ' selesai ÷ total ' + g.unit + '. Dasar perhitungan bisa diubah di Edit proyek.</p>';
    }
    return {
      skin: 'pj-skin', specs: specs, tabs: [['p', 'Proyek', function () { var p = st.proj && by(D.proj, st.proj); if (!p) return list(); var c = pc(p); return '<div class="pj-world" style="--c1:' + c[1] + ';--c2:' + c[2] + '">' + detail(p) + '</div>'; }]],
      sub: function () { return D.proj.length + ' proyek'; },
      cascade: { proj: [['ptask', 'projId'], ['ms', 'projId'], ['pfile', 'projId']] },
      guard: function (e) { if (e !== 'proj' && !D.proj.length) return ['Belum ada proyek', 'Buat proyek terlebih dahulu.']; },
      saved: function (ent, r, isNew, b) {
        var L = { name: 'Nama', area: 'Area', status: 'Status', priority: 'Prioritas', start: 'Mulai', target: 'Target', budget: 'Anggaran', basis: 'Dasar progres' };
        if (ent === 'proj') { if (isNew) { r.hist = []; log(r.id, 'Proyek dibuat'); } else Object.keys(L).forEach(function (k) { if (String(b[k]) !== String(r[k])) log(r.id, L[k] + ': ' + (b[k] || '—') + ' → ' + (r[k] || '—')); }); }
        if (ent === 'ptask') { if (isNew) log(r.projId, 'Tugas ditambahkan: ' + r.title); else if (b.status !== r.status) log(r.projId, 'Tugas "' + r.title + '": ' + b.status + ' → ' + r.status); }
        if (ent === 'ms') { if (isNew) log(r.projId, 'Milestone ditambahkan: ' + r.title); else if (b.done !== r.done) log(r.projId, 'Milestone "' + r.title + '" ' + (r.done ? 'tercapai' : 'dibuka kembali')); }
        if (ent === 'pfile' && isNew) log(r.projId, (r.kind === 'Catatan' ? 'Catatan' : 'Dokumen') + ' ditambahkan: ' + r.title);
      },
      act: function (a, d, t) {
        if (a === 'openp') { st.proj = d.id || null; st.pv = 'overview'; }
        if (a === 'pv') st.pv = d.v;
        if (a === 'bnav') st.bi = (st.bi || 0) + (+d.d);
        if (a === 'mv') { var x = by(D.ptask, d.id), i = Math.max(0, Math.min(2, TS.indexOf(x.status) + +d.d)); if (TS[i] !== x.status) { log(x.projId, 'Tugas "' + x.title + '": ' + x.status + ' → ' + TS[i]); x.status = TS[i]; } }
        if (a === 'tgm') { var m = by(D.ms, d.id); m.done = t.checked; log(m.projId, 'Milestone "' + m.title + '" ' + (m.done ? 'tercapai' : 'dibuka kembali')); }
      }
    };
  });

  MO.kit = { SKIP: SKIP, App: App, uid: uid, esc: esc, has: has, fmt: fmt, rp: rp, fd: fd, todayS: todayS, by: by, el: el, link: link, btns: btns, empty: empty, bar: bar, add: add, chips: chips, prog: prog, opt: opt, stat: stat, badge: badge };
  MO.work = work;
  MO.routes['#work'] = work.open;
  MO.org = org;
  MO.routes['#organization'] = org.open;
  MO.routes['#project'] = proj.open;
})();
;
/* MyOffice — Work Office "Arcade" : tampilan kartu geser (coverflow) bertema game-store gelap.
   Memakai data yang sama dengan Work Office lama (localStorage mo-work-v1), semua fitur lama tetap ada. */
(function () {
  'use strict';
  var MO = window.MyOffice; if (!MO || !MO.work || !MO.kit) return;
  var K = MO.kit, esc = K.esc, rp = K.rp, fd = K.fd, fmt = K.fmt, has = K.has, todayS = K.todayS, by = K.by, uid = K.uid;
  var app = MO.work.app, D = app.D;
  ['client', 'job', 'wtask', 'log', 'wdoc'].forEach(function (k) { if (!D[k]) D[k] = []; });

  var JS = ['Prospek', 'Berjalan', 'Review', 'Selesai', 'Dibatalkan'];
  var IS = ['Tidak relevan', 'Belum ditagih', 'Sudah ditagih', 'Sudah diterima'];
  var TS = ['Belum dikerjakan', 'Sedang dikerjakan', 'Selesai'];
  var DT = ['Kontrak', 'Invoice', 'Brief', 'Deliverable', 'Lainnya'];
  var PALETTE = ['#f59e0b', '#8b5cf6', '#1ea7e1', '#ff4757', '#f7c533', '#22c55e', '#ec4899', '#14b8a6', '#6366f1', '#f97316'];
  var SCOL = { Prospek: '#9aa4b8', Berjalan: '#22c55e', Review: '#f7c533', Selesai: '#1ea7e1', Dibatalkan: '#ff4757' };
  var NAV = [['jobs', 'Pekerjaan'], ['clients', 'Klien'], ['tasks', 'Tugas'], ['hours', 'Jam Kerja'], ['docs', 'Dokumen'], ['income', 'Pendapatan']];
  var WTABS = [['tasks', 'Tugas'], ['hours', 'Jam Kerja'], ['docs', 'Dokumen'], ['income', 'Pendapatan'], ['info', 'Info']];

  var S = { view: 'jobs', idx: 0, q: '', fs: '', world: null, wtab: 'tasks', ts: 'Semua', dt: 'Semua' };
  var ov, frame, isOpen = false, pos = 0, drag = null, dragged = false, wheelT = 0;

  /* ---------- helpers ---------- */
  function jobColor(j, i) { return j.color || PALETTE[(i == null ? D.job.indexOf(j) : i) % PALETTE.length]; }
  function lum(hex) { var h = (hex || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function ink(hex) { return lum(hex) > 0.68 ? '#1a1405' : '#fff'; }
  function cn(id) { var c = by(D.client, id); return c ? c.name : ''; }
  function jn(id) { var j = by(D.job, id); return j ? j.title : '—'; }
  function hrs(id) { return D.log.filter(function (l) { return l.jobId === id; }).reduce(function (a, l) { return a + (+l.hours || 0); }, 0); }
  function tOf(id) { return D.wtask.filter(function (t) { return t.jobId === id; }); }
  function prog(id) { var t = tOf(id); return t.length ? t.filter(function (x) { return x.status === 'Selesai'; }).length / t.length * 100 : null; }
  function late(j) { return j.deadline && j.deadline < todayS() && j.status !== 'Selesai' && j.status !== 'Dibatalkan'; }
  function received() { return D.job.filter(function (j) { return j.incomeStatus === 'Sudah diterima'; }).reduce(function (a, j) { return a + (+j.income || 0); }, 0); }
  function save() { app.save(); }
  function guardJobs() { if (!D.job.length) { MO.msg('Belum ada pekerjaan', 'Tambahkan pekerjaan terlebih dahulu.'); return true; } return false; }
  function filtered() {
    var q = S.q.toLowerCase().trim();
    return D.job.filter(function (j) {
      if (S.fs && j.status !== S.fs) return false;
      return !q || (j.title + ' ' + cn(j.clientId) + ' ' + (j.desc || '')).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ---------- ilustrasi bawaan (bila belum ada gambar) ---------- */
  function mascot(i) {
    var v = i % 4, ears = '';
    if (v === 1) ears = '<path d="M52 66 40 22 82 48Z" fill="rgba(255,255,255,.88)"/><path d="M148 66 160 22 118 48Z" fill="rgba(255,255,255,.88)"/>';
    if (v === 2) ears = '<ellipse cx="72" cy="34" rx="14" ry="34" fill="rgba(255,255,255,.88)"/><ellipse cx="128" cy="34" rx="14" ry="34" fill="rgba(255,255,255,.88)"/>';
    if (v === 3) ears = '<path d="M100 2l9 22 24 2-18 16 6 24-21-13-21 13 6-24-18-16 24-2Z" fill="#ffe14d"/>';
    return '<svg class="wo-mascot" viewBox="0 0 200 210" aria-hidden="true">' + ears +
      '<ellipse cx="100" cy="200" rx="62" ry="9" fill="rgba(0,0,0,.18)"/>' +
      '<circle cx="100" cy="112" r="78" fill="rgba(255,255,255,.92)"/>' +
      '<circle cx="100" cy="112" r="78" fill="url(#wg' + i + ')"/>' +
      '<defs><radialGradient id="wg' + i + '" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></radialGradient></defs>' +
      '<ellipse cx="74" cy="104" rx="9" ry="14" fill="#1b1b2a"/><ellipse cx="126" cy="104" rx="9" ry="14" fill="#1b1b2a"/>' +
      '<circle cx="77" cy="98" r="4" fill="#fff"/><circle cx="129" cy="98" r="4" fill="#fff"/>' +
      '<ellipse cx="58" cy="128" rx="13" ry="8" fill="#ff6b8b" opacity=".55"/><ellipse cx="142" cy="128" rx="13" ry="8" fill="#ff6b8b" opacity=".55"/>' +
      '<path d="M88 130q12 14 24 0" fill="none" stroke="#1b1b2a" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="30" cy="132" r="17" fill="rgba(255,255,255,.92)"/><circle cx="170" cy="132" r="17" fill="rgba(255,255,255,.92)"/></svg>';
  }
  var IMGC = new Map();
  function imgSrc(s) {
    if (!s || String(s).slice(0, 11) !== 'data:image/') return s;
    var c = IMGC.get(s); if (c) return c;
    try {
      var k = s.indexOf(','), head = s.slice(0, k); if (head.indexOf(';base64') < 0) return s;
      var b = atob(s.slice(k + 1)), n = b.length, u = new Uint8Array(n); while (n--) u[n] = b.charCodeAt(n);
      if (IMGC.size > 60) { IMGC.forEach(function (v) { try { URL.revokeObjectURL(v); } catch (e) { } }); IMGC.clear(); }
      c = URL.createObjectURL(new Blob([u], { type: head.slice(5).split(';')[0] })); IMGC.set(s, c); return c;
    } catch (e) { return s; }
  }
  function art(j, i) { return j.img ? '<img class="wo-img" src="' + esc(imgSrc(j.img)) + '" alt="" draggable="false" decoding="async">' : mascot(i); }

  /* ---------- kerangka ---------- */
  function build() {
    ov = document.createElement('div'); ov.className = 'wo-ov'; ov.hidden = true;
    ov.innerHTML = '<section class="wo-frame" role="dialog" aria-modal="true" aria-label="Work Office"></section>';
    document.body.appendChild(ov); frame = ov.firstChild;
    ov.addEventListener('click', onClick);
    ov.addEventListener('change', onChange);
    ov.addEventListener('input', onInput);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.addEventListener('keydown', onKey);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen || document.querySelector('.ac-ov2, .wo-ov2, .ac-soon:not([hidden])')) return;
      if (S.world) { S.world = null; render(); } else close();
    });
    window.addEventListener('resize', function () { if (isOpen && S.view === 'jobs' && !S.world) layout(pos); });
    app.onChange = function () { if (isOpen) render(); };
  }
  function open() { if (!ov) build(); isOpen = true; ov.hidden = false; document.body.style.overflow = 'hidden'; render(); }
  function close() { isOpen = false; if (ov) ov.hidden = true; document.body.style.overflow = ''; }

  function render() {
    if (!isOpen) return;
    var scroll = frame.querySelector('.wo-main'), top = scroll ? scroll.scrollTop : 0;
    var n = D.job.filter(function (j) { return j.status !== 'Selesai' && j.status !== 'Dibatalkan'; }).length;
    var searchOn = S.view === 'jobs' && !S.world;
    window.__morph(frame,
      '<header class="wo-top">' +
        '<div class="wo-l">' + (S.world ? '<button class="wo-back" data-a="back" aria-label="Kembali"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg><span>Pekerjaan</span></button>' :
          '<label class="wo-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input data-in="q" type="search" placeholder="' + (searchOn ? 'Cari pekerjaan' : 'Work Office') + '" value="' + esc(S.q) + '"' + (searchOn ? '' : ' disabled') + ' aria-label="Cari pekerjaan">' +
          '<span class="wo-filt' + (S.fs ? ' on' : '') + '"><svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg><select data-chg="fs" aria-label="Filter status"' + (searchOn ? '' : ' disabled') + '><option value="">Semua status</option>' + JS.map(function (s) { return '<option' + (S.fs === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></span></label>') + '</div>' +
        '<div class="wo-logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg></div>' +
        '<div class="wo-r"><div class="wo-coin" title="Pendapatan pekerjaan yang sudah diterima"><i>$</i><b>' + Math.round(received()).toLocaleString('id-ID') + '</b></div><button class="wo-x" data-a="close" aria-label="Tutup">×</button></div>' +
      '</header>' +
      (S.world ? '' : '<nav class="wo-nav" aria-label="Menu Work Office">' + NAV.map(function (x) { return '<button data-a="nav" data-v="' + x[0] + '" aria-current="' + (S.view === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</nav>') +
      '<div class="wo-main">' + (S.world ? worldHTML() : viewHTML(n)) + '</div>');
    var m = frame.querySelector('.wo-main'); if (m && top) m.scrollTop = top;
    window.__morphReveal(frame);
    if (!S.world && S.view === 'jobs') {
      stage = frame.querySelector('.wo-stage'); bindStage(); pos = clampIdx(S.idx); S.idx = pos;
      var stg = stage; stg.classList.add('nt'); layout(pos);   /* v4.6: kartu langsung di posisinya, tidak meluncur dari awal */
      requestAnimationFrame(function () { requestAnimationFrame(function () { stg.classList.remove('nt'); }); });
    }
  }
  function viewHTML(n) {
    if (S.view === 'jobs') return jobsHTML(n);
    var body = ({ clients: clientsHTML, tasks: function () { return tasksHTML(null); }, hours: function () { return hoursHTML(null); }, docs: function () { return docsHTML(null); }, income: function () { return incomeHTML(null); } })[S.view]();
    var titles = { clients: 'Klien', tasks: 'Semua Tugas', hours: 'Jam Kerja', docs: 'Dokumen', income: 'Pendapatan' };
    return '<div class="wo-page"><h2 class="wo-h2">' + titles[S.view] + '</h2>' + body + '</div>';
  }

  /* ---------- carousel ---------- */
  var stage;
  function jobsHTML(n) {
    var L = filtered(), cards = L.map(function (j, i) { return cardHTML(j, i); }).join('') + '<div class="wo-card add" role="button" tabindex="0" style="--c:#2a2d3a"><div class="wo-plus">+</div><b>Tambah Pekerjaan</b><small>Buat kartu baru</small></div>';
    return '<div class="wo-hero"><span class="wo-gold"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8Zm0 0c2-4 6-4 6-1.5S14 8 12 8Z"/></svg><b>' + n + ' Aktif</b></span>' +
      '<h1 class="wo-brand"><span class="wb1">Work</span> <span class="wb2">Office</span></h1></div>' +
      '<div class="wo-stagewrap"><button class="wo-arr l" data-a="prev" aria-label="Sebelumnya"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<div class="wo-stage" tabindex="0" aria-roledescription="carousel" aria-label="Daftar pekerjaan, geser untuk berpindah">' + cards + '</div>' +
      '<button class="wo-arr r" data-a="next" aria-label="Berikutnya"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button></div>' +
      '<div class="wo-focus">' + focusHTML() + '</div>';
  }
  function cardHTML(j, i) {
    var c = jobColor(j), p = prog(j.id), sub = cn(j.clientId) || 'Tanpa klien';
    return '<div class="wo-card" data-i="' + i + '" data-id="' + j.id + '" tabindex="-1" style="--c:' + c + ';--t:' + ink(c) + '">' +
      '<div class="wo-ct"><div class="wo-tx"><h3>' + esc(j.title) + '</h3><small>' + esc(sub) + '</small><em class="wo-st" style="--s:' + (SCOL[j.status] || '#999') + '">' + esc(j.status || '—') + '</em>' + (late(j) ? '<em class="wo-st late">Lewat tenggat</em>' : '') + '</div>' +
      '<span class="wo-pill" title="Progres tugas"><i></i>' + (p == null ? '—' : fmt(p) + '%') + '</span></div>' +
      '<div class="wo-art">' + art(j, i) + '</div></div>';
  }
  function focusHTML() {
    var L = filtered(), j = L[pos];
    if (!j) return '<p class="wo-empty">' + (D.job.length ? 'Tidak ada pekerjaan yang cocok dengan pencarian/filter.' : 'Belum ada pekerjaan. Tekan kartu “+” untuk menambah.') + '</p>';
    return '<div class="wo-count">' + (pos + 1) + ' / ' + L.length + '</div>' +
      '<div class="wo-rail" role="group" aria-label="Ubah status pekerjaan">' + JS.map(function (s) { return '<button data-a="jstat" data-id="' + j.id + '" data-s="' + s + '" aria-pressed="' + (j.status === s) + '" style="--s:' + SCOL[s] + '">' + s + '</button>'; }).join('') + '</div>' +
      '<div class="wo-acts"><button class="wo-btn go" data-a="open" data-id="' + j.id + '" style="--c:' + jobColor(j) + '">Masuk dunia ▸</button><button class="wo-btn" data-a="jedit" data-id="' + j.id + '">✎ Edit kartu</button><button class="wo-btn dng" data-a="jdel" data-id="' + j.id + '">Hapus</button></div>';
  }
  function clampIdx(i) { var n = filtered().length; return Math.max(0, Math.min(n, Math.round(i))); } // n = kartu "tambah"
  function cards() { return stage ? [].slice.call(stage.children) : []; }
  function layout(p) {
    var cs = cards(); if (!cs.length) return;
    var w = cs[0].offsetWidth || 220, step = w * 0.74;
    cs.forEach(function (c, i) {
      var off = i - p, a = Math.abs(off), s = Math.max(0.5, 1 - 0.125 * a), x = off * step * (a > 2 ? 0.86 : 1);
      c.style.transform = 'translateX(' + x.toFixed(1) + 'px) translateY(' + (a * 6).toFixed(1) + 'px) rotate(' + (off * 2.6).toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
      c.style.zIndex = String(100 - Math.round(a * 10));
      c.style.opacity = a > 3.2 ? '0' : '1';
      c.style.pointerEvents = a > 3.2 ? 'none' : '';
      c.style.setProperty('--dim', a < .5 ? '0' : (Math.min(a, 2) * 0.14).toFixed(2));
      c.classList.toggle('on', a < 0.5);
    });
  }
  function go(i, keep) {
    var n = filtered().length; i = Math.max(0, Math.min(n, i));
    pos = i; S.idx = i; layout(pos); refocus();
  }
  function refocus() { var f = frame.querySelector('.wo-focus'); if (f) f.innerHTML = focusHTML(); }
  function bindStage() {
    if (stage.__bound) return; stage.__bound = 1;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      drag = { x: e.clientX, p: pos, moved: false, id: e.pointerId, lx: e.clientX, lt: performance.now(), v: 0 };
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = e.clientX - drag.x, w = (cards()[0] || {}).offsetWidth || 220, step = w * 0.74;
      if (!drag.moved && Math.abs(dx) > 7) { drag.moved = true; stage.classList.add('drag'); try { stage.setPointerCapture(drag.id); } catch (x) { } }
      if (!drag.moved) return;
      var now = performance.now(); drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.lt); drag.lx = e.clientX; drag.lt = now;
      var n = filtered().length; pos = Math.max(-0.35, Math.min(n + 0.35, drag.p - dx / step)); layout(pos);
    });
    function end() {
      if (!drag) return; var d = drag; drag = null; stage.classList.remove('drag');
      if (d.moved) { dragged = true; setTimeout(function () { dragged = false; }, 0); var w = (cards()[0] || {}).offsetWidth || 220; var t = pos - d.v * 260 / (w * 0.74); go(Math.round(t)); }
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', function (e) {
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0); if (!d) return;
      e.preventDefault(); var t = Date.now(); if (t - wheelT < 260) return; wheelT = t; go(pos + (d > 0 ? 1 : -1));
    }, { passive: false });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(pos + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(pos - 1); }
      else if (e.key === 'Enter') { var j = filtered()[pos]; if (j) openWorld(j.id); else openJobModal(); }
    });
  }
  function openWorld(id) { S.world = id; S.wtab = 'tasks'; render(); var m = frame.querySelector('.wo-main'); if (m) m.scrollTop = 0; }

  /* ---------- tampilan: klien ---------- */
  function clientsHTML() {
    return '<div class="wo-grid">' + D.client.map(function (c, i) {
      var col = PALETTE[(i + 2) % PALETTE.length], js = D.job.filter(function (j) { return j.clientId === c.id; });
      return '<article class="wo-box wo-client" style="--c:' + col + '"><div class="wo-av" style="color:' + ink(col) + '">' + esc((c.name || '?').trim().charAt(0).toUpperCase()) + '</div><div class="wo-cb"><h3>' + esc(c.name) + '</h3><small>' + esc(c.contact || 'Tanpa kontak') + '</small>' +
        '<div class="wo-tags"><span>' + js.length + ' pekerjaan</span></div>' + (c.notes ? '<p class="wo-note">' + esc(c.notes) + '</p>' : '') + '<div class="wo-row"><button class="wo-mini" data-a="edit" data-e="client" data-id="' + c.id + '">Edit</button><button class="wo-mini dng" data-a="del" data-e="client" data-id="' + c.id + '">Hapus</button></div></div></article>';
    }).join('') + '<button class="wo-box wo-addbox" data-a="add" data-e="client"><span>+</span>Tambah klien</button></div>' + (D.client.length ? '' : '<p class="wo-empty">Belum ada klien.</p>');
  }

  /* ---------- tampilan: tugas ---------- */
  function tasksHTML(jobId) {
    var L = D.wtask.filter(function (t) { return (!jobId || t.jobId === jobId) && (S.ts === 'Semua' || t.status === S.ts); }).sort(function (a, b) { return (a.deadline || '9').localeCompare(b.deadline || '9'); });
    var pre = jobId ? ' data-pk="jobId" data-pv="' + jobId + '"' : '';
    var h = '<div class="wo-bar"><div class="wo-chips">' + ['Semua'].concat(TS).map(function (x) { return '<button data-a="filt" data-f="ts" data-v="' + x + '" aria-pressed="' + (S.ts === x) + '">' + x + '</button>'; }).join('') + '</div><button class="wo-btn go" data-a="add" data-e="wtask"' + pre + '>+ Tugas</button></div>';
    if (!L.length) return h + '<p class="wo-empty">Belum ada tugas' + (S.ts !== 'Semua' ? ' dengan status ini' : '') + '.</p>';
    return h + L.map(function (t) {
      var lt = t.deadline && t.deadline < todayS() && t.status !== 'Selesai', done = t.status === 'Selesai', j = by(D.job, t.jobId), c = j ? jobColor(j) : '#888';
      return '<div class="wo-item' + (done ? ' done' : '') + '" style="--c:' + c + '"><input type="checkbox" data-chg="tgw" data-id="' + t.id + '"' + (done ? ' checked' : '') + ' aria-label="Selesai"><div class="wo-ib"><button class="wo-t" data-a="edit" data-e="wtask" data-id="' + t.id + '">' + esc(t.title) + '</button>' + (lt ? '<em class="wo-st late">Terlambat</em>' : '') +
        '<small>' + (jobId ? '' : esc(jn(t.jobId)) + ' · ') + 'Tenggat ' + fd(t.deadline) + ' · Estimasi ' + (has(t.estHours) ? t.estHours + ' jam' : '—') + '</small>' + (t.notes ? '<small>' + esc(t.notes) + '</small>' : '') + '</div>' +
        '<select class="wo-sel" data-chg="tst" data-id="' + t.id + '" aria-label="Status tugas">' + TS.map(function (s) { return '<option' + (t.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<button class="wo-mini dng" data-a="del" data-e="wtask" data-id="' + t.id + '" aria-label="Hapus">×</button></div>';
    }).join('');
  }

  /* ---------- tampilan: jam kerja ---------- */
  function hoursHTML(jobId) {
    var logs = D.log.filter(function (l) { return !jobId || l.jobId === jobId; }), tot = logs.reduce(function (a, l) { return a + (+l.hours || 0); }, 0);
    var js = D.job.filter(function (j) { return (!jobId || j.id === jobId) && hrs(j.id) > 0; });
    var pre = jobId ? ' data-pk="jobId" data-pv="' + jobId + '"' : '';
    var h = '<div class="wo-bar"><p class="wo-hint">Catat jam kerja aktual dan bandingkan dengan estimasi.</p><button class="wo-btn go" data-a="add" data-e="log"' + pre + '>+ Jam kerja</button></div>';
    if (!logs.length) return h + '<p class="wo-empty">Belum ada catatan jam kerja.</p>';
    h += '<div class="wo-stats">' + stat(fmt(tot), 'Total jam tercatat') + stat(js.length, 'Pekerjaan dengan jam tercatat') + '</div>';
    h += '<div class="wo-bars">' + js.map(function (j) {
      var a = hrs(j.id), e = +j.estHours || 0, mx = Math.max(a, e, 1);
      return '<div class="wo-b2"><span>' + esc(j.title) + '</span><div><div class="wo-track"><i style="width:' + a / mx * 100 + '%;--c:' + jobColor(j) + '"></i></div>' + (e ? '<div class="wo-track"><i class="alt" style="width:' + e / mx * 100 + '%"></i></div>' : '') + '</div><span>' + fmt(a) + ' / ' + (e ? fmt(e) : '—') + ' jam</span></div>';
    }).join('') + '</div><div class="wo-legend"><span><i></i>Aktual</span><span><i class="alt"></i>Estimasi</span></div>';
    return h + '<div class="wo-tblwrap"><table class="wo-tbl"><tr><th>Tanggal</th><th>Pekerjaan</th><th>Jam</th><th>Catatan</th><th></th></tr>' +
      logs.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).map(function (l) { return '<tr><td>' + fd(l.date) + '</td><td>' + esc(jn(l.jobId)) + '</td><td>' + l.hours + '</td><td>' + esc(l.notes || '') + '</td><td class="r"><button class="wo-mini" data-a="edit" data-e="log" data-id="' + l.id + '">Edit</button> <button class="wo-mini dng" data-a="del" data-e="log" data-id="' + l.id + '">Hapus</button></td></tr>'; }).join('') + '</table></div>';
  }
  function stat(b, s) { return '<div class="wo-stat"><b>' + b + '</b><span>' + s + '</span></div>'; }

  /* ---------- tampilan: dokumen ---------- */
  function docsHTML(jobId) {
    var L = D.wdoc.filter(function (d) { return (!jobId || d.jobId === jobId) && (S.dt === 'Semua' || d.type === S.dt); });
    var pre = jobId ? ' data-pk="jobId" data-pv="' + jobId + '"' : '';
    var h = '<div class="wo-bar"><div class="wo-chips">' + ['Semua'].concat(DT).map(function (x) { return '<button data-a="filt" data-f="dt" data-v="' + x + '" aria-pressed="' + (S.dt === x) + '">' + x + '</button>'; }).join('') + '</div><button class="wo-btn go" data-a="add" data-e="wdoc"' + pre + '>+ Dokumen</button></div>';
    if (!L.length) return h + '<p class="wo-empty">Belum ada dokumen.</p>';
    return h + L.map(function (d) {
      return '<div class="wo-item"><div class="wo-ib"><b>' + esc(d.title) + '</b><em class="wo-st" style="--s:#8b5cf6">' + esc(d.type) + '</em><small>' + (jobId ? '' : esc(jn(d.jobId))) + (d.link ? (jobId ? '' : ' · ') + K.link(d.link) : '') + '</small>' + (d.notes ? '<small>' + esc(d.notes) + '</small>' : '') + '</div>' +
        '<button class="wo-mini" data-a="edit" data-e="wdoc" data-id="' + d.id + '">Edit</button><button class="wo-mini dng" data-a="del" data-e="wdoc" data-id="' + d.id + '">Hapus</button></div>';
    }).join('');
  }

  /* ---------- tampilan: pendapatan ---------- */
  function incomeHTML(jobId) {
    var js = D.job.filter(function (j) { return (!jobId || j.id === jobId) && +j.income > 0 && j.incomeStatus !== 'Tidak relevan'; });
    var sum = function (s) { return js.filter(function (j) { return j.incomeStatus === s; }).reduce(function (a, j) { return a + +j.income; }, 0); };
    return '<div class="wo-warn"><b>Dipisahkan dari pemasukan pribadi.</b> Angka di sini hanya pendapatan pekerjaan. Tidak ada yang otomatis masuk ke pemasukan pribadi; hubungan ke modul keuangan nanti lewat referensi transaksi per pekerjaan.</div>' +
      '<div class="wo-stats">' + stat(rp(sum('Sudah diterima')), 'Sudah diterima') + stat(rp(sum('Sudah ditagih')), 'Sudah ditagih, belum diterima') + stat(rp(sum('Belum ditagih')), 'Belum ditagih') + '</div>' +
      (js.length ? '<div class="wo-tblwrap"><table class="wo-tbl"><tr><th>Pekerjaan</th><th>Klien</th><th>Jumlah</th><th>Status</th><th>Ref. transaksi</th></tr>' + js.map(function (j) { return '<tr class="click" data-a="jfull" data-id="' + j.id + '"><td>' + esc(j.title) + '</td><td>' + esc(cn(j.clientId) || 'Tanpa klien') + '</td><td>' + rp(j.income) + '</td><td>' + esc(j.incomeStatus) + '</td><td>' + esc(j.txRef || '—') + '</td></tr>'; }).join('') + '</table></div>' : '<p class="wo-empty">Belum ada pekerjaan dengan pendapatan. Isi di form detail pekerjaan.</p>');
  }

  /* ---------- DUNIA BARU (detail pekerjaan) ---------- */
  function worldHTML() {
    var j = by(D.job, S.world); if (!j) { S.world = null; return viewHTML(0); }
    var i = D.job.indexOf(j), c = jobColor(j, i), p = prog(j.id), tn = tOf(j.id), td = tn.filter(function (x) { return x.status === 'Selesai'; }).length, a = hrs(j.id);
    var body = ({
      tasks: function () { return tasksHTML(j.id); }, hours: function () { return hoursHTML(j.id); }, docs: function () { return docsHTML(j.id); }, income: function () { return incomeHTML(j.id); },
      info: function () { return infoHTML(j); }
    })[S.wtab]();
    return '<div class="wo-world" style="--c:' + c + ';--t:' + ink(c) + '">' +
      '<div class="wo-wh"><div class="wo-wart">' + art(j, i) + '</div><div class="wo-wi">' +
      '<small class="wo-sub">' + esc(cn(j.clientId) || 'Tanpa klien') + '</small><h2>' + esc(j.title) + '</h2>' +
      '<div class="wo-rail sm" role="group" aria-label="Ubah status">' + JS.map(function (s) { return '<button data-a="jstat" data-id="' + j.id + '" data-s="' + s + '" aria-pressed="' + (j.status === s) + '" style="--s:' + SCOL[s] + '">' + s + '</button>'; }).join('') + '</div>' +
      '<div class="wo-xp"><div class="wo-track big"><i style="width:' + (p || 0) + '%"></i></div><span>' + (p == null ? 'Belum ada tugas — progres belum bisa dihitung' : td + ' dari ' + tn.length + ' tugas selesai (' + fmt(p) + '%)') + '</span></div>' +
      '<div class="wo-wbtns"><button class="wo-btn" data-a="jedit" data-id="' + j.id + '">✎ Edit kartu</button><button class="wo-btn" data-a="jfull" data-id="' + j.id + '">Detail lengkap</button></div></div></div>' +
      '<div class="wo-stats w">' + stat(td + '/' + tn.length, 'Tugas selesai') + stat(fmt(a) + (has(j.estHours) ? ' / ' + fmt(+j.estHours) : ''), 'Jam aktual / estimasi') + stat(j.deadline ? fd(j.deadline) : '—', late(j) ? 'Tenggat (lewat!)' : 'Tenggat') + stat(+j.income > 0 && j.incomeStatus !== 'Tidak relevan' ? rp(j.income) : '—', 'Pendapatan' + (j.incomeStatus && j.incomeStatus !== 'Tidak relevan' ? ' · ' + j.incomeStatus : '')) + '</div>' +
      '<nav class="wo-wtabs">' + WTABS.map(function (x) { return '<button data-a="wtab" data-v="' + x[0] + '" aria-current="' + (S.wtab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</nav>' +
      '<div class="wo-wbody">' + body + '</div></div>';
  }
  function infoHTML(j) {
    var rows = [['Klien', cn(j.clientId) || 'Tanpa klien'], ['Status', j.status], ['Tenggat', fd(j.deadline)], ['Estimasi durasi', has(j.estHours) ? j.estHours + ' jam' : '—'], ['Pendapatan', +j.income > 0 ? rp(j.income) + ' · ' + j.incomeStatus : '—'], ['Ref. transaksi', j.txRef || '—']];
    return '<div class="wo-box"><div class="wo-kv">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' +
      (j.desc ? '<p class="wo-note"><b>Deskripsi</b>\n' + esc(j.desc) + '</p>' : '') + (j.notes ? '<p class="wo-note"><b>Catatan</b>\n' + esc(j.notes) + '</p>' : '') +
      '<div class="wo-row"><button class="wo-btn go" data-a="jfull" data-id="' + j.id + '">Edit detail lengkap</button><button class="wo-btn" data-a="jedit" data-id="' + j.id + '">✎ Edit kartu</button><button class="wo-btn dng" data-a="jdel" data-id="' + j.id + '">Hapus pekerjaan</button></div></div>';
  }

  /* ---------- editor kartu (gambar, warna, nama, status) ---------- */
  function openJobModal(id) {
    var ed = id ? by(D.job, id) : null, idx = ed ? D.job.indexOf(ed) : D.job.length;
    var m = { title: ed ? ed.title : '', clientId: ed ? ed.clientId || '' : '', status: ed ? ed.status : 'Berjalan', deadline: ed ? ed.deadline || '' : '', color: ed ? jobColor(ed, idx) : PALETTE[idx % PALETTE.length], img: ed ? ed.img || '' : '' };
    var w = document.createElement('div'); w.className = 'wo-ov2';
    w.innerHTML = '<form class="wo-modal" novalidate><header><h2>' + (ed ? 'Edit Kartu' : 'Pekerjaan Baru') + '</h2><button type="button" class="wo-x" data-x aria-label="Tutup">×</button></header>' +
      '<div class="wo-mbody"><div class="wo-prev"><div class="wo-card on" data-pv style="--c:' + m.color + ';--t:' + ink(m.color) + '"></div></div><div class="wo-fields">' +
      '<label class="full"><span>Nama pekerjaan *</span><input name="title" type="text" value="' + esc(m.title) + '" required maxlength="80"></label>' +
      '<label><span>Klien</span><select name="clientId"><option value="">— Internal / tanpa klien —</option>' + D.client.map(function (c) { return '<option value="' + c.id + '"' + (c.id === m.clientId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label><span>Status</span><select name="status">' + JS.map(function (s) { return '<option' + (s === m.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label class="full"><span>Tenggat waktu</span><input name="deadline" type="date" value="' + esc(m.deadline) + '"></label>' +
      '<div class="full"><span class="lb">Warna latar kartu</span><div class="wo-sw">' + PALETTE.map(function (c) { return '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="Warna ' + c + '"></button>'; }).join('') + '<label class="wo-cp" title="Warna sendiri"><input type="color" name="color" value="' + m.color + '"></label></div></div>' +
      '<div class="full"><span class="lb">Gambar kartu</span><div class="wo-upl"><label class="wo-btn">Pilih gambar…<input type="file" accept="image/*" hidden name="file"></label><button type="button" class="wo-btn" data-noimg>Hapus gambar</button></div><small class="wo-hint">PNG transparan hasilnya paling bagus. Gambar otomatis dikecilkan agar hemat penyimpanan.</small></div>' +
      '</div></div><footer><button type="button" class="wo-btn" data-x>Batal</button>' + (ed ? '' : '<button type="button" class="wo-btn" data-more>Simpan & isi detail</button>') + '<button class="wo-btn go" style="--c:' + m.color + '">Simpan</button></footer></form>';
    document.body.appendChild(w);
    var f = w.querySelector('form'), more = false;
    function sync() {
      var pv = w.querySelector('[data-pv]'), c = m.color, t = f.elements.title.value || 'Nama pekerjaan', cl = f.elements.clientId.selectedOptions[0];
      pv.style.setProperty('--c', c); pv.style.setProperty('--t', ink(c));
      pv.innerHTML = '<div class="wo-ct"><div class="wo-tx"><h3>' + esc(t) + '</h3><small>' + esc(cl && cl.value ? cl.textContent : 'Tanpa klien') + '</small><em class="wo-st" style="--s:' + (SCOL[f.elements.status.value] || '#999') + '">' + esc(f.elements.status.value) + '</em></div><span class="wo-pill"><i></i>0%</span></div><div class="wo-art">' + (m.img ? '<img class="wo-img" src="' + esc(m.img) + '" alt="">' : mascot(idx)) + '</div>';
      [].forEach.call(w.querySelectorAll('.wo-sw button'), function (b) { b.classList.toggle('on', b.dataset.c === c); });
      w.querySelector('.wo-btn.go').style.setProperty('--c', c);
    }
    sync();
    f.addEventListener('input', function (e) { if (e.target.name === 'color') m.color = e.target.value; sync(); });
    f.addEventListener('change', function (e) {
      if (e.target.name === 'file' && e.target.files[0]) shrink(e.target.files[0], function (d) { m.img = d; sync(); });
      sync();
    });
    w.addEventListener('click', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-x')) w.remove();
      if (t.dataset.c) { m.color = t.dataset.c; f.elements.color.value = m.color; sync(); }
      if (t.hasAttribute('data-noimg')) { m.img = ''; f.elements.file.value = ''; sync(); }
      if (t.hasAttribute('data-more')) { more = true; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); }
    });
    w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
    w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); w.remove(); } });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var t = f.elements.title.value.trim(); if (!t) { f.elements.title.focus(); return; }
      var rec = ed || { id: uid(), incomeStatus: 'Tidak relevan' };
      rec.title = t; rec.clientId = f.elements.clientId.value; rec.status = f.elements.status.value; rec.deadline = f.elements.deadline.value; rec.color = m.color; rec.img = m.img;
      if (!ed) { D.job.push(rec); S.q = ''; S.fs = ''; S.idx = D.job.length - 1; }
      save(); w.remove(); render();
      if (more) app.form('job', rec.id);
    });
    f.elements.title.focus();
  }
  function shrink(file, cb) {
    var r = new FileReader();
    r.onload = function () {
      var im = new Image();
      im.onload = function () {
        var M = 560, k = Math.min(1, M / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        var d = cv.toDataURL('image/webp', 0.86); if (d.indexOf('data:image/webp') !== 0) d = cv.toDataURL('image/png');
        cb(d);
      };
      im.onerror = function () { MO.msg('Gambar gagal dibaca', 'Coba file gambar lain.'); };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ---------- event ---------- */
  function onClick(e) {
    var t = e.target.closest('[data-a]'); if (!t || !ov.contains(t)) return;
    if (dragged) return;
    var a = t.dataset.a, d = t.dataset;
    if (a === 'close') return close();
    if (a === 'back') { S.world = null; return render(); }
    if (a === 'nav') { S.view = d.v; S.world = null; return render(); }
    if (a === 'prev') return go(pos - 1);
    if (a === 'next') return go(pos + 1);
    if (a === 'jadd') return openJobModal();
    if (a === 'open') return openWorld(d.id);
    if (a === 'jedit') return openJobModal(d.id);
    if (a === 'jfull') return app.form('job', d.id);
    if (a === 'jdel') { app.del('job', d.id); if (!by(D.job, d.id)) { S.world = null; S.idx = Math.max(0, S.idx - 1); render(); } return; }
    if (a === 'jstat') { var j = by(D.job, d.id); if (j) { j.status = d.s; save(); if (S.world) render(); else render(); } return; }
    if (a === 'wtab') { S.wtab = d.v; return render(); }
    if (a === 'filt') { S[d.f] = d.v; return render(); }
    if (a === 'add') {
      if (['wtask', 'log'].indexOf(d.e) > -1 && guardJobs()) return;
      var pre = {}; if (d.pk) pre[d.pk] = d.pv; return app.form(d.e, null, pre);
    }
    if (a === 'edit') return app.form(d.e, d.id);
    if (a === 'del') return app.del(d.e, d.id);
  }
  ov_cardClick();
  function ov_cardClick() {
    document.addEventListener('click', function (e) {
      if (!isOpen || dragged) return; var c = e.target.closest && e.target.closest('.wo-stage .wo-card'); if (!c || !ov.contains(c)) return;
      e.stopPropagation();
      var L = filtered(), i = c.classList.contains('add') ? L.length : +c.dataset.i;
      if (i !== Math.round(pos)) return go(i);
      if (c.classList.contains('add')) return openJobModal();
      openWorld(c.dataset.id);
    }, true);
  }
  function onChange(e) {
    var t = e.target, k = t.dataset && t.dataset.chg; if (!k) return;
    if (k === 'fs') { S.fs = t.value; S.idx = 0; return render(); }
    if (k === 'tgw' || k === 'tst') {
      var x = by(D.wtask, t.dataset.id); if (!x) return;
      x.status = k === 'tgw' ? (t.checked ? 'Selesai' : 'Belum dikerjakan') : t.value; save(); render();
    }
  }
  function onInput(e) {
    var t = e.target; if (!t.dataset || t.dataset.in !== 'q') return;
    S.q = t.value; S.idx = 0; var p = t.selectionStart; render();
    var n = frame.querySelector('[data-in="q"]'); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (x) { } }
  }
  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('wo-card') && e.target.classList.contains('add')) { e.preventDefault(); openJobModal(); }
  }

  MO.routes['#work'] = open;
})();
;
/* MyOffice — Organization "eShop" : tampilan terang ala toko game (hero + grid kartu).
   Memakai data Organization lama (localStorage mo-org-v1); semua fitur lama tetap ada. */
(function () {
  'use strict';
  var MO = window.MyOffice; if (!MO || !MO.org || !MO.kit) return;
  var K = MO.kit, esc = K.esc, rp = K.rp, fd = K.fd, by = K.by, uid = K.uid;
  var app = MO.org.app, D = app.D;
  ['org', 'meeting', 'followup', 'budget', 'odoc'].forEach(function (k) { if (!D[k]) D[k] = []; });

  var FS = ['Belum', 'Berjalan', 'Selesai'];
  var OD = ['Proposal', 'Notulen', 'Laporan pertanggungjawaban', 'Surat', 'Materi presentasi', 'Dokumen lainnya'];
  var PALETTE = ['#e60012', '#00a0e9', '#f5a300', '#2db36f', '#8a5cf6', '#ff6fa5', '#14b8a6', '#ff7a1a'];
  var NAV = [['search', 'Cari'], ['orgs', 'Organisasi'], ['meet', 'Rapat'], ['bud', 'Anggaran'], ['docs', 'Dokumen']];
  var WT = [['meet', 'Rapat'], ['bud', 'Anggaran'], ['docs', 'Dokumen'], ['info', 'Info']];

  var S = { view: 'orgs', idx: 0, q: '', world: null, wtab: 'meet', od: 'Semua' };
  var ov, frame, isOpen = false, drag = null, dragged = false;

  function oc(o, i) { return o.color || PALETTE[(i == null ? D.org.indexOf(o) : i) % PALETTE.length]; }
  /* warna kartu = warna dominan logo; warna tepi = warna latar logo (agar kotak gambar menyatu dengan hero) */
  var BR = {}, ED = {};
  function brandKey(src) { return src.length + '|' + src.slice(-80); }
  function hex(r, g, b) { return '#' + [r, g, b].map(function (v) { return Math.round(v).toString(16).padStart(2, '0'); }).join(''); }
  function domColor(src, done) {
    var im = new Image();
    im.onload = function () {
      try {
        var W = 48, H = Math.max(1, Math.round(W * im.naturalHeight / im.naturalWidth)), cv = document.createElement('canvas');
        cv.width = W; cv.height = H; var cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(im, 0, 0, W, H);
        var px = cx.getImageData(0, 0, W, H).data, bins = {}, er = 0, eg = 0, eb = 0, en = 0;
        for (var p = 0; p < px.length; p += 4) {
          var idx = p / 4, x = idx % W, y = Math.floor(idx / W);
          if (px[p + 3] < 200) continue;
          var r = px[p], g = px[p + 1], b = px[p + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { er += r; eg += g; eb += b; en++; }
          if (mx < 50 || (mx - mn) / mx < 0.28) continue; /* abaikan putih, abu-abu, dan hitam */
          var key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5), q = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
          q.n++; q.r += r; q.g += g; q.b += b;
        }
        var best = null; for (var k in bins) if (!best || bins[k].n > best.n) best = bins[k];
        done(best ? hex(best.r / best.n, best.g / best.n, best.b / best.n) : '', en ? hex(er / en, eg / en, eb / en) : '');
      } catch (err) { done('', ''); }
    };
    im.onerror = function () { done('', ''); };
    im.src = src;
  }
  function brandOf(o, i, cb) {
    if (!o.img) return oc(o, i);
    var k = brandKey(o.img);
    if (BR[k] === undefined) { BR[k] = ''; domColor(o.img, function (c, edge) { BR[k] = c; ED[k] = edge; if (cb) cb(c); else if (isOpen) render(); }); }
    return BR[k] || oc(o, i);
  }
  function edgeOf(o, i) { var c = brandOf(o, i); return (o.img && ED[brandKey(o.img)]) || c; }
  function lum(h) { h = (h || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return (0.299 * parseInt(h.substr(0, 2), 16) + 0.587 * parseInt(h.substr(2, 2), 16) + 0.114 * parseInt(h.substr(4, 2), 16)) / 255; }
  function ink(h) { return lum(h) > 0.7 ? '#1a1405' : '#fff'; }
  function on(id) { var o = by(D.org, id); return o ? o.name : '—'; }
  function save() { app.save(); }
  function cnt(id, k) { return D[k].filter(function (x) { return x.orgId === id; }).length; }
  function bsum(id) { var P = 0, A = 0; D.budget.forEach(function (b) { if (!id || b.orgId === id) { P += +b.planned || 0; A += +b.actual || 0; } }); return { P: P, A: A }; }
  function guardOrg() { if (!D.org.length) { MO.msg('Belum ada organisasi', 'Tambahkan profil organisasi terlebih dahulu.'); return true; } return false; }
  function filtered() { var q = S.q.toLowerCase().trim(); return D.org.filter(function (o) { return !q || (o.name + ' ' + (o.role || '') + ' ' + (o.period || '') + ' ' + (o.desc || '')).toLowerCase().indexOf(q) > -1; }); }
  var I = {
    cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    role: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/></svg>',
    ppl: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-4.5 11.2-4.5 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .5 3.3 2.7 3.5 6"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    srch: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
  };

  /* ilustrasi bawaan (kantor/gedung di bukit) */
  function scene(i) {
    var v = i % 3;
    return '<svg class="es-scene" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="600" height="340" class="s0"/><circle cx="' + (v === 1 ? 140 : 470) + '" cy="82" r="38" fill="#fff" opacity=".85"/>' +
      '<ellipse cx="130" cy="64" rx="60" ry="16" fill="#fff" opacity=".7"/><ellipse cx="380" cy="104" rx="70" ry="15" fill="#fff" opacity=".6"/>' +
      '<path d="M0 250Q150 170 300 230T600 210V340H0Z" class="s1"/><path d="M0 290Q200 230 380 280T600 260V340H0Z" class="s2"/>' +
      '<g class="s3" transform="translate(' + (v === 2 ? 120 : 330) + ' 120)"><rect x="0" y="40" width="120" height="110" rx="6"/><rect x="30" y="0" width="60" height="50" rx="5"/>' +
      '<g fill="#fff" opacity=".9"><rect x="14" y="58" width="16" height="16" rx="3"/><rect x="52" y="58" width="16" height="16" rx="3"/><rect x="90" y="58" width="16" height="16" rx="3"/><rect x="14" y="90" width="16" height="16" rx="3"/><rect x="90" y="90" width="16" height="16" rx="3"/><rect x="46" y="112" width="28" height="38" rx="3"/><rect x="42" y="14" width="14" height="14" rx="3"/><rect x="64" y="14" width="14" height="14" rx="3"/></g>' +
      '<path d="M60 0V-30" stroke="#fff" stroke-width="4"/><path d="M60-30l30 9-30 9Z" fill="#ffd24a"/></g></svg>';
  }
  /* gambar ditampilkan utuh (contain) di atas salinan buram dirinya sendiri, jadi tidak pernah terpotong dan tidak ada ruang kosong */
  function fit(src) { var u = esc(src); return '<span class="es-fit"><img class="es-bg" src="' + u + '" alt="" aria-hidden="true" draggable="false"><img class="es-img" src="' + u + '" alt="" draggable="false"></span>'; }
  function art(o, i) { return o.img ? fit(o.img) : scene(i); }

  /* ---------- kerangka ---------- */
  function build() {
    ov = document.createElement('div'); ov.className = 'es-ov'; ov.hidden = true;
    ov.innerHTML = '<section class="es-frame" role="dialog" aria-modal="true" aria-label="Organization"></section>';
    document.body.appendChild(ov); frame = ov.firstChild;
    ov.addEventListener('click', onClick); ov.addEventListener('change', onChange); ov.addEventListener('input', onInput);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { if (document.querySelector('.ac-ov2, .es-ov2, .ac-soon:not([hidden])')) return; if (S.world) { S.world = null; render(); } else close(); return; }
      if (S.view === 'orgs' && !S.world && !document.querySelector('.ac-ov2, .es-ov2') && /^(ArrowLeft|ArrowRight)$/.test(e.key) && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) pick(S.idx + (e.key === 'ArrowRight' ? 1 : -1));
    });
    app.onChange = function () { if (isOpen) render(); };
  }
  function open() { if (!ov) build(); isOpen = true; ov.hidden = false; document.body.style.overflow = 'hidden'; render(); }
  function close() { isOpen = false; if (ov) ov.hidden = true; document.body.style.overflow = ''; }

  function render() {
    if (!isOpen) return;
    var m0 = frame.querySelector('.es-main'), top = m0 ? m0.scrollTop : 0, cur = filtered()[Math.min(S.idx, Math.max(0, filtered().length - 1))];
    var av = cur ? (cur.img ? '<img src="' + esc(cur.img) + '" alt="">' : '<b>' + esc((cur.name || '?').charAt(0).toUpperCase()) + '</b>') : '<b>O</b>';
    window.__morph(frame,
      '<header class="es-top"><div class="es-logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 11h.01M15 11h.01"/></svg></div>' +
      '<nav class="es-nav" aria-label="Menu Organization">' + (S.world ? '<button class="es-bk" data-a="back">‹ Semua organisasi</button>' : NAV.map(function (x) {
        if (x[0] === 'search') return '<label class="es-sbox' + (S.q ? ' on' : '') + '">' + I.srch + '<input data-in="q" type="search" placeholder="Cari" value="' + esc(S.q) + '" aria-label="Cari organisasi"></label>';
        return '<button data-a="nav" data-v="' + x[0] + '" aria-current="' + (S.view === x[0]) + '">' + x[1] + '</button>';
      }).join('')) + '</nav>' +
      '<div class="es-r"><span class="es-av" title="' + (cur ? esc(cur.name) : '') + '">' + av + '</span><button class="es-x" data-a="close" aria-label="Tutup">×</button></div></header>' +
      '<div class="es-main">' + (S.world ? worldHTML() : viewHTML()) + '</div>');
    var m = frame.querySelector('.es-main'); if (m && top) m.scrollTop = top;
    window.__morphReveal(frame);
    var h = frame.querySelector('.es-hero'); if (h) bindHero(h);
  }
  function viewHTML() {
    if (S.view === 'orgs') return orgsHTML();
    var b = ({ meet: function () { return meetHTML(null); }, bud: function () { return budHTML(null); }, docs: function () { return docsHTML(null); } })[S.view]();
    return '<div class="es-page"><h2 class="es-h2">' + ({ meet: 'Rapat', bud: 'Anggaran', docs: 'Dokumen' })[S.view] + '</h2>' + b + '</div>';
  }

  /* ---------- beranda: hero + grid ---------- */
  function orgsHTML() {
    var L = filtered(), i = Math.min(S.idx, Math.max(0, L.length - 1)), o = L[i];
    var grid = '<div class="es-grid">' + L.map(function (x, k) {
      var c = brandOf(x, D.org.indexOf(x)), isNew = x === D.org[D.org.length - 1] && D.org.length > 1;
      return '<button class="es-card' + (k === i ? ' sel' : '') + '" data-a="pick" data-i="' + k + '" style="--c:' + c + ';--ci:' + ink(c) + '" aria-pressed="' + (k === i) + '"><span class="es-thumb">' + art(x, D.org.indexOf(x)) + '</span><span class="es-cap">' + esc(x.name) + '</span>' + (isNew ? '<em>BARU</em>' : '') + '</button>';
    }).join('') + '<button class="es-card add" data-a="oadd"><span class="es-thumb"><i>+</i><span class="es-cap">Tambah organisasi</span></span></button></div>';
    if (!o) return '<div class="es-hero empty"><div class="es-txt"><h1>' + (D.org.length ? 'Tidak ada hasil' : 'Belum ada organisasi') + '</h1><p class="es-desc">' + (D.org.length ? 'Coba kata kunci lain.' : 'Tambahkan organisasi pertama kamu untuk mulai mencatat rapat, anggaran, dan dokumen.') + '</p></div></div>' + grid;
    var c = brandOf(o, D.org.indexOf(o)), b = bsum(o.id), ed = edgeOf(o, D.org.indexOf(o));
    return '<div class="es-hero" style="--c:' + c + ';--ci:' + ink(c) + ';--edge:' + ed + '"><div class="es-art">' + art(o, D.org.indexOf(o)) + '</div>' +
      '<div class="es-txt"><h1>' + esc(o.name) + '</h1>' +
      '<div class="es-meta">' + I.cal + '<span>' + esc(o.period ? 'Periode ' + o.period : 'Periode belum diisi') + '</span></div>' +
      '<div class="es-meta">' + I.role + '<span>' + esc(o.role ? 'Jabatan: ' + o.role : 'Jabatan belum diisi') + '</span></div>' +
      '<div class="es-meta">' + I.ppl + '<span>' + cnt(o.id, 'meeting') + ' rapat · ' + cnt(o.id, 'odoc') + ' dokumen' + (b.P ? ' · sisa ' + rp(b.P - b.A) : '') + '</span></div>' +
      (o.desc ? '<p class="es-desc">' + esc(o.desc) + '</p>' : '') +
      '<div class="es-btns"><button class="es-buy" data-a="open" data-id="' + o.id + '">' + I.open + '<span>Buka</span></button><button class="es-ghost" data-a="oedit" data-id="' + o.id + '">✎ Edit kartu</button><button class="es-ghost dng" data-a="odel" data-id="' + o.id + '">Hapus</button></div></div>' +
      (L.length > 1 ? '<div class="es-dots" role="tablist" aria-label="Pilih organisasi">' + L.map(function (x, k) { return '<button data-a="pick" data-i="' + k + '" aria-selected="' + (k === i) + '" aria-label="' + esc(x.name) + '"></button>'; }).join('') + '</div>' : '') + '</div>' + grid;
  }
  function pick(i) { var n = filtered().length; if (!n) return; S.idx = ((i % n) + n) % n; render(); }
  function bindHero(h) {
    if (h.__bound) return; h.__bound = 1;
    h.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; drag = { x: e.clientX, id: e.pointerId }; });
    h.addEventListener('pointerup', function (e) { if (!drag) return; var dx = e.clientX - drag.x; drag = null; if (Math.abs(dx) > 60) { dragged = true; setTimeout(function () { dragged = false; }, 0); pick(S.idx + (dx < 0 ? 1 : -1)); } });
    h.addEventListener('pointercancel', function () { drag = null; });
  }

  /* ---------- Rapat ---------- */
  function meetHTML(orgId) {
    var L = D.meeting.filter(function (m) { return !orgId || m.orgId === orgId; }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var h = '<div class="es-bar"><p class="es-hint">Agenda, catatan, keputusan, dan tindak lanjut beserta penanggung jawabnya.</p><button class="es-buy sm" data-a="add" data-e="meeting"' + (orgId ? ' data-pk="orgId" data-pv="' + orgId + '"' : '') + '>+ Rapat</button></div>';
    if (!L.length) return h + '<p class="es-empty">Belum ada rapat.</p>';
    return h + L.map(function (m) {
      var fs = D.followup.filter(function (f) { return f.meetingId === m.id; }), c = oc(by(D.org, m.orgId) || {}, D.org.indexOf(by(D.org, m.orgId)));
      return '<article class="es-box" style="--c:' + c + '"><div class="es-row"><div><h3>' + esc(m.title) + '</h3><small>' + esc(on(m.orgId)) + ' · ' + fd(m.date) + '</small></div>' + btns('meeting', m.id) + '</div>' +
        (m.agenda ? '<div class="es-notes"><b>Agenda</b>\n' + esc(m.agenda) + '</div>' : '') + (m.notes ? '<div class="es-notes"><b>Catatan</b>\n' + esc(m.notes) + '</div>' : '') + (m.decisions ? '<div class="es-notes"><b>Keputusan</b>\n' + esc(m.decisions) + '</div>' : '') +
        fs.map(function (f) {
          return '<div class="es-item' + (f.status === 'Selesai' ? ' done' : '') + '"><input type="checkbox" data-chg="tgf" data-id="' + f.id + '"' + (f.status === 'Selesai' ? ' checked' : '') + ' aria-label="Selesai"><div class="es-ib"><button class="es-t" data-a="edit" data-e="followup" data-id="' + f.id + '">' + esc(f.task) + '</button><small>PJ: ' + esc(f.pic || '—') + ' · Tenggat: ' + fd(f.due) + ' · ' + esc(f.status) + '</small></div><button class="es-mini dng" data-a="del" data-e="followup" data-id="' + f.id + '" aria-label="Hapus">×</button></div>';
        }).join('') + '<button class="es-mini" data-a="add" data-e="followup" data-pk="meetingId" data-pv="' + m.id + '">+ Tindak lanjut</button></article>';
    }).join('');
  }
  function btns(e, id) { return '<div class="es-acts"><button class="es-mini" data-a="edit" data-e="' + e + '" data-id="' + id + '">Edit</button><button class="es-mini dng" data-a="del" data-e="' + e + '" data-id="' + id + '">Hapus</button></div>'; }

  /* ---------- Anggaran ---------- */
  function budHTML(orgId) {
    var h = '<div class="es-bar"><p class="es-hint">Selisih = rencana − aktual. Anggaran organisasi tidak tercampur dengan keuangan pribadi.</p><button class="es-buy sm" data-a="add" data-e="budget"' + (orgId ? ' data-pk="orgId" data-pv="' + orgId + '"' : '') + '>+ Pos anggaran</button></div>';
    var os = D.org.filter(function (o) { return (!orgId || o.id === orgId) && D.budget.some(function (b) { return b.orgId === o.id; }); });
    if (!os.length) return h + '<p class="es-empty">Belum ada pos anggaran.</p>';
    var diff = function (x) { return '<b class="' + (x < 0 ? 'neg' : '') + '">' + (x < 0 ? '−' : '') + rp(Math.abs(x)) + '</b>'; };
    return h + os.map(function (o) {
      var bs = D.budget.filter(function (b) { return b.orgId === o.id; }), t = bsum(o.id);
      return '<article class="es-box" style="--c:' + oc(o) + '"><h3>' + esc(o.name) + '</h3><div class="es-stats"><div><span>Rencana</span><b>' + rp(t.P) + '</b></div><div><span>Aktual</span><b>' + rp(t.A) + '</b></div><div><span>Selisih' + (t.P - t.A < 0 ? ' (melebihi)' : ' (sisa)') + '</span>' + diff(t.P - t.A) + '</div></div>' +
        '<div class="es-tblwrap"><table class="es-tbl"><tr><th>Pos</th><th>Rencana</th><th>Aktual</th><th>Selisih</th><th>Bukti</th></tr>' + bs.map(function (b) { return '<tr class="click" data-a="edit" data-e="budget" data-id="' + b.id + '"><td>' + esc(b.item) + '</td><td>' + rp(b.planned) + '</td><td>' + rp(b.actual) + '</td><td>' + diff((+b.planned || 0) - (+b.actual || 0)) + '</td><td>' + esc(b.proof || '') + (b.link ? ' ' + K.link(b.link) : '') + '</td></tr>'; }).join('') + '</table></div></article>';
    }).join('');
  }

  /* ---------- Dokumen ---------- */
  function docsHTML(orgId) {
    var L = D.odoc.filter(function (d) { return (!orgId || d.orgId === orgId) && (S.od === 'Semua' || d.type === S.od); });
    var h = '<div class="es-bar"><div class="es-chips">' + ['Semua'].concat(OD).map(function (x) { return '<button data-a="filt" data-v="' + x + '" aria-pressed="' + (S.od === x) + '">' + x + '</button>'; }).join('') + '</div><button class="es-buy sm" data-a="add" data-e="odoc"' + (orgId ? ' data-pk="orgId" data-pv="' + orgId + '"' : '') + '>+ Dokumen</button></div>';
    if (!L.length) return h + '<p class="es-empty">Belum ada dokumen.</p>';
    return h + L.map(function (d) {
      return '<div class="es-item"><div class="es-ib"><b>' + esc(d.title) + '</b><em class="es-tag">' + esc(d.type) + '</em><small>' + esc(on(d.orgId)) + ' · ' + fd(d.date) + (d.link ? ' · ' + K.link(d.link) : '') + '</small>' + (d.notes ? '<small>' + esc(d.notes) + '</small>' : '') + '</div>' + btns('odoc', d.id) + '</div>';
    }).join('');
  }

  /* ---------- dunia organisasi ---------- */
  function worldHTML() {
    var o = by(D.org, S.world); if (!o) { S.world = null; return viewHTML(); }
    var i = D.org.indexOf(o), c = oc(o, i), b = bsum(o.id);
    var body = ({ meet: function () { return meetHTML(o.id); }, bud: function () { return budHTML(o.id); }, docs: function () { return docsHTML(o.id); }, info: function () { return infoHTML(o); } })[S.wtab]();
    return '<div class="es-world" style="--c:' + c + '"><div class="es-hero sm"><div class="es-art">' + art(o, i) + '</div><div class="es-txt"><h1>' + esc(o.name) + '</h1>' +
      '<div class="es-meta">' + I.cal + '<span>' + esc(o.period ? 'Periode ' + o.period : 'Periode belum diisi') + '</span></div><div class="es-meta">' + I.role + '<span>' + esc(o.role ? 'Jabatan: ' + o.role : 'Jabatan belum diisi') + '</span></div>' +
      '<div class="es-btns"><button class="es-buy" data-a="oedit" data-id="' + o.id + '">✎ Edit kartu</button><button class="es-ghost" data-a="ofull" data-id="' + o.id + '">Detail lengkap</button></div></div></div>' +
      '<div class="es-stats top"><div><span>Rapat</span><b>' + cnt(o.id, 'meeting') + '</b></div><div><span>Dokumen</span><b>' + cnt(o.id, 'odoc') + '</b></div><div><span>Rencana anggaran</span><b>' + rp(b.P) + '</b></div><div><span>Sisa anggaran</span><b' + (b.P - b.A < 0 ? ' class="neg"' : '') + '>' + (b.P - b.A < 0 ? '−' : '') + rp(Math.abs(b.P - b.A)) + '</b></div></div>' +
      '<nav class="es-tabs">' + WT.map(function (x) { return '<button data-a="wtab" data-v="' + x[0] + '" aria-current="' + (S.wtab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</nav><div class="es-wbody">' + body + '</div></div>';
  }
  function infoHTML(o) {
    return '<div class="es-box"><div class="es-kv"><div><span>Nama</span><b>' + esc(o.name) + '</b></div><div><span>Periode</span><b>' + esc(o.period || '—') + '</b></div><div><span>Jabatan</span><b>' + esc(o.role || '—') + '</b></div></div>' +
      (o.desc ? '<div class="es-notes"><b>Deskripsi</b>\n' + esc(o.desc) + '</div>' : '') + (o.notes ? '<div class="es-notes"><b>Catatan</b>\n' + esc(o.notes) + '</div>' : '') +
      '<div class="es-acts"><button class="es-buy sm" data-a="ofull" data-id="' + o.id + '">Edit detail lengkap</button><button class="es-ghost" data-a="oedit" data-id="' + o.id + '">✎ Edit kartu</button><button class="es-ghost dng" data-a="odel" data-id="' + o.id + '">Hapus organisasi</button></div></div>';
  }

  /* ---------- editor kartu ---------- */
  function openOrgModal(id) {
    var ed = id ? by(D.org, id) : null, idx = ed ? D.org.indexOf(ed) : D.org.length;
    var m = { color: ed ? oc(ed, idx) : PALETTE[idx % PALETTE.length], img: ed ? ed.img || '' : '' };
    var w = document.createElement('div'); w.className = 'es-ov2';
    w.innerHTML = '<form class="es-modal" novalidate><header><h2>' + (ed ? 'Edit Kartu' : 'Organisasi Baru') + '</h2><button type="button" class="es-x" data-x aria-label="Tutup">×</button></header>' +
      '<div class="es-mbody"><div class="es-prev"><span class="es-card sel" data-pv style="--c:' + m.color + '"></span></div><div class="es-fields">' +
      '<label class="full"><span>Nama organisasi *</span><input name="name" type="text" value="' + esc(ed ? ed.name : '') + '" required maxlength="80"></label>' +
      '<label><span>Periode kepengurusan</span><input name="period" type="text" placeholder="2025–2026" value="' + esc(ed ? ed.period || '' : '') + '"></label>' +
      '<label><span>Jabatan saya</span><input name="role" type="text" value="' + esc(ed ? ed.role || '' : '') + '"></label>' +
      '<div class="full"><span class="lb">Warna cadangan (dipakai jika tanpa gambar)</span><div class="es-sw">' + PALETTE.map(function (c) { return '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="Warna ' + c + '"></button>'; }).join('') + '<label class="es-cp" title="Warna sendiri"><input type="color" name="color" value="' + m.color + '"></label></div></div>' +
      '<div class="full"><span class="lb">Gambar kartu</span><div class="es-upl"><label class="es-ghost">Pilih gambar…<input type="file" accept="image/*" hidden name="file"></label><button type="button" class="es-ghost" data-noimg>Hapus gambar</button></div><small class="es-hint">Ukuran ideal 1280 × 720 px (rasio 16:9, landscape). Warna kartu otomatis diambil dari logo.</small><small class=\"es-hint\" data-fit></small></div>' +
      '</div></div><footer><button type="button" class="es-ghost" data-x>Batal</button>' + (ed ? '' : '<button type="button" class="es-ghost" data-more>Simpan & isi detail</button>') + '<button class="es-buy sm">Simpan</button></footer></form>';
    document.body.appendChild(w);
    var f = w.querySelector('form'), more = false;
    function sync() {
      var pv = w.querySelector('[data-pv]');
      var paintPv = function (c) { pv.style.setProperty('--c', c); pv.style.setProperty('--ci', ink(c)); };
      paintPv(m.img ? brandOf({ img: m.img }, idx, function (c) { paintPv(c || m.color); }) : m.color);
      pv.innerHTML = '<span class="es-thumb">' + (m.img ? fit(m.img) : scene(idx)) + '</span><span class="es-cap">' + esc(f.elements.name.value || 'Nama organisasi') + '</span>';
      [].forEach.call(w.querySelectorAll('.es-sw button'), function (b) { b.classList.toggle('on', b.dataset.c === m.color); });
    }
    sync();
    f.addEventListener('input', function (e) { if (e.target.name === 'color') m.color = e.target.value; sync(); });
    function fitHint(src) {
      var h = w.querySelector('[data-fit]'); if (!h) return;
      if (!src) { h.textContent = ''; h.className = 'es-hint'; return; }
      var im = new Image();
      im.onload = function () {
        var r = im.width / im.height, ok = Math.abs(r - 16 / 9) < 0.04;
        h.textContent = ok ? 'Rasio pas (16:9). Kartu tampil utuh tanpa terpotong.' : 'Rasio gambar ' + (Math.round(r * 100) / 100) + ':1, sebagian sisi akan terpotong. Pakai 1280 × 720 px agar pas.';
        h.className = 'es-hint ' + (ok ? 'ok' : 'warn');
      };
      im.src = src;
    }
    f.addEventListener('change', function (e) { if (e.target.name === 'file' && e.target.files[0]) shrink(e.target.files[0], function (d) { m.img = d; sync(); fitHint(d); }); });
    w.addEventListener('click', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-x')) w.remove();
      if (t.dataset.c) { m.color = t.dataset.c; f.elements.color.value = m.color; sync(); }
      if (t.hasAttribute('data-noimg')) { m.img = ''; f.elements.file.value = ''; sync(); fitHint(''); }
      if (t.hasAttribute('data-more')) { more = true; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); }
    });
    w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
    w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); w.remove(); } });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var n = f.elements.name.value.trim(); if (!n) { f.elements.name.focus(); return; }
      var rec = ed || { id: uid() };
      rec.name = n; rec.period = f.elements.period.value.trim(); rec.role = f.elements.role.value.trim(); rec.color = m.color; rec.img = m.img;
      if (!ed) { D.org.push(rec); S.q = ''; S.idx = D.org.length - 1; }
      save(); w.remove(); render(); if (more) app.form('org', rec.id);
    });
    f.elements.name.focus();
  }
  function shrink(file, cb) {
    var r = new FileReader();
    r.onload = function () {
      var im = new Image();
      im.onload = function () {
        var M = 1280, k = Math.min(1, M / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        var d = cv.toDataURL('image/webp', 0.82); if (d.indexOf('data:image/webp') !== 0) d = cv.toDataURL('image/jpeg', 0.82);
        cb(d);
      };
      im.onerror = function () { MO.msg('Gambar gagal dibaca', 'Coba file gambar lain.'); };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ---------- event ---------- */
  function onClick(e) {
    var t = e.target.closest('[data-a]'); if (!t || !ov.contains(t) || dragged) return;
    var a = t.dataset.a, d = t.dataset;
    if (a === 'close') return close();
    if (a === 'back') { S.world = null; return render(); }
    if (a === 'nav') { S.view = d.v; S.world = null; return render(); }
    if (a === 'pick') return pick(+d.i);
    if (a === 'oadd') return openOrgModal();
    if (a === 'oedit') return openOrgModal(d.id);
    if (a === 'ofull') return app.form('org', d.id);
    if (a === 'open') { S.world = d.id; S.wtab = 'meet'; render(); var m = frame.querySelector('.es-main'); if (m) m.scrollTop = 0; return; }
    if (a === 'odel') { app.del('org', d.id); if (!by(D.org, d.id)) { S.world = null; S.idx = 0; render(); } return; }
    if (a === 'wtab') { S.wtab = d.v; return render(); }
    if (a === 'filt') { S.od = d.v; return render(); }
    if (a === 'add') {
      if (['meeting', 'budget', 'odoc'].indexOf(d.e) > -1 && guardOrg()) return;
      if (d.e === 'followup' && !D.meeting.length) return MO.msg('Belum ada rapat', 'Tambahkan rapat terlebih dahulu.');
      var pre = {}; if (d.pk) pre[d.pk] = d.pv; return app.form(d.e, null, pre);
    }
    if (a === 'edit') return app.form(d.e, d.id);
    if (a === 'del') return app.del(d.e, d.id);
  }
  function onChange(e) {
    var t = e.target; if (t.dataset && t.dataset.chg === 'tgf') { var f = by(D.followup, t.dataset.id); if (f) { f.status = t.checked ? 'Selesai' : 'Belum'; save(); render(); } }
  }
  function onInput(e) {
    var t = e.target; if (!t.dataset || t.dataset.in !== 'q') return;
    S.q = t.value; S.idx = 0; S.view = 'orgs'; var p = t.selectionStart; render();
    var n = frame.querySelector('[data-in="q"]'); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (x) { } }
  }

  MO.routes['#organization'] = open;
})();
;
/* MyOffice — Task v3: To Do list, acara, dan proyek.
   Subtugas dibuat bersama tugas dan langsung muncul. Tugas bertanggal otomatis tampil di kalender Task dan kalender umum.
   Data tetap di localStorage 'mo-task-v1'. */
(function () {
  'use strict';
  var MO = window.MyOffice, K = MO.kit, esc = K.esc, fd = K.fd, todayS = K.todayS, by = K.by, empty = K.empty;
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var addDays = K.addDays = function (s, n) { var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var dd = K.dd = function (a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 864e5); };

  /* ---------- label, ikon, warna (sumber tunggal) ---------- */
  var PRIS = ['Urgent', 'High', 'Medium', 'Low'];
  var PMETA = {
    Urgent: { l: 'Urgent', ico: '🔥', c: 'urgent' },
    High: { l: 'Tinggi', ico: '❗', c: 'high' },
    Medium: { l: 'Sedang', ico: '🌱', c: 'medium' },
    Low: { l: 'Santai', ico: '☕', c: 'low' }
  };
  var PCAL = { Urgent: '#ff7a6b', High: '#f0b000', Medium: '#3d9be9', Low: '#a0673f' };
  var KIND = { todo: { l: 'To Do list', ico: '📝' }, event: { l: 'Acara', ico: '📅' }, project: { l: 'Proyek', ico: '🗂️' } };
  var STS = [['To Do', 'Belum'], ['In Progress', 'Sedang'], ['Done', 'Selesai']];
  var STL = { 'To Do': 'Belum dikerjakan', 'In Progress': 'Sedang dikerjakan', Done: 'Selesai' };

  function nst(t) { var s = t.status; if (s === 'Done') return 'Done'; if (s === 'In Progress' || s === 'Waiting') return 'In Progress'; return 'To Do'; }
  var live = function (t) { return t.status !== 'Done' && t.status !== 'Archived'; };
  var kindOf = function (t) { return t.kind || 'todo'; };
  function mk(o) {
    return Object.assign({ id: K.uid(), kind: 'todo', title: '', status: 'To Do', priority: 'Medium', due: '', dueTime: '', endTime: '', category: '', desc: '', pin: false, doneAt: '', parentId: '', remindAt: '', goalRef: '', projId: '' }, o);
  }
  function dueInfo(t) {
    if (!t.due) return null;
    var tm = t.dueTime ? ' · ' + t.dueTime : '';
    if (!live(t)) return { text: fd(t.due) + tm, c: '#8b93ad' };
    var d = dd(todayS(), t.due);
    if (d < 0) return { text: 'Terlambat ' + (-d) + ' hari', c: '#e5484d' };
    if (d === 0) return { text: 'Hari ini' + tm, c: '#c98a00' };
    if (d === 1) return { text: 'Besok' + tm, c: '#3b7de8' };
    return { text: fd(t.due) + tm, c: '#8b93ad' };
  }
  var sortTasks = function (L) {
    return L.slice().sort(function (a, b) { return (a.due || '9').localeCompare(b.due || '9') || (PRIS.indexOf(a.priority) - PRIS.indexOf(b.priority)); });
  };

  /* Event acara ke kalender umum (tugas biasa tetap lewat jalur tugas). */
  K.taskEvents = function () {
    return (ls('mo-task-v1').task || []).filter(function (t) { return t.due && t.kind === 'event' && !t.parentId && t.status !== 'Archived'; }).map(function (t) {
      return { id: 'tk-' + t.id, tk: 1, title: (t.status === 'Done' ? '✓ ' : '📅 ') + t.title, start: t.due, end: t.due, startTime: t.dueTime || '', endTime: t.endTime || '', allDay: !t.dueTime, kind: 'biasa', catId: 'c1', remind: '', location: '', desc: '' };
    });
  };

  var tasks = K.App('Task', 'mo-task-v1', function () { return { task: [], sub: [], cats: ['Belajar', 'Kerja', 'Rapat', 'Administrasi', 'Kesehatan', 'Rumah', 'Lainnya'] }; }, function (app) {
    var D = app.D, st = app.st;
    if (!D.cats) D.cats = ['Lainnya'];
    if (!D.sub) D.sub = [];
    D.task.forEach(function (t) { if (!t.kind) t.kind = 'todo'; });
    st.md = st.md || 'Daftar';

    var children = function (pid) { return D.task.filter(function (t) { return t.parentId === pid; }); };
    var top = function () { return D.task.filter(function (t) { return !t.parentId && t.status !== 'Archived'; }); };
    var prog = function (p) { var k = children(p.id); return k.length ? k.filter(function (x) { return nst(x) === 'Done'; }).length / k.length * 100 : (nst(p) === 'Done' ? 100 : 0); };
    var subsOf = function (id) { return D.sub.filter(function (s) { return s.taskId === id; }); };
    var setStatus = function (x, s) { x.status = s; x.doneAt = s === 'Done' ? (x.doneAt || todayS()) : ''; };
    var syncParent = function (x) {
      if (!x.parentId) return;
      var p = by(D.task, x.parentId); if (!p) return;
      var k = children(p.id), all = k.length && k.every(function (c) { return nst(c) === 'Done'; }), any = k.some(function (c) { return nst(c) !== 'To Do'; });
      setStatus(p, all ? 'Done' : (any ? 'In Progress' : 'To Do'));
    };
    var removeTask = function (id) {
      children(id).forEach(function (c) { removeTask(c.id); });
      D.sub = D.sub.filter(function (s) { return s.taskId !== id; });
      D.task = D.task.filter(function (t) { return t.id !== id; });
    };
    var blankDraft = function () { return { kind: 'todo', title: '', due: '', dueTime: '', endTime: '', priority: 'Medium', category: '', subs: [] }; };

    var specs = { task: { title: 'Tugas', def: {}, fields: [{ k: 'title', l: 'Judul', t: 'text', req: 1, full: 1 }] } };

    /* ---------- pembantu tampilan ---------- */
    function bar(title) { return '<div class="tk3-vh"><button class="tk3-back" data-act="nav" data-v="">‹ Kembali</button><b>' + esc(title) + '</b></div>'; }
    function addForm(f, act, id, ph) {
      return '<form class="tk3-addf" data-f="' + f + '" onsubmit="return false"><input name="v" maxlength="120" autocomplete="off" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '"><button type="submit" data-act="' + act + '" data-id="' + id + '">+</button></form>';
    }
    function statSeg(t) {
      var s = nst(t);
      return '<div class="tk3-stat" role="group">' + STS.map(function (x) {
        return '<button aria-pressed="' + (s === x[0]) + '" class="s-' + x[0].replace(' ', '') + '" data-act="tst" data-id="' + t.id + '" data-s="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>';
    }
    function bubble(t) {
      var k = kindOf(t);
      return '<span class="tk3-ico" aria-hidden="true">' + (k === 'project' ? KIND.project.ico : (PMETA[t.priority] || PMETA.Medium).ico) + '</span>';
    }
    function note(t) {
      var k = kindOf(t), pm = PMETA[t.priority] || PMETA.Medium, done = nst(t) === 'Done', di = dueInfo(t);
      var subs = subsOf(t.id), sd = subs.filter(function (s) { return s.done; }).length, kids = k === 'project' ? children(t.id) : [];
      var h = '<article class="tk3-note p-' + pm.c + (done ? ' is-done' : '') + '">' + bubble(t) +
        '<div class="tk3-row">' +
        (k === 'project' ? '<button class="tk3-tt" data-act="nav" data-v="proj" data-id="' + t.id + '">' + esc(t.title) + '</button>'
          : '<input type="checkbox" class="tk3-chk" data-act="tgd" data-id="' + t.id + '"' + (done ? ' checked' : '') + ' aria-label="Tandai selesai">' +
            '<button class="tk3-tt" data-act="nav" data-v="detail" data-id="' + t.id + '">' + esc(t.title) + '</button>') +
        '</div><div class="tk3-meta"><span class="tk3-pl">' + pm.l + '</span><span class="tk3-kd">' + KIND[k].l + '</span>' +
        (di ? '<span class="tk3-due" style="--c:' + di.c + '">' + esc(di.text) + '</span>' : '') +
        (subs.length ? '<span class="tk3-kd">' + sd + '/' + subs.length + ' subtugas</span>' : '') +
        (kids.length ? '<span class="tk3-kd">' + kids.filter(function (x) { return nst(x) === 'Done'; }).length + '/' + kids.length + ' tugas</span>' : '') + '</div>';
      if (done) h += '<button class="tk3-ib tk3-trash" data-act="rmtask" data-id="' + t.id + '" aria-label="Hapus">🗑️</button>';
      if (k === 'project') h += '<div class="tk3-bar"><i style="width:' + Math.round(prog(t)) + '%"></i></div>';
      else if (subs.length) h += '<div class="tk3-bar"><i style="width:' + Math.round(sd / subs.length * 100) + '%"></i></div>';
      return h + '</article>';
    }
    function list(L, msg) { return L.length ? L.map(note).join('') : empty(msg || 'Belum ada di sini.'); }
    function tile(label, n, cls) { return '<div class="tk3-tile ' + cls + '"><small>' + label + '</small><b data-cnt="' + n + '" data-lab="' + label + '">' + n + '</b></div>'; }

    /* ---------- Hari ini ---------- */
    function home() {
      var T = todayS(), A = top().filter(function (t) { return live(t) && kindOf(t) !== 'project'; }), seen = {};
      var take = function (x) { return x.filter(function (t) { if (seen[t.id]) return false; seen[t.id] = 1; return true; }); };
      var late = take(sortTasks(A.filter(function (t) { return t.due && t.due < T; })));
      var focus = take(sortTasks(A.filter(function (t) { return t.due === T || t.pin || nst(t) === 'In Progress'; })));
      var soon = take(sortTasks(A.filter(function (t) { return t.due && t.due > T && dd(T, t.due) <= 14; })));
      var none = take(sortTasks(A.filter(function (t) { return !t.due; })));
      var projs = top().filter(function (t) { return kindOf(t) === 'project' && nst(t) !== 'Done'; });
      var n = { todo: A.filter(function (t) { return nst(t) === 'To Do'; }).length, prog: A.filter(function (t) { return nst(t) === 'In Progress'; }).length, late: late.length, done: D.task.filter(function (t) { return nst(t) === 'Done'; }).length };
      var set = ls('mo-settings-v1'), photo = set.photo ? ' style="background-image:url(&quot;' + esc(set.photo) + '&quot;)"' : '';
      var grp = function (title, L, cls) { return L.length ? '<section class="tk3-grp ' + cls + '"><h4>' + title + ' <span>' + L.length + '</span></h4>' + list(L) + '</section>' : ''; };
      return '<section class="tk3-hero"><span class="tk3-conf" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
        '<div class="tk3-hero-t"><p class="tk3-hi">Halo' + (set.nick ? ', <b>' + esc(set.nick) + '</b>' : '') + '!</p><h3>Rencanakan hari ini dengan tenang</h3>' +
        '<small>' + fd(T) + '</small><div><button class="tk3-cta" data-act="nav" data-v="new">Tambah baru +</button></div></div>' +
        '<button class="tk3-av" data-act="photo" aria-label="Ganti foto profil"><span' + photo + '></span><small>Ganti</small></button></section>' +
        '<div class="tk3-tiles">' + tile('Belum', n.todo, 't-lav') + tile('Sedang', n.prog, 't-yel') + tile('Terlambat', n.late, 't-pink') + tile('Selesai', n.done, 't-grn') + '</div>' +
        '<form class="tk3-quick" data-f="qt" onsubmit="return false"><input name="qt" maxlength="120" autocomplete="off" placeholder="Tulis tugas cepat, lalu Enter" aria-label="Tugas cepat"><button type="submit" data-act="quick" data-due="today">Simpan</button></form>' +
        (projs.length ? '<section class="tk3-grp k-proj"><h4>Proyek aktif <span>' + projs.length + '</span></h4>' + list(projs) + '</section>' : '') +
        grp('Terlambat', late, 'g-late') + grp('Fokus hari ini', focus, 'g-focus') + grp('14 hari ke depan', soon, 'g-soon') + grp('Tanpa tenggat', none, 'g-none') +
        (!late.length && !focus.length && !soon.length && !none.length && !projs.length ? empty('Belum ada tugas. Tulis di kolom di atas atau tekan Tambah baru.') : '');
    }

    /* ---------- Semua: daftar & kalender ---------- */
    function filtered() {
      var q = (st.q || '').toLowerCase().trim();
      return top().filter(function (t) {
        if (st.fk && kindOf(t) !== st.fk) return false;
        if (st.fp && t.priority !== st.fp) return false;
        if (q && (t.title + ' ' + (t.desc || '')).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
    }
    function all() {
      var md = st.md || 'Daftar', fk = st.fk || '', fp = st.fp || '';
      var chip = function (f, items, cur) { return items.map(function (x) { return '<button class="tk3-f" aria-pressed="' + (x[0] === cur) + '" data-act="filt" data-f="' + f + '" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join(''); };
      var head = '<form class="tk3-search" onsubmit="return false"><input type="search" data-in="q" value="' + esc(st.q || '') + '" placeholder="Cari…" aria-label="Cari"></form>' +
        '<div class="tk3-tabs2">' + ['Daftar', 'Kalender'].map(function (m) { return '<button aria-pressed="' + (m === md) + '" data-act="filt" data-f="md" data-v="' + m + '">' + m + '</button>'; }).join('') + '</div>' +
        '<div class="tk3-fr">' + chip('fk', [['', 'Semua'], ['todo', 'To Do'], ['event', 'Acara'], ['project', 'Proyek']], fk) + '</div>' +
        '<div class="tk3-fr">' + chip('fp', [['', 'Semua warna']].concat(PRIS.map(function (p) { return [p, PMETA[p].l]; })), fp) + '</div>' +
        '<button class="tk3-cta sm" data-act="nav" data-v="new">+ Tambah baru</button>';
      if (md === 'Kalender') return head + calView();
      var L = sortTasks(filtered());
      return head + '<p class="tk3-hint">' + L.length + ' item</p>' + list(L);
    }
    function calView() {
      var T = todayS(), key = st.tm || T.slice(0, 7), y = +key.slice(0, 4), m = +key.slice(5), sd = st.sd || T;
      var wk = (ls('mo-cal-v1').set || {}).wk; wk = wk == null ? 1 : +wk;
      var first = new Date(y, m - 1, 1), lead = (first.getDay() - wk + 7) % 7, n = new Date(y, m, 0).getDate();
      var names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      var h = '<div class="tk3-cn"><button data-act="tnav" data-d="-1" aria-label="Bulan sebelumnya">‹</button><b>' + first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) + '</b><button data-act="tnav" data-d="1" aria-label="Bulan berikutnya">›</button><button class="tk3-today" data-act="tnav" data-d="0">Hari ini</button></div><div class="tk3-grid">';
      for (var i = 0; i < 7; i++) h += '<span class="tk3-wd">' + names[(wk + i) % 7] + '</span>';
      for (i = 0; i < lead; i++) h += '<span></span>';
      for (var d = 1; d <= n; d++) {
        var ds = key + '-' + pad(d), x = top().filter(function (t) { return t.due === ds; });
        h += '<button class="tk3-day' + (ds === T ? ' td' : '') + (ds === sd ? ' sel' : '') + '" data-act="tday" data-d="' + ds + '">' + d +
          (x.length ? '<span class="tk3-dots">' + x.slice(0, 3).map(function (t) { return '<i style="background:' + (PCAL[t.priority] || '#8b93ad') + '"></i>'; }).join('') + '</span>' : '') + '</button>';
      }
      var on = top().filter(function (t) { return t.due === sd; });
      return h + '</div><div class="tk3-dayh"><b>' + fd(sd) + '</b><button class="tk3-cta sm" data-act="nav" data-v="new" data-due="' + sd + '">+ Di tanggal ini</button></div>' + list(sortTasks(on), 'Tidak ada tugas di tanggal ini.');
    }

    /* ---------- Riwayat ---------- */
    function hist() {
      var L = D.task.filter(function (t) { return nst(t) === 'Done' && t.status !== 'Archived'; }).sort(function (a, b) { return (b.doneAt || '').localeCompare(a.doneAt || ''); });
      var T = todayS(), wk = L.filter(function (t) { return t.doneAt && dd(t.doneAt, T) <= 6 && dd(t.doneAt, T) >= 0; }).length;
      var groups = {}, order = [];
      L.forEach(function (t) { var k = t.doneAt || 'Tanpa tanggal'; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(t); });
      return '<div class="tk3-tiles two">' + tile('Selesai', L.length, 't-grn') + tile('7 hari terakhir', wk, 't-lav') + '</div>' +
        (order.length ? order.map(function (k) {
          return '<section class="tk3-grp g-hist"><h4>' + (k === 'Tanpa tanggal' ? k : fd(k)) + ' <span>' + groups[k].length + '</span></h4>' +
            groups[k].map(function (t) {
              var par = t.parentId ? by(D.task, t.parentId) : null;
              return '<div class="tk3-hist"><input type="checkbox" class="tk3-chk" checked data-act="tgd" data-id="' + t.id + '" aria-label="Kembalikan ke daftar"><div><span class="tk3-htt">' + esc(t.title) + '</span><small>' + KIND[kindOf(t)].l + (par ? ' · dari ' + esc(par.title) : '') + ' · ketuk kotak untuk mengembalikan</small></div><button class="tk3-ib tk3-trash" data-act="rmtask" data-id="' + t.id + '" aria-label="Hapus">🗑️</button></div>';
            }).join('') + '</section>';
        }).join('') : empty('Belum ada yang selesai. Tugas yang selesai akan muncul di sini.'));
    }

    /* ---------- tampilan penuh: tambah baru, detail, proyek ---------- */
    function vNew() {
      var dr = st.draft || (st.draft = blankDraft());
      var isEv = dr.kind === 'event', isPr = dr.kind === 'project';
      var kinds = ['todo', 'event', 'project'].map(function (k) {
        return '<button class="tk3-kind' + (dr.kind === k ? ' on' : '') + '" data-act="dk" data-v="' + k + '"><span>' + KIND[k].ico + '</span>' + KIND[k].l + '</button>';
      }).join('');
      var pris = PRIS.map(function (p) {
        return '<button class="tk3-pri p-' + PMETA[p].c + (dr.priority === p ? ' on' : '') + '" data-act="dpri" data-v="' + p + '"><span>' + PMETA[p].ico + '</span>' + PMETA[p].l + '</button>';
      }).join('');
      var subs = dr.subs.map(function (s, i) { return '<span class="tk3-chipx">' + esc(s) + '<button data-act="dsubdel" data-v="' + i + '" aria-label="Hapus">×</button></span>'; }).join('');
      return bar('Tambah baru') + '<div class="tk3-vw" data-draft>' +
        '<div class="tk3-kinds">' + kinds + '</div>' +
        '<form class="tk3-newf" onsubmit="return false"><input class="tk3-big" name="dt" value="' + esc(dr.title) + '" maxlength="120" placeholder="' + (isPr ? 'Nama proyek…' : isEv ? 'Nama acara…' : 'Apa yang mau dikerjakan?') + '">' +
        '<div class="tk3-row2"><label>Tanggal' + (isEv ? '' : ' (opsional)') + '<input type="date" name="dd" value="' + esc(dr.due) + '"></label>' +
        (isEv ? '<label>Mulai<input type="time" name="dtm" value="' + esc(dr.dueTime) + '"></label><label>Selesai<input type="time" name="dend" value="' + esc(dr.endTime) + '"></label>' : (isPr ? '' : '<label>Jam<input type="time" name="dtm" value="' + esc(dr.dueTime) + '"></label>')) + '</div>' +
        '<p class="tk3-lbl">Warna & tingkat</p><div class="tk3-pris">' + pris + '</div>' +
        '<label class="tk3-sm">Kategori<select name="dcat"><option value="">—</option>' + D.cats.map(function (c) { return '<option value="' + esc(c) + '"' + (c === dr.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<button type="submit" class="tk3-cta save" data-act="savenew">Simpan</button></form>' +
        '<p class="tk3-lbl">' + (isPr ? 'Tugas di dalam proyek' : 'Subtugas') + ' <small>langsung tersimpan bersama item ini</small></p>' +
        '<div class="tk3-chipsx">' + (subs || '<span class="tk3-none">Belum ada</span>') + '</div>' +
        addForm('ds', 'dsub', '', isPr ? 'Tambah tugas, lalu Enter' : 'Tambah subtugas, lalu Enter') + '</div>';
    }
    function vDetail() {
      var t = by(D.task, st.tid); if (!t) { st.view = ''; return home(); }
      var k = kindOf(t), pm = PMETA[t.priority] || PMETA.Medium, subs = subsOf(t.id);
      return bar(KIND[k].l) + '<div class="tk3-vw">' +
        '<section class="tk3-big-n p-' + pm.c + '"><span class="tk3-ico big">' + pm.ico + '</span><h2>' + esc(t.title) + '</h2><p>' + KIND[k].l + ' · ' + pm.l + '</p></section>' +
        '<p class="tk3-lbl">Status</p>' + statSeg(t) +
        '<div class="tk3-row2"><label>Tanggal<input type="date" value="' + esc(t.due) + '" data-chg="tdue" data-id="' + t.id + '"></label><label>Jam<input type="time" value="' + esc(t.dueTime) + '" data-chg="ttime" data-id="' + t.id + '"></label></div>' +
        '<p class="tk3-lbl">Warna & tingkat</p><div class="tk3-pris">' + PRIS.map(function (p) { return '<button class="tk3-pri p-' + PMETA[p].c + (t.priority === p ? ' on' : '') + '" data-act="tpri" data-id="' + t.id + '" data-v="' + p + '"><span>' + PMETA[p].ico + '</span>' + PMETA[p].l + '</button>'; }).join('') + '</div>' +
        '<p class="tk3-lbl">Subtugas</p>' + (subs.length ? subs.map(function (s) {
          return '<div class="tk3-srow"><input type="checkbox" data-act="tgs" data-id="' + s.id + '"' + (s.done ? ' checked' : '') + '><span class="' + (s.done ? 'is-done' : '') + '">' + esc(s.title) + '</span><button class="tk3-ib" data-act="sdel" data-id="' + s.id + '" aria-label="Hapus">×</button></div>';
        }).join('') : '<p class="tk3-none">Belum ada subtugas.</p>') +
        addForm('sadd', 'sadd', t.id, 'Tambah subtugas, lalu Enter') +
        '<button class="tk3-danger" data-act="rmtask" data-id="' + t.id + '">Hapus ' + KIND[k].l.toLowerCase() + '</button></div>';
    }
    function vProj() {
      var p = by(D.task, st.pid); if (!p) { st.view = ''; return home(); }
      var kids = children(p.id), done = kids.filter(function (x) { return nst(x) === 'Done'; }).length, pct = Math.round(prog(p));
      return bar('Proyek') + '<div class="tk3-vw">' +
        '<section class="tk3-big-n p-medium"><span class="tk3-ico big">🗂️</span><h2>' + esc(p.title) + '</h2><p>' + done + ' dari ' + kids.length + ' tugas selesai · ' + pct + '%</p><div class="tk3-bar big"><i style="width:' + pct + '%"></i></div></section>' +
        '<div class="tk3-row2"><label>Tenggat<input type="date" value="' + esc(p.due) + '" data-chg="tdue" data-id="' + p.id + '"></label></div>' +
        '<p class="tk3-lbl">Tugas di dalam proyek</p>' +
        (kids.length ? kids.map(function (c) {
          return '<div class="tk3-kid' + (nst(c) === 'Done' ? ' is-done' : '') + '"><div class="tk3-kidt"><span>' + esc(c.title) + '</span><button class="tk3-ib tk3-trash" data-act="rmtask" data-id="' + c.id + '" aria-label="Hapus">' + (nst(c) === 'Done' ? '🗑️' : '×') + '</button></div>' + statSeg(c) + '</div>';
        }).join('') : '<p class="tk3-none">Belum ada tugas. Tambahkan di bawah.</p>') +
        addForm('padd', 'padd', p.id, 'Tambah tugas ke proyek, lalu Enter') +
        '<button class="tk3-danger" data-act="rmtask" data-id="' + p.id + '">Hapus proyek</button></div>';
    }
    function views() { return st.view === 'new' ? vNew() : st.view === 'detail' ? vDetail() : st.view === 'proj' ? vProj() : ''; }
    function wrap(fn) { return function () { return st.view ? views() : fn(); }; }

    /* ---------- aksi ---------- */
    function readDraft(root) {
      var dr = st.draft || (st.draft = blankDraft());
      if (!root) return dr;
      var g = function (n) { var e = root.querySelector('[name=' + n + ']'); return e ? e.value : null; }, v;
      if ((v = g('dt')) !== null) dr.title = v;
      if ((v = g('dd')) !== null) dr.due = v;
      if ((v = g('dtm')) !== null) dr.dueTime = v;
      if ((v = g('dend')) !== null) dr.endTime = v;
      if ((v = g('dcat')) !== null) dr.category = v;
      return dr;
    }
    function formValue(t) { var f = t.closest('form'), i = f && f.querySelector('input[name=v]'); return i ? i.value.trim().slice(0, 120) : ''; }

    function actImpl(a, d, t) {
        var x, root = t.closest ? t.closest('.tk3-vw') : null, v, dr;
        if (a === 'nav') {
          st.view = d.v || '';
          if (d.v === 'detail') st.tid = d.id;
          if (d.v === 'proj') st.pid = d.id;
          if (d.v === 'new') { st.draft = blankDraft(); if (d.due) st.draft.due = d.due; }
          return;
        }
        if (a === 'dk') { readDraft(root); st.draft.kind = d.v; return; }
        if (a === 'dpri') { readDraft(root); st.draft.priority = d.v; return; }
        if (a === 'dsub') {
          readDraft(root); v = formValue(t);
          if (v) st.draft.subs.push(v);
          st.focus = 'ds'; return;
        }
        if (a === 'dsubdel') { readDraft(root); st.draft.subs.splice(+d.v, 1); return; }
        if (a === 'savenew') {
          dr = readDraft(root);
          if (!dr.title.trim()) { MO.msg('Judul kosong', 'Tulis nama dulu ya.'); return; }
          var item = mk({ kind: dr.kind, title: dr.title.trim().slice(0, 120), priority: dr.priority, due: dr.due || '', dueTime: dr.dueTime || '', endTime: dr.endTime || '', category: dr.category || '' });
          if (item.kind === 'project') item.status = 'To Do';
          D.task.push(item);
          if (item.kind === 'project') dr.subs.forEach(function (s) { D.task.push(mk({ title: s, kind: 'todo', parentId: item.id })); });
          else dr.subs.forEach(function (s) { D.sub.push({ id: K.uid(), taskId: item.id, title: s, done: false }); });
          st.draft = null; st.view = '';
          return;
        }
        if (a === 'quick') {
          v = (root || t.closest('form')).querySelector('input[name=qt]'); var q = v ? v.value.trim() : '';
          if (!q) { if (v) v.focus(); return; }
          D.task.push(mk({ title: q.slice(0, 120), due: d.due === 'today' ? todayS() : '' }));
          st.focus = 'qt'; return;
        }
        if (a === 'tgd') { x = by(D.task, d.id); if (!x) return; setStatus(x, t.checked ? 'Done' : 'To Do'); syncParent(x); return; }
        if (a === 'tst') { x = by(D.task, d.id); if (!x) return; setStatus(x, d.s); syncParent(x); return; }
        if (a === 'tgs') { x = by(D.sub, d.id); if (x) x.done = t.checked; return; }
        if (a === 'sdel') { D.sub = D.sub.filter(function (s) { return s.id !== d.id; }); return; }
        if (a === 'sadd') { v = formValue(t); if (v) { D.sub.push({ id: K.uid(), taskId: d.id, title: v, done: false }); st.focus = 'sadd'; } return; }
        if (a === 'padd') {
          v = formValue(t);
          if (v) { D.task.push(mk({ title: v, kind: 'todo', parentId: d.id })); st.focus = 'padd'; }
          return;
        }
        if (a === 'tdue') { x = by(D.task, d.id); if (x) x.due = d.v; return; }
        if (a === 'ttime') { x = by(D.task, d.id); if (x) x.dueTime = d.v; return; }
        if (a === 'tpri') { x = by(D.task, d.id); if (x) x.priority = d.v; return; }
        if (a === 'rmtask') {
          x = by(D.task, d.id); if (!x) return;
          if (!confirm('Hapus "' + x.title + '"?' + (kindOf(x) === 'project' ? ' Semua tugas di dalamnya ikut terhapus.' : ''))) return;
          var par = x.parentId; removeTask(d.id);
          if (par) { var p = by(D.task, par); if (p) syncParent({ parentId: par }); }
          if (st.tid === d.id || st.pid === d.id) st.view = '';
          return;
        }
        if (a === 'tnav') {
          if (+d.d === 0) { st.tm = todayS().slice(0, 7); st.sd = todayS(); }
          else { var k = (st.tm || todayS().slice(0, 7)).split('-'), dt = new Date(+k[0], +k[1] - 1 + +d.d, 1); st.tm = dt.getFullYear() + '-' + pad(dt.getMonth() + 1); }
          return;
        }
        if (a === 'tday') { st.sd = d.d; st.tm = d.d.slice(0, 7); return; }
        if (a === 'photo') {
          var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*';
          fi.onchange = function () {
            var f = fi.files && fi.files[0]; if (!f) return;
            var r = new FileReader();
            r.onload = function () {
              var im = new Image();
              im.onload = function () {
                var s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 256;
                c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256);
                if (MO.setPhoto) MO.setPhoto(c.toDataURL('image/jpeg', 0.85));
                app.render();
              };
              im.src = r.result;
            };
            r.readAsDataURL(f);
          };
          fi.click();
          return;
        }
      }
    function pendingFocus() {
      if (!st.focus) return;
      var f = st.focus; st.focus = '';
      setTimeout(function () { var el = document.querySelector('form[data-f="' + f + '"] input'); if (el) el.focus(); }, 0);
    }
    return {
      skin: 'tk3-skin', specs: specs,
      tabs: [['hari', 'Hari ini', wrap(home)], ['semua', 'Semua', wrap(all)], ['riwayat', 'Riwayat', wrap(hist)]],
      sub: function () { var n = D.task.filter(function (t) { return !t.parentId && live(t) && t.due && t.due < todayS(); }).length; return top().filter(live).length + ' aktif' + (n ? ' · ' + n + ' terlambat' : ''); },
      cascade: { task: [['sub', 'taskId']] },
      act: function (a, d, t) { actImpl(a, d, t); pendingFocus(); }
    };
  });

  /* angka menghitung dari 0 saat pertama kali terlihat */
  var seenCnt = {};
  function countUp(el) {
    var to = +el.getAttribute('data-cnt'), key = el.getAttribute('data-lab') || ('' + to);
    if (!isFinite(to) || seenCnt[key] !== undefined || window.MOCountUp) return;
    seenCnt[key] = to;
    var suf = el.getAttribute('data-suf') || '', t0 = null;
    el.textContent = '0' + suf;
    var step = function (ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / 2600), e = 1 - Math.pow(1 - k, 2);
      el.textContent = Math.round(to * e) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if (window.MutationObserver) { var __cntQ = 0; new MutationObserver(function () { if (__cntQ) return; __cntQ = requestAnimationFrame(function () { __cntQ = 0; document.querySelectorAll('b[data-cnt]').forEach(countUp); }); }).observe(document.body, { childList: true, subtree: true }); }

  MO.routes['#task'] = tasks.open;
})();
;
/* MyOffice — Kalender (data di localStorage perangkat) */
(function () {
  'use strict';
  var MO = window.MyOffice, K = MO.kit, esc = K.esc, fd = K.fd, by = K.by, chips = K.chips, opt = K.opt, badge = K.badge, add = K.add, btns = K.btns, empty = K.empty;
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var DS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], DL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var HM = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Dzulkaidah', 'Dzulhijjah'];
  var dn = function (s) { var a = s.split('-'); return Math.round(Date.UTC(+a[0], a[1] - 1, +a[2]) / 864e5); };
  var addD = function (s, n) { return new Date((dn(s) + n) * 864e5).toISOString().slice(0, 10); };
  var dow = function (s) { return new Date(dn(s) * 864e5).getUTCDay(); };
  var tmin = function (t) { var a = (t || '0:0').split(':'); return +a[0] * 60 + +a[1]; };
  var hhmm = function (m) { return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); };
  var CF = { wk: 1, tz: 'auto', mode: 'both', hij: 0 };
  var PAL = [['', 'Ikuti jenis & kategori'], ['#4f7cff', 'Biru'], ['#2f9e6b', 'Hijau'], ['#d99a2b', 'Kuning'], ['#d0443e', 'Merah'], ['#8a5fb5', 'Ungu'], ['#d4608f', 'Pink'], ['#5f6b7a', 'Abu-abu']];

  /* ---------- Zona waktu & Hijriah ---------- */
  function nowP() {
    var o = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, p = {};
    if (CF.tz && CF.tz !== 'auto') o.timeZone = CF.tz;
    try { new Intl.DateTimeFormat('en-CA', o).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; }); return { date: p.year + '-' + p.month + '-' + p.day, min: (+p.hour % 24) * 60 + +p.minute }; }
    catch (e) { var d = new Date(); return { date: K.todayS(), min: d.getHours() * 60 + d.getMinutes() }; }
  }
  function tzOff(ts, tz) {
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000;
  }
  function zUtc(date, time, tz) {
    var a = date.split('-'), t = (time || '00:00').split(':');
    if (!tz || tz === 'auto') return new Date(+a[0], a[1] - 1, +a[2], +t[0], +t[1]).getTime();
    var g = Date.UTC(+a[0], a[1] - 1, +a[2], +t[0], +t[1]); try { return g - tzOff(g, tz); } catch (e) { return g; }
  }
  var __hijF = null, __hijC = {}, __hijN = 0;
  function hij(s) {
    var off = +CF.hij || 0, ck = s + '|' + off;
    if (ck in __hijC) return __hijC[ck];
    var d = new Date((dn(s) + off) * 864e5 + 432e5), p = {}, r;
    try {
      if (!__hijF) __hijF = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
      __hijF.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      r = { d: +p.day, m: +p.month, y: parseInt(p.relatedYear || p.year, 10) };
    } catch (e) { r = null; }
    if (++__hijN > 4000) { __hijC = {}; __hijN = 0; }
    return (__hijC[ck] = r);
  }

  var cal = K.App('Kalender', 'mo-cal-v1', function () {
    return { ev: [], cat: [{ id: 'c1', name: 'Kuliah', color: '#4f7cff' }, { id: 'c2', name: 'Pekerjaan', color: '#d99a2b' }, { id: 'c3', name: 'Organisasi', color: '#8a5fb5' }, { id: 'c4', name: 'Pribadi', color: '#2f9e6b' }, { id: 'c5', name: 'Ibadah', color: '#d4608f' }], set: { wk: 1, tz: 'auto', mode: 'both', hij: 0 } };
  }, function (app) {
    var D = app.D, st = app.st; D.set = Object.assign({ wk: 1, tz: 'auto', mode: 'both', hij: 0 }, D.set); CF = D.set;
    var projects = function () { return ls('mo-proj-v1').proj || []; }, courses = function () { return ls('mo-acad-v1').course || []; }, TK = [], AXE = [];
    /* ---------- Jenis kegiatan, warna blok & api pengingat ---------- */
    var KD = { ujian: { n: 'Ujian', c: '#e5484d', p: 3 }, presentasi: { n: 'Presentasi', c: '#8b5cf6', p: 2 }, penting: { n: 'Kegiatan penting', c: '#f59e0b', p: 1 } };
    var RX = {
      ujian: /\b(ujian|uts|uas|ujikom|kuis|quiz|ulangan|exam|midterm|sidang)\b/i,
      presentasi: /\b(presentasi|presentation|pitch|seminar|paparan|demo day|sempro|semhas|defense)\b/i,
      penting: /\b(penting|urgent|deadline|wajib|interview|wawancara|krusial)\b/i
    };

    /* ---------- Agenda akademik (ujian, presentasi, tenggat tugas, pertemuan) dibaca langsung dari modul Academic ---------- */
    function AX() {
      var A = ls('mo-acad-v1'), cs = {}, out = [];
      (A.course || []).forEach(function (c) { cs[c.id] = c; });
      (A.exam || []).forEach(function (x) {
        var c = cs[x.courseId]; if (!x.date || !c) return;
        var d = String(x.date).slice(0, 10), t = String(x.date).length > 10 ? String(x.date).slice(11, 16) : '';
        out.push({ id: 'ax-e-' + x.id, ax: 'exam', title: (x.done ? '\u2713 ' : '') + x.type + ' \u00b7 ' + c.name, start: d, end: d, startTime: t, endTime: '', allDay: !t, catId: 'c1', courseId: c.id, location: x.room || '', kind: x.done ? 'biasa' : (x.type === 'Presentasi' ? 'presentasi' : 'ujian') });
      });
      (A.task || []).forEach(function (x) {
        var c = cs[x.courseId]; if (!x.deadline || !c || x.status === 'Selesai') return;
        var d = String(x.deadline).slice(0, 10), t = String(x.deadline).slice(11, 16);
        out.push({ id: 'ax-t-' + x.id, ax: 'task', title: 'Tenggat \u00b7 ' + x.title + ' (' + c.name + ')', start: d, end: d, startTime: t, endTime: '', allDay: !t, catId: 'c1', courseId: c.id, kind: 'penting' });
      });
      (A.course || []).forEach(function (c) {
        ((c.trk && c.trk.m) || []).forEach(function (m, i) {
          if (!m || !m.d) return;
          out.push({ id: 'ax-m-' + c.id + '-' + i, ax: 'trk', title: 'Kuliah \u00b7 ' + c.name + ' (P' + (i + 1) + (m.a ? ' \u00b7 ' + m.a : '') + ')', start: m.d, end: m.d, startTime: '', endTime: '', allDay: true, catId: 'c1', courseId: c.id, kind: 'biasa' });
        });
      });
      return out;
    }
    var evAll = function () { return (D.ev || []).concat(AXE, K.taskEvents ? K.taskEvents() : []); };
    var eact = function (e) { return e.ax ? 'data-act="goacad" data-t="' + e.ax + '"' : e.tk ? 'data-act="gotask"' : 'data-act="edit" data-e="ev" data-id="' + esc(e.id) + '"'; };
    var kindOf = function (e) {
      if (e.kind === 'biasa') return '';
      if (KD[e.kind]) return e.kind;
      var s = (e.title || '') + ' ' + ((by(D.cat, e.catId) || {}).name || '');
      return ['ujian', 'presentasi', 'penting'].filter(function (k) { return RX[k].test(s); })[0] || '';
    };
    var color = function (e) { var k = kindOf(e); return e.color || (k && KD[k].c) || (by(D.cat, e.catId) || {}).color || '#4f7cff'; };
    var lo = function (e) {                       /* sisa hari sampai mulai (0 = hari ini / sedang berlangsung), -1 = sudah lewat */
      var t0 = dn(today()), left = dn(e.start) - t0;
      return left >= 0 ? left : (dn(e.end || e.start) >= t0 ? 0 : -1);
    };
    var fl = function (e) { var n = kindOf(e) ? lo(e) : -1; return n >= 0 && n <= 3 ? n : -1; };   /* api hanya H-3 .. hari-H */
    var hLbl = function (n) { return n === 0 ? 'Hari ini' : 'H-' + n; };
    var FIRE = '<svg viewBox="0 0 24 30" aria-hidden="true"><path class="fo" d="M12 0C12 6 20 10 20 20a8 8 0 0 1-16 0C4 15 7 12 8 8c1 2 2 3 2.5 4C11.5 9 11 4 12 0z"/><path class="fm" d="M12 11c0 4 5 6 5 10.500a5 5 0 0 1-10 0C7 19 8.500 17.500 9.500 16c1 1 1.500 1.500 1.800 2 .5-2.500.5-5 .7-7z"/><path class="fi" d="M12 19c0 2 2.500 3 2.500 5a2.500 2.500 0 0 1-5 0c0-1.200 1-2 1.500-3 .5.500.7.800.8 1 .2-1 .2-2 .2-3z"/></svg>';
    var fireEl = function (n) { return '<em class="fire l' + n + '" role="img" aria-label="Api pengingat ' + hLbl(n) + '" title="' + hLbl(n) + '">' + FIRE + '</em>'; };
    var tag = function (e) { var n = fl(e); return n < 0 ? '' : fireEl(n); };
    var kindLbl = function (e) {
      var k = kindOf(e); if (!k) return ''; var n = lo(e);
      return '<span class="kc-tag" data-k="' + k + '" style="--b:' + KD[k].c + '">' + KD[k].n + (n >= 0 ? ' · ' + hLbl(n) : '') + '</span>';
    };
    var legend = function () {
      return '<div class="kc-leg"><span>' + fireEl(2).replace('class="fire l2"', 'class="fire l2" style="--fd:1.2s"') + 'Api = H-3 s/d hari-H</span>' +
        Object.keys(KD).map(function (k) { return '<span><s style="--b:' + KD[k].c + '"></s>' + KD[k].n + '</span>'; }).join('') + '<span><s style="--b:#4f7cff"></s>Lainnya (warna kategori)</span></div>';
    };
    function fireBar() {
      var list = evAll().filter(function (e) { return fl(e) >= 0; }).sort(function (x, y) { return fl(x) - fl(y) || rng(x)[0] - rng(y)[0]; });
      if (!list.length) return '';
      var now = today();
      return '<div class="fire-bar" role="status">' + fireEl(fl(list[0])) + '<div><b>' + list.length + ' kegiatan menyala dalam 3 hari ke depan</b><div class="fb-c">' +
        list.slice(0, 6).map(function (e) { return '<button class="fb-chip" style="--b:' + color(e) + '" data-act="firego" data-d="' + (e.start > now ? e.start : now) + '">' + esc(KD[kindOf(e)].n + ': ' + e.title) + ' · ' + hLbl(fl(e)) + '</button>'; }).join('') + '</div></div></div>';
    }
    var rng = function (e) {
      var s = dn(e.start) * 1440 + (e.allDay ? 0 : tmin(e.startTime)), en = e.allDay ? (dn(e.end || e.start) + 1) * 1440 : (e.endTime ? dn(e.end || e.start) * 1440 + tmin(e.endTime) : s);
      return [s, en];
    };
    var onDay = function (day) { var a = dn(day) * 1440, b = a + 1440; return evAll().filter(function (e) { var r = rng(e); return r[0] < b && (r[1] > a || (r[1] === r[0] && r[0] >= a)); }); };
    var tasksOn = function (day) { return TK.filter(function (t) { return t.due === day; }); };
    var today = function () { return nowP().date; };
    var tl = function (e) { if (e.allDay) return 'Seharian'; return e.startTime + (e.endTime ? '–' + e.endTime : '') + (e.end && e.end !== e.start ? ' (s/d ' + fd(e.end) + ')' : ''); };
    var small = function (day) { var h = hij(day); return h ? h.d : ''; };
    var dayNum = function (day) {
      var m = +day.slice(8), h = hij(day);
      if (CF.mode === 'hijri' && h) return '<b>' + h.d + '<small>' + m + '</small></b>';
      return '<b>' + m + (CF.mode === 'both' && h ? '<small>' + h.d + '</small>' : '') + '</b>';
    };
    var hijStr = function (a, b) { var x = hij(a), y = hij(b); if (!x || !y) return ''; return (x.m === y.m ? HM[x.m - 1] : HM[x.m - 1] + '–' + HM[y.m - 1]) + ' ' + y.y + ' H'; };
    var mStr = function (a, b) { var x = new Date(dn(a) * 864e5), y = new Date(dn(b) * 864e5); return x.getUTCMonth() === y.getUTCMonth() ? MN[y.getUTCMonth()] + ' ' + y.getUTCFullYear() : MN[x.getUTCMonth()].slice(0, 3) + '–' + MN[y.getUTCMonth()].slice(0, 3) + ' ' + y.getUTCFullYear(); };
    function monthInfo(a) {
      if (CF.mode === 'hijri') {
        var x = hij(a); if (x) { var first = addD(a, -(x.d - 1)), len = 1; while (len < 31) { var y = hij(addD(first, len)); if (!y || y.m !== x.m) break; len++; } return { first: first, len: len }; }
      }
      var yy = +a.slice(0, 4), mm = +a.slice(5, 7); return { first: yy + '-' + pad(mm) + '-01', len: new Date(Date.UTC(yy, mm, 0)).getUTCDate() };
    }
    var specs = {
      ev: { title: 'Acara', def: { allDay: false, catId: 'c4', remind: '15' }, fields: [
        { k: 'title', l: 'Judul acara', t: 'text', req: 1, full: 1 },
        { k: 'catId', l: 'Kategori', t: 'select', o: function () { return [['', '—']].concat(D.cat.map(function (c) { return [c.id, c.name]; })); } },
        { k: 'color', l: 'Warna', t: 'select', o: PAL },
        { k: 'kind', l: 'Jenis kegiatan (api H-3 & warna blok)', t: 'select', o: [['', 'Otomatis (dari judul / kategori)'], ['ujian', 'Ujian'], ['presentasi', 'Presentasi'], ['penting', 'Kegiatan penting'], ['biasa', 'Biasa (tanpa api)']] },
        { k: 'allDay', l: 'Seharian?', t: 'select', bool: 1, o: [['false', 'Tidak (ada jam)'], ['true', 'Ya, seharian']] },
        { k: 'remind', l: 'Pengingat', t: 'select', o: [['', 'Tanpa pengingat'], ['0', 'Tepat waktu'], ['5', '5 menit sebelum'], ['15', '15 menit sebelum'], ['30', '30 menit sebelum'], ['60', '1 jam sebelum'], ['1440', '1 hari sebelum']] },
        { k: 'start', l: 'Tanggal mulai', t: 'date', req: 1 }, { k: 'startTime', l: 'Jam mulai', t: 'time' },
        { k: 'end', l: 'Tanggal selesai', t: 'date' }, { k: 'endTime', l: 'Jam selesai', t: 'time' },
        { k: 'location', l: 'Lokasi', t: 'text', full: 1 },
        { k: 'projId', l: 'Terkait proyek', t: 'select', o: function () { return [['', '—']].concat(projects().map(function (p) { return [p.id, p.name]; })); } },
        { k: 'courseId', l: 'Terkait mata kuliah / jadwal kuliah', t: 'select', o: function () { return [['', '—']].concat(courses().map(function (c) { return [c.id, c.name + (c.schedule ? ' — ' + c.schedule : '')]; })); } },
        { k: 'goalRef', l: 'Terkait goal / milestone (jadwal belajar)', t: 'select', full: 1, o: function () { return MO.goalOpts ? MO.goalOpts() : [['', '—']]; } },
        { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      cat: { title: 'Kategori Acara', def: { color: '#4f7cff' }, fields: [{ k: 'name', l: 'Nama kategori', t: 'text', req: 1, full: 1 }, { k: 'color', l: 'Warna', t: 'select', o: PAL.slice(1) }] }
    };
    function item(e, cls) {
      var rel = [(by(projects(), e.projId) || {}).name, (by(courses(), e.courseId) || {}).name].filter(Boolean).join(' · ');
      return '<button class="ev" style="--c:' + color(e) + '" ' + eact(e) + ' title="' + esc(e.title + ' · ' + tl(e) + (e.location ? ' · ' + e.location : '') + (rel ? ' · ' + rel : '')) + '">' + tag(e) + (e.allDay ? '' : esc(e.startTime) + ' ') + esc(e.title) + '</button>';
    }
    var taskBtn = function (t) { return '<button class="ev tk' + (t.status === 'Done' ? ' dn' : '') + '" style="--c:#8a94a6" data-act="gotask" title="Tenggat tugas' + (t.dueTime ? ' ' + t.dueTime : '') + '">☑ ' + esc(t.title) + '</button>'; };

    function month(a, ttl) {
      var mi = monthInfo(a), first = mi.first, lead = (dow(first) - (+CF.wk) + 7) % 7, now = today(), sel = st.sel || now, i;
      var h = '<div class="kc-wrap"><div class="kc-cal"><div class="kc-nav"><button class="kc-nb" data-act="cnav" data-d="-1" aria-label="Bulan sebelumnya">‹</button><b>' + ttl + '</b><button class="kc-nb" data-act="cnav" data-d="1" aria-label="Bulan berikutnya">›</button></div><div class="kc-wk">';
      for (i = 0; i < 7; i++) h += '<span>' + DS[(+CF.wk + i) % 7] + '</span>';
      h += '</div><div class="kc-days">';
      for (i = 0; i < lead; i++) h += '<span class="kc-d out"></span>';
      for (i = 0; i < mi.len; i++) {
        var d = addD(first, i), evs = onDay(d), tks = tasksOn(d), busy = evs.length + tks.length > 0, fn = -1, tint = null, bars = [];
        evs.forEach(function (e) {
          var c = color(e), k = kindOf(e), n = fl(e);
          if (bars.indexOf(c) < 0) bars.push(c);
          if (k && (!tint || KD[k].p > tint.p)) tint = { c: c, p: KD[k].p };
          if (n >= 0 && d === (e.start > now ? e.start : now) && (fn < 0 || n < fn)) fn = n;   /* api di tanggal mulai (atau hari ini jika sedang berlangsung) */
        });
        if (!tint && evs.length) tint = { c: color(evs[0]), p: 0 };
        h += '<button class="kc-d' + (d === now ? ' td' : '') + (d === sel ? ' sel' : '') + (d < now ? ' pst' : '') + '" data-act="selday" data-d="' + d + '" aria-label="' + fd(d) + (busy ? ', ada kegiatan' : '') + (fn >= 0 ? ', api pengingat ' + hLbl(fn) : '') + '"' + (d === sel ? ' aria-pressed="true"' : '') + '>' +
          (fn >= 0 ? '<s class="kc-glow l' + fn + '"></s>' : tint ? '<s class="kc-blk" style="--b:' + tint.c + '"></s>' : '') +
          dayNum(d) + (fn >= 0 ? fireEl(fn) : '') +
          (bars.length ? '<span class="kc-bars">' + bars.slice(0, 4).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' : (tks.length ? '<u class="kc-dot"></u>' : '')) + '</button>';
      }
      h += '</div><div class="kc-foot">' + legend() + '<button class="kc-today" data-act="cnav" data-d="0"><i class="kt-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle class="kt-o" cx="12" cy="12" r="7.5"/><circle class="kt-d" cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path class="kt-t" d="M12 1.800v3.200M12 19v3.200M1.800 12H5M19 12h3.200"/></svg></i><span>Kembali ke hari ini</span></button></div></div>';
      var ev = onDay(sel).sort(function (x, y) { return rng(x)[0] - rng(y)[0]; }), tk = tasksOn(sel);
      h += '<aside class="kc-side" aria-live="polite"><small>' + DL[dow(sel)] + ', ' + (+sel.slice(8)) + ' ' + MN[+sel.slice(5, 7) - 1] + ' ' + sel.slice(0, 4) + '</small>';
      if (!ev.length && !tk.length) h += '<p>Belum ada kegiatan pada tanggal ini.</p>';
      ev.forEach(function (e) { h += '<button class="kc-ev" style="--c:' + color(e) + '" ' + eact(e) + '><i></i><div><b>' + tag(e) + esc(e.title) + '</b><small>' + kindLbl(e) + esc(tl(e)) + (e.location ? ' · ' + esc(e.location) : '') + '</small></div></button>'; });
      tk.forEach(function (t) { h += '<button class="kc-ev" style="--c:#8a94a6" data-act="gotask"><i></i><div><b>' + esc(t.title) + '</b><small>Tenggat tugas · ' + esc(t.status) + (t.dueTime ? ' · ' + t.dueTime : '') + '</small></div></button>'; });
      return h + '<button class="kc-add" data-act="newday" data-d="' + sel + '">+ Tambah kegiatan</button></aside></div>';
    }
    function lanes(S) {
      S.sort(function (x, y) { return x.s - y.s || y.en - x.en; });
      var cl = [], cur = null;
      S.forEach(function (x) {
        if (!cur || x.s >= cur.end) { cur = { end: 0, items: [], ln: [] }; cl.push(cur); }
        var li = -1; cur.ln.forEach(function (e, j) { if (li < 0 && e <= x.s) li = j; });
        if (li < 0) { li = cur.ln.length; cur.ln.push(0); }
        cur.ln[li] = x.en; x.l = li; cur.items.push(x); cur.end = Math.max(cur.end, x.en);
      });
      cl.forEach(function (c) { c.items.forEach(function (x) { x.n = c.ln.length; }); });
    }
    function grid(days) {
      var np = nowP(), h = '<div class="tgw"><div class="tg" style="--n:' + days.length + ';--mw:' + (days.length > 1 ? 640 : 0) + 'px"><div class="lb"></div>';
      days.forEach(function (d) { h += '<div class="hh" data-act="goday" data-d="' + d + '"' + (d === np.date ? ' style="font-weight:600"' : '') + '>' + DS[dow(d)] + '<small>' + +d.slice(8) + (CF.mode !== 'masehi' && hij(d) ? ' · ' + small(d) : '') + '</small></div>'; });
      h += '<div class="lb">Seharian</div>';
      days.forEach(function (d) { h += '<div class="ad">' + onDay(d).filter(function (e) { return e.allDay; }).map(function (e) { return item(e); }).join('') + tasksOn(d).map(taskBtn).join('') + '</div>'; });
      h += '<div class="hours">'; for (var i = 0; i < 24; i++) h += '<div>' + pad(i) + ':00</div>'; h += '</div>';
      days.forEach(function (d) {
        var a = dn(d) * 1440, S = onDay(d).filter(function (e) { return !e.allDay; }).map(function (e) {
          var r = rng(e), s = Math.max(r[0], a) - a, en = r[1] === r[0] ? s + 25 : Math.min(r[1], a + 1440) - a; return { e: e, s: s, en: en };
        });
        lanes(S);
        h += '<div class="col" data-act="slot" data-d="' + d + '">' + S.map(function (x) {
          var hgt = Math.max(20, (x.en - x.s) * 0.8);
          return '<button class="ev" style="--c:' + color(x.e) + ';top:' + (x.s * 0.8) + 'px;height:' + hgt + 'px;left:' + (x.l * 100 / x.n) + '%;width:calc(' + (100 / x.n) + '% - 3px)" ' + eact(x.e) + '><b>' + tag(x.e) + esc(x.e.title) + '</b>' + (hgt > 34 ? '<br>' + tl(x.e) + (x.e.location ? ' · ' + esc(x.e.location) : '') : '') + '</button>';
        }).join('') + (d === np.date ? '<div class="now" style="top:' + (np.min * 0.8) + 'px"></div>' : '') + '</div>';
      });
      return h + '</div></div><p class="ac-hint" style="margin-top:8px">Acara tanpa jam selesai ditampilkan sebagai penanda singkat. Tugas yang hanya punya tenggat muncul di baris "Seharian", bukan sebagai blok jam.</p>';
    }
    function agenda(a) {
      var h = '', any = false;
      for (var i = 0; i < 30; i++) {
        var d = addD(a, i), ev = onDay(d).sort(function (x, y) { return rng(x)[0] - rng(y)[0]; }), tk = tasksOn(d);
        if (!ev.length && !tk.length) continue; any = true;
        var hh = hij(d);
        h += '<div class="dayh">' + DL[dow(d)] + ', ' + fd(d) + (CF.mode !== 'masehi' && hh ? '<small>' + hh.d + ' ' + HM[hh.m - 1] + ' ' + hh.y + ' H</small>' : '') + '</div>';
        ev.forEach(function (e) {
          var c = by(D.cat, e.catId), rel = [(by(projects(), e.projId) || {}).name, (by(courses(), e.courseId) || {}).name].filter(Boolean).join(' · ');
          h += '<div class="aitem" style="--c:' + color(e) + ';cursor:pointer" ' + eact(e) + '><span class="tm">' + tl(e) + '</span><div><b>' + tag(e) + esc(e.title) + '</b><small>' + kindLbl(e) + [c && c.name, e.location, rel, e.remind !== '' && e.remind != null ? '🔔 ' + (+e.remind ? e.remind + ' mnt sebelum' : 'tepat waktu') : ''].filter(Boolean).map(esc).join(' · ') + '</small></div></div>';
        });
        tk.forEach(function (t) { h += '<div class="aitem" style="--c:#8a94a6;cursor:pointer" data-act="gotask"><span class="tm">Tenggat</span><div>☑ ' + esc(t.title) + '<small>' + esc(t.status) + (t.dueTime ? ' · ' + t.dueTime : '') + '</small></div></div>'; });
      }
      return any ? h : empty('Tidak ada agenda dalam 30 hari ke depan.');
    }
    function vCal() {
      AXE = AX();
      TK = (ls('mo-task-v1').task || []).filter(function (t) { return t.due && t.status !== 'Archived' && t.kind !== 'event' && !t.parentId; });
      var a = st.d || today(), v = st.v || 'Monthly', ttl = '', body;
      if (v === 'Monthly') {
        var mi = monthInfo(a), last = addD(mi.first, mi.len - 1);
        ttl = CF.mode === 'hijri' ? hijStr(mi.first, last) + ' <small style="opacity:.6">' + mStr(mi.first, last) + '</small>' : mStr(mi.first, last) + (CF.mode === 'both' ? ' <small style="opacity:.6">' + hijStr(mi.first, last) + '</small>' : '');
        body = month(a, ttl);
      } else if (v === 'Weekly') {
        var s = addD(a, -((dow(a) - +CF.wk + 7) % 7)), days = []; for (var i = 0; i < 7; i++) days.push(addD(s, i));
        ttl = fd(days[0]) + ' – ' + fd(days[6]); body = grid(days);
      } else if (v === 'Daily') {
        var hh = hij(a); ttl = DL[dow(a)] + ', ' + fd(a) + (CF.mode !== 'masehi' && hh ? ' <small style="opacity:.6">' + hh.d + ' ' + HM[hh.m - 1] + ' ' + hh.y + ' H</small>' : ''); body = grid([a]);
      } else { ttl = 'Agenda 30 hari dari ' + fd(a); body = agenda(a); }
      body = fireBar() + body;
      if (v === 'Monthly') return '<div class="kc-top"><h3>Kalender kegiatan</h3><p>Pilih tanggal untuk melihat detail kegiatan. Blok warna menandai jenis kegiatan; api menyala 3 hari sebelum ujian, presentasi, atau kegiatan penting.</p></div><div class="kc-tools">' +
        chips(['Daily', 'Weekly', 'Monthly', 'Agenda List'].map(function (x) { return x === 'Agenda List' ? 'Agenda' : x; }), 'Monthly', 'v') + add('ev', 'Acara') + '</div>' + body;
      return '<div class="ac-bar"><div class="ac-acts"><button class="ac-btn sm" data-act="cnav" data-d="-1" aria-label="Sebelumnya">←</button><button class="ac-btn sm" data-act="cnav" data-d="0">Hari ini</button><button class="ac-btn sm" data-act="cnav" data-d="1" aria-label="Berikutnya">→</button></div><b style="font-size:15px">' + ttl + '</b>' + add('ev', 'Acara') + '</div>' +
        chips(['Daily', 'Weekly', 'Monthly', 'Agenda List'].map(function (x) { return x === 'Agenda List' ? 'Agenda' : x; }), v === 'Agenda List' ? 'Agenda' : v, 'v') + body;
    }
    var row = function (l, h) { return '<div class="cfgrow"><label>' + l + '</label>' + h + '</div>'; };
    var sel = function (k, list, cur) { return '<select data-chg="set" data-k="' + k + '" style="max-width:320px">' + list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(cur) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>'; };
    function vSet() {
      var np = nowP(), tzs = [['auto', 'Otomatis (zona waktu perangkat)'], ['Asia/Jakarta', 'WIB — Jakarta'], ['Asia/Makassar', 'WITA — Makassar'], ['Asia/Jayapura', 'WIT — Jayapura'], ['Asia/Singapore', 'Singapura'], ['Asia/Kuala_Lumpur', 'Kuala Lumpur'], ['Asia/Riyadh', 'Riyadh'], ['Asia/Tokyo', 'Tokyo'], ['Europe/London', 'London'], ['America/New_York', 'New York'], ['UTC', 'UTC']];
      return '<div class="ac-card">' + row('Zona waktu kalender', sel('tz', tzs, CF.tz)) + '<p class="ac-hint" style="margin:-4px 0 12px">Sekarang di zona ini: <b>' + fd(np.date) + ' ' + hhmm(np.min) + '</b>. Jam acara dibaca sebagai waktu di zona ini.</p>' +
        row('Hari pertama dalam seminggu', sel('wk', [[1, 'Senin'], [0, 'Minggu'], [6, 'Sabtu']], CF.wk)) +
        row('Sistem kalender', sel('mode', [['both', 'Masehi + Hijriah'], ['masehi', 'Masehi saja'], ['hijri', 'Hijriah (grid mengikuti bulan Hijriah)']], CF.mode)) +
        row('Koreksi tanggal Hijriah', sel('hij', [[-2, '−2 hari'], [-1, '−1 hari'], [0, 'Tanpa koreksi'], [1, '+1 hari'], [2, '+2 hari']], CF.hij)) +
        '<p class="ac-hint" style="margin:-4px 0 12px">Hijriah dihitung dengan kalender Umm al-Qura. Penetapan awal bulan di Indonesia bisa berbeda satu hari; gunakan koreksi untuk menyesuaikan.</p>' +
        row('Pengingat di browser', '<div><button class="ac-btn sm" data-act="notif">Aktifkan notifikasi browser</button> <small style="opacity:.7">Pengingat hanya berbunyi saat Beresin terbuka di browser.</small></div>') + '</div>' +
        '<div class="ac-bar"><div class="ac-h" style="margin:0">Kategori acara</div>' + add('cat', 'Kategori') + '</div>' +
        D.cat.map(function (c) { return '<div class="ac-item"><span style="width:14px;height:14px;border-radius:50%;background:' + c.color + ';margin-top:3px;flex:none"></span><div><b>' + esc(c.name) + '</b></div>' + btns('cat', c.id) + '</div>'; }).join('');
    }
    return {
      specs: specs, tabs: [['cal', 'Kalender', vCal], ['set', 'Pengaturan', vSet]],
      sub: function () { var h = hij(today()); return fd(today()) + (CF.mode !== 'masehi' && h ? ' · ' + h.d + ' ' + HM[h.m - 1] + ' ' + h.y + ' H' : '') + ' · ' + (CF.tz === 'auto' ? 'zona perangkat' : CF.tz); },
      validate: function (ent, r) {
        if (ent !== 'ev') return;
        r.end = r.end || r.start;
        if (r.allDay) { r.startTime = r.endTime = ''; if (r.end < r.start) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.'; }
        else {
          if (!r.startTime) return 'Isi jam mulai, atau ubah menjadi acara seharian.';
          if (r.endTime) { var x = rng(r); if (x[1] <= x[0]) return 'Waktu selesai harus setelah waktu mulai.'; }
          else if (r.end !== r.start) return 'Acara lintas hari perlu jam selesai.';
        }
      },
      act: function (a, d, t, ev) {
        if (a === 'set') CF[d.k] = (d.k === 'wk' || d.k === 'hij') ? +d.v : d.v;
        if (a === 'cnav') {
          var cur = st.d || today(), v = st.v || 'Monthly', n = +d.d;
          if (!n) { st.d = today(); st.sel = today(); return; }
          if (v === 'Monthly') { var mi = monthInfo(cur); st.d = CF.mode === 'hijri' ? (n > 0 ? addD(mi.first, mi.len) : addD(mi.first, -1)) : new Date(Date.UTC(+cur.slice(0, 4), +cur.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 10); }
          else st.d = addD(cur, n * (v === 'Weekly' ? 7 : v === 'Daily' ? 1 : 30));
        }
        if (a === 'filt' && d.f === 'v') st.v = d.v === 'Agenda' ? 'Agenda List' : d.v;
        if (a === 'selday') st.sel = d.d;
        if (a === 'firego') { st.d = d.d; st.sel = d.d; }
        if (a === 'goday') { st.d = d.d; st.v = 'Daily'; }
        if (a === 'newday') app.form('ev', null, { start: d.d, end: d.d, allDay: true });
        if (a === 'slot') {
          var col = t.closest('.col'), y = ev.clientY - col.getBoundingClientRect().top, m = Math.max(0, Math.min(1380, Math.floor(y / 0.8 / 30) * 30));
          app.form('ev', null, { start: d.d, end: d.d, startTime: hhmm(m), endTime: hhmm(m + 60), allDay: false });
        }
        if (a === 'gotask' && MO.routes['#task']) MO.routes['#task']();
        if (a === 'goacad' && MO.acadGo) MO.acadGo(d.t === 'task' ? 'task' : d.t === 'trk' ? 'trk' : 'exam');
        if (a === 'notif' && window.Notification) Notification.requestPermission().then(function (p) { MO.msg('Notifikasi', p === 'granted' ? 'Aktif' : 'Tidak diizinkan'); });
      }
    };
  });
  /* ---------- Mesin pengingat (hanya saat halaman terbuka) ---------- */
  function notify(title, text) { MO.msg(title, text); try { if (window.Notification && Notification.permission === 'granted') new Notification(title, { body: text }); } catch (e) { } }
  function check() {
    var now = Date.now(), fired = ls('mo-fired'), ch = false, c = ls('mo-cal-v1'), tz = (c.set || {}).tz;
    (c.ev || []).forEach(function (e) {
      if (e.remind === '' || e.remind == null || !e.start) return;
      var at = zUtc(e.start, e.allDay ? '00:00' : e.startTime, tz) - (+e.remind) * 6e4, k = 'e' + e.id + '@' + at;
      if (at <= now && now - at < 864e5 && !fired[k]) { fired[k] = 1; ch = true; notify('Pengingat acara', e.title + (e.startTime ? ' · ' + e.startTime : '')); }
    });
    (ls('mo-task-v1').task || []).forEach(function (t) {
      if (!t.remindAt || t.status === 'Done' || t.status === 'Archived') return;
      var at = new Date(t.remindAt).getTime(), k = 't' + t.id + '@' + at;
      if (at <= now && now - at < 864e5 && !fired[k]) { fired[k] = 1; ch = true; notify('Pengingat tugas', t.title); }
    });
    if (ch) try { localStorage.setItem('mo-fired', JSON.stringify(fired)); } catch (e) { }
  }
  setTimeout(check, 3000); setInterval(check, 30000);

  MO.routes['#calendar'] = cal.open;
})();
;
/* MyOffice — Finance (tema krem · merah · biru). Data tetap di localStorage 'mo-fin-v1' (kompatibel dengan data lama & Analytics). */
(function () {
  'use strict';
  const MO = window.MyOffice, K = MO.kit, esc = K.esc, rp = K.rp, uid = K.uid, by = K.by, fd = K.fd, today = K.todayS;
  const KEY = 'mo-fin-v1', pad = n => ('0' + n).slice(-2);
  let D; try { D = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  D = D || {}; ['acc', 'tx', 'bud', 'goal', 'con', 'cat', 'item', 'rcp', 'cart', 'tag'].forEach(k => D[k] = D[k] || []);
  const mkc = (k, a) => a.forEach(n => D.cat.push({ id: uid(), name: n, kind: k, archived: false }));
  if (!D.cat.length) { mkc('Pemasukan', ['Uang saku', 'Gaji', 'Freelance', 'Beasiswa', 'Bisnis', 'Lainnya']); mkc('Pengeluaran', ['Makanan', 'Minuman', 'Transportasi', 'Pendidikan', 'Kebutuhan pribadi', 'Hiburan', 'Langganan', 'Kesehatan', 'Organisasi', 'Tabungan', 'Lainnya']); }
  const ICO = { Makanan: '🍜', Minuman: '🥤', Transportasi: '🛵', Pendidikan: '📚', 'Kebutuhan pribadi': '🧴', Hiburan: '🎬', Langganan: '📱', Kesehatan: '💊', Organisasi: '🤝', Tabungan: '🐷', Lainnya: '🧾', 'Uang saku': '👛', Gaji: '💼', Freelance: '💻', Beasiswa: '🎓', Bisnis: '🏪' };
  const ic = c => (c && (c.icon || ICO[c.name])) || '🧾';
  /* katalog = KATEGORI saja; nama item, harga, jumlah & label diisi sendiri saat mencatat */
  if (!D.mig2) { if (!D.cat.some(c => c.kind === 'Pengeluaran' && c.name === 'Minuman')) D.cat.splice(Math.max(0, D.cat.findIndex(c => c.name === 'Makanan') + 1), 0, { id: uid(), name: 'Minuman', kind: 'Pengeluaran', archived: false }); D.mig2 = 1; }
  if (!D.tagSeeded) { [['Penting', '⭐'], ['Mendesak', '⚡'], ['Kebutuhan', '🧺'], ['Keinginan', '🎁'], ['Hiburan', '🎉'], ['Bisa ditunda', '⏳']].forEach(([n, e]) => D.tag.push({ id: uid(), name: n, icon: e })); D.tagSeeded = 1; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { MO.msg('Peringatan', 'Data tidak bisa disimpan di browser ini.'); } };
  const st = { tab: 'home', sub: { riw: 'tx', dom: 'acc' }, m: today().slice(0, 7), cat: '', q: '', tt: '', rng: 6 };
  const mlab = ym => new Date(ym + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const addM = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const pc = (a, b) => b > 0 ? a / b * 100 : 0;
  const cn = id => (by(D.cat, id) || {}).name || '—', an = id => (by(D.acc, id) || {}).name || '—';
  const bal = a => { let b = +a.opening || 0; D.tx.forEach(t => { const x = +t.amount || 0; if (t.accId === a.id) b += t.type === 'Income' ? x : -x; if (t.type === 'Transfer' && t.toAccId === a.id) b += x; }); return b; };
  const sum = (type, m, f) => D.tx.filter(t => t.type === type && t.date.slice(0, 7) === m && (!f || f(t))).reduce((a, t) => a + (+t.amount || 0), 0);
  const expBy = m => { const o = {}; D.tx.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === m).forEach(t => o[t.catId] = (o[t.catId] || 0) + (+t.amount || 0)); return o; };
  const budFor = (cid, m) => D.bud.find(b => b.catId === cid && b.month === m) || D.bud.find(b => b.catId === cid && !b.month);
  const got = g => D.con.filter(c => c.goalId === g.id).reduce((a, c) => a + (+c.amount || 0), 0);
  const expCats = () => D.cat.filter(c => c.kind === 'Pengeluaran' && !c.archived);
  const cartN = () => D.cart.reduce((a, l) => a + l.qty, 0), cartT = () => D.cart.reduce((a, l) => a + l.qty * l.price, 0);
  const tg = id => by(D.tag, id), tgi = t => t ? ci(t, '🏷️') : '';
  const tgChip = id => { const t = tg(id); return t ? `<span class="fn-lb" style="--h:${hue(t.name)}">${tgi(t)} ${esc(t.name)}</span>` : ''; };
  const tagBy = m => { const o = {}; D.tx.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === m).forEach(t => { const k = tg(t.tagId) ? t.tagId : ''; o[k] = (o[k] || 0) + (+t.amount || 0); }); return o; };
  const hue = s => { let h = 0; String(s).split('').forEach(c => h = (h * 31 + c.charCodeAt(0)) % 360); return h; };
  /* gambar/logo kustom: o.img (data URL) menang atas emoji */
  const ci = (o, fb) => (o && o.img) ? '<img class="fn-im" src="' + o.img + '" alt="" draggable="false">' : (o && o.icon ? esc(o.icon) : fb);
  const cic = c => ci(c, c ? (ICO[c.name] || '🧾') : '🧾');
  const bnm = () => (D.brand && D.brand.name) || 'Beresin Finance';

  /* ---------- ikon ---------- */
  const SV = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const I = {
    ana: '<img class="fn-3d" src="data:image/webp;base64,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" alt="">',
    cam: SV('<path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>'),
    home: '<img class="fn-3d" src="data:image/webp;base64,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" alt="">',
    menu: '<img class="fn-3d" src="data:image/webp;base64,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" alt="">',
    cart: SV('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/>'),
    rcp: '<img class="fn-3d" src="data:image/webp;base64,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" alt="">',
    wal: '<img class="fn-3d" src="data:image/webp;base64,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" alt="">',
    x: SV('<path d="M18 6 6 18M6 6l12 12"/>'), dl: SV('<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>'), pr: SV('<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="6" y="14" width="12" height="7"/>')
  };
  const ART = '<svg viewBox="0 0 170 160" aria-hidden="true"><g>' + [128, 108, 88].map(y => `<path d="M26 ${y}v11a54 17 0 0 0 108 0v-11z" fill="#f0c36b"/><ellipse cx="80" cy="${y}" rx="54" ry="17" fill="#ffe3a0"/><ellipse cx="80" cy="${y}" rx="40" ry="11" fill="none" stroke="#e8b655" stroke-width="2"/>`).join('') + '</g><g transform="rotate(-14 112 52)"><circle cx="112" cy="52" r="32" fill="#d92b2b"/><circle cx="112" cy="52" r="25" fill="none" stroke="#ffe3d3" stroke-width="2.5" stroke-dasharray="3 4"/><text x="112" y="60" text-anchor="middle" font-family="Baloo 2,Arial" font-weight="800" font-size="22" fill="#fff3e6">Rp</text></g><circle cx="30" cy="40" r="5" fill="#fff" opacity=".8"/><circle cx="150" cy="118" r="4" fill="#fff" opacity=".7"/><path d="M40 62l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff" opacity=".85"/></svg>';

  /* ---------- kerangka ---------- */
  const R = document.createElement('div'); R.className = 'fn-ov'; R.hidden = true;
  R.innerHTML = '<div class="fn-app" role="dialog" aria-modal="true" aria-label="Finance"><header class="fn-hd"><div class="fn-brand"><button class="fn-logo" data-a="brand" aria-label="Ubah logo dan nama" title="Ubah logo & nama">' + (window.MOBrandIcon ? MOBrandIcon('fin') : 'Rp') + '</button><div><b data-bn>MyOffice Finance</b><small data-bt>Catat hemat, hidup tenang</small></div></div><h2 class="fn-ttl"></h2><div class="fn-hb"><button data-a="goriw" aria-label="Resi" title="Resi">' + I.rcp + '</button><button data-a="close" aria-label="Tutup" title="Tutup">' + I.x + '</button></div></header><main class="fn-v" id="fnv"></main><nav class="fn-nav" aria-label="Menu Finance"></nav><div class="fn-sh" hidden></div></div>';
  document.body.appendChild(R);
  const V = R.querySelector('#fnv'), NAV = R.querySelector('.fn-nav'), SH = R.querySelector('.fn-sh');

  /* ---------- tampilan ---------- */
  const mon = () => `<div class="fn-mon"><button data-a="mon" data-d="-1" aria-label="Bulan sebelumnya">‹</button><b>${mlab(st.m)}</b><button data-a="mon" data-d="1" aria-label="Bulan berikutnya">›</button></div>`;
  const empty = (t, b) => `<div class="fn-empty"><i>🧾</i><p>${t}</p>${b || ''}</div>`;
  const meter = p => `<div class="fn-meter"><i class="${p >= 100 ? 'bad' : p >= 80 ? 'warn' : ''}" style="width:${Math.min(100, p)}%"></i></div>`;
  const seg = (k, list) => `<div class="fn-seg">${list.map(([v, l]) => `<button aria-pressed="${st.sub[k] === v}" data-a="sub" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const txRow = t => {
    const tr = t.type === 'Transfer', c = by(D.cat, t.catId), nm = t.desc || (tr ? 'Transfer' : c ? c.name : 'Transaksi');
    return `<button class="fn-row" data-a="edit" data-e="tx" data-id="${t.id}"><i class="fn-ico">${tr ? '🔁' : cic(c)}</i><div><b>${esc(nm)}</b><small>${tr ? esc(an(t.accId)) + ' → ' + esc(an(t.toAccId)) : esc(c ? c.name : '') + ' · ' + esc(an(t.accId))} · ${fd(t.date)}${t.rcpId ? ' · resi' : ''}${t.tagId && tg(t.tagId) ? ' · ' + esc(tg(t.tagId).name) : ''}</small></div><strong class="${tr ? '' : t.type === 'Income' ? 'pos' : 'neg'}">${tr ? '' : t.type === 'Income' ? '+' : '−'}${rp(t.amount)}</strong></button>`;
  };
  const katCard = c => {
    const n = D.tx.filter(t => t.type === 'Expense' && t.catId === c.id && t.date.slice(0, 7) === st.m), v = n.reduce((a, t) => a + (+t.amount || 0), 0);
    return `<article class="fn-it fn-kc"><button class="fn-ed" data-a="edit" data-e="cat" data-id="${c.id}" aria-label="Ubah kategori ${esc(c.name)}">✎</button><button class="fn-kb" data-a="pick" data-id="${c.id}" aria-label="Catat pengeluaran ${esc(c.name)}"><span class="fn-art${c.img ? ' has' : ''}" style="--h:${hue(c.name)}">${cic(c)}</span><b>${esc(c.name)}</b><small>${v ? rp(v) + ' · ' + n.length + 'x bulan ini' : 'Belum ada bulan ini'}</small><span class="fn-go">+ Catat</span></button></article>`;
  };
  function home() {
    const m = st.m, act = D.acc.filter(a => a.active), total = act.reduce((a, x) => a + bal(x), 0), inc = sum('Income', m), exp = sum('Expense', m), eb = expBy(m);
    const tb = tagBy(m), tk = Object.keys(tb).sort((a, b) => tb[b] - tb[a]), tsum = tk.reduce((a, k) => a + tb[k], 0);
    let bL = 0, bS = 0; expCats().forEach(c => { const b = budFor(c.id, m); if (b) { bL += +b.limit || 0; bS += eb[c.id] || 0; } });
    const gs = D.goal.filter(g => g.status === 'Aktif'), g0 = gs[0];
    const recent = D.tx.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return mon() + `<div class="fn-hm"><div class="fn-hm-a"><section class="fn-ban"><div><h1>Catat.<br>Hemat.<br>Tenang.</h1><p>Saldo <b>${rp(total)}</b><br>Keluar bulan ini <span class="cu">${rp(exp)}</span> · masuk <span class="cu">${rp(inc)}</span></p><button class="fn-btn w" data-a="tab" data-t="menu">Catat pengeluaran</button></div>${ART}</section>
    <div class="fn-cats" role="list">${expCats().map(c => `<button role="listitem" data-a="pick" data-id="${c.id}"><i>${cic(c)}</i><span>${esc(c.name)}</span><small>${eb[c.id] ? rp(eb[c.id]).replace('Rp ', '') : '–'}</small></button>`).join('')}</div>
    <div class="fn-sec"><h3>Pengeluaran per label</h3><button class="fn-lnk" data-a="tab" data-t="menu">Katalog →</button></div>
    ${tk.length ? '<div class="fn-lst">' + tk.map(k => { const t = tg(k); return `<div class="fn-bud"><i class="fn-ico">${t ? tgi(t) : '🏷️'}</i><div><b>${t ? esc(t.name) : 'Tanpa label'}</b><small>${rp(tb[k])} dari ${rp(tsum)}</small>${meter(pc(tb[k], tsum))}</div><em>${Math.round(pc(tb[k], tsum))}%</em></div>`; }).join('') + '</div>' : empty('Pilih kategori di atas, lalu isi nama item, harga, jumlah & label sesukamu. Ringkasan per label muncul di sini.')}
    </div><aside class="fn-hm-b"><section class="fn-rw"><span class="fn-seal">${bL ? '📊' : g0 ? '🎯' : '⭐'}</span><div><b>${bL ? 'Anggaran ' + mlab(m) : g0 ? esc(g0.name) : 'Belum ada anggaran'}</b><small>${bL ? 'Terpakai ' + rp(bS) + ' dari ' + rp(bL) : g0 ? 'Terkumpul ' + rp(got(g0)) + ' dari ' + rp(g0.target) : 'Pasang batas belanja supaya uang tidak bocor.'}</small>${bL ? meter(pc(bS, bL)) : g0 ? meter(pc(got(g0), +g0.target)) : ''}</div><button class="fn-btn" data-a="godom" data-v="${bL || !g0 ? 'bud' : 'goal'}">${bL || g0 ? 'Lihat' : 'Atur'}</button></section>
    <div class="fn-sec"><h3>Transaksi terbaru</h3><button class="fn-lnk" data-a="tab" data-t="riw">Riwayat →</button></div>
    ${recent.length ? recent.map(txRow).join('') : empty('Belum ada transaksi. Pilih kategori di Katalog lalu catat.')}</aside></div>`;
  }
  function menu() {
    const L = expCats();
    return `<p class="fn-hint">Pilih <b>kategori</b>, lalu isi sendiri nama item, harga, jumlah &amp; label (Penting, Mendesak, Hiburan, dll). Kategori bisa kamu ubah lewat tombol ✎.</p>
    <div class="fn-grid" id="fng">${L.map(katCard).join('')}<button class="fn-it fn-kc fn-new" data-a="add" data-e="cat"><span class="fn-art">＋</span><b>Kategori baru</b><small>Mis. Minuman, Parkir, Donasi</small></button></div>
    <div class="fn-two"><button class="fn-btn ghost" data-a="godom" data-v="cat">🏷️ Atur label prioritas</button></div>
    ${cartN() ? `<button class="fn-pill" data-a="cart">${I.cart}<span>${cartN()} item</span><b>${rp(cartT())}</b></button>` : ''}`;
  }
  function riw() {
    let h = seg('riw', [['tx', 'Transaksi'], ['rcp', 'Resi']]);
    if (st.sub.riw === 'rcp') {
      const L = D.rcp.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      return h + (L.length ? '<div class="fn-lst">' + L.map(r => `<article class="fn-rc"><div><b>${esc(r.no)}</b><small>${fd(r.date)} ${esc(r.time)} · ${r.items.length} item · ${esc(an(r.accId))}</small></div><strong>${rp(r.total)}</strong><div class="fn-acts"><button class="fn-btn sm" data-a="rcp" data-id="${r.id}">Lihat</button><button class="fn-btn sm ghost" data-a="png" data-id="${r.id}">Unduh PNG</button></div></article>`).join('') + '</div>' : empty('Belum ada resi. Resi dibuat otomatis setiap kali kamu mencatat keranjang.', '<button class="fn-btn" data-a="tab" data-t="menu">Pilih pengeluaran</button>'));
    }
    const L = D.tx.filter(t => t.date.slice(0, 7) === st.m && (!st.tt || t.type === st.tt)).sort((a, b) => b.date.localeCompare(a.date));
    let i = 0, o = 0; L.forEach(t => { if (t.type === 'Income') i += +t.amount; if (t.type === 'Expense') o += +t.amount; });
    return h + mon() + `<div class="fn-sum"><div><small>Masuk</small><b class="pos">${rp(i)}</b></div><div><small>Keluar</small><b class="neg">${rp(o)}</b></div><div><small>Bersih</small><b>${i - o < 0 ? '−' : ''}${rp(Math.abs(i - o))}</b></div></div>
    <div class="fn-chips">${[['', 'Semua'], ['Income', 'Pemasukan'], ['Expense', 'Pengeluaran'], ['Transfer', 'Transfer']].map(([v, l]) => `<button aria-pressed="${st.tt === v}" data-a="tt" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="fn-two"><button class="fn-btn" data-a="add" data-e="tx">+ Transaksi</button><button class="fn-btn ghost" data-a="csv">Ekspor CSV</button></div>
    ${L.length ? '<div class="fn-lst">' + L.map(txRow).join('') + '</div>' : empty('Tidak ada transaksi di bulan ini.')}`;
  }
  const NETL = { visa: '<i class="atm-visa">VISA</i>', mc: '<i class="atm-mc"><u></u><u></u></i>', gpn: '<i class="atm-gpn">GPN</i>' };
  const NETD = { Bank: 'visa', Tabungan: 'gpn', 'Rekening lain': 'mc' };
  function atm(a, h) {
    const t = a.type === 'E-wallet' ? 'ew' : a.type === 'Cash' ? 'cs' : 'bk', neg = bal(a) < 0, net = NETL[a.net === 'none' ? '' : a.net || NETD[a.type]] || '';
    const dg = String(a.no || '').replace(/\D/g, ''), no = dg ? (dg.length > 4 ? '•••• •••• •••• ' + dg.slice(-4) : dg) : '•••• •••• •••• ••••', plain = a.img && a.ov === 'off';
    return `<button class="atm t-${t} c${h % 6} ${a.img ? 'has-img' : ''} ${plain ? 'plain' : ''} ${a.active ? '' : 'off'}" data-a="edit" data-e="acc" data-id="${a.id}" aria-label="${esc(a.name)}">
      ${a.img ? `<img class="atm-bg" src="${esc(a.img)}" alt="">` : '<span class="atm-pat"></span>'}<span class="atm-sh"></span>
      ${plain ? '' : `<span class="atm-top"><em>${esc(a.name)}${a.active ? '' : ' · nonaktif'}</em><small>${esc(a.type)}</small></span>
      <span class="atm-mid"><i class="atm-chip"></i><svg class="atm-nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 7a7 7 0 0 1 0 10M12 4.5a11 11 0 0 1 0 15M16 2a15 15 0 0 1 0 20"/></svg></span>
      <span class="atm-no">${no}</span>
      <span class="atm-bot"><span><small>PEMEGANG</small><strong>${esc((a.holder || '').toUpperCase() || '—')}</strong></span>${net}</span>`}
      <b class="atm-bal ${neg ? 'neg' : ''}"><small>Saldo</small>${neg ? '−' : ''}${rp(Math.abs(bal(a)))}</b></button>`;
  }
  function dom() {
    let h = seg('dom', [['acc', 'Akun'], ['bud', 'Anggaran'], ['goal', 'Tabungan'], ['cat', 'Kategori']]); const s = st.sub.dom;
    if (s === 'acc') {
      const act = D.acc.filter(a => a.active), total = act.reduce((a, x) => a + bal(x), 0);
      return h + `<div class="fn-sum one"><div><small>Total saldo · ${act.length} akun aktif</small><b>${rp(total)}</b></div></div><div class="fn-two"><button class="fn-btn" data-a="add" data-e="acc">+ Akun</button></div>` +
        (D.acc.length ? '<div class="atm-grid">' + D.acc.map((a, k) => atm(a, k)).join('') + '</div>' : empty('Belum ada akun. Tambahkan Cash, Bank, atau E-wallet dulu.'));
    }
    if (s === 'bud') {
      const eb = expBy(st.m), rows = expCats().map(c => ({ c, b: budFor(c.id, st.m) })).filter(x => x.b);
      return h + mon() + '<div class="fn-two"><button class="fn-btn" data-a="add" data-e="bud">+ Anggaran</button></div>' + (rows.length ? '<div class="fn-lst">' + rows.map(({ c, b }) => { const sp = eb[c.id] || 0, p = pc(sp, +b.limit); return `<button class="fn-bud" data-a="edit" data-e="bud" data-id="${b.id}"><i class="fn-ico">${cic(c)}</i><div><b>${esc(c.name)}</b><small>${rp(sp)} / ${rp(b.limit)}${b.month ? '' : ' · tiap bulan'}</small>${meter(p)}</div><em class="${p >= 100 ? 'neg' : ''}">${Math.round(p)}%</em></button>`; }).join('') + '</div>' : empty('Belum ada anggaran untuk ' + mlab(st.m) + '.'));
    }
    if (s === 'goal') {
      return h + '<div class="fn-two"><button class="fn-btn" data-a="add" data-e="goal">+ Target</button></div>' + (D.goal.length ? '<div class="fn-lst">' + D.goal.map(g => { const c = got(g), p = pc(c, +g.target), left = g.date ? Math.round((new Date(g.date) - new Date(today())) / 864e5) : null; return `<article class="fn-goal"><button data-a="edit" data-e="goal" data-id="${g.id}"><b>${esc(g.name)}</b><span class="fn-tag">${esc(g.status)}</span><small>${rp(c)} dari ${rp(g.target)} · ${Math.round(p)}%${left != null ? ' · ' + (left >= 0 ? left + ' hari lagi' : 'lewat ' + (-left) + ' hari') : ''}</small>${meter(Math.min(p, 99.9))}</button><button class="fn-btn sm" data-a="add" data-e="con" data-pk="goalId" data-pv="${g.id}">+ Setor</button></article>`; }).join('') + '</div>' : empty('Belum ada target tabungan.'));
    }
    return h + '<div class="fn-two"><button class="fn-btn" data-a="add" data-e="cat">+ Kategori</button><button class="fn-btn ghost" data-a="add" data-e="tag">+ Label</button></div>' + ['Pengeluaran', 'Pemasukan'].map(k => `<div class="fn-sec"><h3>${k}</h3></div>` + '<div class="fn-lst">' + D.cat.filter(c => c.kind === k).map(c => `<button class="fn-row ${c.archived ? 'off' : ''}" data-a="edit" data-e="cat" data-id="${c.id}"><i class="fn-ico">${cic(c)}</i><div><b>${esc(c.name)}</b>${c.archived ? '<small>Diarsipkan</small>' : ''}</div></button>`).join('') + '</div>').join('') +
      '<div class="fn-sec"><h3>Label prioritas</h3></div><p class="fn-hint">Dipakai saat mencatat pengeluaran, mis. Penting, Mendesak, Hiburan. Sesuaikan dengan caramu menyusun anggaran.</p><div class="fn-lst">' + (D.tag.length ? D.tag.map(t => `<button class="fn-row" data-a="edit" data-e="tag" data-id="${t.id}"><i class="fn-ico">${tgi(t)}</i><div><b>${esc(t.name)}</b></div></button>`).join('') : '<div class="fn-empty"><p>Belum ada label.</p></div>') + '</div>';
  }
  const VIEWS = { home, menu, riw, dom, ana: () => (X.views.ana ? X.views.ana() : empty('Modul analisis belum termuat.')) };
  const TT = { home: 'Beranda', menu: 'Katalog', ana: 'Analisis Keuangan', riw: 'Riwayat', dom: 'Dompet' };
  function paintBrand() {
    const b = D.brand || {};
    R.querySelectorAll('.fn-logo').forEach(e => { e.innerHTML = b.img ? '<img class="fn-im" src="' + b.img + '" alt="">' : (window.MOBrandIcon ? MOBrandIcon('fin') : 'Rp'); });
    R.querySelectorAll('[data-bn]').forEach(e => { e.textContent = b.name || 'Beresin Finance'; });
    R.querySelectorAll('[data-bt]').forEach(e => { e.textContent = b.tag || 'Catat hemat, hidup tenang'; });
  }
  function render() {
    const top = V.scrollTop;
    window.__morph(V, VIEWS[st.tab]()); if (top) V.scrollTop = top;
    const n = cartN(), tabs = [['home', 'Beranda', I.home], ['menu', 'Katalog', I.menu], ['cart'], ['ana', 'Analisis', I.ana], ['riw', 'Riwayat', I.rcp, 'sb'], ['dom', 'Dompet', I.wal]];
    window.__morph(NAV, '<div class="fn-sbb"><button class="fn-logo" data-a="brand" aria-label="Ubah logo dan nama">' + (window.MOBrandIcon ? MOBrandIcon('fin') : 'Rp') + '</button><div><b data-bn></b><small data-bt></small></div></div>' +
      tabs.map(t => t[0] === 'cart' ? `<button class="fn-fab" data-a="cart" aria-label="Keranjang, ${n} item">${I.cart}<span class="fn-fl">Keranjang</span>${n ? `<i>${n}</i>` : ''}</button>` : `<button class="${t[3] || ''}" data-a="tab" data-t="${t[0]}" aria-current="${st.tab === t[0]}">${t[2]}<span>${t[1]}</span></button>`).join(''));
    const tt = R.querySelector('.fn-ttl'); if (tt) tt.textContent = TT[st.tab] || '';
    paintBrand();
  }

  /* ---------- sheet ---------- */
  const sheet = h => { SH.innerHTML = '<div class="fn-card-sh" role="dialog" aria-modal="true">' + h + '</div>'; SH.hidden = false; const f = SH.querySelector('input,select,textarea'); if (f) f.focus(); };
  const closeSh = () => { SH.hidden = true; SH.innerHTML = ''; };
  const shHead = t => `<header><h2>${t}</h2><button type="button" data-a="xsh" aria-label="Tutup">${I.x}</button></header>`;
  const ask = (t, msg, ok, fn) => { ask.fn = fn; sheet(shHead(t) + `<p class="fn-p">${msg}</p><footer><button type="button" class="fn-btn ghost" data-a="xsh">Batal</button><button type="button" class="fn-btn" data-a="yes">${ok}</button></footer>`); };

  /* ---------- form entitas ---------- */
  const O = a => a.map(x => [x, x]), AT = ['Cash', 'Bank', 'E-wallet', 'Tabungan', 'Rekening lain'], PM = ['Tunai', 'Transfer bank', 'QRIS', 'Kartu debit', 'Kartu kredit', 'E-wallet', 'Lainnya'];
  const accO = v => [['', '— Pilih akun —']].concat(D.acc.filter(a => a.active || a.id === v).map(a => [a.id, a.name + ' (' + a.type + ')']));
  const catO = (kind, v) => [['', '— Pilih kategori —']].concat(D.cat.filter(c => (!kind || c.kind === kind) && (!c.archived || c.id === v)).map(c => [c.id, (kind ? '' : c.kind + ' · ') + c.name]));
  const SP = {
    acc: { t: 'Akun', def: { type: 'Cash', currency: 'IDR', opening: 0, active: true }, f: [['name', 'Nama akun', 'text', 0, 1, 1], ['type', 'Jenis', 'select', O(AT)], ['holder', 'Nama di kartu', 'text', 0, 0, 0], ['no', 'Nomor kartu / rekening (opsional)', 'text'], ['net', 'Logo jaringan', 'select', [['', 'Otomatis'], ['visa', 'Visa'], ['mc', 'Mastercard'], ['gpn', 'GPN'], ['none', 'Tanpa logo']]], ['img', 'Gambar kartu (foto ATM / dompet)', 'cimg'], ['ov', 'Teks & chip di atas gambar', 'select', [['', 'Tampilkan'], ['off', 'Sembunyikan (gambar polos)']]], ['opening', 'Saldo awal (Rp)', 'number'], ['active', 'Status', 'bool', [['true', 'Aktif'], ['false', 'Nonaktif']]]] },
    tx: { t: 'Transaksi', def: { type: 'Expense', date: today(), scope: 'Pribadi' }, f: [['date', 'Tanggal', 'date', 0, 1], ['type', 'Jenis', 'select', O(['Income', 'Expense', 'Transfer']), 1], ['amount', 'Jumlah (Rp)', 'number', 0, 1], ['accId', 'Akun (asal)', 'select', accO, 1], ['toAccId', 'Akun tujuan (Transfer)', 'select', accO], ['catId', 'Kategori', 'select', v => catO('', v)], ['tagId', 'Label prioritas', 'select', v => [['', '— Tanpa label —']].concat(D.tag.map(t => [t.id, t.name]))], ['desc', 'Deskripsi', 'text', 0, 0, 1], ['method', 'Metode', 'select', [['', '—']].concat(O(PM))], ['scope', 'Cakupan', 'select', O(['Pribadi', 'Pekerjaan'])], ['notes', 'Catatan', 'textarea', 0, 0, 1]] },
    cat: { t: 'Kategori', def: { kind: 'Pengeluaran', archived: false }, f: [['name', 'Nama kategori', 'text', 0, 1, 1], ['icon', 'Ikon (emoji)', 'text'], ['img', 'Logo / gambar kategori', 'img'], ['kind', 'Jenis', 'select', O(['Pemasukan', 'Pengeluaran'])], ['archived', 'Status', 'bool', [['false', 'Aktif'], ['true', 'Diarsipkan']]]] },
    tag: { t: 'Label prioritas', def: {}, f: [['name', 'Nama label', 'text', 0, 1, 1], ['icon', 'Emoji (opsional)', 'text']] },
    bud: { t: 'Anggaran', def: { month: st.m }, f: [['catId', 'Kategori pengeluaran', 'select', v => catO('Pengeluaran', v), 1, 1], ['limit', 'Batas (Rp)', 'number', 0, 1], ['month', 'Bulan (kosong = tiap bulan)', 'month']] },
    goal: { t: 'Target tabungan', def: { status: 'Aktif' }, f: [['name', 'Nama target', 'text', 0, 1, 1], ['target', 'Jumlah target (Rp)', 'number', 0, 1], ['date', 'Target tanggal', 'date'], ['status', 'Status', 'select', O(['Aktif', 'Tercapai', 'Dibatalkan'])]] },
    con: { t: 'Setoran', def: { date: today() }, f: [['goalId', 'Target', 'select', () => [['', '— Pilih —']].concat(D.goal.map(g => [g.id, g.name])), 1, 1], ['date', 'Tanggal', 'date', 0, 1], ['amount', 'Jumlah (Rp, negatif = tarik)', 'number', 0, 1], ['notes', 'Catatan', 'text', 0, 0, 1]] }
  };
  const fld = ([k, l, t, o, req, full], v) => {
    const at = `name="${k}"${req ? ' required' : ''}`;
    let i; if (t === 'img') return imgFld(k, l, v); if (t === 'cimg') return imgFld(k, l, v, 0, 1); if (t === 'textarea') i = `<textarea ${at} rows="2">${esc(v)}</textarea>`;
    else if (t === 'select' || t === 'bool') { const L = typeof o === 'function' ? o(v) : o; if (t === 'bool') v = String(!!v); i = `<select ${at}>${L.map(p => `<option value="${esc(p[0])}"${String(p[0]) === String(v) ? ' selected' : ''}>${esc(p[1])}</option>`).join('')}</select>`; }
    else i = `<input ${at} type="${t}" value="${esc(v)}"${t === 'number' ? ' step="any"' : ''}>`;
    return `<label class="${full ? 'full' : ''}"><span>${l}${req ? ' *' : ''}</span>${i}</label>`;
  };
  function imgFld(k, l, v, fit, card) {
    return `<div class="full fn-imf" data-img${card ? ' data-card' : ''}><span>${l}</span><div class="fn-imr"><div class="fn-imp">${v ? '<img src="' + esc(v) + '" alt="">' : '<em>Belum ada</em>'}</div><div class="fn-imb"><div class="fn-ibt"><button type="button" class="fn-btn sm" data-a="pickimg">${I.cam} Pilih gambar</button><button type="button" class="fn-btn sm ghost dng" data-a="rmimg">Hapus</button></div>${card ? '<input type="checkbox" data-fit hidden><small>Foto kartu ATM / dompet digital / buku tabungan (rasio kartu 85,6×54 mm). Kosong = desain otomatis.</small>' : `<label class="fn-chk"><input type="checkbox" data-fit${fit ? ' checked' : ''}> Muat utuh tanpa dipotong (cocok untuk logo)</label><small>JPG, PNG, WebP atau SVG. Kosong = pakai emoji.</small>`}</div></div><input type="file" accept="image/*" data-img-in hidden><input type="hidden" name="${k}" value="${esc(v)}"></div>`;
  }
  function toSquare(file, fit, cb) {
    const fr = new FileReader();
    fr.onerror = () => MO.msg('Gagal', 'File gambar tidak bisa dibaca.');
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => MO.msg('Gagal', 'Format gambar tidak didukung.');
      im.onload = () => {
        const w = im.naturalWidth || 256, h = im.naturalHeight || 256, S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        if (fit) { const k = Math.min(S / w, S / h); g.drawImage(im, (S - w * k) / 2, (S - h * k) / 2, w * k, h * k); }
        else { const m = Math.min(w, h); g.drawImage(im, (w - m) / 2, (h - m) / 2, m, m, 0, 0, S, S); }
        const keepAlpha = fit || /png|svg|webp|gif/.test(file.type);
        cb(c.toDataURL(keepAlpha ? 'image/webp' : 'image/jpeg', .86));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function toCard(file, cb) {
    const fr = new FileReader();
    fr.onerror = () => MO.msg('Gagal', 'File gambar tidak bisa dibaca.');
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => MO.msg('Gagal', 'Format gambar tidak didukung.');
      im.onload = () => {
        const w = im.naturalWidth || 856, h = im.naturalHeight || 540, R = 856 / 540, W = 720, H = Math.round(W / R), c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        let sw = w, sh = w / R; if (sh > h) { sh = h; sw = h * R; }
        g.drawImage(im, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, W, H);
        cb(c.toDataURL('image/jpeg', .86));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function brandSheet() {
    const b = D.brand || {};
    sheet(shHead('Logo & nama aplikasi') + `<form data-f="brand"><div class="fn-flds"><label class="full"><span>Nama</span><input name="name" value="${esc(b.name || '')}" placeholder="Beresin Finance" maxlength="40"></label><label class="full"><span>Slogan</span><input name="tag" value="${esc(b.tag || '')}" placeholder="Catat hemat, hidup tenang" maxlength="60"></label>${imgFld('img', 'Logo', b.img || '', true)}</div><footer><button type="button" class="fn-btn ghost dng" data-a="rstbrand">Reset</button><button class="fn-btn">Simpan</button></footer></form>`);
  }
  function form(e, id, pre) {
    const sp = SP[e], it = id ? by(D[e], id) : Object.assign({}, sp.def, pre || {});
    sheet(shHead((id ? 'Ubah ' : 'Tambah ') + sp.t) + `<form data-f="ent" data-e="${e}" data-id="${id || ''}"><div class="fn-flds">${sp.f.map(f => fld(f, it[f[0]] == null ? '' : it[f[0]])).join('')}</div><footer>${id ? '<button type="button" class="fn-btn ghost dng" data-a="del" data-e="' + e + '" data-id="' + id + '">Hapus</button>' : ''}<button class="fn-btn">Simpan</button></footer></form>`);
  }
  function canDel(e, id) {
    if (e === 'acc' && D.tx.some(t => t.accId === id || t.toAccId === id)) return 'Akun ini punya transaksi. Ubah statusnya jadi nonaktif.';
    if (e === 'cat' && (D.tx.some(t => t.catId === id) || D.bud.some(b => b.catId === id))) return 'Kategori ini masih dipakai. Arsipkan saja.';
  }
  function validate(e, r) {
    if (e === 'tx') {
      if (!(+r.amount > 0)) return 'Jumlah harus lebih dari 0.';
      if (r.type === 'Transfer') { if (!r.toAccId) return 'Pilih akun tujuan.'; if (r.toAccId === r.accId) return 'Akun asal dan tujuan tidak boleh sama.'; r.catId = ''; }
      else { const c = by(D.cat, r.catId); if (!c) return 'Pilih kategori.'; if (c.kind !== (r.type === 'Income' ? 'Pemasukan' : 'Pengeluaran')) return 'Kategori "' + c.name + '" tidak cocok dengan jenis transaksi.'; r.toAccId = ''; }
    }
    if (e === 'bud' && !(+r.limit > 0)) return 'Batas anggaran harus lebih dari 0.';
    if (e === 'goal' && !(+r.target > 0)) return 'Jumlah target harus lebih dari 0.';
    if (e === 'tag' && D.tag.some(t => t.id !== r.id && t.name.toLowerCase() === String(r.name).toLowerCase())) return 'Label dengan nama itu sudah ada.';
    if (e === 'cat' && D.cat.some(c => c.id !== r.id && c.kind === r.kind && c.name.toLowerCase() === String(r.name).toLowerCase())) return 'Kategori dengan nama itu sudah ada.';
    if (e === 'con' && !(+r.amount)) return 'Jumlah tidak boleh 0.';
  }
  function onEnt(f) {
    const e = f.dataset.e, id = f.dataset.id, sp = SP[e], it = id ? by(D[e], id) : null, rec = it ? Object.assign({}, it) : { id: uid() };
    sp.f.forEach(([k, , t]) => { const v = f.elements[k].value.trim(); rec[k] = t === 'bool' ? v === 'true' : t === 'number' ? (v === '' ? '' : +v) : v; });
    const err = validate(e, rec); if (err) return MO.msg('Periksa data', err);
    if (it) Object.assign(it, rec); else D[e].push(rec);
    save(); closeSh(); render();
  }

  /* ---------- keranjang & resi ---------- */
  const lineOf = k => D.cart.find(l => l.k === k);
  function inc(k, d) { const l = lineOf(k); if (!l) return; l.qty += d; if (l.qty <= 0) D.cart = D.cart.filter(x => x !== l); save(); }
  const nameHist = cid => { const o = {}; D.tx.forEach(t => { if (t.type === 'Expense' && t.catId === cid && t.desc) { const n = t.desc.replace(/ ×\d+$/, ''); o[n] = (o[n] || 0) + 1; } }); return Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 12); };
  function pickSheet(cid) {
    const c = by(D.cat, cid); if (!c) return;
    const tags = D.tag.length ? `<div class="full fn-tgs" role="radiogroup" aria-label="Label prioritas"><span>Label prioritas</span><div><label class="fn-tgo"><input type="radio" name="tagId" value="" checked><b>Tanpa label</b></label>${D.tag.map(t => `<label class="fn-tgo" style="--h:${hue(t.name)}"><input type="radio" name="tagId" value="${t.id}"><b>${tgi(t)} ${esc(t.name)}</b></label>`).join('')}</div></div>` : '';
    sheet(shHead(`<span class="fn-ph"><i class="fn-ico">${cic(c)}</i>${esc(c.name)}</span>`) + `<form data-f="pick" data-id="${c.id}"><div class="fn-flds"><label class="full"><span>Nama item *</span><input name="name" required maxlength="80" autocomplete="off" list="fn-nh" placeholder="Isi sendiri, mis. ${c.name === 'Makanan' ? 'Nasi goreng' : c.name === 'Minuman' ? 'Es teh' : 'Nama item'}"><datalist id="fn-nh">${nameHist(c.id).map(n => `<option value="${esc(n)}">`).join('')}</datalist></label><label><span>Harga satuan (Rp) *</span><input type="number" name="price" min="1" step="any" inputmode="decimal" required placeholder="0"></label><label><span>Jumlah</span><input type="number" name="qty" min="1" step="1" inputmode="numeric" value="1"></label>${tags}<label class="full"><span>Keterangan (opsional)</span><input name="note" maxlength="120" placeholder="Mis. buat rapat, patungan, diskon"></label></div><div class="fn-tot"><span>Subtotal</span><b data-sub>${rp(0)}</b></div><footer><button type="submit" class="fn-btn ghost" data-go="more">+ Tambah lagi</button><button type="submit" class="fn-btn" data-go="cart">Lanjut ke keranjang</button></footer></form>`);
  }
  function cartSheet() {
    if (!D.cart.length) return sheet(shHead('Keranjang') + empty('Keranjang kosong. Pilih kategori di Katalog dulu.', '<button class="fn-btn" data-a="gomenu">Buka Katalog</button>'));
    const act = D.acc.filter(a => a.active);
    sheet(shHead('Keranjang pengeluaran') + `<form data-f="cart"><div class="fn-lines">${D.cart.map(l => `<div class="fn-ln"><i class="fn-ico">${cic(by(D.cat, l.catId))}</i><div><b>${esc(l.name)}</b><small>${esc(cn(l.catId))} · ${rp(l.price)}${l.tagId && tg(l.tagId) ? ' · ' + esc(tg(l.tagId).name) : ''}${l.note ? ' · ' + esc(l.note) : ''}</small></div><div class="fn-st"><button type="button" data-a="cdec" data-k="${l.k}" aria-label="Kurangi">−</button><i>${l.qty}</i><button type="button" data-a="cinc" data-k="${l.k}" aria-label="Tambah">+</button></div><strong>${rp(l.price * l.qty)}</strong></div>`).join('')}</div>
    <button type="button" class="fn-btn ghost sm" data-a="gomenu" style="margin-bottom:14px">+ Tambah item lain</button>
    <div class="fn-flds"><label class="full"><span>Dibayar dari *</span><select name="accId" required>${act.length ? act.map(a => `<option value="${a.id}">${esc(a.name)} · ${rp(bal(a))}</option>`).join('') : '<option value="">Belum ada akun aktif</option>'}</select></label><label><span>Tanggal</span><input type="date" name="date" value="${today()}" required></label><label><span>Metode</span><select name="method">${PM.map(p => `<option>${p}</option>`).join('')}</select></label><label><span>Cakupan</span><select name="scope"><option>Pribadi</option><option>Pekerjaan</option></select></label><label><span>Catatan</span><input type="text" name="note" placeholder="Opsional"></label></div>
    <div class="fn-tot"><span>Total</span><b>${rp(cartT())}</b></div><footer><button type="button" class="fn-btn ghost" data-a="clear">Kosongkan</button><button class="fn-btn"${act.length ? '' : ' disabled'}>Catat &amp; buat resi</button></footer></form>`);
  }
  function checkout(f) {
    const a = D.acc.find(x => x.id === f.elements.accId.value); if (!a) return MO.msg('Pilih akun', 'Tambahkan akun aktif di Dompet.');
    const date = f.elements.date.value || today(), n = D.rcp.filter(r => r.date === date).length + 1, rid = uid(), now = new Date();
    const r = { id: rid, no: 'RS-' + date.replace(/-/g, '') + '-' + String(n).padStart(3, '0'), date, time: pad(now.getHours()) + ':' + pad(now.getMinutes()), accId: a.id, method: f.elements.method.value, scope: f.elements.scope.value, note: f.elements.note.value.trim(), items: D.cart.map(l => ({ name: l.name, qty: l.qty, price: l.price, catId: l.catId, tagId: l.tagId || '', note: l.note || '' })), total: cartT() };
    D.cart.forEach(l => { D.tx.push({ id: uid(), type: 'Expense', date, amount: l.qty * l.price, accId: a.id, catId: l.catId, tagId: l.tagId || '', desc: l.name + (l.qty > 1 ? ' ×' + l.qty : ''), notes: l.note || '', method: r.method, scope: r.scope, rcpId: rid }); });
    D.rcp.push(r); D.cart = []; save(); render(); showRcp(r, true);
  }
  const recRows = r => {
    const o = [['No. resi', r.no], ['Tanggal', fd(r.date) + ' ' + r.time], ['Akun', an(r.accId)], ['Metode', r.method || '—'], ['-']];
    r.items.forEach(i => { const t = i.tagId && tg(i.tagId); o.push([i.name + (t ? ' [' + t.name + ']' : ''), '', 'b']); o.push(['  ' + i.qty + ' x ' + Math.round(i.price).toLocaleString('id-ID'), rp(i.price * i.qty)]); if (i.note) o.push(['  ' + i.note, '', 'i']); });
    o.push(['-']); o.push(['TOTAL', rp(r.total), 't']); if (r.note) { o.push(['-']); o.push(['Catatan: ' + r.note, '', 'i']); } return o;
  };
  function showRcp(r, fresh) {
    const bars = r.no.split('').map((c, i) => `<i style="width:${1 + (c.charCodeAt(0) + i) % 4}px"></i>`).join('');
    sheet(shHead(fresh ? 'Tercatat! Ini resimu' : 'Resi') + `<div class="fn-paper"><div class="fn-tear"></div><h4>${esc(bnm())}</h4><p class="c">Resi pengeluaran</p>${recRows(r).map(([a, b, o]) => a === '-' ? '<hr>' : `<div class="r ${o || ''}"><span>${esc(a)}</span><span>${esc(b || '')}</span></div>`).join('')}<div class="bc">${bars}</div><p class="c">Terima kasih. Tetap hemat!</p><div class="fn-tear b"></div></div><footer><button class="fn-btn ghost" data-a="print">${I.pr} Cetak / PDF</button><button class="fn-btn" data-a="png" data-id="${r.id}">${I.dl} Unduh PNG</button></footer>`);
  }
  const dl = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };
  function png(r) {
    const rows = recRows(r), S = 2, W = 520, LH = 28, H = 150 + rows.length * LH + 130, c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    const g = c.getContext('2d'); g.scale(S, S); g.fillStyle = '#fffaf2'; g.fillRect(0, 0, W, H); g.fillStyle = '#d92b2b'; g.fillRect(0, 0, W, 100);
    g.fillStyle = '#fff3e6'; g.textAlign = 'center'; g.font = '800 30px "Baloo 2",Arial,sans-serif'; g.fillText(bnm().slice(0, 28), W / 2, 52); g.font = '700 13px Arial'; g.fillText('RESI PENGELUARAN', W / 2, 78);
    let y = 146;
    rows.forEach(([a, b, o]) => {
      if (a === '-') { g.strokeStyle = '#cdb9a8'; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(32, y - 9); g.lineTo(W - 32, y - 9); g.stroke(); g.setLineDash([]); }
      else { g.fillStyle = o === 'i' ? '#8a7a70' : '#2b1c1c'; g.font = (o === 'b' || o === 't' ? '700 ' : '') + (o === 't' ? '20px' : '15px') + ' "Courier New",monospace'; g.textAlign = 'left'; g.fillText(a.slice(0, 40), 32, y); g.textAlign = 'right'; g.fillText(b || '', W - 32, y); }
      y += LH;
    });
    let x = 32; g.fillStyle = '#2b1c1c'; r.no.split('').forEach((ch, i) => { const w = 1 + (ch.charCodeAt(0) + i) % 4; g.fillRect(x, y + 6, w, 40); x += w + 3; });
    g.textAlign = 'center'; g.fillStyle = '#8a7a70'; g.font = '14px Arial'; g.fillText('Terima kasih. Tetap hemat!', W / 2, y + 78);
    c.toBlob(b => dl(b, r.no + '.png'));
  }
  function csv() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', rows = [['Tanggal', 'Jenis', 'Kategori', 'Akun', 'Deskripsi', 'Jumlah', 'Metode', 'Cakupan', 'Label', 'Keterangan', 'Resi']].concat(D.tx.slice().sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.type, cn(t.catId), an(t.accId), t.desc || '', t.amount, t.method || '', t.scope || '', (tg(t.tagId) || {}).name || '', t.notes || '', (by(D.rcp, t.rcpId) || {}).no || '']));
    dl(new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' }), 'transaksi-myoffice.csv');
  }

  /* ---------- event ---------- */
  const A = {
    close() { R.hidden = true; document.body.style.overflow = ''; }, xsh: closeSh,
    tab(d) { st.tab = d.t; render(); V.scrollTop = 0; },
    sub(d) { st.sub[d.k] = d.v; render(); }, goriw() { st.tab = 'riw'; st.sub.riw = 'rcp'; render(); }, gomenu() { closeSh(); st.tab = 'menu'; render(); },
    godom(d) { st.tab = 'dom'; st.sub.dom = d.v; render(); V.scrollTop = 0; },
    mon(d) { st.m = addM(st.m, +d.d); render(); }, tt(d) { st.tt = d.v; render(); },
    pick(d) { pickSheet(d.id); },
    cinc(d) { inc(d.k, 1); render(); cartSheet(); }, cdec(d) { inc(d.k, -1); render(); cartSheet(); },
    cart() { cartSheet(); }, clear() { D.cart = []; save(); render(); closeSh(); },
    add(d) {
      if (d.e === 'tx' && !D.acc.some(a => a.active)) return MO.msg('Belum ada akun aktif', 'Tambahkan akun dulu di Dompet.');
      if (d.e === 'con' && !D.goal.length) return MO.msg('Belum ada target', 'Buat target tabungan dulu.');
      form(d.e, null, d.pk ? { [d.pk]: d.pv } : null);
    },
    edit(d) { form(d.e, d.id); },
    del(d) {
      const b = canDel(d.e, d.id); if (b) return MO.msg('Tidak bisa dihapus', b);
      ask('Hapus data?', 'Data yang dihapus tidak bisa dikembalikan.', 'Ya, hapus', () => { if (d.e === 'goal') D.con = D.con.filter(c => c.goalId !== d.id); D[d.e] = D[d.e].filter(x => x.id !== d.id); save(); closeSh(); render(); });
    },
    yes() { const f = ask.fn; ask.fn = null; if (f) f(); },
    rcp(d) { showRcp(by(D.rcp, d.id)); }, png(d) { png(by(D.rcp, d.id)); }, csv,
    print() { window.print(); },
    rng(d) { st.rng = +d.v; render(); }, brand() { brandSheet(); },
    rstbrand() { D.brand = {}; save(); paintBrand(); closeSh(); },
    pickimg(d, b) { const w = b.closest('[data-img]'); if (w) w.querySelector('[data-img-in]').click(); },
    rmimg(d, b) { const w = b.closest('[data-img]'); if (!w) return; w.querySelector('input[type=hidden]').value = ''; w.querySelector('.fn-imp').innerHTML = '<em>Belum ada</em>'; }
  };
  R.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && R.contains(b) && A[b.dataset.a]) A[b.dataset.a](b.dataset, b); else if (e.target === SH) closeSh(); });
  R.addEventListener('submit', e => {
    e.preventDefault(); const f = e.target;
    if (f.dataset.f === 'ent') onEnt(f);
    else if (f.dataset.f === 'brand') { D.brand = { name: f.elements.name.value.trim(), tag: f.elements.tag.value.trim(), img: f.elements.img.value }; save(); paintBrand(); closeSh(); }
    else if (f.dataset.f === 'cart') checkout(f);
    else if (f.dataset.f === 'pick') {
      const go = (e.submitter && e.submitter.dataset.go) || 'cart', nm = f.elements.name.value.trim(), pr = +f.elements.price.value, q = Math.max(1, Math.round(+f.elements.qty.value || 1)), c = by(D.cat, f.dataset.id);
      if (!nm) return MO.msg('Periksa data', 'Isi nama item.'); if (!(pr > 0)) return MO.msg('Periksa data', 'Harga harus lebih dari 0.');
      const tid = (f.querySelector('input[name=tagId]:checked') || {}).value || '';
      D.cart.push({ k: 'c' + uid(), name: nm, catId: c.id, price: pr, qty: q, tagId: tid, note: f.elements.note.value.trim() }); save(); render();
      if (go === 'more') pickSheet(c.id); else cartSheet();
    }
  });
  R.addEventListener('change', e => {
    const t = e.target; if (!t.matches || !t.matches('[data-img-in]') || !t.files || !t.files[0]) return;
    const w = t.closest('[data-img]'), fit = w.querySelector('[data-fit]').checked;
    (w.hasAttribute('data-card') ? (f, _, cb) => toCard(f, cb) : toSquare)(t.files[0], fit, url => { w.querySelector('input[type=hidden]').value = url; w.querySelector('.fn-imp').innerHTML = '<img src="' + url + '" alt="">'; t.value = ''; });
  });
  R.addEventListener('input', e => { const f = e.target.form; if (f && f.dataset.f === 'pick' && (e.target.name === 'price' || e.target.name === 'qty')) { const b = f.querySelector('[data-sub]'); if (b) b.textContent = rp((+f.elements.price.value || 0) * Math.max(1, Math.round(+f.elements.qty.value || 1))); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !R.hidden) { if (!SH.hidden) closeSh(); else A.close(); } });
  const X = MO.fin = { D, st, views: {}, addM, mlab, pc, mon, empty, meter, txRow, ci, cic, ic, bal, sum, expBy, budFor, got, expCats, cn, an, total: () => D.acc.filter(a => a.active).reduce((a, x) => a + bal(x), 0) };
  function open() { R.hidden = false; document.body.style.overflow = 'hidden'; render(); R.querySelector('.fn-hb button:last-child').focus(); }
  MO.routes['#finance'] = open;
})();
;
/* MyOffice Finance — Analisis keuangan: KPI, skor kesehatan, grafik SVG, proyeksi, dan insight otomatis.
   Membaca data dari finance.js lewat MyOffice.fin (tidak mengubah data apa pun). */
(function () {
  'use strict';
  const MO = window.MyOffice, X = MO && MO.fin; if (!X) return;
  const K = MO.kit, esc = K.esc, rp = K.rp, by = K.by, fd = K.fd, todayS = K.todayS;
  const D = X.D, st = X.st, pad = n => ('0' + n).slice(-2);
  const PAL = ['#1d5fb4', '#d92b2b', '#f08a3c', '#1f9d8a', '#7a5cc7', '#e0a526', '#2f9e5e', '#d8508a', '#6b3d2a', '#5d7287'];
  const GOOD = '#18814b', WARN = '#e8951a', BAD = '#d92b2b';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dec = x => x.toFixed(1).replace('.', ',').replace(/,0$/, '');
  const nice = v => { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const scale = (mn, mx) => { mn = Math.min(0, mn); mx = Math.max(1, mx); const step = nice((mx - mn) / 4); return { step, lo: Math.floor(mn / step + 1e-9) * step, hi: Math.ceil(mx / step - 1e-9) * step }; };
  const short = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e9 ? s + dec(a / 1e9) + ' M' : a >= 1e6 ? s + dec(a / 1e6) + ' jt' : a >= 1e3 ? s + Math.round(a / 1e3) + ' rb' : s + Math.round(a); };
  const dim = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const mname = (ym, o) => new Date(ym + '-01T00:00:00').toLocaleDateString('id-ID', o || { month: 'short' });
  const lab = (m, i) => (i === 0 || m.slice(5) === '01') ? mname(m) + ' ' + m.slice(2, 4) : mname(m);
  const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const wd = date => (new Date(date + 'T00:00:00').getDay() + 6) % 7;

  /* ---------- perhitungan ---------- */
  function calc() {
    const m = st.m, pm = X.addM(m, -1), cur = todayS().slice(0, 7), ms = [];
    for (let i = st.rng - 1; i >= 0; i--) ms.push(X.addM(m, -i));
    const inc = X.sum('Income', m), exp = X.sum('Expense', m), pinc = X.sum('Income', pm), pexp = X.sum('Expense', pm);
    const net = inc - exp, sr = inc > 0 ? net / inc * 100 : null, total = X.total();
    const e3 = [0, 1, 2].map(i => X.sum('Expense', X.addM(m, -i))).filter(v => v > 0);
    const avgExp = e3.length ? e3.reduce((a, b) => a + b, 0) / e3.length : 0;
    const runway = avgExp > 0 && total > 0 ? total / avgExp : (avgExp > 0 ? 0 : null);
    const eb = X.expBy(m), pb = X.expBy(pm), n = dim(m), isCur = m === cur, dayNow = isCur ? +todayS().slice(8) : (m < cur ? n : 0);
    const daily = Array(n).fill(0);
    D.tx.forEach(t => { if (t.type === 'Expense' && t.date.slice(0, 7) === m) daily[+t.date.slice(8, 10) - 1] += +t.amount || 0; });
    const avgDay = dayNow ? exp / dayNow : 0, proj = isCur ? avgDay * n : exp;
    const buds = X.expCats().map(c => ({ c, b: X.budFor(c.id, m) })).filter(x => x.b).map(x => { const sp = eb[x.c.id] || 0, lim = +x.b.limit || 0; return { c: x.c, sp, lim, p: X.pc(sp, lim) }; });
    const goals = D.goal.filter(g => g.status === 'Aktif').map(g => ({ g, got: X.got(g), p: X.pc(X.got(g), +g.target) }));
    return { m, pm, cur, ms, inc, exp, pinc, pexp, net, sr, total, avgExp, runway, eb, pb, n, isCur, dayNow, daily, avgDay, proj, buds, goals };
  }

  function health(c) {
    const P = [];
    if (c.sr != null) P.push({ k: 'Tingkat tabungan', w: 30, s: clamp(c.sr / 20 * 100, 0, 100), d: Math.round(c.sr) + '% dari pemasukan (target ≥ 20%)' });
    if (c.runway != null) P.push({ k: 'Dana darurat', w: 25, s: clamp(c.runway / 6 * 100, 0, 100), d: dec(c.runway) + ' bulan pengeluaran (ideal ≥ 6)' });
    if (c.buds.length) { const ok = c.buds.filter(b => b.p <= 100).length; P.push({ k: 'Kepatuhan anggaran', w: 20, s: ok / c.buds.length * 100, d: ok + ' dari ' + c.buds.length + ' anggaran aman' }); }
    if (c.pexp > 0 && c.exp >= 0) { const ch = (c.exp - c.pexp) / c.pexp * 100; P.push({ k: 'Tren pengeluaran', w: 15, s: clamp(75 - ch * 2.5, 0, 100), d: (ch > 0 ? 'naik ' : 'turun ') + Math.abs(Math.round(ch)) + '% dari bulan lalu' }); }
    if (c.goals.length) { const a = c.goals.reduce((x, g) => x + g.p, 0) / c.goals.length; P.push({ k: 'Progres target', w: 10, s: clamp(a, 0, 100), d: Math.round(a) + '% rata-rata target aktif' }); }
    if (!P.length) return null;
    const W = P.reduce((a, p) => a + p.w, 0), score = P.reduce((a, p) => a + p.s * p.w, 0) / W;
    const lv = score >= 80 ? ['Sangat sehat', GOOD] : score >= 65 ? ['Sehat', GOOD] : score >= 50 ? ['Cukup, perlu perhatian', WARN] : score >= 35 ? ['Waspada', WARN] : ['Kritis', BAD];
    const sorted = P.slice().sort((a, b) => b.s - a.s);
    return { score, label: lv[0], col: lv[1], P, best: sorted[0], worst: sorted[sorted.length - 1] };
  }

  function balAt(date) {
    const act = new Set(D.acc.filter(a => a.active).map(a => a.id)); let b = 0;
    D.acc.forEach(a => { if (act.has(a.id)) b += +a.opening || 0; });
    D.tx.forEach(t => {
      if (t.date > date) return; const x = +t.amount || 0;
      if (t.type === 'Income') { if (act.has(t.accId)) b += x; }
      else if (t.type === 'Expense') { if (act.has(t.accId)) b -= x; }
      else if (t.type === 'Transfer') { if (act.has(t.accId)) b -= x; if (act.has(t.toAccId)) b += x; }
    });
    return b;
  }

  function weekdayAvg(ms) {
    const a = ms[0] + '-01', last = ms[ms.length - 1], endS = last + '-' + pad(dim(last)), lim = endS > todayS() ? todayS() : endS;
    const tot = Array(7).fill(0), cnt = Array(7).fill(0);
    if (lim < a) return tot;
    for (let d = new Date(a + 'T00:00:00'); ds(d) <= lim; d.setDate(d.getDate() + 1)) cnt[(d.getDay() + 6) % 7]++;
    D.tx.forEach(t => { if (t.type === 'Expense' && t.date >= a && t.date <= lim) tot[wd(t.date)] += +t.amount || 0; });
    return tot.map((v, i) => cnt[i] ? v / cnt[i] : 0);
  }

  /* ---------- grafik SVG ---------- */
  const grid = (W, L, Rr, T, ph, lo, hi, y, step) => { let s = ''; for (let v = lo; v <= hi + step / 1e3; v += step) { const yy = y(v).toFixed(1); s += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" class="an-gl"/><text x="${L - 8}" y="${+yy + 4}" text-anchor="end" class="an-t">${short(v)}</text>`; } return s; };

  function cashflow(ms) {
    const R = ms.map(m => { const i = X.sum('Income', m), e = X.sum('Expense', m); return { m, i, e, n: i - e }; });
    const { lo, hi, step } = scale(Math.min(0, ...R.map(r => r.n)), Math.max(1, ...R.map(r => Math.max(r.i, r.e, r.n))));
    const W = 640, H = 270, L = 54, Rr = 14, T = 16, B = 32, pw = W - L - Rr, ph = H - T - B, y = v => T + ph * (1 - (v - lo) / (hi - lo)), y0 = y(0), gw = pw / R.length, bw = Math.min(30, gw * .3);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="an-svg" role="img" aria-label="Grafik pemasukan, pengeluaran, dan selisih per bulan">` + grid(W, L, Rr, T, ph, lo, hi, y, step) + `<line x1="${L}" x2="${W - Rr}" y1="${y0}" y2="${y0}" class="an-ax"/>`;
    const pts = [];
    R.forEach((r, i) => {
      const cx = L + gw * (i + .5); pts.push([cx, y(r.n), r]);
      [[r.i, '#1d5fb4', -bw - 2, 'Pemasukan'], [r.e, BAD, 2, 'Pengeluaran']].forEach(([v, col, dx, nm]) => { const h = Math.max(0, y0 - y(v)); if (v > 0) s += `<rect class="an-bar" x="${(cx + dx).toFixed(1)}" y="${(y0 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${col}"><title>${nm} ${mname(r.m, { month: 'long', year: 'numeric' })}: ${rp(v)}</title></rect>`; });
      s += `<text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" class="an-t">${lab(r.m, i)}</text>`;
    });
    s += `<polyline class="an-net" points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none"/>`;
    pts.forEach(p => { s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" class="an-dot" stroke="${p[2].n >= 0 ? GOOD : WARN}"><title>Selisih ${mname(p[2].m, { month: 'long', year: 'numeric' })}: ${p[2].n < 0 ? '−' : ''}${rp(Math.abs(p[2].n))}</title></circle>`; });
    return { svg: s + '</svg>', R };
  }

  function area(pts, id, color) {
    const W = 640, H = 250, L = 54, Rr = 22, T = 18, B = 30, pw = W - L - Rr, ph = H - T - B, vs = pts.map(p => p.v);
    const { lo, hi, step } = scale(Math.min(...vs, 0), Math.max(...vs, 1));
    const y = v => T + ph * (1 - (v - lo) / (hi - lo)), x = i => pts.length < 2 ? L + pw / 2 : L + pw * i / (pts.length - 1), y0 = y(0);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join('');
    let s = `<svg viewBox="0 0 ${W} ${H}" class="an-svg" role="img" aria-label="Tren saldo"><defs><linearGradient id="ag${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".34"/><stop offset="1" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>` + grid(W, L, Rr, T, ph, lo, hi, y, step);
    s += `<path d="${line}L${x(pts.length - 1).toFixed(1)} ${y0.toFixed(1)}L${x(0).toFixed(1)} ${y0.toFixed(1)}Z" fill="url(#ag${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p, i) => { s += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" fill="#fff" stroke="${color}" stroke-width="2.5"><title>${p.l}: ${p.v < 0 ? '−' : ''}${rp(Math.abs(p.v))}</title></circle>`; if (pts.length <= 7 || i === pts.length - 1) s += `<text x="${x(i).toFixed(1)}" y="${(y(p.v) - 10).toFixed(1)}" text-anchor="middle" class="an-t b">${short(p.v)}</text>`; s += `<text x="${x(i).toFixed(1)}" y="${H - 9}" text-anchor="middle" class="an-t">${p.s}</text>`; });
    return s + '</svg>';
  }

  function dailyChart(c) {
    const W = 640, H = 230, L = 54, Rr = 12, T = 14, B = 28, pw = W - L - Rr, ph = H - T - B, sc = scale(0, Math.max(...c.daily, c.avgDay, 1)), hi = sc.hi, step = sc.step, y = v => T + ph * (1 - v / hi), gw = pw / c.n, bw = Math.max(3, gw * .68), top = c.daily.indexOf(Math.max(...c.daily));
    let s = `<svg viewBox="0 0 ${W} ${H}" class="an-svg" role="img" aria-label="Pengeluaran harian">` + grid(W, L, Rr, T, ph, 0, hi, y, step);
    c.daily.forEach((v, i) => { const cx = L + gw * (i + .5), h = Math.max(0, y(0) - y(v)); if (v > 0) s += `<rect class="an-bar" x="${(cx - bw / 2).toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw / 2).toFixed(1)}" fill="${i === top ? BAD : '#1d5fb4'}"><title>Tanggal ${i + 1}: ${rp(v)}</title></rect>`; if (i === 0 || (i + 1) % 5 === 0 || (i === c.n - 1 && c.n % 5 >= 3)) s += `<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="an-t">${i + 1}</text>`; });
    if (c.avgDay > 0) s += `<line x1="${L}" x2="${W - Rr}" y1="${y(c.avgDay).toFixed(1)}" y2="${y(c.avgDay).toFixed(1)}" class="an-avg"/><text x="${W - Rr}" y="${(y(c.avgDay) - 5).toFixed(1)}" text-anchor="end" class="an-t b" fill="${WARN}">rata-rata ${short(c.avgDay)}/hari</text>`;
    return s + '</svg>';
  }

  function donut(sl, total) {
    const r = 78, C = 2 * Math.PI * r; let off = 0, s = `<svg viewBox="0 0 220 220" class="an-donut" role="img" aria-label="Komposisi pengeluaran per kategori">`;
    sl.forEach(x => { const len = x.v / total * C; s += `<circle cx="110" cy="110" r="${r}" fill="none" stroke="${x.col}" stroke-width="34" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 110 110)"><title>${esc(x.name)}: ${rp(x.v)} (${Math.round(x.v / total * 100)}%)</title></circle>`; off += len; });
    return s + `<text x="110" y="104" text-anchor="middle" class="an-t">Total keluar</text><text x="110" y="128" text-anchor="middle" class="an-dc">${short(total)}</text></svg>`;
  }

  function gauge(score, col) {
    const L = Math.PI * 80;
    return `<svg viewBox="0 0 200 118" class="an-gauge" role="img" aria-label="Skor kesehatan keuangan ${Math.round(score)} dari 100"><path d="M20 100A80 80 0 0 1 180 100" fill="none" stroke="var(--cr3)" stroke-width="16" stroke-linecap="round"/><path class="an-arc" d="M20 100A80 80 0 0 1 180 100" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(score / 100 * L).toFixed(1)} ${L.toFixed(1)}"/><text x="100" y="88" text-anchor="middle" class="an-gs" fill="${col}">${Math.round(score)}</text><text x="100" y="110" text-anchor="middle" class="an-t">dari 100</text></svg>`;
  }

  /* ---------- insight otomatis ---------- */
  function insights(c, h) {
    const L = [], add = (k, t) => L.push({ k, t }), mlb = mname(c.m, { month: 'long' });
    if (c.inc > 0) {
      if (c.sr >= 20) add('good', `Kamu menyisihkan <b>${Math.round(c.sr)}%</b> dari pemasukan bulan ini. Itu di atas target sehat 20%.`);
      else if (c.sr >= 0) add('warn', `Tingkat tabungan baru <b>${Math.round(c.sr)}%</b>. Untuk mencapai 20% sisihkan <b>${rp(c.inc * .2 - c.net)}</b> lagi.`);
      else add('bad', `Pengeluaran melebihi pemasukan sebesar <b>${rp(-c.net)}</b> pada ${mlb}. Uang keluar lebih besar dari yang masuk.`);
    } else if (c.exp > 0) add('warn', `Belum ada pemasukan tercatat di ${mlb}, padahal sudah keluar <b>${rp(c.exp)}</b>. Catat pemasukanmu agar analisis akurat.`);
    const cats = Object.keys(c.eb).map(id => ({ id, v: c.eb[id] })).sort((a, b) => b.v - a.v);
    if (cats.length && c.exp > 0) { const t = cats[0], p = t.v / c.exp * 100, nm = X.cn(t.id); add(p > 50 ? 'warn' : 'info', `Pengeluaran terbesar ada di <b>${esc(nm)}</b>: ${rp(t.v)} (${Math.round(p)}% dari total).${p > 50 ? ' Lebih dari separuh uang keluarmu ada di satu kategori.' : ''}`); }
    if (c.pexp > 0 && c.exp > 0) { const ch = (c.exp - c.pexp) / c.pexp * 100; if (Math.abs(ch) >= 10) add(ch > 0 ? 'warn' : 'good', `Pengeluaran ${ch > 0 ? 'naik' : 'turun'} <b>${Math.abs(Math.round(ch))}%</b> dibanding bulan lalu (${rp(c.pexp)} → ${rp(c.exp)}).`); }
    if (c.runway != null) { const r = c.runway; add(r >= 6 ? 'good' : r >= 3 ? 'info' : r >= 1 ? 'warn' : 'bad', `Total saldo cukup untuk sekitar <b>${dec(r)} bulan</b> pengeluaran (rata-rata ${rp(c.avgExp)}/bulan). ${r >= 6 ? 'Dana daruratmu sudah kuat.' : r >= 3 ? 'Targetkan 6 bulan sebagai dana darurat ideal.' : 'Dana darurat tipis, prioritaskan menabung.'}`); }
    const over = c.buds.filter(b => b.p > 100), near = c.buds.filter(b => b.p >= 80 && b.p <= 100);
    if (over.length) add('bad', `Anggaran <b>${over.map(b => esc(b.c.name)).join(', ')}</b> sudah terlampaui (total lebih ${rp(over.reduce((a, b) => a + b.sp - b.lim, 0))}).`);
    if (near.length) add('warn', `Anggaran <b>${near.map(b => esc(b.c.name)).join(', ')}</b> hampir habis (≥ 80%).`);
    if (c.isCur && c.dayNow >= 5 && c.exp > 0) { add(c.inc > 0 && c.proj > c.inc ? 'warn' : 'info', `Dengan laju sekarang (<b>${rp(c.avgDay)}/hari</b>), pengeluaran akhir bulan diperkirakan <b>${rp(c.proj)}</b>${c.inc > 0 ? (c.proj > c.inc ? ', melebihi pemasukan bulan ini.' : ', masih di bawah pemasukan.') : '.'}`); }
    const wa = weekdayAvg(c.ms), mxW = Math.max(...wa);
    if (mxW > 0) { const i = wa.indexOf(mxW); add('info', `Hari paling boros: <b>${DAYS[i]}</b> (rata-rata ${rp(mxW)} per hari dalam ${st.rng} bulan terakhir).`); }
    const f = {}; D.tx.forEach(t => { if (t.type !== 'Expense' || t.date.slice(0, 7) !== c.m) return; const raw = (t.desc || '').trim(), q = +((raw.match(/×(\d+)$/) || [])[1]) || 1, nm = raw.replace(/ ×\d+$/, '') || X.cn(t.catId), k = nm.toLowerCase(); f[k] = f[k] || { nm, n: 0, v: 0 }; f[k].n += q; f[k].v += +t.amount || 0; });
    const fr = Object.values(f).filter(x => x.n >= 4 && c.exp > 0 && x.v / c.exp >= .05).sort((a, b) => b.v - a.v)[0];
    if (fr) add('warn', `<b>${esc(fr.nm)}</b> kamu beli ${fr.n}× bulan ini, total ${rp(fr.v)} (${Math.round(fr.v / c.exp * 100)}% pengeluaran). Pengeluaran kecil yang berulang paling mudah dihemat.`);
    if (!c.goals.length) add('info', 'Belum ada target tabungan aktif. Target yang jelas membantu uang sisa benar-benar ditabung.');
    const ord = { bad: 0, warn: 1, info: 2, good: 3 };
    return L.sort((a, b) => ord[a.k] - ord[b.k]).slice(0, 8);
  }

  /* ---------- tampilan ---------- */
  const card = (cls, t, sub, body) => `<section class="an-c ${cls}"><h3>${t}</h3>${sub ? `<p class="an-sub">${sub}</p>` : ''}${body}</section>`;
  const chip = (cur, prev, badUp) => { if (!(prev > 0)) return cur > 0 ? '<em class="an-d">bulan lalu belum ada data</em>' : ''; const p = (cur - prev) / prev * 100; if (Math.abs(p) < 1) return '<em class="an-d">stabil vs bulan lalu</em>'; const up = p > 0, good = badUp ? !up : up; return `<em class="an-d ${good ? 'g' : 'b'}">${up ? '▲' : '▼'} ${Math.abs(Math.round(p))}% vs bulan lalu</em>`; };
  const none = t => `<p class="an-none">${t}</p>`;
  const kpi = (cls, t, v, e) => `<div class="an-k ${cls}"><small>${t}</small><b>${v}</b>${e || ''}</div>`;

  function view() {
    const c = calc(), h = health(c), L = c.ms;
    const head = X.mon() + `<div class="fn-chips an-rng" role="group" aria-label="Rentang tren">${[3, 6, 12].map(n => `<button aria-pressed="${st.rng === n}" data-a="rng" data-v="${n}">${n} bulan</button>`).join('')}</div>`;
    if (!D.tx.length) return head + X.empty('Belum ada transaksi, jadi belum ada yang bisa dianalisis. Catat pemasukan dan pengeluaranmu, lalu grafik dan skor kesehatan keuangan akan muncul di sini.', '<button class="fn-btn" data-a="tab" data-t="menu">Catat pengeluaran pertama</button>');
    const act = D.acc.filter(a => a.active);
    let o = `<div class="an-kp">${kpi('main', 'Total saldo', rp(c.total), `<em class="an-d">${act.length} akun aktif${c.runway != null ? ' · cukup ±' + dec(c.runway) + ' bulan' : ''}</em>`)}${kpi('', 'Pemasukan', `<span class="pos">${rp(c.inc)}</span>`, chip(c.inc, c.pinc, false))}${kpi('', 'Pengeluaran', `<span class="neg">${rp(c.exp)}</span>`, chip(c.exp, c.pexp, true))}${kpi('', c.net >= 0 ? 'Sisa bulan ini' : 'Defisit bulan ini', `<span class="${c.net >= 0 ? 'pos' : 'neg'}">${c.net < 0 ? '−' : ''}${rp(Math.abs(c.net))}</span>`, `<em class="an-d">${c.sr != null ? 'Tingkat tabungan ' + Math.round(c.sr) + '%' : 'Belum ada pemasukan'}</em>`)}</div><div class="an">`;

    /* skor kesehatan */
    if (h) {
      const sum = `Kondisi keuanganmu <b style="color:${h.col}">${h.label.toLowerCase()}</b>. ${h.P.length > 1 ? `Yang sudah baik: <b>${h.best.k.toLowerCase()}</b>. Yang perlu dibenahi: <b>${h.worst.k.toLowerCase()}</b>.` : ''}`;
      o += card('s5', 'Skor kesehatan keuangan', 'Gabungan tabungan, dana darurat, anggaran, tren belanja, dan target.', `<div class="an-hl">${gauge(h.score, h.col)}<b class="an-lv" style="color:${h.col}">${h.label}</b></div><p class="an-sum">${sum}</p><div class="an-pt">${h.P.map(p => `<div><span>${p.k}<small>${p.d}</small></span><div class="fn-meter"><i class="${p.s >= 65 ? '' : p.s >= 40 ? 'warn' : 'bad'}" style="width:${p.s}%"></i></div><em>${Math.round(p.s)}</em></div>`).join('')}</div>`);
    } else o += card('s5', 'Skor kesehatan keuangan', '', none('Skor muncul setelah ada pemasukan atau pengeluaran di bulan ini.'));
    const ins = insights(c, h), ic = { good: '✅', warn: '⚠️', bad: '🚨', info: '💡' };
    o += card('s7', 'Temuan otomatis', `Dibaca dari datamu di ${mname(c.m, { month: 'long', year: 'numeric' })}.`, ins.length ? `<ul class="an-ins">${ins.map(i => `<li class="k-${i.k}"><i>${ic[i.k]}</i><span>${i.t}</span></li>`).join('')}</ul>` : none('Belum cukup data untuk membuat temuan.'));

    /* arus kas */
    const cf = cashflow(L);
    o += card('s7', 'Arus kas bulanan', 'Biru = pemasukan, merah = pengeluaran, garis = selisih. Titik hijau berarti kamu surplus, oranye berarti defisit.', `<div class="an-lg"><span class="a">Pemasukan</span><span class="b">Pengeluaran</span><span class="c">Selisih</span></div>${cf.svg}<details class="an-det"><summary>Lihat angka per bulan</summary><div class="an-tw"><table class="an-tb"><thead><tr><th>Bulan</th><th>Masuk</th><th>Keluar</th><th>Selisih</th><th>Tabung</th></tr></thead><tbody>${cf.R.slice().reverse().map(r => `<tr><td>${mname(r.m, { month: 'short', year: 'numeric' })}</td><td>${rp(r.i)}</td><td>${rp(r.e)}</td><td class="${r.n >= 0 ? 'pos' : 'neg'}">${r.n < 0 ? '−' : ''}${rp(Math.abs(r.n))}</td><td>${r.i > 0 ? Math.round(r.n / r.i * 100) + '%' : '–'}</td></tr>`).join('')}</tbody></table></div></details>`);

    /* donut */
    const cats = Object.keys(c.eb).map(id => ({ id, v: c.eb[id] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    let dn; if (cats.length) {
      const top = cats.slice(0, 6).map((x, i) => ({ name: X.cn(x.id), v: x.v, col: PAL[i], cat: by(D.cat, x.id) })), rest = cats.slice(6).reduce((a, x) => a + x.v, 0); if (rest > 0) top.push({ name: 'Lainnya (' + (cats.length - 6) + ')', v: rest, col: '#b9a99c' });
      dn = `<div class="an-dn">${donut(top, c.exp)}<ul class="an-lgd">${top.map(x => `<li><i style="background:${x.col}"></i><span>${x.cat ? X.cic(x.cat) + ' ' : ''}${esc(x.name)}</span><b>${Math.round(x.v / c.exp * 100)}%</b><small>${rp(x.v)}</small></li>`).join('')}</ul></div>`;
    } else dn = none('Belum ada pengeluaran di bulan ini.');
    o += card('s5', 'Ke mana uangmu pergi', 'Porsi pengeluaran per kategori bulan ini.', dn);

    /* tren saldo */
    const pts = L.map((m, i) => { const e = m + '-' + pad(dim(m)), d = e > todayS() ? todayS() : e; return { l: mname(m, { month: 'long', year: 'numeric' }), s: lab(m, i), v: balAt(d) }; });
    const dlt = pts[pts.length - 1].v - pts[0].v;
    o += card('s7', 'Tren total saldo', `Saldo akhir tiap bulan. Dalam ${L.length} bulan terakhir saldo ${dlt >= 0 ? 'naik' : 'turun'} <b class="${dlt >= 0 ? 'pos' : 'neg'}">${rp(Math.abs(dlt))}</b>.`, area(pts, 'nw', '#1d5fb4'));

    /* akun */
    const pos = act.map(a => ({ a, b: X.bal(a) })).sort((x, y) => y.b - x.b), tp = pos.reduce((a, x) => a + Math.max(0, x.b), 0);
    o += card('s5', 'Komposisi saldo per akun', 'Di mana uangmu disimpan.', pos.length ? `<div class="an-bars">${pos.map((x, i) => `<div><span>${esc(x.a.name)}<small>${esc(x.a.type)}</small></span><div class="fn-meter"><i style="width:${tp ? clamp(Math.max(0, x.b) / tp * 100, 0, 100) : 0}%;background:${x.b < 0 ? BAD : PAL[i % PAL.length]}"></i></div><b class="${x.b < 0 ? 'neg' : ''}">${x.b < 0 ? '−' : ''}${rp(Math.abs(x.b))}</b></div>`).join('')}</div>` : none('Belum ada akun aktif.'));

    /* harian + proyeksi */
    const mxD = Math.max(...c.daily), topDay = mxD > 0 ? c.daily.indexOf(mxD) + 1 : 0;
    o += card('s8', 'Pengeluaran harian', 'Batang merah = hari paling boros. Garis putus-putus = rata-rata harian.', c.exp > 0 ? dailyChart(c) : none('Belum ada pengeluaran di bulan ini.'));
    const tb = c.buds.reduce((a, b) => a + b.lim, 0), pr = (l, v, cl) => `<div><span>${l}</span><b class="${cl || ''}">${v}</b></div>`;
    o += card('s4', c.isCur ? 'Proyeksi akhir bulan' : 'Ringkasan bulan', c.isCur ? `Hari ke-${c.dayNow} dari ${c.n}, diperkirakan dari laju belanjamu.` : 'Statistik pengeluaran bulan terpilih.', `<div class="an-pr">${pr('Rata-rata per hari', rp(c.isCur ? c.avgDay : c.exp / c.n))}${pr(c.isCur ? 'Perkiraan total keluar' : 'Total keluar', rp(c.proj), c.inc > 0 && c.proj > c.inc ? 'neg' : '')}${c.isCur && c.inc > 0 ? pr('Perkiraan sisa', (c.inc - c.proj < 0 ? '−' : '') + rp(Math.abs(c.inc - c.proj)), c.inc - c.proj >= 0 ? 'pos' : 'neg') : ''}${topDay ? pr('Hari terboros', 'Tgl ' + topDay + ' · ' + rp(mxD)) : ''}${tb ? pr('Total anggaran', rp(tb)) : ''}${pr('Jumlah transaksi', D.tx.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === c.m).length + ' keluar')}</div>`);

    /* anggaran */
    o += card('s6', 'Anggaran vs realisasi', 'Seberapa banyak batas belanja sudah terpakai.', c.buds.length ? `<div class="an-bd">${c.buds.sort((a, b) => b.p - a.p).map(b => `<div><i class="fn-ico">${X.cic(b.c)}</i><div><b>${esc(b.c.name)}</b><small>${rp(b.sp)} / ${rp(b.lim)}</small>${X.meter(b.p)}</div><em class="${b.p > 100 ? 'neg' : b.p >= 80 ? 'wn' : 'pos'}">${Math.round(b.p)}%<small>${b.p > 100 ? 'Melebihi' : b.p >= 80 ? 'Hampir habis' : 'Aman'}</small></em></div>`).join('')}</div>` : none('Belum ada anggaran untuk bulan ini.') + '<button class="fn-btn sm" data-a="godom" data-v="bud">Atur anggaran</button>');

    /* pola hari */
    const wa = weekdayAvg(L), mw = Math.max(...wa);
    o += card('s6', 'Pola belanja per hari', `Rata-rata pengeluaran tiap hari dalam ${L.length} bulan terakhir.`, mw > 0 ? `<div class="an-bars wk">${wa.map((v, i) => `<div><span>${DAYS[i]}</span><div class="fn-meter"><i class="${v === mw ? 'bad' : ''}" style="width:${v / mw * 100}%"></i></div><b>${rp(v)}</b></div>`).join('')}</div>` : none('Belum cukup data.'));

    /* tabel kategori */
    const ids = Array.from(new Set(Object.keys(c.eb).concat(Object.keys(c.pb)))).map(id => ({ id, a: c.eb[id] || 0, b: c.pb[id] || 0 })).sort((x, y) => y.a - x.a || y.b - x.b);
    o += card('s7', 'Kategori: bulan ini vs bulan lalu', 'Merah = pengeluaran naik, hijau = turun.', ids.length ? `<div class="an-tw"><table class="an-tb"><thead><tr><th>Kategori</th><th>Bulan ini</th><th class="hm">Bulan lalu</th><th>Ubah</th></tr></thead><tbody>${ids.map(r => { const d = r.b > 0 ? (r.a - r.b) / r.b * 100 : null; return `<tr><td>${X.cic(by(D.cat, r.id))} ${esc(X.cn(r.id))}<small>${c.exp ? Math.round(r.a / c.exp * 100) : 0}% dari total</small></td><td>${rp(r.a)}</td><td class="hm">${rp(r.b)}</td><td class="${d == null ? '' : d > 0 ? 'neg' : d < 0 ? 'pos' : ''}">${d == null ? (r.a > 0 ? 'baru' : '–') : (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + Math.abs(Math.round(d)) + '%'}</td></tr>`; }).join('')}</tbody></table></div>` : none('Belum ada data pengeluaran.'));

    /* top 5 */
    const t5 = D.tx.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === c.m).sort((a, b) => (+b.amount || 0) - (+a.amount || 0)).slice(0, 5);
    o += card('s5', '5 pengeluaran terbesar', 'Transaksi tunggal paling besar bulan ini.', t5.length ? t5.map(X.txRow).join('') : none('Belum ada pengeluaran.'));

    /* sumber pemasukan */
    const ib = {}; D.tx.filter(t => t.type === 'Income' && t.date.slice(0, 7) === c.m).forEach(t => ib[t.catId] = (ib[t.catId] || 0) + (+t.amount || 0));
    const il = Object.keys(ib).map(id => ({ id, v: ib[id] })).sort((a, b) => b.v - a.v);
    o += card('s5', 'Sumber pemasukan', 'Dari mana uang masuk bulan ini.', il.length ? `<div class="an-bars">${il.map((x, i) => `<div><span>${X.cic(by(D.cat, x.id))} ${esc(X.cn(x.id))}</span><div class="fn-meter"><i style="width:${x.v / c.inc * 100}%;background:${PAL[(i + 3) % PAL.length]}"></i></div><b>${rp(x.v)}</b></div>`).join('')}</div>` : none('Belum ada pemasukan bulan ini.'));

    /* target */
    const avgC = g => { const mm = [0, 1, 2].map(i => X.addM(c.cur, -i)), v = D.con.filter(x => x.goalId === g.id && mm.includes(x.date.slice(0, 7))).reduce((a, x) => a + (+x.amount || 0), 0) / 3; return v; };
    o += card('s7', 'Progres target tabungan', 'Estimasi dihitung dari rata-rata setoran 3 bulan terakhir.', c.goals.length ? `<div class="an-gl2">${c.goals.map(x => { const left = Math.max(0, +x.g.target - x.got), ac = avgC(x.g), mo = ac > 0 ? Math.ceil(left / ac) : null; let est = x.p >= 100 ? 'Target tercapai 🎉' : mo ? 'Estimasi tercapai ±' + mo + ' bulan lagi' : 'Belum ada setoran rutin'; if (x.g.date && x.p < 100) { const dl = Math.round((new Date(x.g.date) - new Date(todayS())) / 864e5); est += ' · batas ' + fd(x.g.date) + (dl < 0 ? ' (lewat)' : ''); } return `<div><div class="an-gh"><b>${esc(x.g.name)}</b><em>${Math.round(x.p)}%</em></div>${X.meter(Math.min(x.p, 100))}<small>${rp(x.got)} dari ${rp(x.g.target)} · ${est}</small></div>`; }).join('')}</div>` : none('Belum ada target tabungan aktif.') + '<button class="fn-btn sm" data-a="godom" data-v="goal">Buat target</button>');

    return head + o + '</div><p class="an-foot">Semua angka dihitung dari data di perangkat ini. Transfer antar akun tidak dihitung sebagai pemasukan atau pengeluaran.</p>';
  }

  X.views.ana = view;
})();
;
/* MyOffice — Goal (data di localStorage perangkat) */
(function () {
  'use strict';
  var MO = window.MyOffice, K = MO.kit, esc = K.esc, fd = K.fd, by = K.by, empty = K.empty, bar = K.bar, add = K.add, btns = K.btns, opt = K.opt, badge = K.badge, chips = K.chips, prog = K.prog, has = K.has;
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var HZ = ['Harian', 'Mingguan', 'Bulanan', 'Semesteran', 'Tahunan', 'Jangka panjang'];
  var LC = ['Akademik', 'Karier / Pekerjaan', 'Keuangan', 'Spiritual', 'Kesehatan', 'Relasi & sosial', 'Pengembangan diri', 'Bisnis', 'Lainnya'];
  var GS = ['Belum mulai', 'Berjalan', 'Ditunda', 'Tercapai', 'Dibatalkan'], TS = ['Belum', 'Dikerjakan', 'Selesai'];

  /* Dipakai Task & Kalender untuk menautkan item ke goal/milestone */
  MO.goalOpts = function () {
    var g = ls('mo-goal-v1'), o = [['', '—']];
    (g.goal || []).forEach(function (x) { o.push([x.id, '🎯 ' + x.name]); (g.ms || []).filter(function (m) { return m.goalId === x.id; }).forEach(function (m) { o.push([m.id, '   ↳ ' + m.name]); }); });
    return o;
  };

  var goals = K.App('Goal', 'mo-goal-v1', function () { return { goal: [], ms: [], gtask: [], rev: [] }; }, function (app) {
    var D = app.D, st = app.st, today = K.todayS;
    if (!D.pf || !D.pf.length) D.pf = [{ id: 'pf', level: 3, min: 15, xp: 40, claims: [] }];
    var PF = D.pf[0]; if (!PF.claims) PF.claims = [];
    var LV = [0, ['🌱', 'Santai', 'Pelan tapi pasti', 5, 10], ['⭐', 'Stabil', 'Konsisten tiap hari', 10, 25], ['🚀', 'Intens', 'Progres nyata', 15, 40], ['🔥', 'Maksimal', 'Tantang batasmu', 30, 80]];
    var LB = ['Baru mulai', 'Mulai terasa', 'Separuh jalan', 'Hampir sampai', 'Tercapai!'];
    var CAT = { 'Akademik': ['📚', '#3d7ff5', '#7fb2ff'], 'Karier / Pekerjaan': ['💼', '#7a5af0', '#a98fff'], 'Keuangan': ['💰', '#f2a900', '#ffd24d'], 'Spiritual': ['🕌', '#0f9f7a', '#55d3ae'], 'Kesehatan': ['💪', '#ee4f6a', '#ff98a8'], 'Relasi & sosial': ['🤝', '#ff8433', '#ffbd7a'], 'Pengembangan diri': ['🚀', '#1f9bf0', '#7ccffd'], 'Bisnis': ['📈', '#0db0b0', '#6fe3d6'], 'Lainnya': ['🎯', '#66769a', '#a9b5cf'] };
    var cat = function (g) { return CAT[g.cat] || CAT['Lainnya']; };
    var CH = '<svg class="gq-chest" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v1H3z" fill="#b8621f"/><rect x="3" y="11" width="18" height="9" rx="2" fill="#7a3d12"/><rect x="10" y="10" width="4" height="6" rx="1" fill="#ffcf3f"/></svg>';
    var dstr = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    /* XP nyata: tugas 10, milestone 30, evaluasi 5, hadiah misi 20. Streak = hari beruntun yang punya aktivitas bertanggal. */
    function xpInfo() {
      var e = [], tot = 0, td = 0, days = {}, t = today();
      D.ms.forEach(function (m) { if (m.done) e.push([m.doneAt || '', 30]); });
      D.gtask.forEach(function (x) { if (x.status === 'Selesai') e.push([x.doneAt || '', 10]); });
      D.rev.forEach(function (r) { e.push([r.date || '', 5]); });
      PF.claims.forEach(function (c) { e.push([c, 20]); });
      e.forEach(function (x) { tot += x[1]; if (x[0]) days[x[0]] = 1; if (x[0] === t) td += x[1]; });
      var sk = 0, d = new Date(); if (!days[t]) d.setDate(d.getDate() - 1);
      while (days[dstr(d)]) { sk++; d.setDate(d.getDate() - 1); }
      return { tot: tot, td: td, streak: sk, lv: Math.floor(tot / 100) + 1, into: tot % 100 };
    }
    var msOf = function (gid) { return D.ms.filter(function (m) { return m.goalId === gid; }); };
    var extT = function () { return (ls('mo-task-v1').task || []).filter(function (t) { return t.goalRef; }); };
    var extE = function () { return (ls('mo-cal-v1').ev || []).filter(function (e) { return e.goalRef; }); };
    /* Tugas pendukung = tugas milik goal + tugas dari modul Task yang ditautkan */
    function tasksOf(gid, mid) {
      var ids = [gid].concat(msOf(gid).map(function (m) { return m.id; }));
      var own = D.gtask.filter(function (t) { return mid ? t.msId === mid : t.goalId === gid; }).map(function (t) { return { id: t.id, title: t.title, done: t.status === 'Selesai', due: t.due, own: 1, st: t.status }; });
      var ext = extT().filter(function (t) { return mid ? t.goalRef === mid : ids.indexOf(t.goalRef) > -1; }).map(function (t) { return { id: t.id, title: t.title, done: t.status === 'Done', due: t.due, own: 0, st: t.status }; });
      return own.concat(ext);
    }
    function pg(g) {
      var b = g.basis || 'ms';
      if (b === 'num') return has(g.tgtNum) && +g.tgtNum > 0 ? { pct: Math.min(100, (+g.curNum || 0) / +g.tgtNum * 100), txt: (+g.curNum || 0) + ' / ' + g.tgtNum + ' ' + (g.unit || '') } : { pct: null, txt: 'Isi angka target di Edit goal' };
      if (b === 'tasks') { var t = tasksOf(g.id), d = t.filter(function (x) { return x.done; }).length; return t.length ? { pct: d / t.length * 100, txt: d + ' dari ' + t.length + ' tugas selesai' } : { pct: null, txt: 'Belum ada tugas pendukung' }; }
      var m = msOf(g.id), dn = m.filter(function (x) { return x.done; }).length; return m.length ? { pct: dn / m.length * 100, txt: dn + ' dari ' + m.length + ' milestone tercapai' } : { pct: null, txt: 'Belum ada milestone' };
    }
    var late = function (g) { return g.deadline && g.deadline < today() && g.status !== 'Tercapai' && g.status !== 'Dibatalkan'; };
    var goalOpt = function () { return [['', '— Pilih goal —']].concat(D.goal.map(function (g) { return [g.id, g.name]; })); };
    var specs = {
      goal: { title: 'Goal', def: { horizon: 'Bulanan', cat: 'Pengembangan diri', status: 'Belum mulai', basis: 'ms' }, fields: [
        { k: 'name', l: 'Nama goal', t: 'text', req: 1, full: 1 }, { k: 'why', l: 'Alasan / tujuan', t: 'textarea', full: 1 },
        { k: 'horizon', l: 'Horizon', t: 'select', o: opt(HZ) }, { k: 'cat', l: 'Kategori kehidupan', t: 'select', o: opt(LC) },
        { k: 'target', l: 'Target yang ingin dicapai', t: 'textarea', full: 1 }, { k: 'deadline', l: 'Deadline', t: 'date' }, { k: 'status', l: 'Status', t: 'select', o: opt(GS) },
        { k: 'basis', l: 'Progres dihitung dari', t: 'select', full: 1, o: [['ms', 'Milestone yang tercapai'], ['tasks', 'Tugas pendukung yang selesai'], ['num', 'Angka target (mis. dana terkumpul)']] },
        { k: 'tgtNum', l: 'Angka target (jika dasar = angka)', t: 'number', min: 0 }, { k: 'curNum', l: 'Angka saat ini', t: 'number' }, { k: 'unit', l: 'Satuan', t: 'text', ph: 'Rp / halaman / jam' }] },
      ms: { title: 'Milestone', def: { done: false }, fields: [
        { k: 'name', l: 'Milestone', t: 'text', req: 1, full: 1 }, { k: 'goalId', l: 'Goal', t: 'select', o: goalOpt, req: 1 }, { k: 'due', l: 'Tenggat', t: 'date' },
        { k: 'done', l: 'Status', t: 'select', bool: 1, o: [['false', 'Belum tercapai'], ['true', 'Tercapai']] }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      gtask: { title: 'Tugas Pendukung', def: { status: 'Belum' }, fields: [
        { k: 'title', l: 'Tugas', t: 'text', req: 1, full: 1 }, { k: 'goalId', l: 'Goal', t: 'select', o: goalOpt, req: 1 },
        { k: 'msId', l: 'Milestone (opsional)', t: 'select', o: function () { return [['', '— Tanpa milestone —']].concat(D.ms.map(function (m) { return [m.id, (by(D.goal, m.goalId) || {}).name + ' ↳ ' + m.name]; })); } },
        { k: 'due', l: 'Tenggat', t: 'date' }, { k: 'status', l: 'Status', t: 'select', o: opt(TS) }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] },
      pf: { title: 'Target Harian', def: {}, fields: [{ k: 'level', l: 'Intensitas', t: 'select', full: 1, o: [['1', '🌱 Santai'], ['2', '⭐ Stabil'], ['3', '🚀 Intens'], ['4', '🔥 Maksimal']] }, { k: 'min', l: 'Menit belajar per hari', t: 'number', min: 1 }, { k: 'xp', l: 'Target XP per hari', t: 'number', min: 1 }] },
      rev: { title: 'Evaluasi', def: { mood: 'Sesuai rencana' }, fields: [
        { k: 'goalId', l: 'Goal', t: 'select', o: goalOpt, req: 1 }, { k: 'date', l: 'Tanggal', t: 'date', req: 1 }, { k: 'mood', l: 'Kondisi', t: 'select', o: opt(['Sesuai rencana', 'Perlu perhatian', 'Tertinggal']) },
        { k: 'note', l: 'Catatan evaluasi', t: 'textarea', req: 1, full: 1 }] }
    };
    var meta = function (g) { return badge(g.horizon) + badge(g.cat) + badge(g.status, g.status === 'Tercapai' ? 'on' : '') + (late(g) ? badge('Lewat deadline', 'late') : ''); };

    function hero() {
      var X = xpInfo(), L = LV[PF.level] || LV[3], p = Math.min(100, X.td / (+PF.xp || 1) * 100);
      return '<section class="gq-hero"><div class="gq-top"><span class="gq-lbl"><i>◎</i>Target harian</span><span class="gq-streak">🔥 ' + (X.streak ? X.streak + ' hari beruntun' : 'Mulai streak hari ini') + '</span></div>' +
        '<div class="gq-lv"><span class="gq-em">' + L[0] + '</span><div><b>' + L[1] + '!</b><small>' + L[2] + '</small></div></div>' +
        '<div class="gq-bar g"><i style="width:' + p + '%"></i></div><p class="gq-cap">' + (p >= 100 ? 'Target hari ini tercapai 🎉' : X.td + ' / ' + PF.xp + ' XP hari ini') + '</p>' +
        '<div class="gq-pop"><div><span class="gq-dot v">🕒</span><b>' + PF.min + '</b> Menit / hari</div><div><span class="gq-dot o">⭐</span><b>' + PF.xp + '</b> XP / hari</div></div>' +
        '<div class="gq-set"><button class="gq-rb" data-act="pfstep" data-dir="-1" aria-label="Turunkan intensitas"' + (PF.level <= 1 ? ' disabled' : '') + '>−</button><button class="gq-main" data-act="edit" data-e="pf" data-id="pf"><i>' + PF.level + '</i>Atur target</button><button class="gq-rb" data-act="pfstep" data-dir="1" aria-label="Naikkan intensitas"' + (PF.level >= 4 ? ' disabled' : '') + '>+</button></div></section>';
    }
    function lvlCard() {
      var X = xpInfo();
      return '<section class="gq-lvl"><div class="gq-sh"><b>Lv ' + X.lv + '</b></div><div><b>' + X.tot + ' XP</b><div class="gq-bar b"><i style="width:' + X.into + '%"></i></div><small>' + X.into + ' / 100 XP menuju level berikutnya</small></div></section>';
    }
    function quest() {
      var X = xpInfo(), t = today(), c1 = D.ms.filter(function (m) { return m.done && m.doneAt === t; }).length + D.gtask.filter(function (x) { return x.status === 'Selesai' && x.doneAt === t; }).length, c3 = D.rev.filter(function (r) { return r.date === t; }).length;
      var Q = [['⚡', 'Selesaikan 1 tugas atau milestone', Math.min(c1, 1), 1], ['🎯', 'Raih ' + PF.xp + ' XP hari ini', Math.min(X.td, +PF.xp), +PF.xp], ['📝', 'Tulis 1 evaluasi', Math.min(c3, 1), 1]];
      var all = Q.every(function (q) { return q[2] >= q[3]; }), got = PF.claims.indexOf(t) > -1;
      return '<section class="gq-panel"><h3 class="gq-h">Misi harian' + (all ? ' selesai!' : '') + '</h3>' + Q.map(function (q) {
        return '<div class="gq-q"><span class="gq-qi">' + q[0] + '</span><div><b>' + q[1] + '</b><div class="gq-qb"><div class="gq-bar y"><i style="width:' + q[2] / q[3] * 100 + '%"></i></div>' + CH + '<em>' + q[2] + ' / ' + q[3] + '</em></div></div></div>';
      }).join('') + '<button class="ac-btn pri gq-claim" data-act="claim"' + (all && !got ? '' : ' disabled') + '>' + (got ? 'Hadiah diklaim ✓' : 'Klaim hadiah +20 XP') + '</button></section>';
    }
    function tile(g) {
      var p = pg(g), c = cat(g);
      return '<article class="gq-goal" style="--c1:' + c[1] + ';--c2:' + c[2] + '" data-act="opg" data-id="' + g.id + '"><span class="gq-gi">' + c[0] + '</span><div class="gq-gm"><h3><button class="t" data-act="opg" data-id="' + g.id + '">' + esc(g.name) + '</button></h3><div class="gq-gb">' + meta(g) + '</div>' +
        '<div class="gq-bar g"><i style="width:' + (p.pct || 0) + '%"></i></div><small>' + p.txt + (p.pct != null ? ' (' + Math.round(p.pct) + '%)' : '') + (g.deadline ? ' · deadline ' + fd(g.deadline) : '') + '</small>' + (g.why ? '<div class="ac-notes" style="margin:6px 0 0">' + esc(g.why) + '</div>' : '') + '</div>' +
        '<div class="gq-ga"><button class="ac-btn sm" data-act="edit" data-e="goal" data-id="' + g.id + '">Edit</button><span class="gq-go">Masuk ›</span></div></article>';
    }
    function cele() {
      var c = st.cele, g = c && by(D.goal, c.g); if (!g) return '';
      var p = pg(g), pc = Math.round(p.pct || 0), m = c.id && by(D.ms, c.id), ml = msOf(g.id), tk = tasksOf(g.id), win = c.k === 'goal' || !m, cf = '';
      var dn = function (a) { return a.filter(function (x) { return x.done; }).length; };
      for (var i = 0; i < 16; i++) cf += '<i style="left:' + (i * 6.2 + 2) + '%;animation-delay:' + (i % 5) * 0.35 + 's"></i>';
      var T = [['🎯', 'Milestone', dn(ml) + ' / ' + ml.length], ['✅', 'Tugas selesai', dn(tk) + ' / ' + tk.length], ['🗓', 'Deadline', fd(g.deadline)]];
      return '<div class="gq-cele ' + (win ? 'win' : 'ms') + '" role="dialog" aria-modal="true" aria-label="Pencapaian"><div class="gq-cc">' + (win ? '<div class="gq-conf">' + cf + '</div><div class="gq-trophy">🏆</div><h3>Goal tercapai!</h3><p>' + esc(g.name) + ' — setiap langkah kecilmu sudah sampai.</p>' : '<div class="gq-shield"><b>LEVEL UP</b></div><h3>Milestone tercapai: ' + esc(m.name) + '</h3><p>+30 XP. Kamu makin dekat ke ' + esc(g.name) + '.</p>') +
        '<div class="gq-bar ' + (win ? 'g' : 'p') + '"><i style="width:' + pc + '%"></i></div><small>' + pc + '% · ' + p.txt + '</small><div class="gq-dets">' + T.map(function (x) { return '<div><span>' + x[0] + '</span><small>' + x[1] + '</small><b>' + x[2] + '</b></div>'; }).join('') + '</div>' +
        '<div class="gq-cb">' + (win && g.status !== 'Tercapai' ? '<button class="ac-btn pri" data-act="cele-ok" data-id="' + g.id + '">Tandai goal tercapai</button>' : '') + '<button class="ac-btn" data-act="cele-x">Lanjut</button></div></div></div>';
    }
    function list() {
      var hz = st.hz || 'Semua', L = D.goal.filter(function (g) { return hz === 'Semua' || g.horizon === hz; });
      var h = bar('Target pada berbagai horizon. Progres dihitung dari milestone, tugas, atau angka sesuai dasar yang Anda pilih — bukan angka acak.', add('goal', 'Goal')) + chips(['Semua'].concat(HZ), hz, 'hz');
      if (!L.length) h += empty('Belum ada goal. Mulai dengan satu target, lalu pecah menjadi milestone.');
      HZ.forEach(function (z) {
        var x = L.filter(function (g) { return g.horizon === z; }); if (!x.length) return;
        h += '<div class="ac-h">' + z + ' · ' + x.length + '</div>' + x.map(tile).join('');
      });
      return '<div class="gq-grid"><aside>' + hero() + lvlCard() + quest() + '</aside><div>' + h + '</div></div>' + cele();
    }
    function taskLine(t) {
      return '<div class="ac-item' + (t.done ? ' done' : '') + '" style="margin:4px 0;padding:8px 10px"><input type="checkbox" ' + (t.own ? 'data-act="tgt" data-id="' + t.id + '"' : 'disabled title="Ubah statusnya di modul Task"') + (t.done ? ' checked' : '') + ' aria-label="Selesai"><div><button class="t" ' + (t.own ? 'data-act="edit" data-e="gtask" data-id="' + t.id + '"' : 'data-act="gotask"') + '>' + esc(t.title) + '</button>' + (t.own ? '' : badge('dari Task')) + '<small>' + (t.due ? 'Tenggat ' + fd(t.due) + ' · ' : '') + esc(t.st) + '</small></div>' + (t.own ? '<button class="ac-btn sm danger" data-act="del" data-e="gtask" data-id="' + t.id + '" aria-label="Hapus">×</button>' : '') + '</div>';
    }
    var evLine = function (e) { return '<div class="ac-item" style="margin:4px 0;padding:8px 10px"><div><b>🗓 ' + esc(e.title) + '</b><small>' + fd(e.start) + (e.startTime ? ' · ' + e.startTime + (e.endTime ? '–' + e.endTime : '') : ' · seharian') + '</small></div><button class="ac-btn sm" data-act="gocal">Kalender</button></div>'; };
    function detail(g) {
      var p = pg(g), ms = msOf(g.id).sort(function (a, b) { return (a.due || '9').localeCompare(b.due || '9'); }), E = extE();
      var c = cat(g), pc = p.pct == null ? 0 : p.pct, lvl = pc >= 100 ? 5 : 1 + Math.floor(pc / 25), nx = ms.filter(function (m) { return !m.done; })[0], tk0 = tasksOf(g.id);
      var h = '<button class="ac-btn sm ac-back" data-act="opg" data-id="">← Semua goal</button><section class="gq-wh"><span class="gq-fl a">' + c[0] + '</span><span class="gq-fl b">✨</span><span class="gq-fl c">⭐</span>' +
        '<div class="gq-wtop"><span class="gq-wem">' + c[0] + '</span><div><h3>' + esc(g.name) + '</h3><div class="gq-gb">' + meta(g) + '</div></div>' + btns('goal', g.id) + '</div>' +
        '<div class="gq-bar w"><i style="width:' + pc + '%"></i></div><div class="gq-wl"><b>Level ' + lvl + ' · ' + LB[lvl - 1] + '</b><span>' + Math.round(pc) + '%</span></div><p class="gq-wn">' + p.txt + (nx ? ' · Selanjutnya: ' + esc(nx.name) : '') + '</p>' +
        '<div class="gq-wst"><div><small>Milestone</small><b>' + ms.filter(function (m) { return m.done; }).length + ' / ' + ms.length + '</b></div><div><small>Tugas selesai</small><b>' + tk0.filter(function (x) { return x.done; }).length + ' / ' + tk0.length + '</b></div><div><small>Deadline</small><b>' + fd(g.deadline) + '</b></div></div></section>' +
        (g.basis === 'num' ? '<div class="ac-meta"><span>Angka: <b>' + (+g.curNum || 0) + ' / ' + (g.tgtNum || '—') + ' ' + esc(g.unit || '') + '</b></span></div>' : '') +
        (g.why ? '<div class="ac-notes"><b>Alasan / tujuan</b>\n' + esc(g.why) + '</div>' : '') + (g.target ? '<div class="ac-notes"><b>Target</b>\n' + esc(g.target) + '</div>' : '');
      h += '<div class="ac-bar"><div class="ac-h" style="margin:0">Goal breakdown · Milestone</div>' + add('ms', 'Milestone', 'goalId', g.id) + '</div>';
      h += ms.length ? ms.map(function (m) {
        var T = tasksOf(g.id, m.id), ev = E.filter(function (e) { return e.goalRef === m.id; }), pre = esc(JSON.stringify({ goalId: g.id, msId: m.id })), lt = m.due && m.due < today() && !m.done;
        var dn = T.filter(function (x) { return x.done; }).length, tot = T.length || 1, cur = T.length ? dn : (m.done ? 1 : 0), w = m.done ? 100 : cur / tot * 100;
        return '<div class="gq-ms' + (m.done ? ' done' : '') + '"><div class="gq-mh"><span class="gq-mi">' + (m.done ? '🏆' : '🎯') + '</span><div class="ac-item' + (m.done ? ' done' : '') + '"><input type="checkbox" data-act="tgm" data-id="' + m.id + '"' + (m.done ? ' checked' : '') + ' aria-label="Tercapai"><div><button class="t" data-act="edit" data-e="ms" data-id="' + m.id + '">' + esc(m.name) + '</button>' + (lt ? badge('Lewat tenggat', 'late') : '') + '<small>' + (m.due ? 'Tenggat ' + fd(m.due) + ' · ' : '') + dn + '/' + T.length + ' tugas · ' + ev.length + ' jadwal belajar · +30 XP</small>' + (m.notes ? '<small>' + esc(m.notes) + '</small>' : '') + '</div></div>' + btns('ms', m.id) + '</div>' +
          '<div class="gq-qb"><div class="gq-bar y"><i style="width:' + w + '%"></i></div>' + CH + '<em>' + cur + ' / ' + tot + '</em></div>' +
          '<div class="tree">' + T.map(taskLine).join('') + ev.map(evLine).join('') + '<button class="ac-btn sm" data-act="add" data-e="gtask" data-pre="' + pre + '">+ Tugas</button> <button class="ac-btn sm" data-act="gocal">+ Jadwal belajar (Kalender)</button></div></div>';
      }).join('') : empty('Belum ada milestone. Pecah goal ini di bawah, atau tambahkan satu per satu.');
      var loose = tasksOf(g.id).filter(function (t) { return t.own ? !by(D.gtask, t.id).msId : !ms.some(function (m) { return extT().some(function (x) { return x.id === t.id && x.goalRef === m.id; }); }); });
      h += '<div class="ac-bar"><div class="ac-h" style="margin:0">Tugas pendukung (tanpa milestone)</div>' + add('gtask', 'Tugas', 'goalId', g.id) + '</div>' + (loose.length ? loose.map(taskLine).join('') : '<p class="ac-hint">Tidak ada.</p>');
      var ge = E.filter(function (e) { return e.goalRef === g.id; });
      h += '<div class="ac-bar"><div class="ac-h" style="margin:0">Jadwal belajar untuk goal ini</div><button class="ac-btn sm" data-act="gocal">Buka Kalender</button></div>' + (ge.length ? ge.map(evLine).join('') : '<p class="ac-hint">Buat acara di Kalender dan pilih goal/milestone pada kolom "Terkait goal / milestone". Tugas dari modul Task ditautkan dengan cara yang sama.</p>');
      h += '<div class="ac-card" style="margin-top:14px"><b>Pecah target menjadi milestone</b><p class="ac-hint" style="margin:4px 0 8px">Satu baris = satu milestone. Tenggat opsional dengan format <i>nama | 2026-12-31</i>.</p><textarea rows="4" placeholder="Menguasai kosakata dasar\nMenyelesaikan materi nahwu dasar\nMenyelesaikan materi sharaf dasar\nMembaca teks sederhana\nMeningkatkan pemahaman teks tanpa harakat" style="width:100%"></textarea><div style="margin-top:8px"><button class="ac-btn pri" data-act="bulk" data-id="' + g.id + '">Buat milestone</button></div></div>';
      var rv = D.rev.filter(function (r) { return r.goalId === g.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
      h += '<div class="ac-bar"><div class="ac-h" style="margin:0">Catatan evaluasi</div>' + add('rev', 'Evaluasi', 'goalId', g.id) + '</div>' + (rv.length ? rv.map(function (r) { return '<div class="ac-item"><div><b>' + fd(r.date) + '</b> ' + badge(r.mood, r.mood === 'Sesuai rencana' ? 'on' : r.mood === 'Tertinggal' ? 'late' : 'mid') + '<div class="ac-notes" style="margin:4px 0 0">' + esc(r.note) + '</div></div>' + btns('rev', r.id) + '</div>'; }).join('') : '<p class="ac-hint">Belum ada evaluasi. Catat secara berkala apa yang berjalan dan apa yang perlu diubah.</p>');
      return h;
    }
    return {
      skin: 'gq-skin', specs: specs, tabs: [['g', 'Goals', function () {
        var g = st.g && by(D.goal, st.g); if (!g) return list();
        var c = cat(g), fr = st.fresh; st.fresh = false;
        return '<div class="gq-world' + (fr ? ' fresh' : '') + '" style="--c1:' + c[1] + ';--c2:' + c[2] + '">' + detail(g) + '</div>' + cele();
      }]],
      sub: function () { var a = D.goal.filter(function (g) { return g.status === 'Berjalan'; }).length; return D.goal.length + ' goal · ' + a + ' berjalan'; },
      cascade: { goal: [['ms', 'goalId'], ['gtask', 'goalId'], ['rev', 'goalId']], ms: [['gtask', 'msId']] },
      guard: function (e) { if (e !== 'goal' && !D.goal.length) return ['Belum ada goal', 'Buat goal terlebih dahulu.']; },
      validate: function (e, r) {
        if (e === 'pf') { r.level = Math.max(1, Math.min(4, +r.level || 3)); if (!(+r.min > 0 && +r.xp > 0)) return 'Menit dan XP per hari harus lebih dari 0.'; }
        if (e === 'goal' && r.basis === 'num' && !(+r.tgtNum > 0)) return 'Dasar progres "angka" membutuhkan angka target lebih dari 0.';
        if (e === 'gtask' && r.msId) { var m = by(D.ms, r.msId); if (m) r.goalId = m.goalId; }
      },
      act: function (a, d, t) {
        if (a === 'opg') { st.g = d.id || null; st.fresh = !!d.id; }
        if (a === 'pfstep') { var lv = Math.max(1, Math.min(4, (+PF.level || 3) + (+d.dir))); PF.level = lv; PF.min = LV[lv][3]; PF.xp = LV[lv][4]; }
        if (a === 'claim' && PF.claims.indexOf(today()) < 0) PF.claims.push(today());
        if (a === 'cele-x') st.cele = null;
        if (a === 'cele-ok') { var cg = by(D.goal, d.id); if (cg) cg.status = 'Tercapai'; st.cele = null; }
        if (a === 'tgm') {
          var m0 = by(D.ms, d.id), g1 = by(D.goal, m0.goalId), b0 = g1 ? pg(g1).pct : 0;
          m0.done = t.checked; m0.doneAt = t.checked ? today() : '';
          if (t.checked && g1) { var a0 = pg(g1).pct; st.cele = { k: a0 >= 100 && !(b0 >= 100) ? 'goal' : 'ms', id: m0.id, g: g1.id }; }
        }
        if (a === 'tgt') {
          var k0 = by(D.gtask, d.id), g0 = by(D.goal, k0.goalId), b1 = g0 ? pg(g0).pct : 0;
          k0.status = t.checked ? 'Selesai' : 'Belum'; k0.doneAt = t.checked ? today() : '';
          if (t.checked && g0 && pg(g0).pct >= 100 && !(b1 >= 100)) st.cele = { k: 'goal', g: g0.id };
        }
        if (a === 'gotask' && MO.routes['#task']) MO.routes['#task']();
        if (a === 'gocal' && MO.routes['#calendar']) MO.routes['#calendar']();
        if (a === 'bulk') {
          var ta = t.closest('.ac-card').querySelector('textarea'), n = 0;
          ta.value.split('\n').forEach(function (ln) {
            var p = ln.split('|'), nm = p[0].trim(), due = (p[1] || '').trim(); if (!nm) return;
            D.ms.push({ id: K.uid(), goalId: d.id, name: nm, due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '', done: false, notes: '' }); n++;
          });
          if (n) MO.msg('Milestone dibuat', n + ' milestone ditambahkan');
        }
      }
    };
  });
  MO.routes['#goal'] = goals.open;
})();
;
/* MyOffice — Document Center. Metadata di localStorage, isi berkas asli di IndexedDB browser.
   Tampilan: perpustakaan rak buku (readowl.css) — folder = rak, dokumen = sampul buku. */
(function () {
  'use strict';
  var MO = window.MyOffice, K = MO.kit, esc = K.esc, fd = K.fd, by = K.by, empty = K.empty;
  var dbp;
  function db() {
    return dbp || (dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('mo-docs', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('files'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    }));
  }
  function tx(mode, fn) {
    return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('files', mode), q = fn(t.objectStore('files')); t.oncomplete = function () { res(q && q.result); }; t.onerror = function () { rej(t.error); }; }); });
  }
  var put = function (id, b) { return tx('readwrite', function (s) { return s.put(b, id); }); };
  var get = function (id) { return tx('readonly', function (s) { return s.get(id); }); };
  var rmb = function (id) { return tx('readwrite', function (s) { return s.delete(id); }).catch(function () { }); };
  var size = function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; };
  var SKIN = 'rd-skin';
  var PER_ROW = 6;

  /* ---------- Jenis berkas → warna sampul ---------- */
  var PAL = {
    pdf: ['#ff8a75', '#e5484d'], doc: ['#4aa8ff', '#2f6fe0'], xls: ['#3fd6a0', '#12a07a'], ppt: ['#ffbe55', '#f08a1c'],
    img: ['#2fd0e0', '#0e8fb0'], av: ['#a58bff', '#6a47e6'], txt: ['#fbfffd', '#d3efe6'], zip: ['#7f93a8', '#475b70'], oth: ['#86c5b8', '#3f8379']
  };
  function kind(f) {
    var t = f.type || '', n = f.name.toLowerCase(), s = t + ' ' + n;
    return /^image\//.test(t) ? 'img' : /pdf/.test(s) ? 'pdf' : /word|\.docx?$|\.odt$|\.rtf$/.test(s) ? 'doc' : /sheet|excel|\.xlsx?$|\.csv$|\.ods$/.test(s) ? 'xls'
      : /presentation|powerpoint|\.pptx?$|\.odp$/.test(s) ? 'ppt' : /^(audio|video)\//.test(t) ? 'av' : /zip|rar|7z|tar|gz/.test(s) ? 'zip' : /^text\/|\.(txt|md|json)$/.test(s) ? 'txt' : 'oth';
  }
  var hash = function (s) { var h = 0, i; for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  var extOf = function (f) { var m = /\.([a-z0-9]{1,5})$/i.exec(f.name); return (m ? m[1] : (f.type || '').split('/').pop() || 'file').slice(0, 5).toUpperCase(); };
  var baseName = function (f) { return f.name.replace(/\.[a-z0-9]{1,5}$/i, ''); };

  /* ---------- Ikon ---------- */
  var IC = {
    lib: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
    up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    fnew: '<path d="M12 10v6M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6l-4 1 1-4z"/>',
    del: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    go: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    img: '<rect width="18" height="18" x="3" y="3" rx="2.5"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    book: '<path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H9a3 3 0 0 1 3 3v15a2.5 2.5 0 0 0-2.5-2.5H3.5A1.5 1.5 0 0 1 2 17z"/><path d="M22 4.5A1.5 1.5 0 0 0 20.5 3H15a3 3 0 0 0-3 3v15a2.5 2.5 0 0 1 2.5-2.5h6a1.5 1.5 0 0 0 1.5-1.5z"/>',
    zin: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
    zout: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3M8 11h6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  var ic = function (n, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; };
  var LOGO = '<svg class="rd-owl" viewBox="0 0 64 30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11 11 3l7 5M57 11 53 3l-7 5"/><circle cx="20" cy="19" r="9"/><circle cx="44" cy="19" r="9"/><path d="M29 18.5c1.8-1.6 4.2-1.6 6 0"/><circle cx="20" cy="19" r="3" fill="currentColor" stroke="none"/><circle cx="44" cy="19" r="3" fill="currentColor" stroke="none"/></svg>';

  /* ---------- Thumbnail gambar (dibaca dari IndexedDB, di-cache) ---------- */
  var thumbs = {}, vis = [];
  var thumbable = function (f) { return !!f.cover || (/^image\/(png|jpe?g|webp|gif|avif)$/.test(f.type || '') && f.size < 12e6); };
  var coverKey = function (f) { return f.cover ? 'cv-' + f.id : f.id; };
  /* Sampul dibuat dari versi KECIL gambar (maks. 360px), bukan berkas aslinya yang bisa belasan MB.
     Didekode terkecil lewat createImageBitmap, diproses satu per satu agar halaman tidak tersendat. */
  var tq = [], tbusy = false;
  function mkThumb(b) {
    if (!window.createImageBitmap) return Promise.resolve(b);
    return createImageBitmap(b, { resizeWidth: 520, resizeQuality: 'medium' }).then(function (bm) {
      var c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
      c.getContext('2d').drawImage(bm, 0, 0); if (bm.close) bm.close();
      return new Promise(function (res) { c.toBlob(function (t) { res(t || b); }, 'image/webp', .82); });
    }).catch(function () { return b; });
  }
  function pumpThumbs() {
    if (tbusy || !tq.length) return; tbusy = true;
    var f = tq.shift();
    get(coverKey(f)).then(function (b) { return b ? mkThumb(b) : null; }).then(function (t) {
      if (!t || !(f.id in thumbs)) return;
      var u = URL.createObjectURL(t); thumbs[f.id] = u;
      Array.prototype.forEach.call(document.querySelectorAll('.rd-cover[data-id="' + f.id + '"],.rd-cover[data-fid="' + f.id + '"]'), function (n) { n.style.setProperty('--img', "url('" + u + "')"); n.classList.add('has-img'); });
    }).catch(function () { delete thumbs[f.id]; }).then(function () { tbusy = false; setTimeout(pumpThumbs, 30); });
  }
  function fetchThumbs() {
    vis.forEach(function (f) {
      if (!thumbable(f) || f.id in thumbs) return;
      thumbs[f.id] = null; tq.push(f);
    });
    pumpThumbs();
  }
  function dropThumb(id) { if (thumbs[id]) URL.revokeObjectURL(thumbs[id]); delete thumbs[id]; }

  /* Tombol unggah via label+input agar dialog berkas tidak hilang karena render ulang */
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.rd-skin label[data-pick]')) { e.preventDefault(); e.target.querySelector('input').click(); }
  });
  var readSettings = function () { try { return JSON.parse(localStorage.getItem('mo-settings-v1')) || {}; } catch (e) { return {}; } };

  var docs = K.App('Document Center', 'mo-docs-v1', function () { return { folder: [], file: [] }; }, function (app) {
    var D = app.D, st = app.st;
    var path = function (id) { var o = [], f; while (id && (f = by(D.folder, id)) && o.length < 20) { o.unshift(f); id = f.parentId; } return o; };
    var pstr = function (id) { return path(id).map(function (f) { return f.name; }).join(' / ') || 'Dokumen'; };
    var kids = function (id) { var o = [id]; D.folder.filter(function (f) { return f.parentId === id; }).forEach(function (f) { o = o.concat(kids(f.id)); }); return o; };
    var folderOpts = function () { return [['', 'Dokumen (utama)']].concat(D.folder.map(function (f) { return [f.id, pstr(f.id)]; })); };
    var specs = {
      folder: { title: 'Folder', def: {}, fields: [{ k: 'name', l: 'Nama folder', t: 'text', req: 1, full: 1 }, { k: 'parentId', l: 'Letak', t: 'select', full: 1, o: folderOpts }] },
      file: { title: 'Dokumen', def: {}, fields: [{ k: 'name', l: 'Nama dokumen', t: 'text', req: 1, full: 1 }, { k: 'folderId', l: 'Folder', t: 'select', full: 1, o: folderOpts }, { k: 'tags', l: 'Tag (pisahkan koma)', t: 'text', full: 1 }, { k: 'notes', l: 'Catatan', t: 'textarea', full: 1 }] }
    };
    var tagList = function (f) { return (f.tags || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
    var byName = function (a, b) { return a.name.localeCompare(b.name); };
    var itemCount = function (id) { return D.file.filter(function (x) { return x.folderId === id; }).length; };

    /* ----- Sampul buku ----- */
    function cover(f, extra) {
      var k = kind(f), p = PAL[k], pat = hash(f.name) % 4, img = thumbs[f.id];
      vis.push(f);
      var tip = f.name + '\n' + size(f.size) + ' · ' + fd(f.added) + (f.tags ? '\n#' + tagList(f).join(' #') : '') + (f.notes ? '\n' + f.notes : '');
      return '<button class="rd-cover k-' + k + ' p' + pat + (img ? ' has-img' : '') + (extra ? ' ' + extra : '') + '" style="--c1:' + p[0] + ';--c2:' + p[1] + (img ? ";--img:url('" + img + "')" : '') + '" data-act="view" data-id="' + f.id + '" title="' + esc(tip) + '" aria-label="Buka ' + esc(f.name) + '">' +
        '<i class="rd-art"></i><i class="rd-ext">' + esc(extOf(f)) + '</i>' + (f.rating ? '<i class="rd-rb">★ ' + f.rating + '</i>' : '') + '<b class="rd-name">' + esc(baseName(f)) + '</b>' +
        (k === 'txt' && f.idx && !f.cover ? '<span class="rd-snip">' + esc(f.idx.slice(0, 200)) + '</span>' : '') + '</button>';
    }
    function tools(f) {
      var b = function (a, ico, lb, cls, e) { return '<button class="' + (cls || '') + '" data-act="' + a + '"' + (e ? ' data-e="' + e + '"' : '') + ' data-id="' + f.id + '" aria-label="' + lb + ' ' + esc(f.name) + '" title="' + lb + '">' + ic(ico, 2) + '</button>'; };
      return '<div class="rd-tools">' + b('dl', 'dl', 'Unduh') + b('cvr', 'img', 'Ubah sampul') + b('edit', 'edit', 'Edit', '', 'file') + b('delfile', 'del', 'Hapus', 'danger') + '</div>';
    }
    var book = function (f, i) { return '<div class="rd-book" style="--i:' + Math.min(i, 14) + '">' + cover(f) + tools(f) + '<span class="rd-bt" title="' + esc(f.name) + '">' + esc(baseName(f)) + '</span></div>'; };
    var ghost = function (label) { return '<label class="rd-book rd-ghost" data-pick tabindex="0" role="button" title="Unggah dokumen ke rak ini"><span class="rd-plus">' + ic('plus', 1.6) + '</span><em>' + label + '</em><input type="file" multiple hidden data-chg="upload"></label>'; };
    var row = function (inner) { return '<div class="rd-shelf"><div class="rd-shelf-in">' + inner + '<i class="rd-ledge"></i></div></div>'; };
    function chunk(a, n) { var o = [], i; for (i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

    /* ----- Rak ----- */
    function shelf(title, sub, files, o) {
      o = o || {};
      var head = '<div class="rd-sh"><h3>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</h3><div class="rd-sh-acts">' +
        (o.folder ? '<button class="rd-ib" data-act="fcv" data-id="' + o.folder.id + '" aria-label="Ubah sampul rak ' + esc(o.folder.name) + '" title="Ubah sampul rak">' + ic('img', 1.8) + '</button>' + (o.folder.cover ? '<button class="rd-ib" data-act="fcvx" data-id="' + o.folder.id + '" aria-label="Hapus sampul rak ' + esc(o.folder.name) + '" title="Hapus sampul rak">' + ic('x', 1.8) + '</button>' : '') + '<button class="rd-ib" data-act="edit" data-e="folder" data-id="' + o.folder.id + '" aria-label="Ubah nama atau letak rak ' + esc(o.folder.name) + '" title="Edit rak">' + ic('edit', 1.8) + '</button><button class="rd-ib danger" data-act="delfolder" data-id="' + o.folder.id + '" aria-label="Hapus rak ' + esc(o.folder.name) + '" title="Hapus rak">' + ic('del', 1.8) + '</button>' : '') +
        (o.open ? '<button class="rd-more" data-act="cd" data-id="' + o.open + '">' + (o.more || 'Buka rak') + ic('go', 1.8) + '</button>' : '') + '</div></div>';
      var rows = chunk(files, PER_ROW), i = 0, body = '';
      if (!rows.length) rows = [[]];
      rows.forEach(function (r, ri) {
        var last = ri === rows.length - 1;
        body += row(r.map(function (f) { return book(f, i++); }).join('') + (o.add && last ? ghost('Unggah') : '') + (!r.length && !o.add ? '<span class="rd-void">Rak kosong</span>' : ''));
      });
      return '<section class="rd-sec">' + head + body + '</section>';
    }
    function emptyState() {
      return '<section class="rd-sec rd-empty"><div class="rd-empty-in"><div class="rd-empty-books"><i class="rd-eb e1"></i><i class="rd-eb e2"></i><i class="rd-eb e3"></i><i class="rd-ledge"></i></div>' +
        '<h3>Rak ini masih kosong</h3><p>Unggah dokumen pertama Anda, atau buat folder untuk menyusun rak baru. Berkas disimpan aman di browser ini.</p>' +
        '<div class="rd-empty-acts"><label class="rd-btn pri" data-pick tabindex="0" role="button">' + ic('up') + 'Unggah dokumen<input type="file" multiple hidden data-chg="upload"></label>' +
        '<button class="rd-btn" data-act="add" data-e="folder" data-pre="' + esc(JSON.stringify({ parentId: st.f || '' })) + '">' + ic('fnew') + 'Folder baru</button></div></div></section>';
    }
    function shelvesView(cur) {
      var sub = D.folder.filter(function (f) { return (f.parentId || '') === cur; }).sort(byName),
        fl = D.file.filter(function (f) { return (f.folderId || '') === cur; }).sort(byName), h = '';
      if (!sub.length && !fl.length) return emptyState();
      if (!cur && D.file.length >= 4) {
        var nw = D.file.slice().sort(function (a, b) { return new Date(b.added) - new Date(a.added); }).slice(0, PER_ROW);
        h += shelf('Baru diunggah', '', nw, {});
      }
      h += shelf(cur ? (by(D.folder, cur) || {}).name : 'Dokumen', fl.length + ' dokumen', fl, { add: true });
      sub.forEach(function (f) {
        var inside = D.file.filter(function (x) { return x.folderId === f.id; }).sort(byName), nsub = D.folder.filter(function (x) { return x.parentId === f.id; }).length;
        h += shelf(f.name, inside.length + ' dokumen' + (nsub ? ' · ' + nsub + ' sub-rak' : ''), inside.slice(0, PER_ROW), { folder: f, open: f.id, more: inside.length > PER_ROW ? 'Seluruh rak (' + inside.length + ')' : 'Buka rak' });
      });
      return h;
    }

    /* ----- Grid (Semua / Terbaru / hasil cari) ----- */
    function folderCover(f) {
      var img = thumbs[f.id]; if (f.cover) vis.push(f);
      return '<button class="rd-cover k-fold p' + (hash(f.name) % 4) + (img ? ' has-img' : '') + '" data-fid="' + f.id + '" style="--c1:#2fd0b4;--c2:#0b8f9c' + (img ? ";--img:url('" + img + "')" : '') + '" data-act="cd" data-id="' + f.id + '" title="' + esc(pstr(f.id)) + '" aria-label="Buka rak ' + esc(f.name) + '"><i class="rd-art"></i><i class="rd-ext">RAK</i><b class="rd-name">' + esc(f.name) + '</b><span class="rd-fico">' + ic('folder', 1.5) + '</span></button>';
    }
    function stars(n) { var o = '', i; for (i = 1; i <= 5; i++) o += '<i class="' + (i <= n ? 'on' : '') + '">★</i>'; return o; }
    function card(f, i) {
      var tg = tagList(f);
      return '<div class="rd-card" style="--i:' + Math.min(i, 14) + '"><div class="rd-book">' + cover(f) + tools(f) + '</div><div class="rd-cap"><b title="' + esc(f.name) + '">' + esc(f.name) + '</b>' +
        '<span class="rd-cm"><em>' + esc(extOf(f)) + '</em>' + size(f.size) + '</span><span class="rd-cm dt">' + fd(f.added) + '</span>' +
        '<span class="rd-cl" title="' + esc(pstr(f.folderId)) + '">' + ic('folder', 1.8) + '<span>' + esc(pstr(f.folderId)) + '</span></span>' +
        '<span class="rd-cs' + (f.rating ? '' : ' none') + '" aria-label="Rating ' + (f.rating || 0) + ' dari 5">' + stars(f.rating || 0) + '</span>' +
        (tg.length ? '<span class="rd-ct">' + tg.slice(0, 2).map(function (t) { return '<i>#' + esc(t) + '</i>'; }).join('') + (tg.length > 2 ? '<i>+' + (tg.length - 2) + '</i>' : '') + '</span>' : '') + '</div></div>';
    }
    function gridView(title, note, files, folders, none) {
      var i = 0, g = (folders || []).map(function (f) { return '<div class="rd-card"><div class="rd-book">' + folderCover(f) + '</div><div class="rd-cap"><b>' + esc(f.name) + '</b><span class="rd-cm"><em>RAK</em>' + itemCount(f.id) + ' dokumen</span><span class="rd-cl" title="' + esc(pstr(f.parentId)) + '">' + ic('folder', 1.8) + '<span>' + esc(pstr(f.parentId)) + '</span></span></div></div>'; }).join('') +
        files.map(function (f) { return card(f, i++); }).join('');
      return '<section class="rd-sec"><div class="rd-sh"><h3>' + esc(title) + '<small>' + esc(note) + '</small></h3></div>' + (g ? '<div class="rd-grid">' + g + '</div>' : '<div class="rd-none">' + none + '</div>') + '</section>';
    }

    /* ----- Kerangka: sidebar + panel ----- */
    function side(view, cur, q) {
      var last = D.last && by(D.file, D.last.id), me = readSettings(), nm = me.nick || 'Pengguna';
      var nav = function (v, ico, lb, on) { return '<button class="rd-nav' + (on ? ' on' : '') + '" data-act="rdv" data-v="' + v + '"' + (v === 'shelves' ? ' data-root="1"' : '') + (on ? ' aria-current="page"' : '') + '>' + ic(ico, 1.6) + '<span>' + lb + '</span></button>'; };
      var q0 = !q;
      return '<aside class="rd-side"><div class="rd-logo">' + LOGO + '<b>Document Center</b></div><nav class="rd-navs" aria-label="Menu Document Center">' +
        nav('shelves', 'lib', 'Perpustakaan', q0 && view === 'shelves') + nav('recent', 'clock', 'Terbaru', q0 && view === 'recent') + nav('all', 'grid', 'Semua dokumen', q0 && view === 'all') +
        '<label class="rd-nav" data-pick tabindex="0" role="button">' + ic('up', 1.6) + '<span>Unggah</span><input type="file" multiple hidden data-chg="upload"></label>' +
        '<button class="rd-nav" data-act="add" data-e="folder" data-pre="' + esc(JSON.stringify({ parentId: cur })) + '">' + ic('fnew', 1.6) + '<span>Folder baru</span></button></nav>' +
        (last ? '<div class="rd-resume"><small>Terakhir dibuka</small>' + cover(last, 'mini') + '<span title="' + esc(last.name) + '">' + esc(baseName(last)) + '</span></div>' : '<div class="rd-resume none"></div>') +
        '<button class="rd-me" data-act="rdme" aria-label="Buka pengaturan profil"><i class="rd-av"' + (me.photo ? ' style="background-image:url(&quot;' + esc(me.photo) + '&quot;)"' : '') + '></i><span>' + esc(nm) + '</span>' + ic('chev', 1.8) + '</button></aside>';
    }
    function topbar(view, q) {
      var t = function (v, lb, on) { return '<button class="rd-tab" role="tab" aria-selected="' + on + '" data-act="rdv" data-v="' + v + '">' + lb + '</button>'; };
      return '<div class="rd-top"><div class="rd-tabs" role="tablist">' + t('shelves', 'Rak', !q && view === 'shelves') + t('all', 'Semua dokumen', !q && view !== 'shelves') + '</div>' +
        '<label class="rd-search">' + ic('search', 1.7) + '<input type="text" data-in="dq" placeholder="Cari nama, tag, catatan, atau isi berkas teks…" value="' + esc(st.dq || '') + '" aria-label="Cari dokumen" autocomplete="off"></label></div>';
    }

    function vDocs() {
      var old = document.querySelector('.rd-main');
      if (old && !st.reset && (st.lq || '') === (st.dq || '')) st.rs = old.scrollTop; else st.rs = 0;
      st.reset = 0; st.lq = st.dq || '';
      vis = [];
      var q = (st.dq || '').toLowerCase().trim(), cur = st.f || '', view = st.view || 'shelves';
      if (cur && !by(D.folder, cur)) cur = st.f = '';
      var total = D.file.reduce(function (a, f) { return a + (+f.size || 0); }, 0), main, crumbs = '';
      if (q) {
        var F = D.file.filter(function (f) { return (f.name + ' ' + (f.tags || '') + ' ' + (f.notes || '') + ' ' + (f.idx || '')).toLowerCase().indexOf(q) > -1; }).sort(byName),
          Fo = D.folder.filter(function (f) { return f.name.toLowerCase().indexOf(q) > -1; }).sort(byName);
        main = gridView('Hasil pencarian', (F.length + Fo.length) + ' hasil untuk “' + (st.dq || '').trim() + '”', F, Fo, 'Tidak ada hasil. Pencarian isi berkas hanya untuk berkas teks (.txt, .md, .csv, .json).');
      } else if (view === 'all') {
        main = gridView('Semua dokumen', D.file.length + ' berkas', D.file.slice().sort(byName), null, 'Belum ada dokumen. Unggah dokumen pertama Anda lewat menu Unggah.');
      } else if (view === 'recent') {
        main = gridView('Terbaru', '24 berkas terakhir diunggah', D.file.slice().sort(function (a, b) { return new Date(b.added) - new Date(a.added); }).slice(0, 24), null, 'Belum ada dokumen. Unggah dokumen pertama Anda lewat menu Unggah.');
      } else {
        main = shelvesView(cur);
        crumbs = '<nav class="rd-crumbs" aria-label="Lokasi rak"><button class="rd-crumb' + (cur ? '' : ' on') + '" data-act="cd" data-id="">Dokumen</button>' + path(cur).map(function (f, i, a) { return '<span aria-hidden="true">/</span><button class="rd-crumb' + (i === a.length - 1 ? ' on' : '') + '" data-act="cd" data-id="' + f.id + '">' + esc(f.name) + '</button>'; }).join('') + '</nav>';
      }
      var info = '<div class="rd-info">' + (crumbs || '<span></span>') + '<small>' + D.file.length + ' dokumen · ' + D.folder.length + ' folder · ' + size(total) + ' di browser ini</small></div>';
      var html = '<div class="rd">' + side(view, cur, q) + '<div class="rd-panel"><div class="rd-main">' + topbar(view, q) + info + main + '</div></div></div>';
      setTimeout(function () { var m = document.querySelector('.rd-main'); if (m && st.rs) m.scrollTop = st.rs; fetchThumbs(); }, 0);
      return html;
    }

    /* ----- Sampul kustom: gambar dikecilkan lalu disimpan di IndexedDB (kunci cv-<id>) ----- */
    function mkCover(file) {
      if (!window.createImageBitmap) return Promise.resolve(file);
      return createImageBitmap(file, { resizeWidth: 640, resizeQuality: 'high' }).then(function (bm) {
        var c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
        c.getContext('2d').drawImage(bm, 0, 0); if (bm.close) bm.close();
        return new Promise(function (res) { c.toBlob(function (t) { res(t || file); }, 'image/webp', .9); });
      }).catch(function () { return file; });
    }
    function setCover(o, file) {
      if (!file) return Promise.resolve();
      if (!/^image\//.test(file.type || '')) { MO.msg('Bukan gambar', 'Pilih berkas gambar (JPG, PNG, atau WEBP) untuk sampul.'); return Promise.resolve(); }
      return mkCover(file).then(function (b) { return put('cv-' + o.id, b); }).then(function () {
        o.cover = Date.now(); dropThumb(o.id); app.save(); app.render(); MO.msg('Sampul diubah', 'Sampul baru sudah dipasang.');
      }).catch(function () { MO.msg('Gagal', 'Sampul tidak dapat disimpan di browser ini.'); });
    }
    function clearCover(o) { rmb('cv-' + o.id); delete o.cover; dropThumb(o.id); app.save(); app.render(); }
    function pickCover(o, done) {
      var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.style.display = 'none'; document.body.appendChild(i);
      i.addEventListener('change', function () { var f = i.files && i.files[0]; i.remove(); if (f) setCover(o, f).then(done); });
      i.addEventListener('cancel', function () { i.remove(); });
      i.click();
    }

    /* ----- Halaman keterangan: sampul besar, info, rating, tombol Baca & Unduh ----- */
    var kindName = { pdf: 'Dokumen PDF', doc: 'Dokumen Word', xls: 'Lembar kerja', ppt: 'Presentasi', img: 'Gambar', av: 'Audio / video', txt: 'Teks', zip: 'Arsip', oth: 'Berkas' };
    var readable = function (f) { var k = kind(f); return k === 'pdf' || k === 'img' || k === 'txt' || k === 'av'; };
    function detail(f) {
      var k = kind(f), p = PAL[k], tg = tagList(f), cur = f.rating || 0, urls = [];
      var ov = el2('ac-ov ac-ov2 ' + SKIN + ' rd-det-ov', '<div class="rd-det" role="dialog" aria-modal="true" aria-label="Keterangan ' + esc(f.name) + '"><button class="rd-det-x" data-x aria-label="Tutup">' + ic('x', 2) + '</button>' +
        '<div class="rd-det-cv"><div class="rd-book"><div class="rd-cover k-' + k + ' p' + (hash(f.name) % 4) + '" style="--c1:' + p[0] + ';--c2:' + p[1] + '"><i class="rd-art"></i><i class="rd-ext">' + esc(extOf(f)) + '</i><b class="rd-name">' + esc(baseName(f)) + '</b></div></div></div>' +
        '<div class="rd-det-bd"><h2 class="rd-det-t">' + esc(f.name) + '</h2><p class="rd-det-sub">' + kindName[k] + ' · ' + size(f.size) + '</p>' +
        '<div class="rd-rate" role="radiogroup" aria-label="Rating dokumen"></div>' +
        '<dl class="rd-meta"><div><dt>Jenis</dt><dd>' + esc(extOf(f)) + '</dd></div><div><dt>Ukuran</dt><dd>' + size(f.size) + '</dd></div><div><dt>Diunggah</dt><dd>' + fd(f.added) + '</dd></div><div><dt>Letak</dt><dd title="' + esc(pstr(f.folderId)) + '">' + esc(pstr(f.folderId)) + '</dd></div></dl>' +
        (tg.length ? '<div class="rd-det-tags">' + tg.map(function (t) { return '<i>#' + esc(t) + '</i>'; }).join('') + '</div>' : '') +
        (f.notes ? '<p class="rd-det-notes">' + esc(f.notes) + '</p>' : '') +
        '<div class="rd-det-acts"><button class="rd-btn pri" data-do="read"' + (readable(f) ? '' : ' disabled title="Jenis berkas ini tidak bisa dibaca di browser, silakan unduh"') + '>' + ic('book', 1.8) + 'Baca</button><button class="rd-btn" data-do="dl">' + ic('dl', 1.8) + 'Unduh</button></div>' +
        (readable(f) ? '' : '<p class="rd-det-hint">Jenis berkas ini belum bisa dibaca langsung di browser. Unduh untuk membukanya dengan aplikasi yang sesuai.</p>') +
        '<div class="rd-det-more"><button data-do="cover">' + ic('img', 1.8) + 'Ubah sampul</button>' + (f.cover ? '<button data-do="nocover">' + ic('x', 1.8) + 'Hapus sampul</button>' : '') + '<button data-do="edit">' + ic('edit', 1.8) + 'Edit keterangan</button><button data-do="del" class="danger">' + ic('del', 1.8) + 'Hapus</button></div></div></div>');
      document.body.appendChild(ov);
      var rate = ov.querySelector('.rd-rate');
      function drawRate() {
        var h = '', i; for (i = 1; i <= 5; i++) h += '<button role="radio" aria-checked="' + (i === cur) + '" class="' + (i <= cur ? 'on' : '') + '" data-n="' + i + '" aria-label="' + i + ' bintang">★</button>';
        rate.innerHTML = h + '<span>' + (cur ? cur + ' / 5' : 'Belum dinilai') + '</span>';
      }
      drawRate();
      /* sampul sebenarnya (gambar kustom, atau gambar itu sendiri) dimuat belakangan */
      var cv = ov.querySelector('.rd-cover');
      if (f.cover || k === 'img') get(f.cover ? 'cv-' + f.id : f.id).then(function (b) {
        if (!b || !ov.isConnected) return; var u = URL.createObjectURL(b); urls.push(u); cv.style.setProperty('--img', "url('" + u + "')"); cv.classList.add('has-img');
      }).catch(function () { });
      var off = function () { ov.remove(); urls.forEach(function (u) { URL.revokeObjectURL(u); }); };
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) off(); });
      ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); off(); } });
      ov.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-x')) return off();
        if (t.dataset.n) { var n = +t.dataset.n; cur = cur === n ? 0 : n; f.rating = cur; if (!cur) delete f.rating; app.save(); drawRate(); app.render(); return; }
        var d = t.dataset.do; if (!d) return;
        if (d === 'read') withBlob(f.id, reader);
        if (d === 'dl') withBlob(f.id, download);
        if (d === 'cover') pickCover(f, function () { off(); detail(by(D.file, f.id) || f); });
        if (d === 'nocover') { clearCover(f); off(); detail(f); }
        if (d === 'del') { off(); var db = document.querySelector('.rd-skin [data-act="delfile"][data-id="' + f.id + '"]'); if (db) db.click(); }
        if (d === 'edit') { off(); var eb = document.querySelector('.rd-skin [data-act="edit"][data-e="file"][data-id="' + f.id + '"]'); if (eb) eb.click(); }
      });
      var first = ov.querySelector('[data-do="read"]:not([disabled])') || ov.querySelector('[data-do="dl"]'); if (first) first.focus();
    }

    /* ----- Pembaca di dalam aplikasi (tanpa tab baru) dengan zoom in / out ----- */
    var pdfLib = null;
    function loadPdfJs() {
      if (pdfLib) return pdfLib;
      var base = document.baseURI;
      return (pdfLib = import(new URL('pdfjs/pdf.min.mjs', base).href).then(function (m) {
        m.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', base).href; return m;
      }).catch(function (e) { pdfLib = null; throw e; }));
    }
    function reader(f, blob) {
      var k = kind(f), t = f.type || blob.type || '', url = URL.createObjectURL(blob), z = 1, ZMIN = .5, ZMAX = 4, apply = function () { }, cleanup = [];
      var ov = el2('ac-ov ac-ov2 ' + SKIN + ' rd-rdr-ov', '<div class="rd-rdr" role="dialog" aria-modal="true" aria-label="Membaca ' + esc(f.name) + '">' +
        '<header class="rd-rdr-h"><div class="rd-rdr-ti"><b title="' + esc(f.name) + '">' + esc(f.name) + '</b><small class="rd-rdr-pg"></small></div>' +
        '<div class="rd-zoom" role="group" aria-label="Zoom"><button data-z="out" aria-label="Perkecil" title="Perkecil (−)">' + ic('zout', 1.9) + '</button><button class="pct" data-z="fit" aria-label="Kembali ke ukuran awal" title="Ukuran awal (0)">100%</button><button data-z="in" aria-label="Perbesar" title="Perbesar (+)">' + ic('zin', 1.9) + '</button></div>' +
        '<button class="rd-rdr-b" data-do="dl" title="Unduh">' + ic('dl', 1.9) + '<span>Unduh</span></button><button class="rd-rdr-b x" data-x aria-label="Tutup pembaca" title="Tutup">' + ic('x', 2) + '</button></header>' +
        '<div class="rd-rdr-body" tabindex="0"><div class="rd-rdr-doc"></div></div></div>');
      document.body.appendChild(ov);
      var body = ov.querySelector('.rd-rdr-body'), doc = ov.querySelector('.rd-rdr-doc'), pct = ov.querySelector('.pct'), pgl = ov.querySelector('.rd-rdr-pg');
      var setZ = function (v) { z = Math.max(ZMIN, Math.min(ZMAX, Math.round(v * 100) / 100)); pct.textContent = Math.round(z * 100) + '%'; apply(); };
      var off = function () { cleanup.forEach(function (fn) { try { fn(); } catch (e) { } }); ov.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 3000); };
      ov.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-x')) return off();
        if (b.dataset.do === 'dl') return download(f, blob);
        if (b.dataset.z === 'in') setZ(z + .25); if (b.dataset.z === 'out') setZ(z - .25); if (b.dataset.z === 'fit') setZ(1);
      });
      ov.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); off(); }
        else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZ(z + .25); }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZ(z - .25); }
        else if (e.key === '0') { e.preventDefault(); setZ(1); }
      });
      body.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZ(z + (e.deltaY < 0 ? .15 : -.15)); } }, { passive: false });
      body.focus();

      if (k === 'img') {
        doc.innerHTML = '<img class="rd-rdr-img" src="' + url + '" alt="' + esc(f.name) + '" draggable="false">';
        apply = function () { doc.firstChild.style.width = (z * 100) + '%'; };
      } else if (/^video\//.test(t)) { doc.innerHTML = '<video src="' + url + '" controls style="width:100%;max-height:78dvh;border-radius:14px;background:#000"></video>'; ov.querySelector('.rd-zoom').style.display = 'none'; }
      else if (/^audio\//.test(t)) { doc.innerHTML = '<audio src="' + url + '" controls style="width:100%"></audio>'; ov.querySelector('.rd-zoom').style.display = 'none'; }
      else if (k === 'txt') {
        blob.text().then(function (x) { doc.innerHTML = '<pre class="rd-rdr-txt">' + esc(x.slice(0, 400000)) + '</pre>'; apply(); });
        apply = function () { var p = doc.querySelector('pre'); if (p) p.style.fontSize = (14 * z) + 'px'; };
      } else if (k === 'pdf') {
        doc.innerHTML = '<div class="rd-rdr-load">Memuat dokumen…</div>';
        blob.arrayBuffer().then(function (buf) { return loadPdfJs().then(function (lib) { return lib.getDocument({ data: buf }).promise; }); })
          .then(function (pdf) { if (!ov.isConnected) { pdf.destroy(); return; } cleanup.push(function () { pdf.destroy(); }); renderPdf(pdf); })
          .catch(function () { pdfFallback(); });
      } else { doc.innerHTML = '<div class="rd-rdr-load">Jenis berkas ini tidak bisa dibaca di browser. Gunakan tombol Unduh.</div>'; ov.querySelector('.rd-zoom').style.display = 'none'; }

      /* PDF: tiap halaman digambar ke kanvas saat terlihat; zoom menggambar ulang dengan ketajaman penuh */
      function renderPdf(pdf) {
        doc.innerHTML = ''; doc.classList.add('pdf');
        var pages = [], io, dpr = Math.min(2, window.devicePixelRatio || 1), n = pdf.numPages, timer = 0;
        var baseW = function () { return Math.min(body.clientWidth - 36, 940); };
        pgl.textContent = 'Halaman 1 dari ' + n;
        io = new IntersectionObserver(function (es) { es.forEach(function (e) { var p = e.target.__p; p.vis = e.isIntersecting; if (p.vis) draw(p); }); }, { root: body, rootMargin: '700px 0px' });
        cleanup.push(function () { io.disconnect(); clearTimeout(timer); pages.forEach(function (p) { if (p.task) p.task.cancel(); }); });
        function size1(p) { var w = baseW() * z; p.box.style.width = w + 'px'; p.box.style.height = (w * p.h / p.w) + 'px'; }
        function draw(p) {
          var w = baseW() * z, key = Math.round(w);
          if (p.done === key) return; if (p.task) { p.task.cancel(); p.task = null; }
          var vp = p.page.getViewport({ scale: w / p.w * dpr }), c = p.cv || (p.cv = document.createElement('canvas'));
          var tmp = document.createElement('canvas'); tmp.width = Math.floor(vp.width); tmp.height = Math.floor(vp.height);
          p.task = p.page.render({ canvasContext: tmp.getContext('2d'), viewport: vp });
          p.task.promise.then(function () {
            p.task = null; p.done = key; c.width = tmp.width; c.height = tmp.height; c.getContext('2d').drawImage(tmp, 0, 0);
            c.style.width = '100%'; c.style.height = '100%'; if (!c.parentNode) p.box.appendChild(c); p.box.classList.add('ok');
          }).catch(function () { });
        }
        apply = function () { pages.forEach(function (p) { size1(p); }); clearTimeout(timer); timer = setTimeout(function () { pages.forEach(function (p) { if (p.vis) draw(p); }); }, 140); };
        var chain = Promise.resolve(), i;
        function add(no) {
          return pdf.getPage(no).then(function (pg) {
            var v = pg.getViewport({ scale: 1 }), box = document.createElement('div'); box.className = 'rd-pg'; box.setAttribute('data-no', no);
            var p = { page: pg, w: v.width, h: v.height, box: box, vis: false }; box.__p = p; pages.push(p); size1(p); doc.appendChild(box); io.observe(box);
          });
        }
        for (i = 1; i <= n; i++) (function (no) { chain = chain.then(function () { return ov.isConnected ? add(no) : null; }); })(i);
        body.addEventListener('scroll', function () {
          var mid = body.scrollTop + body.clientHeight * .35, cur = 1; pages.forEach(function (p) { if (p.box.offsetTop <= mid) cur = +p.box.getAttribute('data-no'); });
          pgl.textContent = 'Halaman ' + cur + ' dari ' + n;
        }, { passive: true });
        var rz = function () { apply(); }; window.addEventListener('resize', rz); cleanup.push(function () { window.removeEventListener('resize', rz); });
      }
      /* Cadangan bila pdf.js tidak bisa dimuat (mis. dibuka langsung dari file://): penampil PDF bawaan browser, tetap di dalam halaman ini */
      function pdfFallback() {
        doc.innerHTML = '<div class="rd-rdr-fb"><iframe src="' + url + '#toolbar=0&navpanes=0" title="' + esc(f.name) + '"></iframe></div>';
        var fr = doc.firstChild; pgl.textContent = '';
        apply = function () { fr.style.transform = 'scale(' + z + ')'; fr.style.width = (100 / z) + '%'; fr.style.height = (100 / z) + '%'; };
        apply();
      }
    }
    var el2 = K.el;
    function download(f, blob) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 10000); }
    function withBlob(id, fn) { var f = by(D.file, id); if (!f) return; get(id).then(function (b) { if (!b) return MO.msg('Berkas tidak ditemukan', 'Isinya hilang dari penyimpanan browser.'); fn(f, b); }).catch(function () { MO.msg('Gagal', 'Penyimpanan browser tidak dapat dibaca.'); }); }
    return {
      skin: SKIN,
      specs: specs, tabs: [['d', 'Dokumen', vDocs]], sub: function () { return D.file.length + ' dokumen · ' + D.folder.length + ' folder'; },
      cascade: { folder: [] },
      act: function (a, d, t, ev) {
        if (a === 'cd') { st.f = d.id || ''; st.dq = ''; st.view = 'shelves'; st.reset = 1; }
        if (a === 'rdv') { st.view = d.v; st.dq = ''; if (d.root) st.f = ''; st.reset = 1; }
        if (a === 'rdme') {
          var ov = ev && ev.target.closest('.ac-ov'), x = ov && ov.querySelector('[data-act="close"]');
          if (x) x.click(); setTimeout(function () { if (MO.routes['#settings']) MO.routes['#settings'](); }, 60);
        }
        if (a === 'view') { var vf = by(D.file, d.id); if (vf) { D.last = { id: d.id, t: Date.now() }; detail(vf); } }
        if (a === 'cvr') { var cf = by(D.file, d.id); if (cf) pickCover(cf); }
        if (a === 'fcv') { var cfo = by(D.folder, d.id); if (cfo) pickCover(cfo); }
        if (a === 'fcvx') { var cfx = by(D.folder, d.id); if (cfx) clearCover(cfx); }
        if (a === 'dl') withBlob(d.id, download);
        if (a === 'upload') {
          var fs = Array.prototype.slice.call(t.files || []); t.value = ''; if (!fs.length) return;
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
          MO.msg('Mengunggah…', fs.length + ' berkas');
          Promise.all(fs.map(function (f) {
            var id = K.uid(), m = { id: id, name: f.name, size: f.size, type: f.type || '', folderId: st.f || '', added: new Date().toISOString(), notes: '', tags: '', idx: '' };
            return put(id, f).then(function () {
              if ((/^text\//.test(f.type) || /\.(txt|md|csv|json)$/i.test(f.name)) && f.size < 2e6) return f.text().then(function (x) { m.idx = x.slice(0, 20000); return m; });
              return m;
            });
          })).then(function (ms) { ms.forEach(function (m) { D.file.push(m); }); app.save(); app.render(); MO.msg('Selesai', ms.length + ' dokumen tersimpan'); })
            .catch(function () { MO.msg('Gagal mengunggah', 'Penyimpanan browser penuh atau diblokir.'); });
        }
        if (a === 'delfile') { var f = by(D.file, d.id); if (f && confirm('Hapus "' + f.name + '" dari Document Center?')) { rmb(f.id); rmb('cv-' + f.id); dropThumb(f.id); if (D.last && D.last.id === f.id) D.last = null; D.file = D.file.filter(function (x) { return x.id !== f.id; }); } }
        if (a === 'delfolder') {
          var ids = kids(d.id), fl = D.file.filter(function (x) { return ids.indexOf(x.folderId) > -1; });
          if (confirm('Hapus folder ini beserta ' + (ids.length - 1) + ' subfolder dan ' + fl.length + ' dokumen di dalamnya?')) {
            fl.forEach(function (x) { rmb(x.id); rmb('cv-' + x.id); dropThumb(x.id); if (D.last && D.last.id === x.id) D.last = null; }); D.file = D.file.filter(function (x) { return ids.indexOf(x.folderId) < 0; }); D.folder = D.folder.filter(function (x) { return ids.indexOf(x.id) < 0; });
            ids.forEach(function (i) { rmb('cv-' + i); dropThumb(i); });
            if (ids.indexOf(st.f) > -1) st.f = '';
          }
        }
      },
      validate: function (e, r) { if (e === 'folder' && r.parentId && r.id && kids(r.id).indexOf(r.parentId) > -1) return 'Folder tidak bisa dipindahkan ke dalam dirinya sendiri.'; }
    };
  });
  MO.routes['#documents'] = docs.open;
})();
;
/* MyOffice — Analytics. Membaca data semua modul (hanya baca) dan menyusun grafik + analisis berbasis aturan. */
(function () {
  'use strict';
  var MO = window.MyOffice, K = MO.kit, esc = K.esc, rp = K.rp, stat = K.stat, empty = K.empty, by = K.by, btns = K.btns, add = K.add, bar = K.bar;
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + (+f(x) || 0); }, 0); };
  var n1 = function (n) { return String(Math.round(n * 10) / 10); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var addM = function (ym, n) { var d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
  var mlab = function (ym) { return new Date(ym + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short' }); };
  var addD = function (s, n) { return new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); };
  var cut = function (v, n) { return String(v || '').slice(0, n); };
  var short = function (v) { var a = Math.abs(v); return (v < 0 ? '-' : '') + (a >= 1e6 ? n1(a / 1e6) + 'jt' : a >= 1e3 ? Math.round(a / 1e3) + 'rb' : Math.round(a)); };

  /* kolom grafik: labels, a (utama), b (opsional); fmt untuk label nilai */
  function vb(labels, a, b, f) {
    var mx = Math.max.apply(null, a.concat(b || [], [0.0001]));
    return '<div class="vb">' + labels.map(function (l, i) { return '<div><span>' + (f ? f(a[i]) : n1(a[i])) + '</span><div class="bs"><i style="height:' + a[i] / mx * 100 + '%"></i>' + (b ? '<i class="alt" style="height:' + b[i] / mx * 100 + '%"></i>' : '') + '</div><span>' + esc(l) + '</span></div>'; }).join('') + '</div>';
  }
  function hb(rows, f) {
    if (!rows.length) return '<p class="ac-hint">Belum ada data.</p>';
    var mx = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([0.0001]));
    return '<div class="ac-bars">' + rows.map(function (r) { return '<div class="ac-bar2"><span>' + esc(r[0]) + '</span><div class="ac-track"><i style="width:' + r[1] / mx * 100 + '%"></i></div><span>' + (f ? f(r[1]) : n1(r[1])) + '</span></div>'; }).join('') + '</div>';
  }
  var LBL = {};
  var H = function (t) { return '<div class="ac-h">' + esc(LBL[t] || t) + '</div>'; };
  var HK = ['Skor kondisi', 'Pengeluaran per kategori', 'Status tugas', 'Angka utama', 'Capaian', 'Pintasan', 'Analisis otomatis', 'Catatan saya', 'IP per semester (batang oranye = target)', 'Nilai akhir mata kuliah aktif', 'Distribusi huruf mutu', 'Status tugas kuliah', 'Waktu belajar per mata kuliah (jam)', 'Arus kas 6 bulan (batang gelap = pemasukan, oranye = pengeluaran)', 'Pemasukan pribadi vs pendapatan pekerjaan (bulan ini)', 'Pengeluaran per kategori (bulan ini)', 'Saldo per akun aktif', 'Progres target tabungan (%)', 'Jam kerja tercatat per pekerjaan', 'Pendapatan pekerjaan menurut status (terpisah dari pemasukan pribadi)', 'Pekerjaan menurut status', 'Progres proyek (tugas/milestone selesai, %)', 'Tindak lanjut rapat organisasi', 'Tugas selesai per minggu (8 minggu terakhir)', 'Task menurut status', 'Tugas aktif per area', 'Goal berjalan menurut horizon'];
  var wrap = function (h) { var p = h.split('<div class="ac-h">'); return p[0] + p.slice(1).map(function (x) { return '<section class="an-sec"><div class="ac-h">' + x + '</section>'; }).join(''); };
  var ART = '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="anG" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#FFE98F"/><stop offset="1" stop-color="#FFB52E"/></radialGradient></defs><rect width="400" height="300" fill="url(#anG)"/><g fill="#FFF6C9" opacity=".75"><rect x="52" y="120" width="34" height="90" rx="17"/><rect x="96" y="90" width="34" height="120" rx="17"/><rect x="270" y="100" width="34" height="110" rx="17"/><rect x="314" y="70" width="34" height="140" rx="17"/></g><circle cx="200" cy="120" r="82" fill="#FFD23F"/><circle cx="168" cy="108" r="11" fill="#3b2a12"/><circle cx="232" cy="108" r="11" fill="#3b2a12"/><circle cx="171" cy="104" r="4" fill="#fff"/><circle cx="235" cy="104" r="4" fill="#fff"/><circle cx="140" cy="140" r="14" fill="#FF8F5A" opacity=".8"/><circle cx="260" cy="140" r="14" fill="#FF8F5A" opacity=".8"/><path d="M178 138q22 30 44 0z" fill="#3b2a12"/></svg>';
  var seed = function () {
    return {
      cfg: { maxWeekHours: 45, ipTarget: 3, overdueMax: 3, spendRise: 20, budgetWarn: 80 }, title: 'Analytics', sub: 'Membaca data dari semua modul · hanya baca', lbl: {}, hid: {},
      theme: { bg1: '#D5D8E4', bg2: '#C3C7D7', a1: '#6C5CE7', a2: '#FF6A1F', ink: '#1E1B4B' },
      hero: [{ id: 'h', title: 'Total saldo', big: 'c2', meta: 'Pengeluaran bulan ini', big2: 'c3', cta: 'Buka analisis keuangan', ctaTab: 'fin', img: '' }],
      card: [
        { id: 'c1', icon: '🎓', title: 'IPK', src: 'ipk', val: '', color: '0', tab: 'acad', note: 'Dihitung dari formula nilai kampus yang sedang dipilih di Academic Management. Aktifkan formula agar angkanya muncul.' },
        { id: 'c2', icon: '💰', title: 'Total saldo', src: 'saldo', val: '', color: '1', tab: 'fin', note: 'Jumlah saldo semua akun aktif di menu Financial.' },
        { id: 'c3', icon: '🧾', title: 'Pengeluaran bulan ini', src: 'spend', val: '', color: '2', tab: 'fin', note: 'Total pengeluaran sejak tanggal 1 bulan ini.' },
        { id: 'c4', icon: '✅', title: 'Tugas aktif', src: 'tasks', val: '', color: '3', tab: 'prod', note: 'Tugas di menu Task yang belum selesai atau diarsipkan.' },
        { id: 'c5', icon: '📚', title: 'Mata kuliah aktif', src: 'courses', val: '', color: '4', tab: 'acad', note: 'Mata kuliah pada semester yang sedang aktif.' },
        { id: 'c6', icon: '🎯', title: 'Goal berjalan', src: 'goals', val: '', color: '0', tab: '', note: 'Goal berstatus Berjalan di menu Goals.' }],
      note: [], chart: []
    };
  };
  var AUTOOPT = [['manual', 'Isi manual'], ['courses', 'Otomatis: mata kuliah aktif'], ['ipk', 'Otomatis: IPK'], ['tasks', 'Otomatis: tugas aktif'], ['saldo', 'Otomatis: total saldo'], ['spend', 'Otomatis: pengeluaran bulan ini'], ['goals', 'Otomatis: goal berjalan']];
  var TABOPT = [['', 'Tidak ada'], ['ins', 'Ringkasan & Analisis'], ['acad', 'Akademik'], ['fin', 'Keuangan'], ['work', 'Kerja & Proyek'], ['prod', 'Produktivitas'], ['mine', 'Grafik Saya'], ['cfg', 'Pengaturan']];
  var COL = [['0', 'Lavender'], ['1', 'Peach'], ['2', 'Mint'], ['3', 'Pink'], ['4', 'Putih']];
  var readImg = function (f, cb) { var r = new FileReader(); r.onload = function () { var im = new Image(); im.onload = function () { var k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .85)); }; im.src = r.result; }; r.readAsDataURL(f); };
  var parseRows = function (t) { var o = []; String(t || '').split('\n').forEach(function (l) { var i = l.lastIndexOf(':'); if (i < 0) return; var n = l.slice(i + 1).split(',').map(parseFloat); if (isNaN(n[0])) return; o.push({ l: l.slice(0, i).trim() || '—', a: n[0], b: isNaN(n[1]) ? null : n[1] }); }); return o; };
  var score = function (I) { var g = 0, f = 0, n = 0; I.forEach(function (x) { if (x[1] === 'Belum cukup data') return; n++; if (x[0] === 'good') g++; else if (x[0] === 'info') f += .5; }); return n ? Math.round((g + f) / n * 100) / 10 : null; };

  var an = K.App('Analytics', 'mo-an-v1', seed, function (app) {
    var D = app.D, st = app.st, S0 = seed(); Object.keys(S0).forEach(function (k) { if (D[k] == null) D[k] = S0[k]; });
    D.cfg = Object.assign({}, S0.cfg, D.cfg); D.theme = Object.assign({}, S0.theme, D.theme); LBL = D.lbl;
    if (D.v !== 2) { D.v = 2; var im = D.hero[0] && D.hero[0].img; D.theme = S0.theme; D.hero = S0.hero; D.hero[0].img = im || ''; }
    var today = K.todayS;

    /* ---------- Akademik: memakai konfigurasi formula yang Anda simpan ---------- */
    function acad(cid) {   /* v5.2: per kampus (default: kampus terpilih di Academic) — rumus nilai, IP, IPK tidak digabung */
      var A = (window.MyOffice && window.MyOffice.acadSlice) ? window.MyOffice.acadSlice(cid) : ls('mo-acad-v1'), cfg = A.cfg || {}, ok = !!cfg.confirmed, C = A.course || [], T = A.task || [], X = A.exam || [], has = function (v) { return v !== '' && v != null && !isNaN(+v); };
      var catOf = function (t) { return (cfg.cats || []).some(function (c) { return c.n === t; }) ? t : 'Tugas'; };
      function fs(c) {
        if (has(c.manual)) return +c.manual; if (!ok) return null;
        var it = [], num = 0, den = 0, all = 0;
        T.forEach(function (t) { if (t.courseId === c.id && has(t.score)) it.push({ c: catOf(t.type), s: +t.score, w: +t.weight > 0 ? +t.weight : 1 }); });
        X.forEach(function (e) { if (e.courseId === c.id && has(e.score)) it.push({ c: e.type, s: +e.score, w: +e.weight > 0 ? +e.weight : 1 }); });
        (cfg.cats || []).forEach(function (k) {
          var w = +k.w || 0; all += w; var xs = it.filter(function (i) { return i.c === k.n; }); if (!xs.length || !w) return;
          var sw = 0, ss = 0; xs.forEach(function (i) { sw += i.w; ss += i.s * i.w; }); num += w * ss / sw; den += w;
        });
        return den ? (cfg.normalize ? num / den : num / (all || 100)) : null;
      }
      var lt = function (s) { if (s == null || !ok) return null; return (cfg.scale || []).slice().sort(function (a, b) { return b.min - a.min; }).filter(function (r) { return s >= r.min; })[0] || null; };
      var ip = function (cs) { var a = 0, b = 0; cs.forEach(function (c) { var L = lt(fs(c)), k = +c.sks || 0; if (L && k) { a += L.p * k; b += k; } }); return b ? a / b : null; };
      return { A: A, ok: ok, C: C, T: T, X: X, fs: fs, lt: lt, ip: ip, ipk: ip(C) };
    }
    /* ---------- Keuangan ---------- */
    function fin() {
      var F = ls('mo-fin-v1'), tx = F.tx || [], acc = (F.acc || []).filter(function (a) { return a.active; });
      var bal = function (a) { var b = +a.opening || 0; tx.forEach(function (t) { var x = +t.amount || 0; if (t.accId === a.id) b += t.type === 'Income' ? x : -x; if (t.type === 'Transfer' && t.toAccId === a.id) b += x; }); return b; };
      var m = function (type, ym, f) { return sum(tx.filter(function (t) { return t.type === type && cut(t.date, 7) === ym && (!f || f(t)); }), function (t) { return t.amount; }); };
      return { F: F, tx: tx, acc: acc, bal: bal, m: m, total: sum(acc, bal) };
    }

    /* ---------- Analisis (aturan sederhana, ambang bisa diatur) ---------- */
    function insights() {
      var c = D.cfg, I = [], td = today(), wk0 = addD(td, -6), ym = td.slice(0, 7);
      var W = ls('mo-work-v1'), P = ls('mo-proj-v1'), TK = ls('mo-task-v1'), O = ls('mo-org-v1'), G = ls('mo-goal-v1'), AA = ls('mo-acad-v1'), f = fin();   /* v5.2: AA = semua kampus (hanya untuk beban waktu & tenggat) */
      var workH = sum((W.log || []).filter(function (l) { return l.date >= wk0 && l.date <= td; }), function (l) { return l.hours; });
      var studyH = sum((AA.study || []).filter(function (s) { return s.date >= wk0 && s.date <= td; }), function (s) { return s.minutes; }) / 60;
      if (workH + studyH > 0) {
        if (workH + studyH > c.maxWeekHours) I.push(['warn', 'Beban kerja dan belajar tinggi', '7 hari terakhir tercatat ' + n1(workH + studyH) + ' jam (kerja ' + n1(workH) + ' + belajar ' + n1(studyH) + '), di atas ambang ' + c.maxWeekHours + ' jam. Sisihkan waktu istirahat dan tunda hal yang tidak mendesak.']);
        else I.push(['good', 'Beban masih terkendali', n1(workH + studyH) + ' jam tercatat dalam 7 hari terakhir (ambang ' + c.maxWeekHours + ' jam).']);
      }
      var cps = (AA.campuses && AA.campuses.length) ? AA.campuses : [{ id: 'main', name: '' }];
      cps.forEach(function (cp) {   /* v5.2: analisis IPK dibuat terpisah untuk tiap kampus */
        var a = acad(cp.id), tg = cps.length > 1 ? ' — ' + cp.name : '';
        if (a.ok && a.ipk != null) {
          var low = a.C.map(function (x) { return { n: x.name, L: a.lt(a.fs(x)) }; }).filter(function (x) { return x.L; }).sort(function (p, q) { return p.L.p - q.L.p; }).slice(0, 3);
          if (a.ipk >= c.ipTarget) I.push(['good', 'IPK sesuai target' + tg, 'IPK ' + n1(Math.round(a.ipk * 100) / 100) + ' ≥ target ' + c.ipTarget + '. Pertahankan ritme belajar.']);
          else I.push(['warn', 'IPK di bawah target' + tg, 'IPK ' + (Math.round(a.ipk * 100) / 100) + ' < target ' + c.ipTarget + '.' + (low.length ? ' Mata kuliah yang perlu dipelajari lagi: ' + low.map(function (x) { return x.n + ' (' + x.L.l + ')'; }).join(', ') + '.' : '')]);
        } else if (!a.ok && a.C.length) I.push(['info', 'Formula nilai belum aktif' + tg, 'Aktifkan formula di Academic Management → Formula Nilai' + (cps.length > 1 ? ' (pilih kampus ' + cp.name + ' dulu)' : '') + ' agar IP/IPK dan analisis akademik bisa dihitung.']);
      });
      var od = sum((TK.task || []), function (t) { return t.due && t.due < td && t.status !== 'Done' && t.status !== 'Archived' ? 1 : 0; }) + sum(AA.task || [], function (t) { return t.status !== 'Selesai' && t.deadline && cut(t.deadline, 10) < td ? 1 : 0; }) + sum(W.wtask || [], function (t) { return t.status !== 'Selesai' && t.deadline && t.deadline < td ? 1 : 0; }) + sum(O.followup || [], function (t) { return t.status !== 'Selesai' && t.due && t.due < td ? 1 : 0; }) + sum(P.ptask || [], function (t) { return t.status !== 'Selesai' && t.due && t.due < td ? 1 : 0; });
      if (od > c.overdueMax) I.push(['warn', od + ' tugas lewat tenggat', 'Jumlahnya melebihi ambang ' + c.overdueMax + '. Pilih 1–3 yang paling penting, selesaikan, lalu jadwalkan ulang sisanya.']);
      else if (od > 0) I.push(['info', od + ' tugas lewat tenggat', 'Masih dalam batas ' + c.overdueMax + '. Tinjau di Task → Overdue.']);
      var ex = (AA.exam || []).filter(function (e) { return e.date && cut(e.date, 10) >= td && cut(e.date, 10) <= addD(td, 7); });
      if (ex.length) I.push(['info', ex.length + ' ujian dalam 7 hari', ex.map(function (e) { var cc = (AA.course || []).filter(function (x) { return x.id === e.courseId; })[0]; return e.type + ' ' + (cc ? cc.name : ''); }).join(', ') + '. Jadwalkan sesi belajar di Kalender.']);
      if (f.tx.length) {
        var cur = f.m('Expense', ym), prev = f.m('Expense', addM(ym, -1));
        if (prev > 0 && (cur - prev) / prev * 100 > c.spendRise) I.push(['warn', 'Pengeluaran naik ' + Math.round((cur - prev) / prev * 100) + '%', rp(prev) + ' → ' + rp(cur) + ' dibanding bulan lalu (ambang ' + c.spendRise + '%). Periksa kategori terbesar di Financial.']);
        else if (prev > 0 && cur <= prev) I.push(['good', 'Pengeluaran tidak naik', 'Bulan ini ' + rp(cur) + ' vs bulan lalu ' + rp(prev) + '.']);
        f.acc.forEach(function (x) { if (f.bal(x) < 0) I.push(['warn', 'Saldo "' + x.name + '" minus', 'Saldo saat ini ' + rp(f.bal(x)) + '. Periksa transaksi atau lakukan transfer.']); });
        var eb = {}; f.tx.filter(function (t) { return t.type === 'Expense' && cut(t.date, 7) === ym; }).forEach(function (t) { eb[t.catId] = (eb[t.catId] || 0) + (+t.amount || 0); });
        ((f.F.bud || [])).forEach(function (b) {
          var m = b.month || ym; if (m !== ym || !(+b.limit > 0)) return; var p = (eb[b.catId] || 0) / b.limit * 100;
          if (p >= c.budgetWarn) { var ct = (f.F.cat || []).filter(function (x) { return x.id === b.catId; })[0]; I.push([p >= 100 ? 'warn' : 'info', 'Anggaran ' + (ct ? ct.name : '') + ' ' + Math.round(p) + '%', p >= 100 ? 'Sudah melewati batas anggaran bulan ini.' : 'Mendekati batas (ambang ' + c.budgetWarn + '%).']); }
        });
      }
      var rcv = sum((W.job || []).filter(function (j) { return j.incomeStatus === 'Sudah ditagih'; }), function (j) { return j.income; });
      if (rcv > 0) I.push(['info', 'Ada tagihan pekerjaan belum diterima', rp(rcv) + ' berstatus "Sudah ditagih". Pantau pembayarannya.']);
      (G.goal || []).forEach(function (g) {
        if (g.status === 'Tercapai' || g.status === 'Dibatalkan') return;
        if (g.deadline && g.deadline < td) I.push(['warn', 'Goal lewat deadline: ' + g.name, 'Perbarui status, geser deadline, atau evaluasi penyebabnya.']);
        else if (!(G.ms || []).some(function (m) { return m.goalId === g.id; }) && (g.basis || 'ms') === 'ms') I.push(['info', 'Goal belum dipecah: ' + g.name, 'Buat milestone agar progres bisa dilacak.']);
      });
      if (!I.length) I.push(['info', 'Belum cukup data', 'Isi data di modul Academic, Work, Task, Financial, atau Goal. Analisis akan muncul otomatis.']);
      return I;
    }
    function autoVals() {
      var a = acad(), f = fin(), T = ls('mo-task-v1').task || [], ym = today().slice(0, 7), G = ls('mo-goal-v1').goal || [];
      return {
        courses: String((ls('mo-acad-v1').course || []).filter(function (c) { var s = (ls('mo-acad-v1').sem || []).filter(function (x) { return x.id === c.semId; })[0]; return s && s.active; }).length),   /* v5.2: hitungan semua kampus; IPK di bawah = kampus terpilih */
        ipk: a.ok && a.ipk != null ? String(Math.round(a.ipk * 100) / 100) : '—',
        tasks: String(T.filter(function (t) { return t.status !== 'Done' && t.status !== 'Archived'; }).length),
        saldo: rp(f.total), spend: rp(f.m('Expense', ym)), goals: String(G.filter(function (g) { return g.status === 'Berjalan'; }).length)
      };
    }
    function look() {
      var T = D.theme, s = document.getElementById('an-theme'); if (!s) { s = document.createElement('style'); s.id = 'an-theme'; document.head.appendChild(s); }
      s.textContent = 'html:root .ac-ov.an-skin:not(.ad-skin){--an-bg1:' + T.bg1 + ';--an-bg2:' + T.bg2 + ';--an-a1:' + T.a1 + ';--an-a2:' + T.a2 + ';--an-ink:' + T.ink + '}';
      var h = document.querySelector('.ac-ov.an-skin:not(.ac-ov2) header h2'); if (h) h.textContent = D.title || 'Analytics';
    }
    var specs = {
      hero: { title: 'Dua Kartu Gradasi', def: {}, fields: [{ k: 'title', l: 'Kartu 1: label', t: 'text', req: 1 }, { k: 'big', l: 'Kartu 1: angka dari kartu', t: 'select', o: function () { return D.card.map(function (c) { return [c.id, c.icon + ' ' + c.title]; }); } }, { k: 'meta', l: 'Kartu 2: label', t: 'text', req: 1 }, { k: 'big2', l: 'Kartu 2: angka dari kartu', t: 'select', o: function () { return D.card.map(function (c) { return [c.id, c.icon + ' ' + c.title]; }); } }, { k: 'cta', l: 'Teks tombol ↗ pada kartu 1', t: 'text', req: 1 }, { k: 'ctaTab', l: 'Tombol ↗ membuka tab', t: 'select', o: TABOPT.slice(1) }] },
      card: { title: 'Kartu Angka', def: { src: 'manual', color: '0', icon: '⭐', tab: '' }, fields: [{ k: 'title', l: 'Judul kartu', t: 'text', req: 1 }, { k: 'icon', l: 'Ikon (emoji)', t: 'text' }, { k: 'src', l: 'Sumber angka', t: 'select', o: AUTOOPT }, { k: 'val', l: 'Angka manual (dipakai bila sumber = Isi manual)', t: 'text' }, { k: 'color', l: 'Warna kartu', t: 'select', o: COL }, { k: 'tab', l: 'Tombol ▶ membuka tab', t: 'select', o: TABOPT }, { k: 'note', l: 'Penjelasan', t: 'textarea', full: 1 }] },
      note: { title: 'Catatan', def: { kind: 'info' }, fields: [{ k: 'title', l: 'Judul', t: 'text', req: 1, full: 1 }, { k: 'text', l: 'Isi catatan', t: 'textarea', full: 1 }, { k: 'kind', l: 'Jenis', t: 'select', o: [['good', 'Positif'], ['warn', 'Perhatian'], ['info', 'Info']] }] },
      chart: { title: 'Grafik', def: { kind: 'hb', unit: '' }, fields: [{ k: 'title', l: 'Judul grafik', t: 'text', req: 1, full: 1 }, { k: 'kind', l: 'Bentuk', t: 'select', o: [['hb', 'Batang mendatar'], ['vb', 'Kolom tegak']] }, { k: 'unit', l: 'Satuan (jam, %, Rp, ...)', t: 'text' }, { k: 'data', l: 'Data: satu baris "Label: nilai" (kolom tegak boleh "Label: nilai, nilai2")', t: 'textarea', full: 1 }] }
    };
    var P5 = ['var(--an-ink)', 'var(--an-a1)', '#B8B2F0', 'var(--an-a2)'], PS = ['#FF9A9A', '#8FD3F4', '#B7E43A', '#FF8FB1', '#FFB347'];
    var gauge = function (p) { var L = Math.PI * 90; return '<svg class="bn-gauge" viewBox="0 0 220 130" aria-hidden="true"><path class="gt" d="M20 110A90 90 0 0 1 200 110"/><path class="gf" d="M20 110A90 90 0 0 1 200 110" style="stroke-dasharray:' + L + ';stroke-dashoffset:' + L * (1 - Math.max(0, Math.min(1, p))) + '"/><text x="20" y="127">0</text><text x="200" y="127" text-anchor="end">100</text></svg>'; };
    var donut = function (parts, big) {
      var C = 2 * Math.PI * 60, tot = sum(parts, function (x) { return x.v; }), acc = 0;
      var arcs = parts.filter(function (x) { return x.v > 0; }).map(function (x) { var l = x.v / tot * C, r = '<circle cx="80" cy="80" r="60" style="stroke:' + x.c + ';stroke-dasharray:' + Math.max(0, l - 3) + ' ' + C + ';stroke-dashoffset:' + (-acc) + '"/>'; acc += l; return r; }).join('');
      return '<div class="bn-donut"><svg viewBox="0 0 160 160" aria-hidden="true"><circle class="dt" cx="80" cy="80" r="60"/>' + arcs + '</svg><b>' + big + '</b></div>';
    };
    var spark = function (v) { var mx = Math.max.apply(null, v.concat([1])), pt = v.map(function (x, i) { return [8 + i * 184 / Math.max(1, v.length - 1), 62 - x / mx * 50]; }), e = pt[pt.length - 1]; return '<svg class="bn-spark" viewBox="0 0 200 70" aria-hidden="true"><path d="' + pt.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + '"/><circle cx="' + e[0] + '" cy="' + e[1] + '" r="6"/></svg>'; };
    var vIns = function () {
      var q = (st.q || '').toLowerCase(), AV = autoVals(), h0 = D.hero[0] || {}, all = insights(), I = all.filter(function (i) { return !D.hid[i[1]]; }), nh = all.length - I.length, f = fin(), td = today(), ym = td.slice(0, 7);
      var hit = function (x) { return !q || String(x).toLowerCase().indexOf(q) >= 0; }, Tt = function (t) { return esc(LBL[t] || t); }, hd = function (t, x) { return '<h4>' + Tt(t) + (x || '') + '</h4>'; };
      var cv = function (c) { return c ? (c.src && c.src !== 'manual' && AV[c.src] != null ? AV[c.src] : (c.val || '—')) : '—'; };
      var cnt = { good: 0, info: 0, warn: 0 }; all.forEach(function (i) { if (i[1] !== 'Belum cukup data') cnt[i[0]]++; });
      var n = cnt.good + cnt.info + cnt.warn, sc = score(all), pc = function (x) { return n ? Math.round(x / n * 100) : 0; }, mxc = Math.max(cnt.good, cnt.info, cnt.warn, 1);
      var pill = function (l, v, k) { return '<div class="bn-pill"><i class="p' + k + '" style="width:' + Math.max(34, v / mxc * 100) + '%"></i><span>' + l + '</span><em>' + v + '</em></div>'; };
      var gaugeC = '<section class="bn-c">' + hd('Skor kondisi') + '<div class="bn-gw">' + gauge(sc == null ? 0 : sc / 10) + '<div class="bn-gc"><div><b>' + (sc == null ? '—' : Math.round(sc * 10) + '%') + '</b><small><i class="bdot" style="background:var(--an-a1)"></i>Skor</small></div><div><b>' + pc(cnt.warn) + '%</b><small><i class="bdot" style="background:var(--an-a2)"></i>Perhatian</small></div></div></div>' + pill('Positif', cnt.good, 0) + pill('Info', cnt.info, 1) + pill('Perhatian', cnt.warn, 3) + '</section>';
      var ms = []; for (var k = 5; k >= 0; k--) ms.push(addM(ym, -k));
      var ex = ms.map(function (m) { return f.m('Expense', m); }), inc = ms.map(function (m) { return f.m('Income', m); }), mx = Math.max.apply(null, ex.concat([1]));
      var b1 = by(D.card, h0.big) || D.card[0], b2 = by(D.card, h0.big2) || D.card[1] || D.card[0];
      var g1 = '<section class="bn-c bn-g1"' + (h0.img ? ' style="background-image:linear-gradient(135deg,rgba(201,184,247,.8),rgba(255,216,188,.8)),url(' + h0.img + ')"' : '') + '><label class="an-up" title="Ganti foto latar">📷<input type="file" accept="image/*" data-chg="img" hidden></label>' + (h0.img ? '<button class="an-up r" data-act="imgdel" aria-label="Hapus foto latar">✕</button>' : '') + '<button class="bn-ico" data-act="tab" data-t="' + esc(h0.ctaTab || 'fin') + '" title="' + esc(h0.cta) + '" aria-label="' + esc(h0.cta) + '">↗</button><b class="bn-big">' + esc(cv(b1)) + '</b><p>' + esc(h0.title) + '</p><div class="bn-mb" aria-hidden="true">' + ex.slice(1).map(function (x, i) { return '<i style="height:' + Math.max(8, x / mx * 100) + '%;opacity:' + (.45 + i * .14) + '"></i>'; }).join('') + '</div><button class="an-edit" data-act="edit" data-e="hero" data-id="h" aria-label="Edit kartu gradasi">✎</button></section>';
      var T = ls('mo-task-v1').task || [], dn = T.filter(function (t) { return t.status === 'Done'; }).length, lt = T.filter(function (t) { return t.status !== 'Done' && t.status !== 'Archived' && t.due && t.due < td; }).length, ac = T.filter(function (t) { return t.status !== 'Done' && t.status !== 'Archived'; }).length - lt, tt = dn + lt + ac;
      var tc = '<section class="bn-c">' + hd('Status tugas') + donut([{ v: lt, c: '#F2644E' }, { v: ac, c: '#B58BEA' }, { v: dn, c: '#2DB67C' }], tt ? Math.round(dn / tt * 100) + '%' : '—') + '<div class="bn-lg"><span><i style="background:#2DB67C"></i>Selesai ' + dn + '</span><span><i style="background:#B58BEA"></i>Aktif ' + ac + '</span><span><i style="background:#F2644E"></i>Terlambat ' + lt + '</span></div></section>';
      var tabs = [['acad', 'Akademik'], ['fin', 'Keuangan'], ['work', 'Kerja & Proyek'], ['prod', 'Produktivitas'], ['mine', 'Grafik Saya']];
      var pls = '<section class="bn-c">' + hd('Pintasan') + '<div class="bn-pills">' + tabs.map(function (t, i) { return '<button class="bn-pl p' + (i % 4) + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></section>';
      var cn = {}; (f.F.cat || []).forEach(function (c) { cn[c.id] = c.name; }); var eb = {};
      f.tx.filter(function (t) { return t.type === 'Expense' && cut(t.date, 7) === ym; }).forEach(function (t) { var kk = cn[t.catId] || 'Lainnya'; eb[kk] = (eb[kk] || 0) + (+t.amount || 0); });
      var er = Object.keys(eb).map(function (kk) { return [kk, eb[kk]]; }).sort(function (a, b) { return b[1] - a[1]; }), top = er.slice(0, 3), rest = sum(er.slice(3), function (r) { return r[1]; }); if (rest > 0) top.push(['Lainnya', rest]);
      var et = sum(top, function (r) { return r[1]; });
      var dom = '<section class="bn-c">' + hd('Pengeluaran per kategori') + donut(top.map(function (r, i) { return { v: r[1], c: P5[i] }; }), et ? Math.round(top[0][1] / et * 100) + '%' : '—') + '<div class="bn-lg">' + (top.length ? top.map(function (r, i) { return '<span><i style="background:' + P5[i] + '"></i>' + esc(r[0]) + '</span>'; }).join('') : '<span>Belum ada pengeluaran bulan ini</span>') + '</div></section>';
      var gt = st.gt || 'Proyek', rows = [];
      if (gt === 'Proyek') { var PR = ls('mo-proj-v1'); rows = (PR.proj || []).map(function (p) { var ms2 = p.basis === 'ms', a = ms2 ? (PR.ms || []).filter(function (x) { return x.projId === p.id; }) : (PR.ptask || []).filter(function (x) { return x.projId === p.id; }), v = a.length ? a.filter(function (x) { return ms2 ? x.done : x.status === 'Selesai'; }).length / a.length * 100 : 0; return [p.name, v, Math.round(v) + '%']; }); }
      else if (gt === 'Area') { var ar = {}; T.filter(function (t) { return t.status !== 'Done' && t.status !== 'Archived'; }).forEach(function (t) { ar[t.area || '—'] = (ar[t.area || '—'] || 0) + 1; }); rows = Object.keys(ar).map(function (kk) { return [kk, ar[kk], String(ar[kk])]; }); }
      else { var a0 = acad(); rows = a0.C.map(function (c) { return [c.name, a0.fs(c)]; }).filter(function (r) { return r[1] != null; }).map(function (r) { return [r[0], r[1], n1(r[1])]; }); }
      rows = rows.slice(0, 5); var rmx = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([0.0001]));
      var gn = '<section class="bn-c">' + hd('Capaian', '<span class="bn-tabs">' + ['Proyek', 'Area', 'Nilai'].map(function (t) { return '<button data-act="gt" data-v="' + t + '" aria-pressed="' + (t === gt) + '">' + t + '</button>'; }).join('') + '</span>') + (rows.length ? rows.map(function (r, i) { return '<div class="bn-gr"><span>' + esc(r[0]) + '</span><div class="bn-gb"><i style="width:' + Math.max(14, r[1] / rmx * 100) + '%;background:' + PS[i % 5] + '">' + esc(r[2]) + '</i></div></div>'; }).join('') : '<p class="ac-hint">Belum ada data untuk ' + gt.toLowerCase() + '.</p>') + '</section>';
      var cards = D.card.filter(function (c) { return hit(c.title + ' ' + c.note); });
      var rec = '<section class="bn-c">' + hd('Angka utama', '<button class="bn-add" data-act="add" data-e="card" aria-label="Tambah kartu angka">+</button>') + (cards.length ? cards.map(function (c) { return '<div class="bn-row"><i class="bn-ic c' + esc(c.color) + '">' + esc(c.icon) + '</i><div><b>' + esc(c.title) + '</b><small>' + esc(cut(c.note, 38)) + '</small></div><strong>' + esc(cv(c)) + '</strong><button class="bn-ed" data-act="edit" data-e="card" data-id="' + c.id + '" aria-label="Edit ' + esc(c.title) + '">✎</button></div>'; }).join('') : '<p class="ac-hint">' + (D.card.length ? 'Tidak ada kartu yang cocok.' : 'Belum ada kartu.') + '</p>') + '</section>';
      var g2 = '<section class="bn-c bn-g2"><button class="bn-ico" data-act="tab" data-t="' + esc(h0.ctaTab || 'fin') + '" aria-label="' + esc(h0.cta) + '">▥</button><b class="bn-big">' + esc(cv(b2)) + '</b><p>' + esc(h0.meta) + '</p>' + spark(inc) + '</section>';
      var ins = I.filter(function (i) { return hit(i[1] + ' ' + i[2]); }).map(function (i) { return '<div class="ins ' + i[0] + '"><b>' + esc(i[1]) + '</b>' + esc(i[2]) + '<button class="an-x" data-act="hid" data-k="' + esc(i[1]) + '">Sembunyikan</button></div>'; }).join('');
      var notes = D.note.filter(function (x) { return hit(x.title + ' ' + x.text); }).map(function (x) { return '<div class="ins ' + esc(x.kind) + ' mine"><b>' + esc(x.title) + '</b>' + esc(x.text) + '<div class="ac-acts" style="margin-top:8px">' + btns('note', x.id) + '</div></div>'; }).join('');
      var wide = '<section class="bn-c bn-wide">' + hd('Analisis otomatis') + '<p class="ac-hint" style="margin-bottom:12px">Analisis memakai aturan sederhana dengan ambang yang bisa Anda ubah di tab Pengaturan. Ini bantuan membaca data, bukan saran profesional.</p>' + (ins || '<p class="ac-hint">Tidak ada analisis yang cocok.</p>') + (nh ? '<button class="an-x" data-act="unhid">Tampilkan ' + nh + ' analisis yang disembunyikan</button>' : '') + hd('Catatan saya') + notes + '<div class="ac-acts">' + add('note', 'Catatan') + '</div></section>';
      return '<div class="an-search"><span aria-hidden="true">🔍</span><input type="search" data-in="q" value="' + esc(st.q || '') + '" placeholder="Cari angka, analisis, atau catatan" aria-label="Cari"></div><div class="bn"><div class="bn-col">' + gaugeC + rec + '</div><div class="bn-col">' + g1 + tc + pls + '</div><div class="bn-col">' + dom + gn + g2 + '</div></div>' + wide;
    };
    var vAcad = function () {
      var a = acad(), S = a.A.sem || [];
      if (!a.C.length) return empty('Belum ada data akademik.');
      var h = a.A.multi ? '<p class="ac-hint">Kampus: <b>' + esc(a.A.name) + '</b> — angka di tab ini hanya untuk kampus tersebut (ganti kampus di menu Academic).</p>' : '';
      h += a.ok ? '' : '<div class="ac-warn"><span>Formula nilai belum diaktifkan, sehingga IP/IPK tidak dihitung.</span></div>';
      var sr = S.map(function (s) { return { s: s, v: a.ip(a.C.filter(function (c) { return c.semId === s.id; })) }; }).filter(function (x) { return x.v != null; });
      h += H('IP per semester (batang oranye = target)') + (sr.length ? vb(sr.map(function (x) { return x.s.name; }), sr.map(function (x) { return x.v; }), sr.map(function (x) { return +x.s.target || 0; }), function (v) { return n1(Math.round(v * 100) / 100); }) : '<p class="ac-hint">Belum ada IP yang bisa dihitung.</p>');
      var act = a.C.filter(function (c) { var s = S.filter(function (x) { return x.id === c.semId; })[0]; return s && s.active; });
      h += H('Nilai akhir mata kuliah aktif') + hb(act.map(function (c) { return [c.name, a.fs(c)]; }).filter(function (r) { return r[1] != null; }), n1);
      var dist = {}; a.C.forEach(function (c) { var L = a.lt(a.fs(c)); if (L) dist[L.l] = (dist[L.l] || 0) + 1; });
      h += H('Distribusi huruf mutu') + hb(Object.keys(dist).map(function (k) { return [k, dist[k]]; }), String);
      var st = {}; (a.T).forEach(function (t) { st[t.status] = (st[t.status] || 0) + 1; });
      h += H('Status tugas kuliah') + hb(Object.keys(st).map(function (k) { return [k, st[k]]; }), String);
      var sd = {}; (a.A.study || []).forEach(function (s) { var c = a.C.filter(function (x) { return x.id === s.courseId; })[0]; if (c) sd[c.name] = (sd[c.name] || 0) + (+s.minutes || 0); });
      h += H('Waktu belajar per mata kuliah (jam)') + hb(Object.keys(sd).map(function (k) { return [k, sd[k] / 60]; }), n1);
      return wrap(h);
    };
    var vFin = function () {
      var f = fin(), ym = today().slice(0, 7);
      if (!f.tx.length && !f.acc.length) return empty('Belum ada data keuangan.');
      var ms = []; for (var i = 5; i >= 0; i--) ms.push(addM(ym, -i));
      var h = H('Arus kas 6 bulan (batang gelap = pemasukan, oranye = pengeluaran)') + vb(ms.map(mlab), ms.map(function (m) { return f.m('Income', m); }), ms.map(function (m) { return f.m('Expense', m); }), short);
      h += H('Pemasukan pribadi vs pendapatan pekerjaan (bulan ini)') + hb([['Pemasukan pribadi', f.m('Income', ym, function (t) { return t.scope !== 'Pekerjaan'; })], ['Pendapatan pekerjaan', f.m('Income', ym, function (t) { return t.scope === 'Pekerjaan'; })]], rp);
      var eb = {}, cn = {}; (f.F.cat || []).forEach(function (c) { cn[c.id] = c.name; });
      f.tx.filter(function (t) { return t.type === 'Expense' && cut(t.date, 7) === ym; }).forEach(function (t) { eb[cn[t.catId] || '—'] = (eb[cn[t.catId] || '—'] || 0) + (+t.amount || 0); });
      h += H('Pengeluaran per kategori (bulan ini)') + hb(Object.keys(eb).map(function (k) { return [k, eb[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), rp);
      h += H('Saldo per akun aktif') + hb(f.acc.map(function (x) { return [x.name, Math.max(0, f.bal(x))]; }), rp);
      var gs = (f.F.goal || []).filter(function (g) { return g.status === 'Aktif'; });
      h += H('Progres target tabungan (%)') + hb(gs.map(function (g) { var c = sum((f.F.con || []).filter(function (x) { return x.goalId === g.id; }), function (x) { return x.amount; }); return [g.name, Math.min(100, c / (+g.target || 1) * 100)]; }), function (v) { return Math.round(v) + '%'; });
      return wrap(h);
    };
    var vWork = function () {
      var W = ls('mo-work-v1'), P = ls('mo-proj-v1'), O = ls('mo-org-v1');
      if (!(W.job || []).length && !(P.proj || []).length && !(O.org || []).length) return empty('Belum ada data pekerjaan, proyek, atau organisasi.');
      var h = H('Jam kerja tercatat per pekerjaan');
      h += hb((W.job || []).map(function (j) { return [j.title, sum((W.log || []).filter(function (l) { return l.jobId === j.id; }), function (l) { return l.hours; })]; }).filter(function (r) { return r[1] > 0; }), n1);
      var inc = {}; (W.job || []).forEach(function (j) { if (+j.income > 0 && j.incomeStatus !== 'Tidak relevan') inc[j.incomeStatus] = (inc[j.incomeStatus] || 0) + +j.income; });
      h += H('Pendapatan pekerjaan menurut status (terpisah dari pemasukan pribadi)') + hb(Object.keys(inc).map(function (k) { return [k, inc[k]]; }), rp);
      var st = {}; (W.job || []).forEach(function (j) { st[j.status] = (st[j.status] || 0) + 1; });
      h += H('Pekerjaan menurut status') + hb(Object.keys(st).map(function (k) { return [k, st[k]]; }), String);
      h += H('Progres proyek (tugas/milestone selesai, %)') + hb((P.proj || []).map(function (p) { var ms = p.basis === 'ms', a = ms ? (P.ms || []).filter(function (x) { return x.projId === p.id; }) : (P.ptask || []).filter(function (x) { return x.projId === p.id; }); return [p.name, a.length ? a.filter(function (x) { return ms ? x.done : x.status === 'Selesai'; }).length / a.length * 100 : 0]; }), function (v) { return Math.round(v) + '%'; });
      var fu = O.followup || []; h += H('Tindak lanjut rapat organisasi') + hb(['Belum', 'Berjalan', 'Selesai'].map(function (s) { return [s, fu.filter(function (x) { return x.status === s; }).length]; }), String);
      return wrap(h);
    };
    var vProd = function () {
      var T = (ls('mo-task-v1').task || []), td = today(), ws = [], i;
      for (i = 7; i >= 0; i--) ws.push(addD(td, -7 * i));
      var h = H('Tugas selesai per minggu (8 minggu terakhir)') + vb(ws.map(function (w) { return w.slice(5); }), ws.map(function (w) { return T.filter(function (t) { return t.status === 'Done' && t.doneAt >= w && t.doneAt < addD(w, 7); }).length; }), null, String);
      var st = {}; T.forEach(function (t) { st[t.status] = (st[t.status] || 0) + 1; });
      h += H('Task menurut status') + hb(Object.keys(st).map(function (k) { return [k, st[k]]; }), String);
      var ar = {}; T.filter(function (t) { return t.status !== 'Done' && t.status !== 'Archived'; }).forEach(function (t) { ar[t.area || '—'] = (ar[t.area || '—'] || 0) + 1; });
      h += H('Tugas aktif per area') + hb(Object.keys(ar).map(function (k) { return [k, ar[k]]; }), String);
      var G = ls('mo-goal-v1'), gs = (G.goal || []).filter(function (g) { return g.status !== 'Dibatalkan'; });
      h += H('Goal berjalan menurut horizon') + hb(['Harian', 'Mingguan', 'Bulanan', 'Semesteran', 'Tahunan', 'Jangka panjang'].map(function (z) { return [z, gs.filter(function (g) { return g.horizon === z; }).length]; }).filter(function (r) { return r[1] > 0; }), String);
      var E = (ls('mo-cal-v1').ev || []).filter(function (e) { return !e.allDay && e.start >= addD(td, -6) && e.start <= td && e.endTime; });
      var hrs = sum(E, function (e) { var s = e.startTime.split(':'), t = e.endTime.split(':'); return ((+t[0] * 60 + +t[1]) - (+s[0] * 60 + +s[1])) / 60; });
      return wrap(h) + '<p class="ac-hint" style="margin-top:12px">Jam acara terjadwal 7 hari terakhir (yang punya jam selesai): <b>' + n1(hrs) + ' jam</b>.</p>';
    };
    var vMine = function () {
      var h = bar('Buat grafik sendiri dari data yang Anda ketik. Satu baris = satu batang, formatnya “Label: nilai”.', add('chart', 'Grafik'));
      if (!D.chart.length) return h + empty('Belum ada grafik. Tekan “+ Grafik” untuk membuat yang pertama.');
      return h + D.chart.map(function (c) {
        var r = parseRows(c.data), f = c.unit === 'Rp' ? rp : function (v) { return n1(v) + (c.unit ? ' ' + c.unit : ''); }, two = r.some(function (x) { return x.b != null; });
        var g = !r.length ? '<p class="ac-hint">Data belum valid. Tulis satu baris per batang, contoh “Senin: 5”.</p>' : c.kind === 'vb' ? vb(r.map(function (x) { return x.l; }), r.map(function (x) { return x.a; }), two ? r.map(function (x) { return x.b || 0; }) : null, f) : hb(r.map(function (x) { return [x.l, x.a]; }), f);
        return '<section class="an-sec"><div class="ac-row"><div class="ac-h">' + esc(c.title) + '</div>' + btns('chart', c.id) + '</div>' + g + '</section>';
      }).join('');
    };
    var vCfg = function () {
      var T = D.theme, cols = [['bg1', 'Warna latar atas'], ['bg2', 'Warna latar bawah'], ['a1', 'Tombol: warna awal'], ['a2', 'Tombol & aksen: warna akhir'], ['ink', 'Warna teks']];
      var rows = [['maxWeekHours', 'Ambang jam kerja + belajar per minggu', 'jam'], ['ipTarget', 'Target IPK untuk analisis', 'skala 4'], ['overdueMax', 'Batas tugas terlambat sebelum diberi peringatan', 'tugas'], ['spendRise', 'Kenaikan pengeluaran yang dianggap tinggi', '%'], ['budgetWarn', 'Peringatan anggaran mulai dari', '%']];
      var tx = function (l, k, v) { return '<div class="cfgrow w"><label>' + l + '</label><input type="text" value="' + esc(v) + '" data-chg="txt" data-k="' + k + '"></div>'; };
      return '<section class="an-sec"><div class="ac-h">Warna tema</div>' + cols.map(function (c) { return '<div class="cfgrow"><label>' + c[1] + '</label><input type="color" value="' + esc(T[c[0]]) + '" data-chg="theme" data-k="' + c[0] + '"></div>'; }).join('') + '<div class="ac-acts" style="margin-top:10px"><button class="ac-btn sm" data-act="themereset">Kembalikan warna bawaan</button></div></section>' +
        '<section class="an-sec"><div class="ac-h">Judul jendela</div>' + tx('Judul', 'title', D.title) + tx('Keterangan di bawah judul', 'sub', D.sub) + '</section>' +
        '<section class="an-sec"><div class="ac-h">Nama judul grafik &amp; bagian</div><p class="ac-hint" style="margin-bottom:8px">Ubah teks, kosongkan kolom untuk memakai nama bawaan.</p>' + HK.map(function (k) { return '<div class="cfgrow w"><label>' + esc(k) + '</label><input type="text" value="' + esc(LBL[k] || '') + '" placeholder="' + esc(k) + '" data-chg="lbl" data-k="' + esc(k) + '"></div>'; }).join('') + '</section>' +
        '<section class="an-sec"><div class="ac-h">Ambang analisis</div><p class="ac-hint" style="margin-bottom:8px">Ambang ini milik Anda; analisis tidak memakai angka tersembunyi.</p>' + rows.map(function (r) { return '<div class="cfgrow"><label>' + r[1] + '</label><div><input type="number" step="any" min="0" value="' + D.cfg[r[0]] + '" data-chg="cfg" data-k="' + r[0] + '" style="max-width:120px"> <small>' + r[2] + '</small></div></div>'; }).join('') + '</section>' +
        '<div class="ac-acts"><button class="ac-btn danger" data-act="resetall">Kembalikan tampilan Ringkasan ke bawaan</button></div>';
    };
    return {
      skin: 'an-skin', specs: specs, tabs: [['ins', 'Ringkasan & Analisis', vIns], ['acad', 'Akademik', vAcad], ['fin', 'Keuangan', vFin], ['work', 'Kerja & Proyek', vWork], ['prod', 'Produktivitas', vProd], ['mine', 'Grafik Saya', vMine], ['cfg', 'Pengaturan', vCfg]],
      sub: function () { look(); return D.sub; },
      act: function (a, d, t) {
        if (a === 'cfg') { var v = parseFloat(d.v); if (!isNaN(v) && v >= 0) D.cfg[d.k] = v; }
        else if (a === 'gt') st.gt = d.v;
        else if (a === 'hid') D.hid[d.k] = 1;
        else if (a === 'unhid') D.hid = {};
        else if (a === 'img') { var f = t && t.files && t.files[0]; if (f) readImg(f, function (u) { D.hero[0].img = u; app.save(); app.render(); }); }
        else if (a === 'imgdel') D.hero[0].img = '';
        else if (a === 'theme') { if (/^#[0-9a-f]{6}$/i.test(d.v)) D.theme[d.k] = d.v; }
        else if (a === 'themereset') D.theme = seed().theme;
        else if (a === 'lbl') { var x = String(d.v).trim(); if (x) LBL[d.k] = x; else delete LBL[d.k]; }
        else if (a === 'txt') { D[d.k] = String(d.v).trim() || seed()[d.k]; }
        else if (a === 'resetall') { if (confirm('Kembalikan hero, kartu angka, warna, dan nama bagian ke bawaan? Catatan dan grafik Anda tidak dihapus.')) { var S = seed(); ['hero', 'card', 'theme', 'hid'].forEach(function (k) { D[k] = S[k]; }); Object.keys(LBL).forEach(function (k) { delete LBL[k]; }); D.title = S.title; D.sub = S.sub; } }
      }
    };
  });
  MO.routes['#analytics'] = an.open;
})();
;
/* MyOffice — Settings: profil, status kegiatan, cadangan data */
(function () {
  'use strict';
  var MO = window.MyOffice, K = MO.kit, esc = K.esc, fd = K.fd, chips = K.chips, badge = K.badge, empty = K.empty;
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var cut = function (v, n) { return String(v || '').slice(0, n); };

  /* Terapkan nama panggilan & foto ke halaman utama */
  function apply() {
    var s = ls('mo-settings-v1'), i = document.querySelector('.avatar i'), h = document.getElementById('hiName');
    if (i) i.style.background = s.photo ? 'url("' + s.photo + '") center/cover no-repeat' : '';
    if (h) h.textContent = 'Assalamu’alaikum,' + (s.nick ? ' ' + s.nick + ',' : '');
  }
  apply();

  var GROUPS = ['Belum berjalan', 'Sedang berjalan', 'Menunggu / ditunda', 'Lewat tenggat', 'Selesai', 'Dibatalkan / arsip'];
  var DONE = /^(Selesai|Done|Tercapai)$/, CANC = /^(Dibatalkan|Archived)$/, RUN = /^(Sedang dikerjakan|In Progress|Berjalan|Dikerjakan|Review)$/, WAIT = /^(Ditunda|Waiting)$/;
  function cls(status, due, td) {
    if (DONE.test(status)) return GROUPS[4]; if (CANC.test(status)) return GROUPS[5];
    if (due && cut(due, 10) < td) return GROUPS[3];
    if (WAIT.test(status)) return GROUPS[2]; if (RUN.test(status)) return GROUPS[1]; return GROUPS[0];
  }
  function gather() {
    var td = K.todayS(), out = [], A = ls('mo-acad-v1'), W = ls('mo-work-v1'), O = ls('mo-org-v1'), P = ls('mo-proj-v1'), T = ls('mo-task-v1'), G = ls('mo-goal-v1');
    var put = function (mod, route, title, status, due) { out.push({ mod: mod, route: route, title: title, status: status, due: due, g: cls(status, due, td) }); };
    (T.task || []).forEach(function (t) { put('Task', '#task', t.title, t.status, t.due); });
    (A.task || []).forEach(function (t) { put('Tugas kuliah', '#academic', t.title, t.status, t.deadline); });
    (A.exam || []).forEach(function (e) {
      var c = (A.course || []).filter(function (x) { return x.id === e.courseId; })[0], d = cut(e.date, 10);
      put('Ujian', '#academic', e.type + (c ? ' — ' + c.name : ''), (d && d < td) || (e.score !== '' && e.score != null) ? 'Selesai' : 'Belum', d && d >= td ? '' : '');
    });
    (W.job || []).forEach(function (j) { put('Pekerjaan', '#work', j.title, j.status, j.deadline); });
    (W.wtask || []).forEach(function (t) { put('Tugas kerja', '#work', t.title, t.status, t.deadline); });
    (O.followup || []).forEach(function (f) { put('Organisasi', '#organization', f.task, f.status === 'Belum' ? 'Belum' : f.status, f.due); });
    (P.proj || []).forEach(function (p) { put('Proyek', '#project', p.name, p.status, p.target); });
    (P.ptask || []).forEach(function (t) { put('Tugas proyek', '#project', t.title, t.status, t.due); });
    (G.goal || []).forEach(function (g) { put('Goal', '#goal', g.name, g.status, g.deadline); });
    return out;
  }

  var set = K.App('Settings', 'mo-settings-v1', function () { return { nick: '', photo: '' }; }, function (app) {
    var D = app.D, st = app.st;
    function vProf() {
      var nm = D.nick || 'Pengguna';
      return '<div class="ac-card"><div class="pv"><div class="ph" style="' + (D.photo ? 'background-image:url(&quot;' + D.photo + '&quot;)' : '') + '"></div><div><h3 style="font-size:18px">' + esc(nm) + '</h3><small style="opacity:.7">Sapaan di beranda: Assalamu’alaikum, ' + esc(D.nick || '…') + ',</small></div></div>' +
        '<div class="cfgrow"><label>Nama panggilan</label><div style="display:flex;gap:8px"><input type="text" maxlength="30" value="' + esc(D.nick) + '" placeholder="Nama panggilan" aria-label="Nama panggilan"><button class="ac-btn pri" data-act="savenick">Simpan</button></div></div>' +
        '<div class="cfgrow"><label>Foto profil</label><div style="display:flex;gap:8px;flex-wrap:wrap"><label class="ac-btn" style="cursor:pointer;display:inline-block">Pilih foto<input type="file" accept="image/*" hidden data-chg="photo"></label>' + (D.photo ? '<button class="ac-btn danger" data-act="rmphoto">Hapus foto</button>' : '') + '</div></div>' +
        '<p class="ac-hint">Foto dipotong persegi dan dikecilkan, disimpan hanya di browser ini.</p></div>';
    }
    /* v5.7: Mode tampilan dipindah dari header (ikon palet) ke Pengaturan */
    function vView() {
      var lt = !!(MO.cosmos && MO.cosmos.isLite && MO.cosmos.isLite());
      var chip = function (v, l, on) { return '<button class="ac-chip" data-act="lite" data-v="' + v + '" aria-pressed="' + on + '">' + l + '</button>'; };
      return '<div class="ac-card"><b>Mode hemat</b><p class="ac-hint" style="margin:4px 0 10px">Kurangi animasi latar agar aplikasi ringan di perangkat lawas. Pilihan disimpan di browser ini.</p>' +
        '<div class="ac-chips">' + chip('0', 'Normal', !lt) + chip('1', 'Hemat', lt) + '</div></div>';
    }
    function vStat() {
      var all = gather(), g = st.sg || 'Semua', cnt = {}, L;
      all.forEach(function (i) { cnt[i.g] = (cnt[i.g] || 0) + 1; });
      L = all.filter(function (x) { return g === 'Semua' || x.g === g; }).sort(function (a, b) { return (a.due || '9').localeCompare(b.due || '9'); });
      if (st._sg !== g) { st._sg = g; st.lim = 40; }   /* v4.7: render bertahap, bukan ratusan item sekaligus */
      var lim = st.lim || 40, total = L.length; L = L.slice(0, lim);
      var h = '<p class="ac-hint" style="margin-bottom:10px">Ringkasan kegiatan dari semua modul. Klik item untuk membuka modulnya.</p><div class="ac-chips">' + ['Semua'].concat(GROUPS).map(function (x) { var n = x === 'Semua' ? all.length : (cnt[x] || 0); return '<button class="ac-chip" aria-pressed="' + (x === g) + '" data-act="filt" data-f="sg" data-v="' + x + '">' + x + ' (' + n + ')</button>'; }).join('') + '</div>';
      if (!L.length) return h + empty('Tidak ada kegiatan pada status ini.');
      return h + '<div class="st-list">' + L.map(function (x) {
        return '<div class="ac-item st-go" data-act="go" data-r="' + x.route + '"><div><button class="t" data-act="go" data-r="' + x.route + '">' + esc(x.title) + '</button>' + badge(x.mod) + (x.g === GROUPS[3] ? badge('Lewat tenggat', 'late') : '') + '<small>' + esc(x.status) + (x.due ? ' · tenggat ' + fd(cut(x.due, 10)) : '') + '</small></div></div>';
      }).join('') + '</div>' + (total > lim ? '<button class="ac-btn" style="margin:12px auto;display:block" data-act="more">Tampilkan lebih banyak (' + (total - lim) + ')</button>' : '');
    }
    function vData() {
      var keys = Object.keys(localStorage).filter(function (k) { return k.indexOf('mo-') === 0 && k !== 'mo-fired'; });
      return '<div class="ac-card"><b>Cadangan data</b><p class="ac-hint" style="margin:4px 0 10px">Semua data tersimpan hanya di browser ini (' + keys.length + ' kelompok data). Buat cadangan agar tidak hilang jika data browser dibersihkan. File di Document Center tidak ikut dicadangkan.</p><div class="ac-acts"><button class="ac-btn pri" data-act="export">Unduh cadangan (.json)</button><label class="ac-btn" style="cursor:pointer;display:inline-block">Pulihkan dari cadangan<input type="file" accept="application/json,.json" hidden data-chg="import"></label></div></div>' +
        '<div class="ac-card"><b>Hapus semua data</b><p class="ac-hint" style="margin:4px 0 10px">Menghapus seluruh data Beresin di browser ini, termasuk dokumen. Tidak bisa dibatalkan.</p><button class="ac-btn danger" data-act="wipe">Hapus semua data</button></div>';
    }
    return {
      specs: {}, tabs: [['prof', 'Profil', vProf], ['view', 'Mode Tampilan', vView], ['stat', 'Status Kegiatan', vStat], ['board', 'Tampilan Board', function () { return window.BeresinBoards ? window.BeresinBoards.html() : ''; }], ['sync', 'Sambung Perangkat', function () { return window.BeresinSync ? window.BeresinSync.html() : ''; }], ['data', 'Data & Cadangan', vData]],
      sub: function () { return D.nick ? 'Halo, ' + D.nick : 'Atur profil Anda'; },
      act: function (a, d, t) {
        if (a === 'more') { st.lim = (st.lim || 40) + 60; return; }
        if (a === 'lite') { if (MO.cosmos && MO.cosmos.setLite) MO.cosmos.setLite(d.v === '1', true); app.render(); return; }
        if (a === 'savenick') { D.nick = t.parentNode.querySelector('input').value.trim().slice(0, 30); app.save(); apply(); }
        if (a === 'rmphoto') { D.photo = ''; app.save(); apply(); }
        if (a === 'go' && MO.routes[d.r]) { window.__cuSkip = Date.now() + 1800; if (window.__bsJump) window.__bsJump(); app.close(); MO.routes[d.r](); return K.SKIP; }
        if (a === 'photo') {
          var f = t.files && t.files[0]; t.value = ''; if (!f) return;
          var r = new FileReader();
          r.onload = function () {
            var im = new Image();
            im.onload = function () {
              var s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 256;
              c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256);
              D.photo = c.toDataURL('image/jpeg', 0.85); app.save(); app.render(); apply();
            };
            im.onerror = function () { MO.msg('Gagal', 'File bukan gambar yang valid.'); };
            im.src = r.result;
          };
          r.readAsDataURL(f);
        }
        if (a === 'export') {
          var o = { app: 'Beresin', exported: new Date().toISOString(), data: {} };
          Object.keys(localStorage).forEach(function (k) { if (k.indexOf('mo-') === 0 && k !== 'mo-fired') o.data[k] = localStorage.getItem(k); });
          var u = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' })), l = document.createElement('a');
          l.href = u; l.download = 'myoffice-cadangan-' + K.todayS() + '.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 10000);
        }
        if (a === 'import') {
          var fl = t.files && t.files[0]; t.value = ''; if (!fl) return;
          fl.text().then(function (x) {
            var o = JSON.parse(x); if (!o || (o.app !== 'Beresin' && o.app !== 'MyOffice') || !o.data) throw 0;
            if (!confirm('Pulihkan ' + Object.keys(o.data).length + ' kelompok data? Data saat ini akan ditimpa.')) return;
            Object.keys(o.data).forEach(function (k) { if (k.indexOf('mo-') === 0) localStorage.setItem(k, o.data[k]); });
            location.reload();
          }).catch(function () { MO.msg('Gagal', 'Berkas cadangan tidak valid.'); });
        }
        if (a === 'wipe' && confirm('Hapus SEMUA data Beresin di browser ini?') && confirm('Yakin? Tindakan ini tidak bisa dibatalkan.')) {
          Object.keys(localStorage).forEach(function (k) { if (k.indexOf('mo-') === 0) localStorage.removeItem(k); });
          try { indexedDB.deleteDatabase('mo-docs'); } catch (e) { }
          location.reload();
        }
      }
    };
  });
  MO.routes['#settings'] = set.open;
  /* dipakai modul lain (mis. Task) untuk mengganti foto profil tanpa membuka Pengaturan */
  MO.setPhoto = function (d) { set.app.D.photo = d; set.app.save(); apply(); };
})();
;
/* =====================================================================
   MyOffice — PREMIUM UI layer (JS)
   Menghias jendela menu yang dibuat modul lain: warna identitas, ikon,
   sidebar, indikator tab yang bergeser, animasi buka dari ikon menu,
   dan hitung-naik angka statistik. Tidak mengubah data/logika modul.
   ===================================================================== */
(function () {
  'use strict';
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var svg = function (p, w) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  };

  /* ---------- Identitas tiap menu ---------- */
  var MODS = [
    { k: 'academic', m: /academic/, sym: 'i-academic', a: '#5b7cff', b: '#8b5cf6' },
    { k: 'work', m: /work/, sym: 'i-work', a: '#0ea5a4', b: '#3b82f6' },
    { k: 'org', m: /organi/, sym: 'i-org', a: '#a855f7', b: '#ec4899' },
    { k: 'project', m: /project/, sym: 'i-project', a: '#f97316', b: '#ef4444' },
    { k: 'task', m: /task/, sym: 'i-task', a: '#3b82f6', b: '#06b6d4' },
    { k: 'cal', m: /kalender|calendar/, sym: 'i-cal', a: '#ec4899', b: '#f97316' },
    { k: 'fin', m: /financ|keuangan/, sym: 'i-fin', a: '#10b981', b: '#0ea5e9' },
    { k: 'goal', m: /goal/, sym: 'i-goal', a: '#f43f5e', b: '#f59e0b' },
    { k: 'doc', m: /document/, sym: 'i-doc', a: '#a8642b', b: '#c78a4c' },
    { k: 'ana', m: /analytic/, sym: 'i-chart', a: '#06b6d4', b: '#6366f1' },
    { k: 'set', m: /setting/, sym: 'i-set', a: '#64748b', b: '#6366f1' }
  ];
  var DEF = { k: 'x', sym: 'i-project', a: '#5b7cff', b: '#8b5cf6' };
  function modOf(label) {
    label = (label || '').toLowerCase();
    for (var i = 0; i < MODS.length; i++) if (MODS[i].m.test(label)) return MODS[i];
    return DEF;
  }

  /* ---------- Ikon tab ---------- */
  var I = {
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    check: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    done: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6l-4 1 1-4z"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    bank: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M12 3 3 8h18z"/>',
    swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r=".6" fill="currentColor"/>',
    goal: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    next: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    layers: '<path d="m12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z"/><path d="m22 17.7-9.2 4.1a2 2 0 0 1-1.6 0L2 17.7M22 12.7l-9.2 4.1a2 2 0 0 1-1.6 0L2 12.7"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    dot: '<circle cx="12" cy="12" r="3.2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  var TI = [
    [/mode tampilan/, 'sun'], [/analisis|analitik|analytics/, 'chart'], [/semester|kalender|calendar/, 'cal'], [/mata kuliah/, 'book'], [/ujian/, 'pen'],
    [/formula|pengaturan|ambang/, 'sliders'], [/klien/, 'users'], [/jam kerja/, 'clock'], [/pekerjaan/, 'briefcase'],
    [/dokumen/, 'folder'], [/pendapatan/, 'coins'], [/profil/, 'user'], [/rapat/, 'msg'], [/anggaran/, 'pie'],
    [/ringkasan|overview/, 'dash'], [/akun/, 'bank'], [/transaksi/, 'swap'], [/kategori/, 'tag'], [/tabungan/, 'goal'],
    [/my day/, 'sun'], [/upcoming/, 'next'], [/overdue/, 'alert'], [/all tasks/, 'list'], [/by project/, 'layers'],
    [/by area/, 'grid'], [/completed|selesai/, 'done'], [/tugas|task/, 'check'], [/status/, 'flag'], [/data|cadangan/, 'db'],
    [/keuangan/, 'coins'], [/akademik/, 'book'], [/kerja/, 'briefcase'], [/produktivitas/, 'trend']
  ];
  function tabIcon(label) {
    label = (label || '').toLowerCase();
    for (var i = 0; i < TI.length; i++) if (TI[i][0].test(label)) return I[TI[i][1]];
    return I.dot;
  }

  /* ---------- Dekorasi jendela ---------- */
  function fixClose(ov) {
    Array.prototype.forEach.call(ov.querySelectorAll('.ac-x'), function (b) {
      if (b.textContent.trim() === '×') b.innerHTML = svg(I.x, 2);
    });
  }
  function inherit(ov) {
    var src = document.querySelector('.ac-ov[data-mod]:not(.ac-ov2):not([hidden])');
    if (!src) return;
    ov.dataset.mod = src.dataset.mod;
    ov.style.setProperty('--ac', src.style.getPropertyValue('--ac'));
    ov.style.setProperty('--ac2', src.style.getPropertyValue('--ac2'));
  }
  function decorate(ov) {
    if (ov.__pm) return; ov.__pm = 1;
    var win = ov.querySelector('.ac-win'); if (!win) return;
    if (ov.classList.contains('ac-ov2')) { inherit(ov); fixClose(ov); return; }

    var m = modOf(win.getAttribute('aria-label'));
    ov.dataset.mod = m.k;
    ov.style.setProperty('--ac', m.a); ov.style.setProperty('--ac2', m.b);

    var hd = win.querySelector(':scope > header');
    if (hd) hd.insertAdjacentHTML('afterbegin', '<span class="ac-ico">' + svg('<use href="#' + m.sym + '"/>', 1.6) + '</span>');
    fixClose(ov);

    var nav = win.querySelector(':scope > .ac-tabs');
    if (nav) {
      Array.prototype.forEach.call(nav.querySelectorAll('.ac-tab'), function (b) {
        b.insertAdjacentHTML('afterbegin', svg(tabIcon(b.textContent), 1.7).replace('<svg ', '<svg class="ac-ti" '));
      });
      nav.insertAdjacentHTML('afterbegin', '<div class="ac-brand"><span class="ac-bd"></span><div><b>Beresin</b><small>Plan · Execute · Achieve</small></div></div><i class="ac-ind"></i>');
      nav.insertAdjacentHTML('beforeend', '<div class="ac-side-foot"><kbd>Esc</kbd><span>untuk menutup</span></div>');
      new MutationObserver(function () { if (ov.hidden || ov.__pq) return; ov.__pq = requestAnimationFrame(function () { ov.__pq = 0; place(ov); }); }).observe(nav, { attributes: true, attributeFilter: ['aria-selected'], subtree: true });
    }
  }

  /* ---------- Indikator tab ---------- */
  function place(ov) {
    var nav = ov.querySelector('.ac-win > .ac-tabs'); if (!nav) return;
    var ind = nav.querySelector('.ac-ind'), s = nav.querySelector('.ac-tab[aria-selected="true"]');
    if (!ind || !s || !s.offsetWidth) return;
    ind.style.width = s.offsetWidth + 'px'; ind.style.height = s.offsetHeight + 'px';
    ind.style.transform = 'translate(' + s.offsetLeft + 'px,' + s.offsetTop + 'px)';
    if (!ind.__init) { ind.__init = 1; requestAnimationFrame(function () { requestAnimationFrame(function () { ind.classList.add('on'); }); }); }
    if (getComputedStyle(nav).flexDirection === 'row') {
      var l = Math.max(0, s.offsetLeft - (nav.clientWidth - s.offsetWidth) / 2);
      if (nav.scrollTo) nav.scrollTo({ left: l, behavior: reduce || !ind.__init ? 'auto' : 'smooth' }); else nav.scrollLeft = l;
    }
  }

  /* ---------- Hitung-naik angka statistik ---------- */
  function countUp(root) {
    if (reduce || window.MOCountUp) return;
    Array.prototype.forEach.call(root.querySelectorAll('.ac-stat b'), function (b) {
      if (b.children.length) return;
      var t = b.textContent.trim(), rp = /^(Rp\s?)(-?[\d.]+)$/.exec(t), pl = /^(-?\d+(?:\.(\d+))?)(%?)$/.exec(t), to, fmt;
      if (rp) { to = +rp[2].replace(/\./g, ''); fmt = function (v) { return rp[1] + Math.round(v).toLocaleString('id-ID'); }; }
      else if (pl) { to = parseFloat(pl[1]); var d = pl[2] ? pl[2].length : 0; fmt = function (v) { return v.toFixed(d) + pl[3]; }; }
      else return;
      if (!isFinite(to) || Math.abs(to) < 1) return;
      var t0 = null, dur = 2600;
      (function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 2);
        b.textContent = p < 1 ? fmt(to * e) : t;
        if (p < 1 && b.isConnected) requestAnimationFrame(step);
      })(performance.now());
    });
  }
  function enter(ov, quick) {
    var b = ov.querySelector('.ac-body'); if (!b) return;
    b.classList.toggle('ac-quick', !!quick);   /* v3.3: pindah tab = fade singkat, tanpa animasi berurutan */
    b.classList.add('ac-enter');
    clearTimeout(b.__t); b.__t = setTimeout(function () { b.classList.remove('ac-enter'); }, quick ? 300 : 650);
    countUp(b);
  }

  /* ---------- Animasi buka dari ikon menu ---------- */
  var last = null;
  document.addEventListener('click', function (e) {
    /* v4.0: tanpa getBoundingClientRect (memaksa hitung ulang tata letak seluruh beranda di ketukan yang sama) */
    var a = e.target.closest && e.target.closest('.nav a, .avatar');
    if (a) last = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, true);

  function launch(ov) {
    var win = ov.querySelector('.ac-win'); if (!win) return;
    /* v4.0: animasi zoom jendela sudah dimatikan sejak v3.7, jadi titik asalnya tidak dibaca lagi (hemat hitung ulang tata letak) */
    ov.classList.add('ac-launch');
    clearTimeout(ov.__lt); ov.__lt = setTimeout(function () { ov.classList.remove('ac-launch'); }, 900);
    enter(ov); if (!ov.__pq) ov.__pq = requestAnimationFrame(function () { ov.__pq = 0; place(ov); });
  }
  function watch(ov) {
    if (ov.classList.contains('ac-ov2')) return;
    new MutationObserver(function () { if (!ov.hidden) launch(ov); }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    /* pindah tab: animasi isi sekali */
    ov.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.ac-tab')) enter(ov, true);
    }, true);
    if (!ov.hidden) launch(ov);
  }
  function adopt(n) {
    if (n.nodeType !== 1 || !n.classList.contains('ac-ov')) return;
    decorate(n); watch(n);
  }

  new MutationObserver(function (list) {
    list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, adopt); });
  }).observe(document.body, { childList: true });
  Array.prototype.forEach.call(document.querySelectorAll('.ac-ov'), adopt);

  var rz; window.addEventListener('resize', function () {
    clearTimeout(rz); rz = setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll('.ac-ov:not(.ac-ov2):not([hidden])'), place);
    }, 80);
  });
})();
;
(function(){
var D=document,calm=matchMedia('(prefers-reduced-motion:reduce)').matches;
/* blob: [warna, opasitas, x, y, ukuran, durasi, dx, dy] */
var Wd={
academic:{b:[['#f6c25b',.5,'8%','8%',520,17,150,90],['#9fb8e8',.42,'78%','70%',560,20,-140,-90],['#f1b9a8',.38,'35%','95%',440,18,120,-110]],r:['rgba(246,194,91,.35)',.5],p:[10,'#fff6dc',.7,4,14]},
work:{b:[['#d6b36a',.16,'18%','12%',620,18,200,80],['#6b6f80',.14,'50%','100%',640,20,-160,-90]],au:[[ '#d6b36a','12%',.2,-10],['#8a8578','38%',.16,12],['#f2dda6','62%',.14,-14],['#d6b36a','82%',.14,10]],st:[24,'#f2e6c4'],sh:2,spot:'rgba(214,179,106,.08)'},
org:{b:[['#8fcfb0',.5,'12%','10%',520,18,140,90],['#f0d58c',.42,'85%','25%',460,20,-130,80],['#b8e0d0',.45,'55%','92%',560,19,100,-100]],r:['rgba(255,255,255,.55)',.45],l:[10,['#6fb58f','#8fcfb0','#e6c36a','#4f9a7a']]},
project:{b:[['#e58a63',.36,'88%','8%',560,18,-140,90],['#f2cf9a',.44,'10%','55%',520,20,130,-60]],au:[['#e9825a','20%',.3,22],['#f2b07a','55%',.28,-20],['#c9667a','80%',.2,24]]},
task:{b:[['#5865f2',.32,'85%','8%',620,19,-160,110],['#a06cf0',.24,'10%','60%',560,21,150,-80]],st:[34,'#dfe4ff'],sh:2,spot:'rgba(140,158,255,.16)',au:[['#6a78ff','30%',.2,8],['#a06cf0','70%',.18,-10]]},
calendar:{b:[['#ffc9a6',.5,'12%','10%',560,17,130,80],['#f5a3b3',.38,'88%','45%',520,20,-130,60]],sun:1,f:[3,'#ffe9d6',.7]},
finance:{b:[['#5eead4',.42,'90%','8%',560,18,-130,80],['#7aa7ff',.34,'8%','70%',560,21,130,-80]],sp:[14,'#a7f3d0'],sheen:1,p:[8,'#a7f3d0',.6,3,8]},
goal:{b:[['#8fdcf0',.5,'15%','8%',560,17,120,80],['#b6ecd2',.38,'55%','100%',560,19,100,-80]],sun:1,r:['rgba(255,236,160,.45)',.4],c:[6,'#fff',.85]},
documents:{b:[['#ffd9a0',.6,'88%','6%',560,18,-110,90,1],['#e8b27a',.3,'10%','80%',520,21,100,-80]],p:[9,'#fff3d6',.75,4,22]},
analytics:{b:[['#b7a8f5',.45,'12%','10%',580,18,150,80],['#f6a99a',.34,'88%','55%',520,20,-130,-60]],w:[['#8a7bf0',.5,'6%',38],['#f08f78',.45,'0%',30],['#6fcfbf',.4,'-4%',46]]},
settings:{b:[['#a9c1d9',.5,'12%','10%',560,20,120,70]],f:[4,'#e9f1f8',.75]}};
function el(c,s,t){var e=D.createElement(t||'div');e.className=c;for(var k in s)e.style.setProperty(k,s[k]);return e}
function r(a,b){return a+Math.random()*(b-a)}
function K(){return D.documentElement.dataset.lite==='1'||matchMedia('(pointer:coarse)').matches?.5:1}
function add(a,n,c,f){n=Math.max(1,Math.round(n*K()));for(var i=0;i<n;i++)a.appendChild(el(c,f(i)))}
function build(n){
  var w=Wd[n],a=el('wx-amb');if(!w)return a;
  w.b.forEach(function(b){var e=el('wx-b'+(b[8]?' wx-breathe':''),{'--c':b[0],'--o':b[1],'--x':b[2],'--y':b[3],'--s':b[4]+'px','--t':b[5]+'s','--dx':b[6]+'px','--dy':b[7]+'px'});a.appendChild(e)});
  if(w.r)a.appendChild(el('wx-r',{'--c':w.r[0],'--o':w.r[1]}));
  if(w.au)w.au.forEach(function(u,i){a.appendChild(el('wx-au',{'--c':u[0],'--x':u[1],'--o':u[2],'--r':u[3]+'deg','--t':r(14,22)+'s','--d':-i*4+'s'}))});
  if(w.w)w.w.forEach(function(u,i){var s=D.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 1600 200');s.setAttribute('preserveAspectRatio','none');s.setAttribute('class','wx-w');
    s.style.cssText='--c:'+u[0]+';--o:'+u[1]+';--y:'+u[2]+';--t:'+(u[3]+i*6)+'s;--d:-'+i*7+'s';
    s.innerHTML='<path d="M0 100 C260 20 540 180 800 100 C1060 20 1340 180 1600 100"/>';a.appendChild(s)});
  if(w.p)add(a,w.p[0],'wx-p',function(){return{'--c':w.p[1],'--o':w.p[2],'--x':r(3,97)+'%','--s':r(w.p[3],w.p[4])*.5+'px','--t':r(14,26)+'s','--d':-r(0,26)+'s','--dx':r(-60,60)+'px'}});
  if(w.st)add(a,w.st[0],'wx-s',function(){return{'--c':w.st[1],'--o':r(.3,.85),'--x':r(2,98)+'%','--y':r(2,98)+'%','--s':r(1.5,3)+'px','--t':r(2.5,6)+'s','--d':-r(0,6)+'s'}});
  if(w.sh)add(a,w.sh,'wx-sh',function(i){return{'--x':r(40,90)+'%','--y':r(4,30)+'%','--t':r(9,15)+'s','--d':-i*5+'s'}});
  if(w.sp)add(a,w.sp[0],'wx-sp',function(){return{'--c':w.sp[1],'--o':r(.5,.95),'--x':r(3,95)+'%','--y':r(5,95)+'%','--s':r(10,22)+'px','--t':r(3,6)+'s','--d':-r(0,6)+'s'}});
  if(w.sheen)a.appendChild(el('wx-sheen'));
  if(w.l)add(a,w.l[0],'wx-l',function(i){return{'--c':w.l[1][i%w.l[1].length],'--o':r(.5,.85),'--x':r(2,96)+'%','--s':r(12,22)+'px','--t':r(12,22)+'s','--d':-r(0,22)+'s','--dx':r(-140,140)+'px','--rot':r(240,600)+'deg'}});
  if(w.c)add(a,w.c[0],'wx-c',function(){return{'--c':w.c[1],'--o':w.c[2]-r(0,.25),'--y':r(4,70)+'%','--s':r(260,520)+'px','--t':r(60,110)+'s','--d':-r(0,100)+'s'}});
  if(w.f)add(a,w.f[0],'wx-f',function(i){return{'--c':w.f[1],'--o':w.f[2]-r(0,.25),'--y':(i*24+r(-6,10))+'%','--s':r(620,980)+'px','--t':r(34,60)+'s','--d':-r(0,40)+'s'}});
  if(w.sun){var d=new Date(),h=d.getHours()+d.getMinutes()/60,night=h<5.5||h>18.5,x=10+Math.max(0,Math.min(1,(h-5.5)/13))*80;
    a.appendChild(el('wx-sun',{'--x':x+'%','--c':night?'#cdd8ff':(h>16.5?'#ffb27a':'#ffd98a'),'--o':night?.45:.7}))}
  if(w.spot)a.appendChild(el('wx-spot',{'--c':w.spot}));
  return a;
}
function world(ov){
  var c=ov.className+'',f=ov.firstElementChild;if(!f||/ac-ov2|ac-form|\bvw\b/.test(c+' '+f.className))return null;
  if(/\bad-ov\b/.test(c))return'academic';if(/\bwo-ov\b/.test(c))return'work';if(/\bes-ov\b/.test(c))return'org';if(/\bfn-ov\b/.test(c))return'finance';
  if(/pj-skin/.test(c))return'project';if(/tk-skin/.test(c))return'task';if(/gq-skin/.test(c))return'goal';if(/rd-skin/.test(c))return'documents';if(/an-skin/.test(c))return'analytics';
  if(!/\bac-ov\b/.test(c))return null;
  return /kalender|calendar/i.test((ov.querySelector('header')||ov).textContent.slice(0,80))?'calendar':'settings';
}
function spot(win){
  var s=win.querySelector('.wx-spot');if(!s||calm||win._sp)return;win._sp=1;var q=0,x=0,y=0;
  win.addEventListener('pointermove',function(e){x=e.clientX;y=e.clientY;if(q)return;q=requestAnimationFrame(function(){q=0;var b=win.getBoundingClientRect();var a=win.querySelector('.wx-spot');if(a){a.style.setProperty('--mx',(x-b.left)+'px');a.style.setProperty('--my',(y-b.top)+'px')}})},{passive:true});
}
/* Jika modul menggambar ulang isi jendela dan latar terhapus, pasang kembali */
function guard(win,n){
  if(win._wg)return;win._wg=1;
  new MutationObserver(function(){if(!win.querySelector(':scope>.wx-amb')){win.appendChild(build(n));spot(win)}}).observe(win,{childList:true});
}
var pend=0;
function scan(){
  pend=0;
  D.querySelectorAll('[class$="-ov"],[class*="-ov "]').forEach(function(ov){
    var vis=!ov.hidden;
    if(!vis){if(ov.classList.contains('wx-live'))ov.classList.remove('wx-live','wx-open');return}
    if(ov.classList.contains('wx-live'))return;
    var n=world(ov);if(!n)return;
    ov.dataset.wx=n;ov.classList.add('wx-live');
    var win=ov.firstElementChild;
    if(!win.querySelector(':scope>.wx-amb')){win.appendChild(build(n));spot(win)}
    guard(win,n);
    if(!calm){ov.classList.add('wx-open');setTimeout(function(){ov.classList.remove('wx-open')},1700)}
  });
}
function sched(){if(!pend){pend=1;requestAnimationFrame(scan)}}
new MutationObserver(sched).observe(D.body,{childList:true});
new MutationObserver(sched).observe(D.body,{attributes:true,attributeFilter:['hidden'],subtree:false,childList:false}); /* hanya anak langsung <body> (overlay); subtree:true memicu pemindaian penuh tiap elemen di dalam menu di-hide/show */
addEventListener('hashchange',sched);
sched();
})();
;
/* =====================================================================
   MyOffice — POLISH (JS ringan, dimuat paling akhir)
   1. Menandai perangkat sentuh  -> CSS mematikan efek berat di HP
   2. Penguncian scroll yang andal (satu sumber kebenaran)
   3. Animasi dijeda saat tab tersembunyi
   4. Tanggal ringkas di layar sempit supaya kartu info tidak patah baris
   5. Latar foto (assets/bg.jpg) hanya dipakai bila file memang ada
   Tidak menyentuh data pengguna.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () { } }; };
  var on = function (m, f) { if (m.addEventListener) m.addEventListener('change', f); else if (m.addListener) m.addListener(f); };

  /* ---------- 1. Sentuh / layar kecil ---------- */
  var coarse = mq('(hover: none) and (pointer: coarse)');
  function flagTouch() { root.classList.toggle('touch', !!coarse.matches); }
  flagTouch(); on(coarse, flagTouch);

  /* ---------- 2. Kunci scroll ----------
     Sebelumnya tiap menu mengatur body.style.overflow sendiri-sendiri; menutup
     satu lapisan membuka kunci walau lapisan lain (form, pencarian) masih ada,
     sehingga halaman di belakangnya bisa tergulir. Di sini kuncinya mengikuti
     kenyataan: terkunci selama ada lapisan yang tampil. */
  var LAYER = /(^|\s)(ac-ov|ad-ov|wo-ov|es-ov|fn-ov|ac-ov2|wo-ov2|es-ov2|ac-soon|sp-ov|ib-ov)(\s|$)/;
  var COVER = /(^|\s)(ac-ov|ad-ov|wo-ov|es-ov|fn-ov|sp-ov|ib-ov)(\s|$)/, __cover = false, __cvT = 0;
  function anyLayer() {
    var c = body.children, any = false, cov = false;
    for (var i = 0; i < c.length; i++) {
      var n = c[i];
      if (n.nodeType !== 1 || n.hidden) continue;
      var cn = n.className || '';
      if (!LAYER.test(cn)) continue;
      any = true; if (COVER.test(cn)) cov = true;   /* v4.7: tanpa getComputedStyle/offsetParent (memaksa restyle+layout seluruh halaman); atribut hidden sudah cukup */
    }
    __cover = cov; return any;
  }
  var lockQ = 0;
  function syncLock() {
    lockQ = 0;
    var want = anyLayer();
    if (want && body.style.overflow !== 'hidden') body.style.overflow = 'hidden';
    else if (!want && body.style.overflow === 'hidden') body.style.overflow = '';
    root.classList.toggle('win-open', want);
    var wc = want && __cover;
    if (!wc) { clearTimeout(__cvT); root.classList.remove('win-cover'); }
    else if (!root.classList.contains('win-cover')) { clearTimeout(__cvT); __cvT = setTimeout(function () { if (__cover) root.classList.add('win-cover'); }, 360); }
  }
  function schedLock() { if (!lockQ) lockQ = requestAnimationFrame(syncLock); }
  new MutationObserver(schedLock).observe(body, { childList: true, attributes: true, attributeFilter: ['hidden', 'class'], subtree: false });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setTimeout(schedLock, 60); });
  document.addEventListener('click', function () { setTimeout(schedLock, 80); }, true);
  schedLock();

  /* ---------- 3. Tab tersembunyi: jeda animasi CSS ---------- */
  function vis() { root.classList.toggle('is-hidden', document.hidden); }
  document.addEventListener('visibilitychange', vis); vis();

  /* ---------- 4. Tanggal ringkas di layar sempit ---------- */
  var narrow = mq('(max-width: 420px)');
  var masehi = document.getElementById('masehi'), busy = false, full = '';
  function shorten() {
    if (!masehi || busy) return;
    busy = true;
    try {
      if (narrow.matches) {
        var d = new Date();
        var short = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
        if (masehi.textContent !== short) { full = masehi.textContent; masehi.textContent = short; }
      } else if (full && masehi.textContent !== full) {
        masehi.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (e) { }
    busy = false;
  }
  if (masehi) {
    new MutationObserver(function () { if (!busy) shorten(); }).observe(masehi, { childList: true, characterData: true, subtree: true });
    on(narrow, shorten); shorten();
  }

  /* ---------- 5. Foto latar opsional ----------
     Paket tidak menyertakan assets/bg.jpg. Hanya saat "Danau Senja" dipilih
     file diperiksa; jika ada, dipakai (lewat CSS), jika tidak, ilustrasi SVG
     tetap tampil dan tidak ada permintaan 404 saat halaman dibuka. */
})();
;
/* MyOffice — V6: ringkasan hari ini + lonceng notifikasi. Hanya membaca data, tidak mengubahnya. */
(function () {
  'use strict';
  var D = document, $ = function (i) { return D.getElementById(i); };
  function ls(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function data() {
    var td = today(), T = ls('mo-task-v1').task || [], E = ls('mo-cal-v1').ev || [], G = ls('mo-goal-v1').goal || [];
    var act = T.filter(function (t) { return t.status !== 'Done' && t.status !== 'Archived'; });
    var due = act.filter(function (t) { return t.due && String(t.due).slice(0, 10) <= td; });
    var ev = E.filter(function (e) { var s = String(e.start || '').slice(0, 10), z = String(e.end || e.start || '').slice(0, 10); return s && s <= td && z >= td; });
    var goals = G.filter(function (g) { return g.status === 'Berjalan'; });
    return { act: act, due: due, ev: ev, goals: goals, td: td };
  }

  /* ---------- Ringkasan di beranda ---------- */
  var hero = D.querySelector('.hero'), info = D.querySelector('.hero .info');
  var box = D.createElement('div'); box.className = 'today'; box.id = 'today'; box.setAttribute('aria-label', 'Ringkasan hari ini');
  box.innerHTML = [['#task', 'tTask', 'Tugas aktif'], ['#calendar', 'tEv', 'Agenda hari ini'], ['#goal', 'tGoal', 'Goal berjalan']].map(function (c) {
    return '<a class="tchip" href="' + c[0] + '"><b id="' + c[1] + '">0</b><span>' + c[2] + '</span></a>';
  }).join('');
  if (hero && info) info.insertAdjacentElement('afterend', box);
  box.addEventListener('click', function (e) {          // buka lewat router, sama seperti dock
    var a = e.target.closest('a'); if (!a) return; e.preventDefault();
    var r = window.MyOffice && MyOffice.routes && MyOffice.routes[a.getAttribute('href')]; if (r) r();
  });

  /* ---------- Lonceng: dipindah ke revisi5.js (BeresinNotif) ---------- */
  function refresh() {
    var d = data();
    $('tTask').textContent = d.act.length; $('tEv').textContent = d.ev.length; $('tGoal').textContent = d.goals.length;
    if (window.BeresinNotif) BeresinNotif.refresh();
    return d;
  }
  // data berubah saat jendela menu ditutup / tab kembali aktif
  new MutationObserver(function () { if (!D.documentElement.classList.contains('win-open')) refresh(); }).observe(D.documentElement, { attributes: true, attributeFilter: ['class'] });
  D.addEventListener('visibilitychange', function () { if (!D.hidden) refresh(); });
  refresh();
})();
;
/* MyOffice — fx.js v3.4: efek tekan SERAGAM untuk semua yang bisa diklik (tombol, kartu, baris, label unggah, tab, ikon).
   Satu mekanisme saja (WAAPI 'scale' + riak), delegasi event, dan pembacaan layout hanya SEKALI per tekanan,
   sehingga tidak ikut membuat lemot. Aturan CSS :active { transform } lama dihapus (bentrok = efek tidak merata). */
(function () {
  'use strict';
  if (window.__fxClick) return; window.__fxClick = 1;
  var D = document;
  var SEL = 'button,[role=button],[role=tab],[role=menuitem],[role=switch],a[href],summary,label.ac-chip,.chip,.wall,.es-card,.kc-d,.tk-d,.ad-d,[data-act],[data-a],input[type=checkbox],input[type=radio],input[type=submit],input[type=button]';
  var SEL_X = 'label[for],label.ac-btn,label.wo-btn,label.wo-cp,label.an-up,[onclick],[tabindex="0"]:not(input):not(textarea):not(select)';
  var NOFX = 'select,textarea,option,input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),[contenteditable=true],[contenteditable=""]';
  var reduce = matchMedia('(prefers-reduced-motion:reduce)');
  var canWA = typeof Element !== 'undefined' && !!Element.prototype.animate;
  var PROP = (window.CSS && CSS.supports && CSS.supports('scale', '1')) ? 'scale' : 'transform';
  var val = function (s) { return PROP === 'scale' ? String(s) : 'scale(' + s + ')'; };
  var held = null, rippleOn = false; /* v4.4: riak dimatikan (bercak lingkaran di atas label = glitch); umpan balik sentuh = tekan-lalu-pegas */
  var info = new WeakMap();                      // elemen → {d: kedalaman, br: radius sudut, col: warna} (dihitung sekali)

  /* elemen terluar dalam rantai kursor-pointer (kursor menurun ke anak) — hanya dipakai bila selector biasa tak cocok */
  function pointerRoot(t) {
    var el = t, top = null, n = 0;
    while (el && el.nodeType === 1 && el !== D.body && el !== D.documentElement && n++ < 7) {
      if (getComputedStyle(el).cursor === 'pointer') top = el; else if (top) break;
      el = el.parentElement;
    }
    return top;
  }
  function target(e) {
    var t = e.target; if (!t || !t.closest) return null;
    var el = t.closest(SEL);
    if (!el) {
      if (t.closest(NOFX)) return null;
      el = t.closest(SEL_X) || pointerRoot(t);
      if (!el) return null;
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('.fx-off')) return null;
    return el;
  }
  /* satu kali baca layout per elemen: ukuran → kedalaman tekan (seragam per kelas ukuran), radius → riak */
  var kinfo = Object.create(null);
  function measure(el) {
    var c = info.get(el);
    if (!c && !rippleOn) {
      var sig = el.tagName + '.' + (typeof el.className === 'string' ? el.className : '');
      c = kinfo[sig];
      if (c) { info.set(el, c); return c; }
    }
    /* v4.4: tanpa efek riak, ukuran yang sudah di-cache dipakai ulang — tidak ada pembacaan layout di setiap sentuhan */
    if (c && !rippleOn) return c;
    var r = el.getBoundingClientRect();
    if (!c || c.w !== r.width || c.h !== r.height) {
      var m = Math.min(r.width, r.height), vw = innerWidth, vh = innerHeight, cs = getComputedStyle(el);
      c = { w: r.width, h: r.height, big: r.width > .92 * vw && r.height > .6 * vh, br: cs.borderRadius, col: cs.color, d: m > 160 ? .984 : m > 70 ? .955 : m > 34 ? .925 : .88 };
      info.set(el, c); if (!rippleOn) kinfo[el.tagName + '.' + (typeof el.className === 'string' ? el.className : '')] = c;
    }
    if (rippleOn) c.r = r; return c;
  }
  function ripple(el, c, x, y) {
    var r = c.r; if (r.width < 2 || r.height < 2) return;
    var host = D.createElement('div'), dot = D.createElement('i');
    host.className = 'fx-ripple-host'; dot.className = 'fx-ripple';
    host.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' + c.br + ';color:' + c.col;
    var cx = x == null ? r.width / 2 : Math.max(0, Math.min(r.width, x - r.left)), cy = y == null ? r.height / 2 : Math.max(0, Math.min(r.height, y - r.top));
    var rad = Math.max(Math.hypot(cx, cy), Math.hypot(r.width - cx, cy), Math.hypot(cx, r.height - cy), Math.hypot(r.width - cx, r.height - cy));
    dot.style.cssText = 'left:' + (cx - rad) + 'px;top:' + (cy - rad) + 'px;width:' + rad * 2 + 'px;height:' + rad * 2 + 'px';
    host.appendChild(dot); D.body.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 600);
  }
  function press(el, c) {
    if (!canWA || reduce.matches) return null;
    try { return el.animate([{ [PROP]: val(1) }, { [PROP]: val(c.d) }], { duration: 85, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }); } catch (e) { return null; }
  }
  function release(el, a, c) {
    if (!canWA || reduce.matches) return;
    try {
      if (a) a.cancel();
      var d = c ? c.d : .94, o = 1 - d;
      el.animate([{ [PROP]: val(d) }, { [PROP]: val(1 + o * .45), offset: .5 }, { [PROP]: val(1 - o * .1), offset: .76 }, { [PROP]: val(1) }], { duration: 380, easing: 'cubic-bezier(.25,1.2,.4,1)' });
    } catch (e) { }
  }
  function end() { if (held) { var h = held; held = null; release(h.el, h.a, h.c); } }

  D.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    var el = target(e); if (!el) return;
    if (el.matches('input[type=checkbox],input[type=radio]')) return;
    end();
    var c = measure(el); if (c.big) return;
    if (rippleOn) ripple(el, c, e.clientX, e.clientY);
    held = { el: el, a: press(el, c), c: c };
    if (e.pointerType === 'touch' && navigator.vibrate && !reduce.matches) { try { navigator.vibrate(5); } catch (x) { } }
  }, { capture: true, passive: true });
  ['pointerup', 'pointercancel', 'dragstart', 'contextmenu'].forEach(function (n) { D.addEventListener(n, end, { capture: true, passive: true }); });
  addEventListener('blur', end);
  D.addEventListener('visibilitychange', end);

  /* keyboard (Enter / Space) → klik tanpa pointer */
  D.addEventListener('click', function (e) {
    if (e.detail !== 0) return;
    var el = target(e); if (!el || el.matches('input[type=checkbox],input[type=radio]')) return;
    var c = measure(el); if (c.big) return;
    if (rippleOn) ripple(el, c, null, null); release(el, press(el, c), c);
  }, true);

  /* centang / radio / switch */
  D.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches('input[type=checkbox],input[type=radio]')) return;
    if (reduce.matches) return;
    t.classList.remove('fx-check'); void t.offsetWidth; t.classList.add('fx-check');
    setTimeout(function () { t.classList.remove('fx-check'); }, 340);
  }, true);
})();
;
/* Latar bintang bergerak untuk bagian paling atas (hero) dan paling bawah (footer).
   Ringan: canvas hanya berjalan saat terlihat, jeda saat tab disembunyikan atau jendela ASTA terbuka. */
(function () {
  "use strict";
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  var TINT = ["255,255,255", "255,255,255", "255,255,255", "248,210,74", "248,210,74", "150,230,205"];

  var SPR = {};
  function sprite(c) {                              /* titik bulat dipra-render sekali per warna */
    if (SPR[c]) return SPR[c];
    var k = document.createElement("canvas"); k.width = k.height = 32;
    var g = k.getContext("2d"); g.fillStyle = "rgb(" + c + ")"; g.beginPath(); g.arc(16, 16, 15, 0, 6.2832); g.fill();
    return (SPR[c] = k);
  }

  function Field(host, density, shoot, cap) {
    var cv = document.createElement("canvas"), cx = cv.getContext("2d");
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block";
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.isolation = "isolate";
    host.appendChild(cv);
    var W = 0, H = 0, stars = [], star = null, nextShoot = 2 + Math.random() * 3, visible = false, last = 0, raf = 0, acc = 0, t = 0;

    function rnd(a, b) { return a + Math.random() * (b - a); }
    function seed() {
      var n = Math.max(24, Math.min(cap || 150, Math.round(W * H / density)));
      if (document.documentElement.dataset.lite === "1") n = Math.round(n / 2);
      stars = [];
      for (var i = 0; i < n; i++) {
        var z = Math.random();                       /* 0 jauh ... 1 dekat */
        stars.push({
          x: Math.random() * W, y: Math.random() * H, z: z,
          r: 0.55 + z * 1.35, v: 3 + z * 13,
          ph: Math.random() * 6.28, sp: rnd(0.6, 2.2),
          c: TINT[(Math.random() * TINT.length) | 0],
          sparkle: z > 0.86
        });
      }
    }
    function size() {
      var r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cx.setTransform(DPR, 0, 0, DPR, 0, 0); seed(); draw(0);
    }
    function draw(dt) {
      cx.clearRect(0, 0, W, H);
      t += dt;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.x += s.v * dt * 0.8; s.y -= s.v * dt * 0.45;      /* melayang pelan ke kanan atas */
        if (s.x > W + 4) s.x = -4; if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
        var a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.ph + t * s.sp));
        cx.globalAlpha = a * (0.55 + s.z * 0.45); cx.drawImage(sprite(s.c), s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); cx.globalAlpha = 1;
        if (s.sparkle) {
          var L = 3 + 4 * a; cx.strokeStyle = "rgba(" + s.c + "," + (a * 0.55).toFixed(3) + ")"; cx.lineWidth = 0.8;
          cx.beginPath(); cx.moveTo(s.x - L, s.y); cx.lineTo(s.x + L, s.y); cx.moveTo(s.x, s.y - L); cx.lineTo(s.x, s.y + L); cx.stroke();
        }
      }
      if (shoot && !reduce && document.documentElement.dataset.lite !== "1") {
        if (!star) { nextShoot -= dt; if (nextShoot <= 0) { star = { x: rnd(W * 0.35, W * 1.05), y: rnd(-10, H * 0.35), life: 0, len: rnd(90, 150), sp: rnd(520, 700) }; nextShoot = rnd(5, 9); } }
        else {
          star.life += dt; var d = star.sp * dt; star.x -= d * 0.86; star.y += d * 0.5;
          var f = Math.max(0, 1 - star.life / 1.1), tx = star.x + star.len * 0.86, ty = star.y - star.len * 0.5;
          var g = cx.createLinearGradient(star.x, star.y, tx, ty);
          g.addColorStop(0, "rgba(255,244,190," + (0.95 * f).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,244,190,0)");
          cx.strokeStyle = g; cx.lineWidth = 1.6; cx.lineCap = "round"; cx.beginPath(); cx.moveTo(star.x, star.y); cx.lineTo(tx, ty); cx.stroke();
          if (star.life > 1.1 || star.x < -160 || star.y > H + 160) star = null;
        }
      }
    }
    function paused() { var ai = document.getElementById("ai-app"); return document.hidden || document.documentElement.classList.contains("win-open") || (ai && !ai.hidden); }
    function loop(now) {
      raf = 0; if (!visible) return;
      if (paused()) { last = 0; raf = requestAnimationFrame(loop); return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      acc += dt;
      var fps = document.documentElement.dataset.lite === "1" ? 20 : 30;
      if (acc >= 1 / fps) { draw(acc); acc = 0; }              /* 30 gambar/detik cukup untuk gerak pelan */
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(loop); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }, { rootMargin: "80px" }).observe(host);
    } else { visible = true; start(); }
    if ("ResizeObserver" in window) new ResizeObserver(function () { if (Math.abs(host.clientWidth - W) > 1 || Math.abs(host.clientHeight - H) > 1) size(); }).observe(host);
    window.addEventListener("resize", size);
    size();
  }

  /* MyOffice: satu langit bintang di belakang seluruh aplikasi */
  var sky = document.querySelector(".bg .stack");
  if (sky) Field(sky, 6500, true, 240);
})();
;
/* GENERATED oleh gen_icons3d.py */
window.IC3D={"academic":"<ellipse class=\"sh\" cx=\"50\" cy=\"91.6\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"7.44\" width=\"92.00\" height=\"83.13\"/></g>","work":"<ellipse class=\"sh\" cx=\"50\" cy=\"91.1\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"7.85\" width=\"92.00\" height=\"82.30\"/></g>","org":"<ellipse class=\"sh\" cx=\"50\" cy=\"87.9\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"11.09\" width=\"92.00\" height=\"75.81\"/></g>","project":"<ellipse class=\"sh\" cx=\"50\" cy=\"94.1\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"4.95\" width=\"92.00\" height=\"88.10\"/></g>","task":"<ellipse class=\"sh\" cx=\"50\" cy=\"94.2\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"4.79\" width=\"92.00\" height=\"88.42\"/></g>","cal":"<ellipse class=\"sh\" cx=\"50\" cy=\"92.1\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"6.86\" width=\"92.00\" height=\"84.28\"/></g>","fin":"<ellipse class=\"sh\" cx=\"50\" cy=\"96.0\" rx=\"32.3\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"7.51\" y=\"3.00\" width=\"84.97\" height=\"92.00\"/></g>","goal":"<ellipse class=\"sh\" cx=\"50\" cy=\"90.6\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"8.39\" width=\"92.00\" height=\"81.23\"/></g>","doc":"<ellipse class=\"sh\" cx=\"50\" cy=\"94.2\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"4.85\" width=\"92.00\" height=\"88.31\"/></g>","chart":"<ellipse class=\"sh\" cx=\"50\" cy=\"96.0\" rx=\"35.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"4.00\" y=\"3.00\" width=\"92.00\" height=\"92.00\"/></g>","set":"<ellipse class=\"sh\" cx=\"50\" cy=\"96.0\" rx=\"33.1\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"6.49\" y=\"3.00\" width=\"87.03\" height=\"92.00\"/></g>","clock":"<ellipse class=\"sh\" cx=\"50\" cy=\"96.0\" rx=\"31.0\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"9.15\" y=\"3.00\" width=\"81.70\" height=\"92.00\"/></g>","bell":"<ellipse class=\"sh\" cx=\"50\" cy=\"96.0\" rx=\"31.4\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"8.65\" y=\"3.00\" width=\"82.70\" height=\"92.00\"/></g>","book":"<ellipse class=\"sh\" cx=\"50\" cy=\"96.0\" rx=\"33.2\" ry=\"5\" fill=\"url(#lg-sh)\"/><g class=\"n-body\"><image href=\"data:image/webp;base64,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\" x=\"6.28\" y=\"3.00\" width=\"87.43\" height=\"92.00\"/></g>"};
;
/* brand-icons.js — logo di dalam tiap menu = ikon 3D milik menu itu sendiri (sama dengan ikon di beranda).
   Memakai window.IC3D (icons-3d.js). Tanpa latar; ukurannya diatur di beresin.css. */
(function () {
  'use strict';
  var MAP = { academic: 'academic', work: 'work', org: 'org', project: 'project', task: 'task', cal: 'cal', fin: 'fin', goal: 'goal', doc: 'doc', ana: 'chart', set: 'set' };
  function icon(k, cls) {
    var d = window.IC3D && window.IC3D[k];
    if (!d) return '';
    return '<svg viewBox="0 0 100 100" class="lv lv-' + k + ' lv-on bi ' + (cls || '') + '" overflow="visible" aria-hidden="true" focusable="false" fill="none" stroke="none">' + d + '</svg>';
  }
  window.MOBrandIcon = icon;

  function apply() {
    var r = document;
    [['.wo-logo', 'work'], ['.es-logo', 'org']].forEach(function (p) {
      r.querySelectorAll(p[0] + ':not([data-bi])').forEach(function (e) { e.setAttribute('data-bi', 1); e.innerHTML = icon(p[1]); });
    });
    r.querySelectorAll('.ad-logo svg.ad-mk:not(.bi)').forEach(function (e) {
      var t = document.createElement('div'); t.innerHTML = icon('academic', 'ad-mk'); if (t.firstChild) e.replaceWith(t.firstChild);
    });
    r.querySelectorAll('.rd-logo svg.rd-owl:not(.bi)').forEach(function (e) {
      var t = document.createElement('div'); t.innerHTML = icon('doc', 'rd-owl'); if (t.firstChild) e.replaceWith(t.firstChild);
    });
    r.querySelectorAll('.ac-brand .ac-bd:not([data-bi])').forEach(function (e) {
      var o = e.closest('[data-sf]'), k = o && MAP[o.getAttribute('data-sf')];
      if (!k) return; e.setAttribute('data-bi', 1); e.innerHTML = icon(k);
    });
  }
  var q = 0;
  function sched() { if (q) return; q = requestAnimationFrame(function () { q = 0; apply(); }); }
  function start() { apply(); new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
;
/* icons-live.js — ikon 3D vektor berlapis dengan gerak ASLI per bagian.
   Menggantikan gambar PNG (<use href="#i-...">) dengan SVG inline: jarum jam benar-benar berputar, gir berputar,
   batang grafik tumbuh, lonceng berayun, panah menancap di sasaran, dst. Animasi ada di icons-live.css.
   - Hanya berjalan saat ikon terlihat (IntersectionObserver) -> hemat baterai.
   - Mati hanya jika sistem meminta prefers-reduced-motion. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches);

  /* ---------- gradasi bersama ---------- */
  var GR = {
    navy: ['#4d5d99', '#1b2447'], navyD: ['#2c3869', '#121833'],
    blue: ['#86b0ff', '#3a63d8'], blueD: ['#5a82ee', '#2848b0'],
    cream: ['#fffcf2', '#f0dfb8'], white: ['#ffffff', '#dde5fb'],
    gold: ['#ffe680', '#f5a623'], goldD: ['#f9b936', '#d58210'],
    red: ['#ff8080', '#e0344a'], pink: ['#ffa6b8', '#e94f6f'],
    brown: ['#dc9560', '#8f4d28'], brownD: ['#b06a3c', '#6a3516'],
    green: ['#74e6a0', '#2fa066'], greenD: ['#46b883', '#1d7650'],
    purple: ['#c9b6ff', '#7f62e6'], purpleD: ['#ab94f7', '#6446cf'],
    orange: ['#ffc56a', '#f47a20'], yellow: ['#ffe680', '#f7b21d'],
    grey: ['#eceef8', '#b9bdd6'], lilac: ['#d6ccff', '#9482ee']
  };
  var defs = '';
  Object.keys(GR).forEach(function (k) {
    defs += '<linearGradient id="lg-' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + GR[k][0] + '"/><stop offset="1" stop-color="' + GR[k][1] + '"/></linearGradient>';
  });
  defs += '<radialGradient id="lg-sh"><stop offset="0" stop-color="#3c4696" stop-opacity=".34"/><stop offset="1" stop-color="#3c4696" stop-opacity="0"/></radialGradient>';
  defs += '<clipPath id="lvc-case"><rect x="10" y="28" width="80" height="58" rx="12"/></clipPath>';
  defs += '<clipPath id="lvc-label"><rect x="38" y="32" width="30" height="18" rx="4"/></clipPath>';
  var holder = document.createElementNS(NS, 'svg');
  holder.setAttribute('width', '0'); holder.setAttribute('height', '0'); holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = '<defs>' + defs + '</defs>';
  document.body.insertBefore(holder, document.body.firstChild);

  var U = function (k) { return 'url(#lg-' + k + ')'; };
  var SH = function (rx) { return '<ellipse class="sh" cx="50" cy="92" rx="' + (rx || 34) + '" ry="5.5" fill="url(#lg-sh)"/>'; };
  var f = function (n) { return +n.toFixed(2); };

  /* gir: poligon bergigi, digambar di koordinat absolut */
  function gear(cx, cy, ro, ri, n) {
    var p = [], s = Math.PI * 2 / n, i, a;
    for (i = 0; i < n; i++) {
      a = i * s - Math.PI / 2;
      [[-.29, ri], [-.17, ro], [.17, ro], [.29, ri]].forEach(function (q) {
        p.push(f(cx + Math.cos(a + q[0] * s) * q[1]) + ' ' + f(cy + Math.sin(a + q[0] * s) * q[1]));
      });
    }
    return 'M' + p.join('L') + 'Z';
  }
  function coin(y) {
    return '<path d="M66 ' + (y + 1) + 'v6a13 5 0 0 0 26 0v-6z" fill="' + U('goldD') + '"/>' +
      '<ellipse cx="79" cy="' + y + '" rx="13" ry="5.2" fill="' + U('gold') + '"/>' +
      '<ellipse cx="79" cy="' + y + '" rx="8" ry="2.9" fill="none" stroke="#d58210" stroke-opacity=".55" stroke-width="1.2"/>';
  }
  function tick12(cx, cy, r) {
    var s = '';
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6, big = i % 3 === 0, r1 = r - (big ? 6 : 3.5), r2 = r - 1;
      s += '<path d="M' + f(cx + Math.sin(a) * r1) + ' ' + f(cy - Math.cos(a) * r1) + 'L' + f(cx + Math.sin(a) * r2) + ' ' + f(cy - Math.cos(a) * r2) +
        '" stroke="' + (big ? '#3b4a7a' : '#9aa3c4') + '" stroke-width="' + (big ? 2.4 : 1.4) + '" stroke-linecap="round"/>';
    }
    return s;
  }
  var STAR = function (x, y, s) {
    return '<path d="M' + x + ' ' + (y - s) + 'Q' + x + ' ' + y + ' ' + (x + s) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + s) + 'Q' + x + ' ' + y + ' ' + (x - s) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - s) + 'Z" fill="#ffd34d"/>';
  };
  var CHECK = function (cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + U('green') + '"/>' +
      '<path d="M' + (cx - 3) + ' ' + cy + 'l2.6 2.8 4.2-5.4" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  };

  /* ---------- 14 ikon ---------- */
  var I = {};

  I.academic = SH() +
    '<g class="a-book"><path d="M12 68q0-6 6-6h64q6 0 6 6v14q0 6-6 6H18q-6 0-6-6z" fill="' + U('blue') + '"/>' +
    '<rect x="17" y="66" width="66" height="14" rx="3.5" fill="' + U('cream') + '"/>' +
    '<path d="M22 71h56M22 75.500h56" stroke="#d8c598" stroke-width="1.400" stroke-linecap="round"/>' +
    '<path d="M14 68q0-4 4-4h64" stroke="#fff" stroke-opacity=".55" stroke-width="1.600" stroke-linecap="round" fill="none"/>' +
    '<path class="a-rib" d="M20 80h11v12l-5.500-4-5.500 4z" fill="' + U('red') + '"/></g>' +
    '<g class="a-cap"><path d="M30 44v13q0 9 20 9t20-9V44z" fill="' + U('navyD') + '"/>' +
    '<path d="M6 32L50 14l44 18v6L50 56 6 38z" fill="#121a38"/>' +
    '<path d="M50 14l44 18-44 18L6 32z" fill="' + U('navy') + '"/>' +
    '<path d="M50 18.500l34 13.500-34 13.500L16 32z" fill="#fff" fill-opacity=".09"/>' +
    '<path d="M50 14l44 18" stroke="#fff" stroke-opacity=".35" stroke-width="1.400" fill="none"/>' +
    '<path d="M50 32L80 37" stroke="#f5a623" stroke-width="2.400" stroke-linecap="round" fill="none"/>' +
    '<g class="a-tas"><path d="M80 37v16" stroke="#f5a623" stroke-width="2.400" stroke-linecap="round"/>' +
    '<circle cx="80" cy="53" r="3" fill="' + U('gold') + '"/>' +
    '<path d="M76 55h8l2.500 13h-13z" fill="' + U('gold') + '"/><path d="M78 58v9M80 58v10M82 58v9" stroke="#d58210" stroke-opacity=".5" stroke-width=".8"/></g>' +
    '<circle cx="50" cy="32" r="3.200" fill="' + U('gold') + '"/></g>';

  I.work = SH() +
    '<g class="w-body"><g class="w-han"><path d="M36 32v-8q0-8 8-8h12q8 0 8 8v8" fill="none" stroke="#6a3516" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M36 32v-8q0-8 8-8h12q8 0 8 8v8" fill="none" stroke="' + U('brown') + '" stroke-width="3.200" stroke-linecap="round"/></g>' +
    '<rect x="10" y="28" width="80" height="58" rx="12" fill="' + U('brown') + '"/>' +
    '<path d="M10 52q40 11 80 0v-8H10z" fill="#fff" fill-opacity=".1"/>' +
    '<path d="M12 52q38 10 76 0" fill="none" stroke="#5a2c10" stroke-opacity=".35" stroke-width="2"/>' +
    '<path d="M18 35q32-4 64 0" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="3" stroke-linecap="round"/>' +
    '<g clip-path="url(#lvc-case)"><rect class="w-shine" x="-24" y="26" width="13" height="62" fill="#fff" fill-opacity=".34" transform="skewX(-18)"/></g>' +
    '<rect class="w-clasp" x="42" y="47" width="16" height="15" rx="4.500" fill="' + U('gold') + '"/><rect x="47.500" y="51.500" width="5" height="6" rx="1.500" fill="#b9700b" fill-opacity=".55"/>' +
    '<g class="w-tag"><path d="M71.500 52h5v9h-5z" fill="' + U('blueD') + '"/>' +
    '<rect x="63" y="59" width="22" height="27" rx="4.500" fill="' + U('white') + '"/>' +
    '<circle cx="74" cy="68.500" r="3.800" fill="' + U('blue') + '"/><path d="M66.500 81q0-8 7.500-8t7.500 8z" fill="' + U('blue') + '"/></g></g>';

  I.org = SH(40) +
    '<ellipse cx="50" cy="80" rx="42" ry="12" fill="' + U('grey') + '"/><ellipse cx="50" cy="77" rx="36" ry="8" fill="#e9edfb"/>' +
    '<g class="o-l"><circle cx="24" cy="42" r="9.500" fill="' + U('gold') + '"/><path d="M10 76q0-22 14-22t14 22z" fill="' + U('goldD') + '"/></g>' +
    '<g class="o-r"><circle cx="76" cy="42" r="9.500" fill="' + U('green') + '"/><path d="M62 76q0-22 14-22t14 22z" fill="' + U('greenD') + '"/></g>' +
    '<g class="o-c"><g class="o-ch"><circle cx="50" cy="28" r="13" fill="' + U('blue') + '"/><ellipse cx="45.500" cy="23" rx="4.200" ry="2.600" fill="#fff" fill-opacity=".35"/></g>' +
    '<path d="M24 80q0-30 26-30t26 30z" fill="' + U('blueD') + '"/><path d="M43 51l7 9 7-9z" fill="#fff"/>' +
    '<path d="M48 59h4l1.500 13L50 76l-3.500-4z" fill="#fff"/></g>' +
    '<path d="M8 76q2 16 42 16t42-16q-8 8-42 8T8 76z" fill="' + U('white') + '"/>';

  I.project = SH() +
    '<rect x="12" y="14" width="64" height="74" rx="11" fill="' + U('blue') + '"/>' +
    '<rect x="18" y="24" width="52" height="58" rx="6" fill="' + U('white') + '"/>' +
    '<rect x="29" y="7" width="30" height="15" rx="5.500" fill="' + U('gold') + '"/><circle cx="44" cy="14" r="2.600" fill="#fff"/>' +
    '<g class="pr-c1">' + CHECK(30, 38, 6) + '</g><g class="pr-c2">' + CHECK(30, 53, 6) + '</g><g class="pr-c3">' + CHECK(30, 68, 6) + '</g>' +
    '<rect class="pr-l1" x="41" y="36" width="24" height="4.200" rx="2.100" fill="#a9b8f0"/>' +
    '<rect class="pr-l2" x="41" y="51" width="18" height="4.200" rx="2.100" fill="#a9b8f0"/>' +
    '<rect class="pr-l3" x="41" y="66" width="22" height="4.200" rx="2.100" fill="#a9b8f0"/>' +
    '<g class="pr-gear"><path d="' + gear(74, 72, 19, 14.500, 8) + '" fill="' + U('orange') + '" stroke="#f89a3a" stroke-width="2.600" stroke-linejoin="round"/>' +
    '<circle cx="74" cy="72" r="8.500" fill="#fff3da"/><circle cx="74" cy="72" r="4.500" fill="' + U('gold') + '"/></g>';

  I.task = SH() +
    '<rect x="8" y="14" width="64" height="74" rx="11" fill="' + U('purple') + '"/>' +
    '<rect x="14" y="24" width="52" height="58" rx="6" fill="' + U('white') + '"/>' +
    '<rect x="25" y="7" width="30" height="15" rx="5.500" fill="' + U('purpleD') + '"/><circle cx="40" cy="14" r="2.600" fill="#fff"/>' +
    '<g class="t-c1">' + CHECK(26, 38, 6) + '</g><g class="t-c2">' + CHECK(26, 53, 6) + '</g><g class="t-c3">' + CHECK(26, 68, 6) + '</g>' +
    '<rect class="t-l1" x="37" y="36" width="25" height="4.200" rx="2.100" fill="#a9b8f0"/>' +
    '<rect class="t-l2" x="37" y="51" width="19" height="4.200" rx="2.100" fill="#a9b8f0"/>' +
    '<rect class="t-l3" x="37" y="66" width="23" height="4.200" rx="2.100" fill="#a9b8f0"/>' +
    '<g class="t-pen"><g transform="translate(79 48) rotate(36)">' +
    '<rect x="-6.500" y="-36" width="13" height="10" rx="3.500" fill="' + U('pink') + '"/>' +
    '<rect x="-6.500" y="-27" width="13" height="4.500" fill="' + U('grey') + '"/>' +
    '<rect x="-6.500" y="-23" width="13" height="38" fill="' + U('yellow') + '"/><rect x="-1.500" y="-23" width="3" height="38" fill="#fff" fill-opacity=".35"/>' +
    '<path d="M-6.500 15L0 29l6.500-14z" fill="#ffe4b8"/><path d="M-2.200 24.500L0 29l2.200-4.500z" fill="#3b4256"/></g></g>';

  I.cal = SH() +
    '<g class="c-ring"><rect x="24" y="5" width="8" height="18" rx="4" fill="' + U('purpleD') + '"/></g>' +
    '<g class="c-ring c-r2"><rect x="64" y="5" width="8" height="18" rx="4" fill="' + U('purpleD') + '"/></g>' +
    '<rect x="8" y="14" width="80" height="72" rx="11" fill="' + U('white') + '"/>' +
    '<path d="M8 25q0-11 11-11h58q11 0 11 11v10H8z" fill="' + U('red') + '"/>' +
    '<path d="M16 19q30-3 64 0" stroke="#fff" stroke-opacity=".4" stroke-width="2.200" stroke-linecap="round" fill="none"/>' +
    [0, 1, 2].map(function (r) {
      return [0, 1, 2, 3, 4].map(function (c) {
        if (r === 1 && c === 2) return '';
        return '<rect x="' + (15 + c * 12.500) + '" y="' + (42 + r * 11) + '" width="9.500" height="8" rx="2.300" fill="#e2e7f8"/>';
      }).join('');
    }).join('') +
    '<rect class="c-today" x="40" y="53" width="9.500" height="8" rx="2.300" fill="' + U('red') + '"/>' +
    '<circle cx="70" cy="68" r="21" fill="' + U('blue') + '"/><circle cx="70" cy="68" r="16" fill="' + U('cream') + '"/>' +
    tick12(70, 68, 15.500) +
    '<line class="c-hh" x1="70" y1="68" x2="70" y2="60" stroke="#27315e" stroke-width="3" stroke-linecap="round"/>' +
    '<line class="c-hm" x1="70" y1="68" x2="70" y2="56" stroke="#27315e" stroke-width="2.200" stroke-linecap="round"/>' +
    '<circle cx="70" cy="68" r="2.600" fill="' + U('gold') + '"/>';

  I.fin = SH() +
    '<g class="f-bag"><path d="M38 33C13 46 6 70 12 81q6 10 26 10t26-10C70 70 63 46 38 33z" fill="' + U('green') + '"/>' +
    '<path d="M20 18q9-8 18-1 9-7 18 1l-4 15q-14 6-28 0z" fill="' + U('greenD') + '"/>' +
    '<path d="M25 31q13 8 26 0" fill="none" stroke="' + U('gold') + '" stroke-width="4.500" stroke-linecap="round"/>' +
    '<g class="f-tail"><circle cx="38" cy="36" r="4.500" fill="' + U('gold') + '"/><path d="M36 39l-4 10M40 39l4 10" stroke="#f0a020" stroke-width="3" stroke-linecap="round"/></g>' +
    '<path d="M22 58q-6 12-3 22" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4" stroke-linecap="round"/>' +
    '<text class="f-dollar" x="38" y="78" font-size="29" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial,Helvetica,sans-serif">$</text></g>' +
    '<g class="f-c1">' + coin(81) + '</g><g class="f-c2">' + coin(74) + '</g><g class="f-c3">' + coin(67) + '</g><g class="f-c4">' + coin(60) + '</g>' +
    '<g class="f-flip"><circle cx="79" cy="44" r="10.500" fill="' + U('goldD') + '"/><circle cx="79" cy="44" r="8.600" fill="' + U('gold') + '"/>' +
    '<text x="79" y="49" font-size="13" font-weight="800" text-anchor="middle" fill="#c97a0c" font-family="Arial,sans-serif">$</text></g>' +
    '<g class="f-sp f-s1">' + STAR(14, 22, 6) + '</g><g class="f-sp f-s2">' + STAR(92, 22, 5) + '</g>';

  I.goal = SH() +
    '<g class="g-t"><circle cx="46" cy="56" r="38" fill="' + U('red') + '"/><circle cx="46" cy="56" r="29" fill="#fff6ee"/>' +
    '<circle cx="46" cy="56" r="21" fill="' + U('red') + '"/><circle cx="46" cy="56" r="13" fill="#fff6ee"/><circle cx="46" cy="56" r="6.200" fill="' + U('red') + '"/>' +
    '<path d="M16 40q6-14 22-19" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3.200" stroke-linecap="round"/></g>' +
    '<circle class="g-rip" cx="46" cy="56" r="38" fill="none" stroke="#ff5a6a" stroke-width="3"/>' +
    '<g class="g-ar"><g transform="translate(46 56) rotate(-45)">' +
    '<rect x="2" y="-2.200" width="52" height="4.400" rx="2.200" fill="' + U('blueD') + '"/>' +
    '<path d="M44-2L55-10h8l-6 10 6 10h-8L44 2z" fill="' + U('blue') + '"/><path d="M50-1L58-8h5l-4 8z" fill="#fff" fill-opacity=".4"/></g></g>';

  I.doc = SH() +
    '<path d="M8 32q0-8 8-8h20l6 8h42q8 0 8 8v40q0 8-8 8H16q-8 0-8-8z" fill="' + U('goldD') + '"/>' +
    '<g class="d-pap"><g class="d-p2"><rect x="24" y="12" width="46" height="52" rx="5" fill="' + U('grey') + '" transform="rotate(-7 47 38)"/></g>' +
    '<rect x="28" y="14" width="46" height="52" rx="5" fill="' + U('white') + '"/>' +
    '<path d="M35 25h32M35 33h32M35 41h22" stroke="#a9b8f0" stroke-width="3.600" stroke-linecap="round"/></g>' +
    '<path d="M8 50q0-8 8-8h68q8 0 8 8v30q0 8-8 8H16q-8 0-8-8z" fill="' + U('gold') + '"/>' +
    '<path d="M14 47h72" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>' +
    '<g class="d-cloud"><circle cx="64" cy="67" r="19" fill="' + U('blueD') + '"/>' +
    '<path d="M53.500 72a6.500 6.500 0 0 1 1.500-12.600 9 9 0 0 1 17 2.200 5.700 5.700 0 0 1-.8 10.400z" fill="#fff"/>' +
    '<g class="d-arr"><path d="M64 73V60M58.500 65.500L64 60l5.500 5.500" fill="none" stroke="#3a63d8" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"/></g></g>';

  I.chart = SH() +
    '<rect x="6" y="82" width="88" height="10" rx="5" fill="' + U('lilac') + '"/>' +
    '<rect class="h-b1" x="13" y="64" width="15" height="19" rx="2.500" fill="' + U('blue') + '"/>' +
    '<rect class="h-b2" x="32" y="52" width="15" height="31" rx="2.500" fill="' + U('green') + '"/>' +
    '<rect class="h-b3" x="51" y="38" width="15" height="45" rx="2.500" fill="' + U('orange') + '"/>' +
    '<rect class="h-b4" x="70" y="24" width="15" height="59" rx="2.500" fill="' + U('gold') + '"/>' +
    '<path class="h-ln" pathLength="100" d="M10 48Q50 44 76 15" fill="none" stroke="' + U('purpleD') + '" stroke-width="4.400" stroke-linecap="round"/>' +
    '<path class="h-hd" d="M81 8.500L79.500 22.500 67.500 12z" fill="#7a5ae0" stroke="#7a5ae0" stroke-width="2" stroke-linejoin="round"/>';

  I.set = SH() +
    '<g class="s-g1"><path d="' + gear(50, 48, 41, 32, 8) + '" fill="' + U('purple') + '" stroke="#a48df5" stroke-width="3.400" stroke-linejoin="round"/>' +
    '<circle cx="50" cy="48" r="22" fill="#9b82f0"/><circle cx="50" cy="48" r="17" fill="' + U('cream') + '"/>' +
    '<circle cx="50" cy="48" r="9" fill="' + U('gold') + '"/>' +
    '<path d="M24 28q8-12 22-15" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3.400" stroke-linecap="round"/></g>' +
    '<g class="s-g2"><path d="' + gear(80, 80, 16, 12, 7) + '" fill="' + U('orange') + '" stroke="#f89a3a" stroke-width="2.600" stroke-linejoin="round"/>' +
    '<circle cx="80" cy="80" r="6.500" fill="#fff3da"/><circle cx="80" cy="80" r="3" fill="' + U('gold') + '"/></g>';

  I.bell = SH() +
    '<g class="b-sp"><path d="M12 22L5 15M19 13L15 5M90 22l7-7M83 12l4-8" stroke="#ffc42e" stroke-width="3.400" stroke-linecap="round"/></g>' +
    '<g class="b-bell"><circle cx="50" cy="12" r="5.500" fill="' + U('gold') + '"/>' +
    '<path d="M50 14C29 14 25 35 25 52c0 12-9 15-13 24h76c-4-9-13-12-13-24 0-17-4-38-25-38z" fill="' + U('gold') + '"/>' +
    '<ellipse cx="50" cy="77" rx="41" ry="10" fill="' + U('goldD') + '"/>' +
    '<path d="M35 28q-5 12-3 28" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4.500" stroke-linecap="round"/>' +
    '<g class="b-clap"><circle cx="50" cy="88" r="8.500" fill="' + U('gold') + '"/><ellipse cx="47" cy="85.500" rx="3" ry="2" fill="#fff" fill-opacity=".5"/></g></g>' +
    '<g class="b-badge"><circle cx="76" cy="26" r="13" fill="' + U('red') + '"/>' +
    '<text x="76" y="31.500" font-size="16" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">1</text></g>';

  I.clock = SH() +
    '<g class="k-top"><circle cx="26" cy="22" r="14.500" fill="' + U('gold') + '"/><circle cx="74" cy="22" r="14.500" fill="' + U('gold') + '"/>' +
    '<ellipse cx="22" cy="17" rx="5" ry="3" fill="#fff" fill-opacity=".45" transform="rotate(-30 22 17)"/><ellipse cx="70" cy="17" rx="5" ry="3" fill="#fff" fill-opacity=".45" transform="rotate(-30 70 17)"/>' +
    '<rect class="k-ham" x="45" y="5" width="10" height="9" rx="3" fill="' + U('blueD') + '"/></g>' +
    '<ellipse cx="28" cy="90" rx="6" ry="4" fill="' + U('goldD') + '"/><ellipse cx="72" cy="90" rx="6" ry="4" fill="' + U('goldD') + '"/>' +
    '<circle cx="50" cy="56" r="37" fill="' + U('blue') + '"/><circle cx="50" cy="56" r="29.500" fill="' + U('cream') + '"/>' +
    '<path d="M24 40q8-14 24-17" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>' +
    tick12(50, 56, 28) +
    '<line class="k-hh" x1="50" y1="56" x2="50" y2="43" stroke="#27315e" stroke-width="4" stroke-linecap="round"/>' +
    '<line class="k-hm" x1="50" y1="56" x2="50" y2="34" stroke="#27315e" stroke-width="3" stroke-linecap="round"/>' +
    '<line class="k-hs" x1="50" y1="62" x2="50" y2="31" stroke="#e0344a" stroke-width="1.600" stroke-linecap="round"/>' +
    '<circle cx="50" cy="56" r="3.800" fill="' + U('gold') + '"/>' +
    '<g class="k-sp"><path d="M90 20l7-6M94 32l8-1" stroke="#ffc42e" stroke-width="3.200" stroke-linecap="round"/></g>';

  I.book = SH() +
    '<rect x="16" y="12" width="66" height="76" rx="9" fill="' + U('greenD') + '"/>' +
    '<rect class="bk-pg" x="76" y="18" width="10" height="64" rx="3" fill="' + U('cream') + '"/>' +
    '<rect x="12" y="10" width="66" height="76" rx="9" fill="' + U('green') + '"/>' +
    '<path d="M12 19q0-9 9-9h6v76h-6q-9 0-9-9z" fill="#13683f" fill-opacity=".28"/>' +
    '<path d="M17 18q18-4 50 0" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="38" y="32" width="30" height="18" rx="4" fill="' + U('cream') + '"/>' +
    '<g clip-path="url(#lvc-label)"><rect class="bk-sh" x="22" y="30" width="8" height="24" fill="#fff" fill-opacity=".8" transform="skewX(-20)"/></g>' +
    '<path class="bk-rib" d="M52 86h12v14l-6-4.500-6 4.500z" fill="' + U('red') + '"/>' +
    '<g class="bk-sp"><path d="M88 18l7-6M92 30l8-1" stroke="#ffc42e" stroke-width="3.200" stroke-linecap="round"/></g>';

  if (window.IC3D) Object.keys(window.IC3D).forEach(function (k) { I[k] = window.IC3D[k]; });   /* ikon 3D baru (icons-3d.js) menggantikan SVG lama */

  /* ---------- pemasangan ---------- */
  var KEY = {
    'i-academic': 'academic', 'i-work': 'work', 'i-org': 'org', 'i-project': 'project', 'i-task': 'task', 'i-cal': 'cal', 'i-fin': 'fin',
    'i-goal': 'goal', 'i-doc': 'doc', 'i-chart': 'chart', 'i-set': 'set', 'i-bell': 'bell', 'i-clock': 'clock', 'i-book': 'book'
  };
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    if (document.documentElement.classList.contains('win-open')) return;   /* v5.8: abaikan saat menu terbuka agar ikon tidak mulai ulang saat menu ditutup */
    es.forEach(function (e) { e.target.classList.toggle('lv-on', e.isIntersecting && !reduce); });
  }, { rootMargin: '60px' }) : null;

  function mount(u) {
    var id = (u.getAttribute('href') || u.getAttribute('xlink:href') || '').replace('#', '');
    var k = KEY[id]; if (!k || u._lv) return; u._lv = 1;
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('width', '100%'); s.setAttribute('height', '100%');
    s.setAttribute('class', 'lv lv-' + k); s.setAttribute('overflow', 'visible'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'none'); s.setAttribute('focusable', 'false');
    s.innerHTML = I[k];
    u.parentNode.replaceChild(s, u);
    if (io) io.observe(s); else if (!reduce) s.classList.add('lv-on');
  }
  var queued = 0;
  function scan(root) {
    var list = (root || document).querySelectorAll('svg use');
    for (var i = 0; i < list.length; i++) mount(list[i]);
  }
  function later() { if (queued) return; queued = 1; requestAnimationFrame(function () { queued = 0; scan(); }); }
  scan();
  if ('MutationObserver' in window) new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  window.LiveIcons = { scan: scan, keys: Object.keys(I), svg: function (k) { return '<svg class="lv lv-' + k + ' lv-on" viewBox="0 0 100 100" fill="none" stroke="none" aria-hidden="true">' + I[k] + '</svg>'; } };
})();
;
/* v5.8: gerak ikon menu 3D (muncul / klik / keluar menu) DIHAPUS. Ikon menu diam; hanya ikon hidup (melayang halus) yang tetap. */
;
/* perf.js — penjaga kelancaran: deteksi FPS otomatis, class .touch, dan pemuatan bank soal saat idle. */
(function () {
  'use strict';
  var root = document.documentElement;
  var MO = window.MyOffice = window.MyOffice || {};
  var saved = null; try { saved = localStorage.getItem('mo-lite'); } catch (e) { }

  /* layar sentuh → class .touch (dipakai v6.css) */
  try { if (matchMedia('(pointer:coarse)').matches) root.classList.add('touch'); } catch (e) { }

  /* ---- Probe FPS: ukur ±2 dtk; jika rata-rata frame lambat, otomatis aktifkan mode hemat ---- */
  var probing = false;
  function probe(ms) {
    if (probing || saved !== null || root.dataset.lite === '1' || document.hidden) return;
    probing = true;
    var n = 0, sum = 0, last = 0, t0 = 0;
    (function f(now) {
      if (document.hidden) { probing = false; return; }
      if (!t0) t0 = now;
      if (last) { var d = now - last; if (d < 250) { sum += d; n++; } }   // abaikan lonjakan jeda tab
      last = now;
      if (now - t0 < ms) return requestAnimationFrame(f);
      probing = false;
      if (n > 20 && sum / n > 26 && MO.cosmos && MO.cosmos.setLite) MO.cosmos.setLite(true, false);  // < ±38 fps
    })(0);
  }
  window.addEventListener('load', function () { setTimeout(function () { probe(2200); }, 1200); });
  new MutationObserver(function () {                      // jendela modul baru dibuka → ukur lagi
    if (root.classList.contains('win-open')) setTimeout(function () { probe(1800); }, 700);
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  /* ---- Bank soal (±190 KB) dimuat saat browser menganggur, bukan menghambat tampilan awal ---- */
  var banksLoaded = false;
  MO.loadBanks = function () {
    if (banksLoaded) return; banksLoaded = true;
    var s = document.createElement('script'); s.src = 'banks.js'; s.async = false; document.head.appendChild(s);
  };
  window.addEventListener('load', function () {
    (window.requestIdleCallback || function (f) { return setTimeout(f, 900); })(MO.loadBanks, { timeout: 2500 });
  });
})();
;
/* MyOffice — SOFT UI: beranda baru (sapaan, strip tanggal, agenda) + pewarnaan tiap menu.
   Hanya membaca data dari localStorage; tidak mengubah data atau logika menu. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.dataset.theme = 'pagi'; root.dataset.wall = 'soft';
  var tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', '#eef1f7');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  var key = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var addDays = function (d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
  var sameDay = function (a, b) { return key(a) === key(b); };

  /* ---------- Warna per menu untuk semua jenis jendela ---------- */
  var BY_CLASS = { 'ad-ov': 'academic', 'ex-ov': 'academic', 'wo-ov': 'work', 'es-ov': 'org', 'fn-ov': 'fin', 'sp-ov': 'set' };
  function tag(el) {
    if (!el || el.nodeType !== 1) return;
    var cl = el.classList, k = null;
    if (cl.contains('ac-ov')) k = el.dataset.mod || null;
    else for (var c in BY_CLASS) if (cl.contains(c)) { k = BY_CLASS[c]; break; }
    if (!k && (cl.contains('ac-ov2') || /-ov2?$/.test(String(typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').split(' ')[0] || ''))) {
      var open = document.querySelector('[data-sf]:not([hidden]):not(.ac-ov2)'); k = open ? open.dataset.sf : null;
    }
    if (k && el.dataset.sf !== k) el.dataset.sf = k;
  }
  function tagAll() { Array.prototype.forEach.call(document.querySelectorAll('.ac-ov,.ad-ov,.wo-ov,.es-ov,.fn-ov,.ex-ov,.sp-ov,.es-ov2,.wo-ov2'), tag); }
  tagAll();
  var OVSEL = '.ac-ov,.ad-ov,.wo-ov,.es-ov,.fn-ov,.ex-ov,.sp-ov,.es-ov2,.wo-ov2';
  new MutationObserver(function (ms) {
    var need = false;      /* pindai ulang semua jendela hanya bila jendela itu sendiri berubah (bukan tiap mutasi kecil) */
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.type === 'childList') {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j]; if (n.nodeType !== 1) continue;
          tag(n); if (n.matches(OVSEL) || n.querySelector(OVSEL)) need = true;
        }
      } else { tag(m.target); if (m.target.matches && m.target.matches(OVSEL)) need = true; }
    }
    if (need) tagAll();
  }).observe(document.body, { childList: true, attributes: true, attributeFilter: ['data-mod', 'hidden'], subtree: true });

  /* ---------- Beranda ---------- */
  var hero = $('.hero'); if (!hero) return;
  var info = $('.info'), navWrap = $('.nav-wrap'), quote = $('.quote');
  var grid = document.createElement('div'); grid.className = 'sf-grid';
  var phone = document.createElement('section'); phone.className = 'sf-phone'; phone.setAttribute('aria-label', 'Agenda harian');
  var side = document.createElement('div'); side.className = 'sf-side';
  phone.innerHTML =
    '<div class="sf-hello"><div><small>Hello,</small><h1 id="sfName"></h1></div><div class="sf-ava" id="sfAva" role="button" tabindex="0" aria-label="Pengaturan akun"></div></div>' +
    '<p class="sf-quote"></p>' +
    '<div class="sf-days" id="sfDays" role="tablist" aria-label="Pilih tanggal"></div>' +
    '<div class="sf-bar"><button type="button" class="sf-today" id="sfToday">Hari ini</button>' +
    '<div class="sf-arrows"><button type="button" id="sfPrev" aria-label="Minggu sebelumnya"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>' +
    '<button type="button" id="sfNext" aria-label="Minggu berikutnya"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button></div></div>' +
    '<div class="sf-list" id="sfList"></div>';
  $('.sf-quote', phone).textContent = quote ? quote.textContent.replace(/\s+/g, ' ').trim() : '';
  if (info) side.appendChild(info);
  if (navWrap) side.appendChild(navWrap);
  grid.appendChild(phone); grid.appendChild(side); hero.appendChild(grid);

  var fab = document.createElement('button'); fab.type = 'button'; fab.className = 'sf-fab'; fab.setAttribute('aria-label', 'Tambah tugas');
  fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  document.body.appendChild(fab);
  var go = function (h) { var a = document.querySelector('.nav a[href="' + h + '"]'); if (a) a.click(); else location.hash = h; };
  fab.addEventListener('click', function () { go('#task'); });

  /* nama & foto */
  function nick() {
    var s = ls('mo-settings-v1'); return (s.nick || '').trim() || 'Sobat';
  }
  function paintName() {
    var s = ls('mo-settings-v1'), n = nick(), ava = $('#sfAva');
    $('#sfName').textContent = n;
    if (s.photo) { ava.style.backgroundImage = 'url("' + s.photo + '")'; ava.textContent = ''; }
    else { ava.style.backgroundImage = ''; ava.textContent = n.charAt(0).toUpperCase(); }
  }
  paintName();
  var hi = document.getElementById('hiName');
  if (hi) new MutationObserver(paintName).observe(hi, { childList: true, characterData: true, subtree: true });
  $('#sfAva').addEventListener('click', function () { go('#settings'); });
  $('#sfAva').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('#settings'); } });

  /* ---------- Data agenda ---------- */
  var AREA_ICON = { Akademik: '📚', Pekerjaan: '💼', Organisasi: '🤝', Pribadi: '🌿' };
  var TINTS = [['#dff3ff', '#ffffff'], ['#ffe9d6', '#ffffff'], ['#ffe0e4', '#ffffff'], ['#dff7ec', '#ffffff'], ['#ece4ff', '#ffffff']];
  function iconFor(title, area, kind) {
    var s = (title || '').toLowerCase();
    if (kind === 'ujian' || /ujian|uts|uas|kuis|quiz|sidang/.test(s)) return '✍️';
    if (kind === 'presentasi' || /presentasi|seminar|pitch/.test(s)) return '🎤';
    if (/rapat|meeting|diskusi/.test(s)) return '💬';
    if (/kuliah|kelas|belajar|baca|study/.test(s)) return '📖';
    if (/olahraga|lari|gym/.test(s)) return '🏃';
    if (/bayar|keuangan|uang/.test(s)) return '💳';
    return AREA_ICON[area] || '💡';
  }
  function minutes(t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : 9999; }
  function addMin(t, n) { var v = minutes(t) + n; if (v >= 9999) return ''; v = v % 1440; return pad(Math.floor(v / 60)) + ':' + pad(v % 60); }

  function itemsFor(d) {
    var ds = key(d), td = key(new Date()), out = [];
    var T = ls('mo-task-v1'), C = ls('mo-cal-v1');
    (T.task || []).forEach(function (t) {
      if (!t || t.status === 'Archived') return;
      var done = t.status === 'Done', due = (t.due || '').slice(0, 10);
      var late = !done && due && due < td && ds === td;
      if (!(due === ds || late || (done && (t.doneAt || '').slice(0, 10) === ds && !due))) return;
      var time = t.dueTime ? (t.estMin ? t.dueTime + ' – ' + addMin(t.dueTime, +t.estMin) : t.dueTime) : 'Sepanjang hari';
      var tags = [t.area || 'Tugas']; if (late) tags.push('Terlambat'); else if (t.priority && t.priority !== 'Medium') tags.push(t.priority); else if (t.category) tags.push(t.category);
      out.push({ title: t.title || 'Tugas', time: time, tags: tags, done: done, icon: iconFor(t.title, t.area), go: '#task', sort: t.dueTime ? minutes(t.dueTime) : 5000 });
    });
    (C.ev || []).forEach(function (e) {
      if (!e || !e.start) return;
      var s = e.start.slice(0, 10), en = (e.end || e.start).slice(0, 10);
      if (!(s <= ds && ds <= en)) return;
      var cat = (C.cat || []).filter(function (c) { return c.id === e.catId; })[0];
      var time = e.allDay === true || e.allDay === 'true' || !e.startTime ? 'Sepanjang hari' : (e.endTime ? e.startTime + ' – ' + e.endTime : e.startTime);
      var tags = [cat ? cat.name : 'Acara']; if (e.kind && e.kind !== 'biasa') tags.push(e.kind.charAt(0).toUpperCase() + e.kind.slice(1)); else if (e.location) tags.push(e.location);
      out.push({ title: e.title || 'Acara', time: time, tags: tags, done: false, icon: iconFor(e.title, '', e.kind), go: '#calendar', sort: e.startTime ? minutes(e.startTime) : 4000 });
    });
    out.sort(function (a, b) { return a.sort - b.sort; });
    return out;
  }

  /* ---------- Strip tanggal ---------- */
  var today = new Date(), sel = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var start = addDays(sel, -1), lastSig = '';
  function renderDays() {
    var h = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(start, i), has = itemsFor(d).length > 0;
      h += '<button type="button" role="tab" class="sf-day' + (sameDay(d, sel) ? ' on' : '') + (has ? ' has' : '') + (sameDay(d, new Date()) ? ' now' : '') +
        '" data-d="' + key(d) + '" aria-selected="' + sameDay(d, sel) + '"><b>' + d.getDate() + '</b><span>' + DAY[d.getDay()] + '</span><i></i></button>';
    }
    $('#sfDays').innerHTML = h;
    var isToday = sameDay(sel, new Date());
    $('#sfToday').textContent = isToday ? 'Hari ini' : DAY[sel.getDay()] + ', ' + sel.getDate() + ' ' + MON[sel.getMonth()];
  }
  function renderList() {
    var list = itemsFor(sel), box = $('#sfList'), h = '';
    if (!list.length) {
      var isToday = sameDay(sel, new Date());
      h = '<div class="sf-empty"><span class="sf-ic" style="--c1:#dff3ff">🌤️</span><div><b>' + (isToday ? 'Hari ini masih lapang' : 'Belum ada agenda') + '</b>Tekan tombol + lalu ketik perintah, mis. “buat tugas laporan besok jam 17.00”, atau buka menu Calendar untuk membuat acara.</div></div>';
    } else list.slice(0, 8).forEach(function (it, i) {
      var t = TINTS[i % TINTS.length];
      h += '<button type="button" class="sf-card" data-go="' + it.go + '"><span class="sf-ic" style="--c1:' + t[0] + ';--c2:' + t[1] + '">' + it.icon + '</span>' +
        '<span class="sf-tx"><b>' + esc(it.title) + '</b><small>' + esc(it.time) + '</small><span class="sf-tags">' +
        it.tags.slice(0, 2).map(function (x, k) { return '<span class="sf-tag t' + ((i + k) % 5) + '">' + esc(x) + '</span>'; }).join('') + '</span></span>' +
        (it.done ? '<span class="sf-chk"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>' : '') + '</button>';
    });
    box.innerHTML = h;
  }
  function render(force) {
    var sig = key(sel) + '|' + key(start) + '|' + (localStorage.getItem('mo-task-v1') || '').length + '|' + (localStorage.getItem('mo-cal-v1') || '').length;
    if (!force && sig === lastSig) return; lastSig = sig; renderDays(); renderList();
  }
  $('#sfDays').addEventListener('click', function (e) {
    var b = e.target.closest('.sf-day'); if (!b) return; var p = b.dataset.d.split('-');
    sel = new Date(+p[0], +p[1] - 1, +p[2]); render(true);
  });
  $('#sfList').addEventListener('click', function (e) { var b = e.target.closest('.sf-card'); if (b) go(b.dataset.go); });
  $('#sfToday').addEventListener('click', function () { sel = new Date(); sel = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate()); start = addDays(sel, -1); render(true); });
  $('#sfPrev').addEventListener('click', function () { start = addDays(start, -7); sel = addDays(sel, -7); render(true); });
  $('#sfNext').addEventListener('click', function () { start = addDays(start, 7); sel = addDays(sel, 7); render(true); });
  window.addEventListener('storage', function () { render(); });
  setInterval(function () { if (!document.hidden && !document.documentElement.classList.contains('win-open')) render(); }, 2500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  /* modul ditutup → perbarui strip sekali (selama modul terbuka strip tidak dihitung ulang) */
  (function () { var was = document.documentElement.classList.contains('win-open'); new MutationObserver(function () { var now = document.documentElement.classList.contains('win-open'); if (was && !now) render(); was = now; }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); })();
  render(true);
})();
;
/* REVISI 4 — efek angka menghitung naik (count up) untuk seluruh modul.
   Angka statistik dihitung dari 0 (atau dari nilai sebelumnya) ke nilai akhir, tiap kali muncul / berubah. */
(function () {
  'use strict';
  if (window.MOCountUp) return;
  window.MOCountUp = true;

  var SEL = [
    '.tchip b',                                   /* Beranda: Tugas aktif, Agenda, Goal */
    '.ac-stat b', '.dv-stats b',                  /* Academic, Project */
    '.tk3-tile b',                                /* Task */
    '.fn-sum b', '.an-k b',                       /* Finance, Analisis keuangan */
    '.wo-stat b',                                 /* Work */
    '.es-stats b',                                /* Organization */
    '.gq-pop b', '.gq-lvl b',                     /* Goal */
    '.fn-ban p b', '.cu', '.fn-cats small', '.fn-bud em', '.fn-rc strong',   /* Finance: banner, kategori, persen label, resi */
    '.bn-big'                                     /* Analytics */
  ].join(',');

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = 1300;
  /* teks harus berbentuk: [tanda][Rp ]angka[%|XP|jam|…][ / angka] — selain itu (tanggal, jam, dll) dilewati */
  var RE = /^([−\-+]?[\s ]?(?:Rp\.?[\s ]?)?)(\d[\d.,]*)((?:[\s ]?(?:%|XP|jam|menit|hari|x))?(?:[\s ]?\/[\s ]?\d[\d.,]*)?)$/;
  var recent = {};                                /* kunci -> {t, val, at}: cegah animasi ulang saat render ulang cepat */

  function parse(txt) {
    var m = RE.exec(txt); if (!m) return null;
    var raw = m[2], v, fmt;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {            /* 1.234.567 (format Indonesia) */
      var dc = (raw.split(',')[1] || '').length;
      v = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
      fmt = function (x) { return x.toLocaleString('id-ID', { minimumFractionDigits: dc, maximumFractionDigits: dc }); };
    } else if (/^\d+,\d+$/.test(raw)) {                      /* 3,5 */
      var dd = raw.split(',')[1].length; v = parseFloat(raw.replace(',', '.'));
      fmt = function (x) { return x.toFixed(dd).replace('.', ','); };
    } else if (/^\d+\.\d+$/.test(raw)) {                     /* 12.5 */
      var de = raw.split('.')[1].length; v = parseFloat(raw);
      fmt = function (x) { return x.toFixed(de); };
    } else if (/^\d+$/.test(raw)) {                          /* 12 */
      v = parseInt(raw, 10); fmt = function (x) { return String(Math.round(x)); };
    } else return null;
    if (!isFinite(v)) return null;
    return { pre: m[1], suf: m[3], v: v, f: function (x) { return m[1] + fmt(x) + m[3]; } };
  }

  var keyCache = new Map(), keyCacheQ = 0;
  function keyOf(el) {
    var root = el.closest('.fn-app,.ac-ov,#today,.app') || document.body, i = 0, n = el;
    var lab = (el.parentElement && (el.parentElement.textContent || '').replace(el.textContent, '').trim().slice(0, 40)) || '';
    /* v6.2: daftar elemen per-root disimpan selama satu putaran sinkron (sebelumnya querySelectorAll + gulir linear
       dijalankan ulang untuk SETIAP angka → kerja kuadratis saat daftar panjang). Indeks tetap sama persis. */
    var all = keyCache.get(root);
    if (!all) { all = Array.prototype.slice.call(root.querySelectorAll(SEL)); keyCache.set(root, all); if (!keyCacheQ) { keyCacheQ = 1; Promise.resolve().then(function () { keyCache = new Map(); keyCacheQ = 0; }); } }
    i = all.indexOf(el); if (i < 0) i = all.length;
    return (root.id || root.className || 'x').toString().slice(0, 30) + '|' + lab + '|' + i;
  }

  function run(el, p, from) {
    var t0 = null, to = p.v;
    el.__cuRun = true;
    el.textContent = p.f(from);
    (function step(ts) {
      if (!el.isConnected) { el.__cuRun = false; return; }
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / DUR), e = 1 - Math.pow(1 - k, 3);
      if (k < 1) { el.textContent = p.f(from + (to - from) * e); requestAnimationFrame(step); }
      else { el.__cuRun = false; el.__cuFinal = p.f(to); el.textContent = el.__cuFinal; }
    })(performance.now());
  }

  function consider(el) {
    if (el.__cuRun || el.children.length) return;
    if (el.closest && el.closest('.wo-world')) return;   /* v4.6: detail pekerjaan langsung tampil, tanpa hitung-naik */
    var txt = el.textContent.trim();
    if (!txt || txt === el.__cuFinal) return;
    var p = parse(txt); if (!p) return;
    el.__cuFinal = txt;
    if (reduce || (window.__cuSkip || 0) > Date.now() || Math.abs(p.v) < 1 && p.v === 0) { el.__cuVal = p.v; return; }   /* v4.6: __cuSkip = lompat antar-menu, angka langsung final */
    var from = 0, key = keyOf(el), r = recent[key], now = Date.now();
    if (el.__cuVal !== undefined) from = el.__cuVal;                       /* elemen sama berganti nilai: hitung dari nilai lama */
    else if (r && now - r.at < 4000) {                                     /* render ulang cepat */
      if (r.t === txt) { el.__cuVal = p.v; return; }
      from = r.val;
    }
    el.__cuVal = p.v; recent[key] = { t: txt, val: p.v, at: now };
    if (from === p.v) return;
    run(el, p, from);
  }

  function scan(node) {
    if (!node || node.nodeType !== 1) { if (node && node.nodeType === 3) node = node.parentElement; else return; }
    if (!node) return;
    if (node.matches && node.matches(SEL)) consider(node);
    if (node.querySelectorAll) { var l = node.querySelectorAll(SEL); for (var i = 0; i < l.length; i++) consider(l[i]); }
    var up = node.closest && node.closest(SEL); if (up && up !== node) consider(up);
  }

  function start() {
    scan(document.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') scan(m.target.parentElement);
        else { if (m.target.nodeType === 1 && m.target.matches && m.target.matches(SEL)) scan(m.target); for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]); }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    /* modul yang dibuka lagi (tampil kembali): ulangi hitungan angkanya */
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('a[href^="#"], .nav a, .tchip, .avatar')) return;
      setTimeout(function () { Object.keys(recent).forEach(function (k) { delete recent[k]; }); document.querySelectorAll(SEL).forEach(function (el) { if (!el.__cuRun) { el.__cuFinal = null; el.__cuVal = undefined; } }); scan(document.body); }, 120);
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
;;
/* MyOffice — Revisi 5
   A. (DIHAPUS di v5.7) Lonceng/panel Notifikasi — digantikan Inbox. Mesin pengingat Kalender tetap berjalan.
      Sumber: Task & To-do, Kalender, Academic (tugas, ujian), Work, Organization, Project, Goal.
      Aturan:
        • Tenggat (tugas/to-do/pekerjaan/goal...) : terlambat · hari ini · besok
        • Kegiatan/acara/ujian berjam : muncul H-1 jam (atau sesuai pengingat yang lebih awal), lalu "sedang berlangsung"
        • Kegiatan seharian : muncul pada hari-H (ujian/presentasi/penting juga H-1)
      Angka di lonceng = jumlah item di panel; hilang otomatis saat selesai / lewat.
   B. Logo Beresin bergerak (ikon) + tulisan "Beresin" muncul/hilang dari kiri seperti mengetik (lihat revisi5.css). */
(function () {
  'use strict';
  var D = document;
  function ls(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDay(s, n) { var a = s.split('-'); return ymd(new Date(+a[0], a[1] - 1, +a[2] + n, 12)); }
  function dayDiff(a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+x[0], x[1] - 1, +x[2]) - Date.UTC(+y[0], y[1] - 1, +y[2])) / 864e5); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var DONE = /^(Selesai|Done|Tercapai|Completed)$/i, CANC = /^(Dibatalkan|Archived|Batal|Cancelled)$/i;
  var fin = function (s) { return DONE.test(s || '') || CANC.test(s || ''); };

  /* ---------- waktu ---------- */

  /* ================= B. Logo Beresin bergerak ================= */
  var brand = D.querySelector('.brand');
  if (brand && !brand.getAttribute('data-mv')) {
    brand.setAttribute('data-mv', '1');
    var svg = brand.querySelector('svg'), path = svg && svg.querySelector('path'), NS = 'http://www.w3.org/2000/svg';
    if (path) {
      path.id = 'bsMark'; svg.setAttribute('overflow', 'visible');
      var defs = svg.querySelector('defs') || svg.insertBefore(D.createElementNS(NS, 'defs'), svg.firstChild);
      defs.insertAdjacentHTML('beforeend',
        '<clipPath id="bsMarkClip"><use href="#bsMark"/></clipPath>' +
        '<linearGradient id="bsShineG" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>');
      path.insertAdjacentHTML('afterend',
        '<g clip-path="url(#bsMarkClip)"><g transform="skewX(-18)"><rect class="bs-shine" x="-50" y="-10" width="34" height="120" fill="url(#bsShineG)"/></g></g>' +
        '<path class="bs-spark" d="M86 6l2.6 6.4L95 15l-6.4 2.6L86 24l-2.6-6.4L77 15l6.4-2.6z" fill="#ffc42e"/>' +
        '<circle class="bs-spark s2" cx="94" cy="34" r="2.6" fill="#7fdcff"/>');
      svg.classList.add('bs-live');
    }
    // teks → huruf per huruf
    var node = null; brand.childNodes.forEach(function (n) { if (n.nodeType === 3 && /\S/.test(n.nodeValue)) node = n; });
    if (node) {
      var word = node.nodeValue.trim(), sp = D.createElement('span');
      sp.className = 'brand-t'; sp.setAttribute('aria-hidden', 'true');
      sp.innerHTML = word.split('').map(function (ch, i) { return '<b class="bl" style="--i:' + i + '">' + esc(ch) + '</b>'; }).join('');
      node.parentNode.replaceChild(sp, node);
      brand.style.setProperty('--n', word.length);
    }
  }
})();
;
/* QRCode generator (Kazuhiko Arase, MIT) - dibungkus untuk browser */
(function(){var D={},C={};function R(n){n=n.replace(/^\.\//,'').replace(/\.js$/,'');if(!C[n]){var m={exports:{}};C[n]=m;D[n](m,m.exports,R)}return C[n].exports}
D["QR8bitByte"]=function(module,exports,require){var QRMode = require('./QRMode');

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

};
D["QRBitBuffer"]=function(module,exports,require){function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

};
D["QRErrorCorrectLevel"]=function(module,exports,require){module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


};
D["QRMaskPattern"]=function(module,exports,require){module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

};
D["QRMath"]=function(module,exports,require){var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

};
D["QRMode"]=function(module,exports,require){module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

};
D["QRPolynomial"]=function(module,exports,require){var QRMath = require('./QRMath');

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

};
D["QRRSBlock"]=function(module,exports,require){var QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

};
D["QRUtil"]=function(module,exports,require){var QRMode = require('./QRMode');
var QRPolynomial = require('./QRPolynomial');
var QRMath = require('./QRMath');
var QRMaskPattern = require('./QRMaskPattern');

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

};
D["index"]=function(module,exports,require){

















var QR8bitByte = require('./QR8bitByte');
var QRUtil = require('./QRUtil');
var QRPolynomial = require('./QRPolynomial');
var QRRSBlock = require('./QRRSBlock');
var QRBitBuffer = require('./QRBitBuffer');

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

};
window.__QR=R('index')})();
;
/* Beresin — Sambung Perangkat: kode sambung (teks) + QR animasi, PIN opsional (AES-GCM) */
(function () {
  'use strict';
  var Q = window.__QR, S = { parts: {}, n: 0, sid: '' }, $ = function (s) { return document.querySelector(s); };
  var b64 = function (u) { var s = ''; for (var i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var unb = function (t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  var pipe = function (u, C, m) { return new Response(new Blob([u]).stream().pipeThrough(new C(m))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); };
  var gz = function (u) { return pipe(u, CompressionStream, 'gzip'); }, gun = function (u) { return pipe(u, DecompressionStream, 'gzip'); };
  var kd = function (pin, salt, use) { return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']).then(function (k) { return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, [use]); }); };
  function msg(t, bad) { var e = $('#sy-msg'); if (e) { e.textContent = t; e.className = 'ac-hint sy-msg' + (bad ? ' bad' : ''); } }

  function make(pin) {
    var o = { app: 'Beresin', t: Date.now(), d: {} };
    Object.keys(localStorage).forEach(function (k) { if (k.indexOf('mo-') === 0 && k !== 'mo-fired') o.d[k] = localStorage.getItem(k); });
    return gz(new TextEncoder().encode(JSON.stringify(o))).then(function (z) {
      if (!pin) return 'BRS1.' + b64(z);
      var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      return kd(pin, salt, 'encrypt').then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, z); }).then(function (c) {
        var c8 = new Uint8Array(c), a = new Uint8Array(28 + c8.length); a.set(salt); a.set(iv, 16); a.set(c8, 28); return 'BRS2.' + b64(a);
      });
    });
  }
  function read(code, pin) {
    var m = /^BRS([12])\.(.+)$/.exec(code.replace(/\s+/g, '')); if (!m) return Promise.reject('fmt');
    var u = unb(m[2]), p = m[1] === '1' ? Promise.resolve(u) : kd(pin || '', u.subarray(0, 16), 'decrypt').then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(16, 28) }, k, u.subarray(28)); }).then(function (b) { return new Uint8Array(b); }).catch(function () { throw 'pin'; });
    return p.then(gun).then(function (z) { var o = JSON.parse(new TextDecoder().decode(z)); if (o.app !== 'Beresin' || !o.d) throw 'fmt'; return o; });
  }
  /* gabung: item ber-id baru ditambahkan; data lokal tidak ditimpa */
  function merge(k, inc) {
    var a, b; try { a = JSON.parse(localStorage.getItem(k)); b = JSON.parse(inc); } catch (e) { return inc; }
    if (!a || typeof a !== 'object' || !b || typeof b !== 'object') return inc;
    Object.keys(b).forEach(function (p) {
      var x = a[p], y = b[p];
      if (Array.isArray(x) && Array.isArray(y)) { var ids = {}; x.forEach(function (i) { if (i && i.id != null) ids[i.id] = 1; }); y.forEach(function (i) { if (!(i && i.id != null && ids[i.id])) x.push(i); }); }
      else if (x == null || x === '') a[p] = y;
    });
    return JSON.stringify(a);
  }

  var timer = 0, stream = 0, scanT = 0;
  function draw(txt) {
    var q = new Q(-1, 1), c = $('#sy-qr'); q.addData(txt); q.make(); if (!c) return;
    var n = q.getModuleCount(), sc = Math.max(2, Math.floor(320 / (n + 8))), z = (n + 8) * sc, g = c.getContext('2d'); c.width = c.height = z;
    g.fillStyle = '#fff'; g.fillRect(0, 0, z, z); g.fillStyle = '#14213d';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + 4) * sc, (r + 4) * sc, sc, sc);
  }
  function streamQR(code) {
    clearInterval(timer); var sid = Math.random().toString(36).slice(2, 6), L = 600, P = [], i = 0;
    for (var j = 0; j < code.length; j += L) P.push(code.slice(j, j + L));
    var tick = function () { draw('BRS|' + sid + '|' + i + '|' + P.length + '|' + P[i]); $('#sy-qp').textContent = 'QR ' + (i + 1) + ' / ' + P.length + (P.length > 1 ? ' — arahkan kamera perangkat tujuan, biarkan berputar' : ''); i = (i + 1) % P.length; };
    tick(); if (P.length > 1) timer = setInterval(tick, 700);
  }
  function stopScan() { clearInterval(scanT); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = 0; var v = $('#sy-vid'); if (v) v.hidden = true; }
  function scan() {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices) return msg('Browser ini belum bisa memindai QR. Pakai kode teks (salin–tempel).', 1);
    var det = new BarcodeDetector({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (st) {
      stream = st; var v = $('#sy-vid'); v.srcObject = st; v.hidden = false; v.play(); S.parts = {}; S.sid = ''; msg('Memindai… arahkan ke QR di perangkat asal.');
      scanT = setInterval(function () {
        det.detect(v).then(function (rs) {
          rs.forEach(function (b) {
            var m = /^BRS\|(\w+)\|(\d+)\|(\d+)\|([\s\S]*)$/.exec(b.rawValue); if (!m) return;
            if (S.sid !== m[1]) { S.sid = m[1]; S.parts = {}; } S.n = +m[3]; S.parts[m[2]] = m[4];
            var got = Object.keys(S.parts).length; msg('Diterima ' + got + ' dari ' + S.n + ' bagian…');
            if (got === S.n) { var c = ''; for (var i = 0; i < S.n; i++) c += S.parts[i]; stopScan(); $('#sy-in').value = c; msg('Kode lengkap diterima. Tekan “Terapkan”.'); }
          });
        }).catch(function () { });
      }, 250);
    }).catch(function () { msg('Kamera tidak bisa dibuka. Izinkan akses kamera.', 1); });
  }

  var A = {
    make: function () {
      var pin = ($('#sy-pin').value || '').trim(); msg('Menyiapkan kode…');
      make(pin).then(function (c) { $('#sy-out').hidden = false; $('#sy-code').value = c; streamQR(c); msg(pin ? 'Kode terkunci PIN. Beri tahu PIN ke perangkat tujuan secara terpisah.' : 'Kode dibuat tanpa PIN — jangan bagikan ke orang lain.'); }).catch(function () { msg('Gagal membuat kode.', 1); });
    },
    copy: function () { var t = $('#sy-code').value; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { msg('Kode disalin.'); }).catch(function () { $('#sy-code').select(); document.execCommand('copy'); msg('Kode disalin.'); }); },
    share: function () { var t = $('#sy-code').value; if (navigator.share) navigator.share({ title: 'Kode sambung Beresin', text: t }).catch(function () { }); else A.copy(); },
    stop: function () { clearInterval(timer); $('#sy-out').hidden = true; $('#sy-code').value = ''; },
    scan: scan,
    apply: function () {
      var code = $('#sy-in').value.trim(); if (!code) return msg('Tempel atau pindai kode sambung dulu.', 1);
      read(code, $('#sy-pin2').value.trim()).then(function (o) {
        var ow = $('#sy-mode').value === 'o', ks = Object.keys(o.d);
        if (!confirm((ow ? 'TIMPA semua data di perangkat ini dengan ' : 'Gabungkan ') + ks.length + ' kelompok data dari perangkat asal?')) return;
        ks.forEach(function (k) { if (k.indexOf('mo-') === 0) localStorage.setItem(k, ow || localStorage.getItem(k) == null ? o.d[k] : merge(k, o.d[k])); });
        msg('Berhasil. Memuat ulang…'); setTimeout(function () { location.reload(); }, 600);
      }).catch(function (e) { msg(e === 'pin' ? 'PIN salah atau kode rusak.' : 'Kode tidak valid.', 1); });
    }
  };
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-sy]'); if (b && A[b.dataset.sy]) A[b.dataset.sy](); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopScan(); });

  window.BeresinSync = {
    html: function () {
      return '<div class="ac-card sy-card"><div class="sy-h"><i class="sy-ic">⇄</i><div><b>Kirim dari perangkat ini</b><p class="ac-hint">Buat kode sambung atau QR, lalu terima di HP/laptop lain.</p></div></div>' +
        '<div class="sy-row"><input id="sy-pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="PIN pengaman (opsional)" aria-label="PIN"><button class="ac-btn pri" data-sy="make">Buat kode sambung</button></div>' +
        '<div id="sy-out" hidden><div class="sy-qrbox"><canvas id="sy-qr" aria-label="QR sambung"></canvas></div><div id="sy-qp" class="ac-hint sy-qp"></div><textarea id="sy-code" readonly rows="3"></textarea>' +
        '<div class="ac-acts"><button class="ac-btn" data-sy="copy">Salin</button><button class="ac-btn" data-sy="share">Bagikan</button><button class="ac-btn danger" data-sy="stop">Tutup</button></div></div></div>' +
        '<div class="ac-card sy-card"><div class="sy-h"><i class="sy-ic">⬇</i><div><b>Terima di perangkat ini</b><p class="ac-hint">Tempel kode atau pindai QR dari perangkat asal.</p></div></div>' +
        '<textarea id="sy-in" rows="3" placeholder="Tempel kode sambung (BRS1… / BRS2…)"></textarea>' +
        '<div class="sy-row"><input id="sy-pin2" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="PIN (jika ada)" aria-label="PIN"><select id="sy-mode" aria-label="Mode"><option value="m">Gabung (aman)</option><option value="o">Timpa semua</option></select></div>' +
        '<video id="sy-vid" hidden playsinline muted></video><div class="ac-acts"><button class="ac-btn" data-sy="scan">Pindai QR</button><button class="ac-btn pri" data-sy="apply">Terapkan</button></div>' +
        '<p id="sy-msg" class="ac-hint sy-msg"></p><p class="ac-hint">Yang disambungkan: semua modul (Task, Academic, Finance, Goal, Kalender, dll). File di Document Center tidak ikut.</p></div>';
    }
  };
})();
;
/* Beresin — Tampilan Board (Pengaturan → Tampilan Board): font, warna & background main board.
   Edit berlaku khusus untuk board yang dipilih (Organization: per logo/organisasi). Judul, logo, keterangan tetap lewat "Edit kartu". */
(function () {
  'use strict';
  var KEY = 'mo-board-v1', SEL = '.dv-hero,.wo-hero,.pj-hero,.tk-hero,.tk3-hero,.gq-hero,.es-hero,.fn-sum';
  var CL = [['dv-hero', 'academic'], ['wo-hero', 'work'], ['pj-hero', 'project'], ['tk3-hero', 'task'], ['tk-hero', 'task'], ['gq-hero', 'goal'], ['es-hero', 'org'], ['fn-sum', 'finance']];
  var NAMES = [['academic', 'Academic'], ['work', 'Work Office'], ['project', 'Project'], ['task', 'Task'], ['goal', 'Goal'], ['finance', 'Finance']];
  var FONTS = [['Bawaan', ''], ['Inter', "'Inter',sans-serif"], ['Sora', "'Sora',sans-serif"], ['Outfit', "'Outfit',sans-serif"], ['Nunito', "'Nunito',sans-serif"], ['Plus Jakarta Sans', "'Plus Jakarta Sans',sans-serif"], ['Baloo 2', "'Baloo 2',sans-serif"], ['Fraunces (serif)', "'Fraunces',Georgia,serif"], ['EB Garamond (serif)', "'EB Garamond',Georgia,serif"], ['Anton (tebal)', "'Anton',Impact,sans-serif"], ['Chakra Petch', "'Chakra Petch',sans-serif"]];
  var D = {}, urls = {}, S = { k: 'academic' }, $ = function (s) { return document.querySelector(s); };
  try { D = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { D = {}; } D.b = D.b || {}; D.fonts = D.fonts || [];
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { alert('Penyimpanan penuh.'); } };
  var B = function (k) { var b = D.b[k] || (D.b[k] = {}); b.bg = b.bg || { m: 'o' }; b.h = b.h || {}; b.f = b.f || {}; return b; };
  var sid = function (x) { return String(x).replace(/[^\w-]/g, '_'); };

  var idb = function () { return new Promise(function (ok, no) { var r = indexedDB.open('mo-bfiles', 1); r.onupgradeneeded = function () { r.result.createObjectStore('f'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = no; }); };
  var tx = function (mode, fn) { return idb().then(function (d) { return new Promise(function (ok) { var t = d.transaction('f', mode), q = fn(t.objectStore('f')); t.oncomplete = function () { ok(q && q.result); }; t.onerror = function () { ok(null); }; }); }); };
  var put = function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }); }, get = function (k) { return tx('readonly', function (s) { return s.get(k); }); }, del = function (k) { return tx('readwrite', function (s) { return s.delete(k); }); };
  function addFont(n, buf) { try { return new FontFace(n, buf).load().then(function (f) { document.fonts.add(f); return f; }); } catch (e) { return Promise.reject(e); } }
  D.fonts.forEach(function (n) { get('font:' + n).then(function (b) { if (b) addFont(n, b).then(css); }); });
  Object.keys(D.b).forEach(function (k) { if (D.b[k].bg && D.b[k].bg.m === 'i') get('img:' + k).then(function (b) { if (b) { urls[k] = URL.createObjectURL(b); css(); } }); });

  var st = document.createElement('style'); st.id = 'bsb-style'; document.head.appendChild(st);
  function css() {
    var o = '';
    Object.keys(D.b).forEach(function (k) {
      var b = D.b[k], g = b.bg || {}, h = b.h || {}, f = b.f || {}, q = 'html:root:root:root:root:root [data-bsb="' + k + '"]', r = '', T = q + ' :is(h1,h2,h3)';
      if (g.m === 's') r += 'background:' + g.c1 + '!important;';
      if (g.m === 'g') r += 'background:linear-gradient(' + (g.a == null ? 135 : g.a) + 'deg,' + g.c1 + ',' + g.c2 + ')!important;';
      if (g.m === 'i' && urls[k]) { var dm = (g.dim || 0) / 100; r += 'background:linear-gradient(rgba(0,0,0,' + dm + '),rgba(0,0,0,' + dm + ')),url("' + urls[k] + '") center/cover no-repeat!important;'; }
      if (b.r != null) r += 'border-radius:' + b.r + 'px!important;';
      o += q + '{' + r + '}';
      if (g.hide) o += q + '::before,' + q + '::after{display:none!important}';
      if (k === 'finance' && g.m && g.m !== 'o') o += q + '{padding:12px}' + q + '>div{background:transparent!important;box-shadow:none!important}';
      if (f.ff) o += q + ',' + q + ' *{font-family:' + f.ff + '!important}';
      if (f.c) o += q + ' *{color:' + f.c + '!important}';
      if (h.ff) o += T + '{font-family:' + h.ff + '!important}'; if (h.c) o += T + '{color:' + h.c + '!important}'; if (h.fs) o += T + '{zoom:' + h.fs / 100 + '}';
    });
    st.textContent = o;
  }

  /* warna kartu Organization = warna logo masing-masing (dua warna paling menonjol → gradasi pastel) */
  var BP = {}; try { BP = JSON.parse(localStorage.getItem('mo-brand2-v1')) || {}; } catch (e) { BP = {}; }
  var hx = function (r, g, b) { return '#' + [r, g, b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); };
  function hueOf(r, g, b) { var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return h; }
  function pal(im) {
    try {
      var W = 56, H = Math.max(1, Math.round(W * im.naturalHeight / im.naturalWidth)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, W, H); var px = cx.getImageData(0, 0, W, H).data, bin = [], i;
      for (i = 0; i < 24; i++) bin.push({ w: 0, r: 0, g: 0, b: 0 });
      for (var p = 0; p < px.length; p += 4) {
        if (px[p + 3] < 200) continue; var r = px[p], g = px[p + 1], b = px[p + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0, v = mx / 255;
        if (v < .2 || s < .25) continue; var w = s * v, q = bin[Math.floor(hueOf(r, g, b) / 15) % 24]; q.w += w; q.r += r * w; q.g += g * w; q.b += b * w;
      }
      var a = 0; for (i = 1; i < 24; i++) if (bin[i].w > bin[a].w) a = i; if (!bin[a].w) return ['#64748b', '#94a3b8'];
      var c = -1; for (i = 0; i < 24; i++) { var dd = Math.min(Math.abs(i - a), 24 - Math.abs(i - a)); if (dd >= 3 && bin[i].w > bin[a].w * .25 && (c < 0 || bin[i].w > bin[c].w)) c = i; }
      var col = function (q) { return hx(q.r / q.w, q.g / q.w, q.b / q.w); };
      return [col(bin[a]), c >= 0 ? col(bin[c]) : col(bin[a])];
    } catch (e) { return null; }
  }
  function brand(b, k) {
    var d = D.b[k], im = b.querySelector('.es-img'); if (!im || b.classList.contains('sm')) return;
    if (d && d.bg && d.bg.m !== 'o') { b.style.removeProperty('background'); return; }
    if (!im.complete || !im.naturalWidth) { if (!im._bw) { im._bw = 1; im.addEventListener('load', function () { brand(b, k); }); } return; }
    var key = im.src.length + ':' + im.src.slice(-40), p = BP[key]; if (!p) { p = pal(im); if (!p) return; BP[key] = p; try { localStorage.setItem('mo-brand2-v1', JSON.stringify(BP)); } catch (e) { } }
    b.style.setProperty('background', 'linear-gradient(140deg,color-mix(in srgb,' + p[0] + ' 42%,#fff) 0%,color-mix(in srgb,' + p[0] + ' 50%,' + p[1] + ') 52%,color-mix(in srgb,' + p[1] + ' 58%,#fff) 100%)', 'important');
    b.style.setProperty('--c', p[0]); b.style.setProperty('--edge', p[0]);
  }
  var keyOf = function (b) { for (var i = 0; i < CL.length; i++) if (b.classList.contains(CL[i][0])) { if (CL[i][1] !== 'org') return CL[i][1]; var e = b.querySelector('[data-id]'); return e ? 'org-' + sid(e.getAttribute('data-id')) : null; } return null; };
  function apply() { document.querySelectorAll(SEL).forEach(function (b) { var k = keyOf(b); if (!k) { b.removeAttribute('data-bsb'); return; } b.dataset.bsb = k; if (b.classList.contains('es-hero')) brand(b, k); }); }
  var raf = 0; new MutationObserver(function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); }).observe(document.body, { childList: true, subtree: true });
  css(); apply();

  /* ---------- halaman Pengaturan → Tampilan Board ---------- */
  var orgs = function () { try { return (JSON.parse(localStorage.getItem('mo-org-v1')) || {}).org || []; } catch (e) { return []; } };
  var row = function (l, h) { return '<label class="bsb-r"><span>' + l + '</span>' + h + '</label>'; };
  function fontOpts(sel) { return FONTS.concat(D.fonts.map(function (n) { return [n + ' ★', '"' + n + '",sans-serif']; })).map(function (f) { return '<option value="' + f[1].replace(/"/g, '&quot;') + '"' + (f[1] === sel ? ' selected' : '') + '>' + f[0] + '</option>'; }).join(''); }
  function build() {
    var O = orgs().map(function (o) { return ['org-' + sid(o.id), o.name || 'Organisasi']; }), all = NAMES.map(function (n) { return n[0]; }).concat(O.map(function (x) { return x[0]; }));
    if (all.indexOf(S.k) < 0) S.k = 'academic';
    var b = B(S.k), g = b.bg, h = b.h, f = b.f, isOrg = S.k.indexOf('org-') === 0, mk = function (v, t) { return '<option value="' + v + '"' + (g.m === v ? ' selected' : '') + '>' + t + '</option>'; };
    var opt = function (a) { return '<option value="' + a[0] + '"' + (a[0] === S.k ? ' selected' : '') + '>' + a[1].replace(/</g, '&lt;') + '</option>'; };
    return '<div class="ac-card sy-card"><b>Tampilan Main Board</b><p class="ac-hint">Atur font, warna, dan background. Logo, judul, dan keterangan tetap diubah lewat tombol ✎ Edit kartu. Perubahan hanya berlaku untuk board yang dipilih di bawah.</p>' +
      row('Board', '<select id="bs-k"><optgroup label="Menu">' + NAMES.map(opt).join('') + '</optgroup>' + (O.length ? '<optgroup label="Organization · per logo">' + O.map(opt).join('') + '</optgroup>' : '') + '</select>') +
      '<h4>Background</h4>' + row('Jenis', '<select id="bs-m">' + mk('o', isOrg ? 'Otomatis dari warna logo' : 'Asli (bawaan)') + mk('s', 'Warna polos') + mk('g', 'Gradasi') + mk('i', 'Gambar') + '</select>') +
      (g.m === 's' || g.m === 'g' ? row('Warna 1', '<input id="bs-c1" type="color" value="' + (g.c1 || '#2b3b6b') + '">') : '') +
      (g.m === 'g' ? row('Warna 2', '<input id="bs-c2" type="color" value="' + (g.c2 || '#7b8cff') + '">') + row('Sudut <i>' + (g.a == null ? 135 : g.a) + '°</i>', '<input id="bs-a" type="range" min="0" max="360" value="' + (g.a == null ? 135 : g.a) + '">') : '') +
      (g.m === 'i' ? row('Gambar', '<input id="bs-img" type="file" accept="image/*">') + row('Gelapkan <i>' + (g.dim || 0) + '%</i>', '<input id="bs-dim" type="range" min="0" max="80" value="' + (g.dim || 0) + '">') : '') +
      row('Sembunyikan hiasan', '<input id="bs-hide" type="checkbox"' + (g.hide ? ' checked' : '') + '>') + row('Sudut <i>' + (b.r == null ? 'asli' : b.r + 'px') + '</i>', '<input id="bs-r" type="range" min="0" max="60" value="' + (b.r == null ? 26 : b.r) + '">') +
      '<h4>Judul</h4>' + row('Font', '<select id="bs-hff">' + fontOpts(h.ff || '') + '</select>') + row('Ukuran <i>' + (h.fs || 100) + '%</i>', '<input id="bs-hfs" type="range" min="60" max="200" value="' + (h.fs || 100) + '">') + row('Warna', '<input id="bs-hc" type="color" value="' + (h.c || '#1f2a48') + '"><button data-bs="hc0">Asli</button>') +
      '<h4>Teks lainnya</h4>' + row('Font', '<select id="bs-fff">' + fontOpts(f.ff || '') + '</select>') + row('Warna', '<input id="bs-fc" type="color" value="' + (f.c || '#1f2a48') + '"><button data-bs="fc0">Asli</button>') +
      '<div class="ac-acts"><button class="ac-btn danger" data-bs="reset">Kembalikan board ini ke asli</button></div></div>' +
      '<div class="ac-card sy-card"><b>Font sendiri</b><p class="ac-hint">Unggah .ttf, .otf, .woff, atau .woff2; font muncul di semua pilihan font. Tersimpan di perangkat ini.</p>' + row('Tambah font', '<input id="bs-fnt" type="file" accept=".ttf,.otf,.woff,.woff2,font/*">') +
      (D.fonts.length ? '<div class="bsb-chips">' + D.fonts.map(function (n) { return '<span>' + n + '<button data-bs="fdel" data-n="' + n + '" aria-label="Hapus font">✕</button></span>'; }).join('') + '</div>' : '') + '</div>';
  }
  function draw() { var r = $('#bsb-root'); if (r) { var y = r.closest('.ac-body') ? r.closest('.ac-body').scrollTop : 0; r.innerHTML = build(); if (r.closest('.ac-body')) r.closest('.ac-body').scrollTop = y; } }
  function touch(re) { save(); css(); apply(); if (re) draw(); }
  function down(file, cb) { var r = new FileReader(); r.onload = function () { var im = new Image(); im.onload = function () { var m = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * m; c.height = im.height * m; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.toBlob(cb, 'image/jpeg', .86); }; im.src = r.result; }; r.readAsDataURL(file); }
  function onIn(e) {
    var t = e.target, id = t.id; if (!id || id.indexOf('bs-') !== 0) return;
    if (id === 'bs-k') { S.k = t.value; return draw(); }
    var b = B(S.k), g = b.bg, h = b.h, f = b.f, v = t.value, lab = t.parentNode.firstChild;
    if (id === 'bs-m') { g.m = v; g.c1 = g.c1 || '#2b3b6b'; g.c2 = g.c2 || '#7b8cff'; touch(1); }
    else if (id === 'bs-c1') { g.c1 = v; touch(); } else if (id === 'bs-c2') { g.c2 = v; touch(); }
    else if (id === 'bs-a') { g.a = +v; touch(); lab.innerHTML = 'Sudut <i>' + v + '°</i>'; } else if (id === 'bs-dim') { g.dim = +v; touch(); lab.innerHTML = 'Gelapkan <i>' + v + '%</i>'; }
    else if (id === 'bs-hide') { g.hide = t.checked; touch(); } else if (id === 'bs-r') { b.r = +v; touch(); lab.innerHTML = 'Sudut <i>' + v + 'px</i>'; }
    else if (id === 'bs-hff') { h.ff = v; touch(); } else if (id === 'bs-hfs') { h.fs = +v; touch(); lab.innerHTML = 'Ukuran <i>' + v + '%</i>'; } else if (id === 'bs-hc') { h.c = v; touch(); }
    else if (id === 'bs-fff') { f.ff = v; touch(); } else if (id === 'bs-fc') { f.c = v; touch(); }
    else if (id === 'bs-img' && t.files[0]) down(t.files[0], function (bl) { put('img:' + S.k, bl).then(function () { if (urls[S.k]) URL.revokeObjectURL(urls[S.k]); urls[S.k] = URL.createObjectURL(bl); touch(); }); });
    else if (id === 'bs-fnt' && t.files[0]) { var fl = t.files[0], n = fl.name.replace(/\.[^.]+$/, '').replace(/[^\w ]+/g, ' ').trim().slice(0, 30) || 'Font'; fl.arrayBuffer().then(function (buf) { return addFont(n, buf.slice(0)).then(function () { return put('font:' + n, buf); }); }).then(function () { if (D.fonts.indexOf(n) < 0) D.fonts.push(n); touch(1); }).catch(function () { alert('File font tidak valid.'); }); }
  }
  document.addEventListener('input', onIn); document.addEventListener('change', onIn);
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-bs]'); if (!t) return; var a = t.dataset.bs, b = B(S.k);
    if (a === 'hc0') { delete b.h.c; touch(1); } if (a === 'fc0') { delete b.f.c; touch(1); }
    if (a === 'fdel') { var n = t.dataset.n; D.fonts = D.fonts.filter(function (x) { return x !== n; }); del('font:' + n); touch(1); }
    if (a === 'reset' && confirm('Kembalikan tampilan board ini ke asli?')) { delete D.b[S.k]; del('img:' + S.k); urls[S.k] = 0; document.querySelectorAll('[data-bsb="' + S.k + '"]').forEach(function (x) { x.style.removeProperty('background'); }); touch(1); }
  });
  window.BeresinBoards = { html: function () { return '<div id="bsb-root">' + build() + '</div>'; } };
})();
;
;
/* turbo.js v3.5 — buka/tutup menu mulus (dimuat paling akhir)
   Masalah: satu ketukan menu memicu 4–5 kali hitung-ulang tata letak paksa (baca scrollTop / focus / getBoundingClientRect
   di tengah penulisan DOM) + restyle seluruh halaman karena kelas <html> diubah belakangan.
   Perbaikan (perilaku visual tetap sama):
   1. Selama pembukaan menu: scrollTop dibaca 0 & tulis 0 diabaikan (jendela baru memang mulai dari atas, elemen display:none juga selalu 0),
      jadi tidak ada reflow paksa di render(); focus() ditunda ke frame berikutnya (tanpa reflow paksa).
   2. 'win-open' dipasang di ketukan yang sama sehingga ikut satu kali restyle bersama jendela baru. */
(function () {
  'use strict';
  if (window.__bsTurbo) return; window.__bsTurbo = 1;
  var root = document.documentElement, opening = false, guard = 0;
  /* v4.7: lompat antar-menu (mis. Settings → Task). Dipanggil SEBELUM menu lama ditutup: tutup tanpa fade, pembacaan scrollTop/focus tidak memaksa layout. */
  window.__bsJump = function () {
    opening = true; window.__bsJumpUntil = Date.now() + 500; root.classList.add('win-open');
    clearTimeout(guard); guard = setTimeout(function () { opening = false; }, 250);
    requestAnimationFrame(function () { requestAnimationFrame(function () { opening = false; }); });
  };
  var d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  if (d && d.get && d.set) {
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true, enumerable: d.enumerable,
      get: function () { return opening ? 0 : d.get.call(this); },
      set: function (v) { if (opening && !(+v)) return; d.set.call(this, v); }
    });
  }
  var F = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (o) {
    if (!opening) return F.apply(this, arguments);
    var s = this; requestAnimationFrame(function () { try { F.call(s, { preventScroll: true }); } catch (e) { } });
  };
  function done() { opening = false; clearTimeout(guard); }
  window.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('.nav a, .tools .avatar'); if (!a) return;
    var h = a.classList.contains('avatar') ? '#settings' : a.getAttribute('href'), MO = window.MyOffice || {};
    if (h !== '#academic' && !(MO.routes && MO.routes[h])) return;
    opening = true; root.classList.add('win-open');
    clearTimeout(guard); guard = setTimeout(done, 250);
    requestAnimationFrame(function () { requestAnimationFrame(done); });
  }, true);
})();
;

/* turbo-close v4.3 — menutup menu seketika & mulus.
   hidden=true -> jendela langsung memudar 100 ms lewat Web Animations (opacity, dijalankan compositor, tidak menunggu layout) sementara beranda
   dipulihkan di baliknya; pekerjaan berat (melanjutkan animasi beranda) ditunda sampai jendela sudah hilang. Buka ulang di tengah pudar membatalkannya.
   Mode "kurangi gerakan" tetap langsung menutup. */
(function () {
  'use strict';
  if (window.__bsClose) return; window.__bsClose = 1;
  var H = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden'); if (!H || !H.get || !H.set) return;
  var OV = /(^|\s)(ac-ov|ad-ov|wo-ov|es-ov|fn-ov|sp-ov|ib-ov)(\s|$)/, OV2 = /(^|\s)(ac-ov2|wo-ov2|es-ov2)(\s|$)/;
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function end(el, tok, anim) {
    if (el.__bso !== tok) return; el.__bso = 0; clearTimeout(el.__bsot);
    H.set.call(el, true); el.classList.remove('bs-pre', 'bs-out'); try { anim && anim.cancel(); } catch (e) { }
  }
  Object.defineProperty(HTMLElement.prototype, 'hidden', {
    configurable: true, enumerable: H.enumerable,
    get: function () { return this.__bso ? true : H.get.call(this); },
    set: function (v) {
      var el = this;
      if (el.__bso) {
        if (!v) { clearTimeout(el.__bsot); el.__bso = 0; el.classList.remove('bs-pre', 'bs-out'); try { el.__bsa && el.__bsa.cancel(); } catch (e) { } H.set.call(el, false); }
        return;
      }
      if (v && !H.get.call(el) && el.isConnected && !mq.matches && el.animate && !(window.__bsJumpUntil > Date.now())) {
        var cn = el.className; cn = typeof cn === 'string' ? cn : '';
        if (OV.test(cn) && !OV2.test(cn)) {
          var tok = el.__bso = (el.__bsn = (el.__bsn || 0) + 1);
          el.classList.add('bs-pre', 'bs-out');
          var an = el.__bsa = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(22px,0,0)' }], { duration: 130, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })   /* v5.8: halaman bergeser keluar (seperti kembali ke halaman sebelumnya) */;
          an.onfinish = function () { end(el, tok, an); };
          el.__bsot = setTimeout(function () { end(el, tok, an); }, 260);
          return;
        }
      }
      H.set.call(el, v);
    }
  });
})();

/* warm-home v4.3 — setelah menu terbuka ±0,35 dtk dan browser menganggur, beranda "dipanaskan" (layout dihitung saat tersembunyi & beku) supaya penutupan menu murah.
   Saat menu ditutup, status beku dilepas SETELAH jendela hilang (±0,15 dtk), bukan di frame pertama penutupan. */
(function () {
  'use strict';
  if (window.__bsWarm) return; window.__bsWarm = 1;
  var root = document.documentElement, T = 0, U = 0, was = root.classList.contains('win-open');
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 30); };
  new MutationObserver(function () {
    var now = root.classList.contains('win-open'); if (now === was) return; was = now;
    clearTimeout(T); clearTimeout(U);
    if (!now) { U = setTimeout(function () { if (!root.classList.contains('win-open')) root.classList.remove('win-warm'); }, 160); return; }
    T = setTimeout(function () { idle(function () { if (root.classList.contains('win-open') && !document.hidden) root.classList.add('win-warm'); }, { timeout: 300 }); }, 350);
  }).observe(root, { attributes: true, attributeFilter: ['class'] });
})();
