/* study.js — v5.2 "Fokus Belajar" (tab baru di Academic)
   Pomodoro + durasi fokus yang dapat diatur + statistik waktu produktif (bagan) + riwayat aktivitas belajar.

   Prinsip penyambungan (agar rapi digabung dengan pekerjaan rekan tim):
   - TIDAK membuat penyimpanan data belajar baru. Catatan disimpan ke D.study milik Academic (kunci 'mo-acad-v1'),
     dengan bentuk yang sama seperti catatan lama {id, courseId, date, minutes, notes} + kolom tambahan opsional
     {topic, mode, start, end, plan, done}. Karena itu Analitik, Smart Planner ("jam belajar 7 hari terakhir"),
     Smart Insight, Inbox, dan Cadangan data otomatis ikut membaca catatan dari sini.
   - Hanya pengaturan & timer yang berjalan disimpan terpisah di 'mo-study-v1' (otomatis ikut Cadangan data: semua kunci mo-*).
   - Tersambung ke Academic lewat 3 titik kecil di app.js: TABS/PAGE (tab 'fokus') dan MO.studyView().
   - Edit/Hapus/Catat manual memakai formulir & aksi bawaan Academic (data-act="edit|del|add" data-e="study"),
     sedangkan tombol milik modul ini memakai atribut data-fk agar tidak bertabrakan dengan data-act modul lain.
   - Perhitungan waktu memakai cap waktu (bukan hitung mundur per detik) sehingga tetap akurat saat layar mati / tab di latar belakang. */
(function () {
  'use strict';
  if (window.__bsStudy) return; window.__bsStudy = 1;
  var W = window, D = document, MO = W.MyOffice = W.MyOffice || {};
  var KEY = 'mo-study-v1';

  /* ---------- util ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var p2 = function (n) { return ('0' + n).slice(-2); };
  var ds = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var todayS = function () { return ds(new Date()); };
  var hhmm = function (t) { var d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  var addDays = function (d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
  var fm = function (m) { m = Math.round(m || 0); if (m < 60) return m + ' mnt'; var h = Math.floor(m / 60), r = m % 60; return h + ' j' + (r ? ' ' + r + ' mnt' : ''); };
  var fmS = function (m) { m = Math.round(m || 0); if (m < 60) return m + 'm'; var h = Math.floor(m / 60), r = m % 60; return h + 'j' + (r ? r : ''); };
  var clamp = function (v, a, b) { v = Math.round(+v); if (isNaN(v)) v = a; return Math.max(a, Math.min(b, v)); };
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var HARI_L = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var uid = function () { return Math.random().toString(36).slice(2, 9); };

  /* ---------- data Academic (objek hidup milik app.js) ---------- */
  var AD = function () { return MO.acadData ? (MO.acadData.scoped ? MO.acadData.scoped() : MO.acadData.D ? MO.acadData.D() : null) : null; };   /* v5.4: per kampus terpilih (MO.acadData.D() = gabungan semua kampus, hanya utk pembaca jadwal) */
  var A_save = function () { try { MO.acadData.save(); } catch (e) { } };
  var courses = function () { var a = AD(); return a ? a.course || [] : []; };
  var studyAll = function () { var a = AD(); if (!a) return []; if (!a.study) a.study = []; return a.study; };
  var cname = function (id) { var c = courses().filter(function (x) { return x.id === id; })[0]; return c ? c.name : '—'; };
  function courseOptsList() {
    var a = AD(); if (!a) return [];
    var act = {}; (a.sem || []).forEach(function (s) { if (s.active) act[s.id] = 1; });
    var all = a.course || [], on = all.filter(function (c) { return act[c.semId]; });
    return on.length ? on : all;
  }

  /* ---------- state (pengaturan + timer berjalan) ---------- */
  var DEF = { focus: 25, brk: 5, lbrk: 15, every: 4, pomo: 1, auto: 0, sound: 1, goal: 120, last: '' };
  var S = { cfg: Object.assign({}, DEF), run: null };
  try { var raw = JSON.parse(localStorage.getItem(KEY)); if (raw && raw.cfg) { S.cfg = Object.assign({}, DEF, raw.cfg); S.run = raw.run || null; } } catch (e) { }
  var UI = { rng: '7', cfgOpen: 0, hist: 15, hf: '', cid: '', topic: '' };
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

  /* ---------- timer ---------- */
  var tm = 0, wake = null, actx = null;
  var PH = { focus: 'Fokus', short: 'Istirahat pendek', long: 'Istirahat panjang' };
  function planMs(ph) { return (ph === 'focus' ? S.cfg.focus : ph === 'short' ? S.cfg.brk : S.cfg.lbrk) * 60000; }
  function remMs() { var r = S.run; if (!r) return 0; return r.paused ? r.rem : Math.max(0, r.endAt - Date.now()); }
  function elapsedMs() { var r = S.run; return r ? Math.max(0, r.plan - remMs()) : 0; }

  function beep() {
    if (!S.cfg.sound) return;
    try {
      var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return;
      actx = actx || new AC(); if (actx.state === 'suspended') actx.resume();
      [0, .22, .44].forEach(function (t, i) {
        var o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime + t;
        o.type = 'sine'; o.frequency.value = i === 2 ? 1046 : 784; g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.25, n + .02); g.gain.exponentialRampToValueAtTime(.0001, n + .2);
        o.connect(g); g.connect(actx.destination); o.start(n); o.stop(n + .22);
      });
    } catch (e) { }
    try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) { }
  }
  function notify(title, body) {
    try { if (MO.msg) MO.msg(title, body); } catch (e) { }
    try { if (W.Notification && Notification.permission === 'granted' && D.hidden) new Notification(title, { body: body, icon: 'icon-192.png', tag: 'beresin-study' }); } catch (e) { }
  }
  function lock(on) {
    try {
      if (on && navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (l) { wake = l; l.addEventListener('release', function () { wake = null; }); }).catch(function () { });
      else if (!on && wake) { wake.release(); wake = null; }
    } catch (e) { }
  }
  D.addEventListener('visibilitychange', function () { if (!D.hidden) { if (S.run && !S.run.paused && !S.run.wait) lock(true); loop(); paint(); } });

  function loop() {
    var go = S.run && !S.run.paused && !S.run.wait;
    if (go && !tm) tm = setInterval(tick, 500);
    if (!go && tm) { clearInterval(tm); tm = 0; }
  }
  function tick() {
    var r = S.run; if (!r || r.paused || r.wait) { loop(); return; }
    if (remMs() <= 0) complete(false); else paint();
  }

  /* simpan satu blok fokus ke riwayat Academic (D.study) */
  function logBlock(mins, done) {
    var r = S.run, a = AD(); if (!r || !a || mins < 1) return false;
    var t0 = r.t0, rec = {
      id: uid(), courseId: r.cid, date: ds(new Date(t0)), minutes: mins, notes: r.topic || '',
      topic: r.topic || '', mode: S.cfg.pomo ? 'pomodoro' : 'fokus', start: hhmm(t0), end: hhmm(Date.now()), plan: Math.round(r.plan / 60000), done: done ? 1 : 0
    };
    studyAll().push(rec); A_save(); r.sum = (r.sum || 0) + mins; return true;
  }

  function begin(ph, auto) {
    var r = S.run; r.phase = ph; r.plan = planMs(ph); r.rem = r.plan; r.t0 = Date.now(); r.wait = 0;
    if (auto) { r.paused = 0; r.endAt = Date.now() + r.plan; } else { r.paused = 1; r.wait = 1; }
    persist(); loop(); lock(!!auto && ph === 'focus');
  }
  function complete(offline) {
    var r = S.run; if (!r) return;
    if (r.phase === 'focus') {
      var mins = Math.max(1, Math.round(r.plan / 60000)); logBlock(mins, true); r.cycle = (r.cycle || 0) + 1;
      if (!S.cfg.pomo) { notify('Fokus selesai 🎉', fm(mins) + ' tercatat untuk ' + cname(r.cid) + '.'); endRun(true); return; }
      var next = r.cycle % S.cfg.every === 0 ? 'long' : 'short';
      notify('Fokus selesai 🎉', fm(mins) + ' tercatat. Saatnya ' + (next === 'long' ? 'istirahat panjang' : 'istirahat') + '.'); beep();
      begin(next, S.cfg.auto && !offline);
    } else {
      notify('Istirahat selesai', 'Siap lanjut fokus?'); beep();
      begin('focus', S.cfg.auto && !offline);
    }
    refresh();
  }
  function endRun(silent) {
    var r = S.run; if (!r) return;
    var sum = r.sum || 0;
    S.run = null; persist(); loop(); lock(false);
    if (!silent && sum) notify('Sesi selesai', fm(sum) + ' tercatat di riwayat belajar.');
    refresh();
  }

  function start() {
    var cid = UI.cid || S.cfg.last; if (!courseOpts().some(function (c) { return c.id === cid; })) cid = '';
    if (!cid) { try { MO.msg('Pilih mata kuliah', courses().length ? 'Pilih mata kuliah yang sedang dipelajari.' : 'Tambahkan mata kuliah di Academic terlebih dahulu.'); } catch (e) { } return; }
    S.cfg.last = cid;
    S.run = { cid: cid, topic: UI.topic.trim(), cycle: 0, sum: 0 };
    try { if (W.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { }
    try { var AC = W.AudioContext || W.webkitAudioContext; if (AC && !actx) actx = new AC(); if (actx && actx.state === 'suspended') actx.resume(); } catch (e) { }
    begin('focus', 1); refresh();
  }
  function pause() { var r = S.run; if (!r || r.paused) return; r.rem = remMs(); r.paused = 1; persist(); loop(); lock(false); refresh(); }
  function resume() {
    var r = S.run; if (!r) return;
    if (r.wait) { r.wait = 0; r.t0 = Date.now(); }
    r.paused = 0; r.endAt = Date.now() + r.rem; persist(); loop(); lock(r.phase === 'focus'); refresh();
  }
  function finish() {
    var r = S.run; if (!r) return;
    if (r.phase === 'focus' && !r.wait) {
      var m = Math.round(elapsedMs() / 60000);
      if (m >= 1) logBlock(m, false);
    }
    endRun(false);
  }
  function skipBreak() { var r = S.run; if (!r) return; begin('focus', 0); refresh(); }

  /* sesi yang tertinggal saat aplikasi ditutup: selesaikan sekali, jangan menjalankan fase berikutnya sendiri */
  function settle() {
    var r = S.run; if (!r) return;
    if (!r.paused && !r.wait && r.endAt <= Date.now()) { complete(true); }
    else loop();
  }

  /* ---------- perhitungan statistik ---------- */
  function byDay() { var m = {}; studyAll().forEach(function (s) { if (!s.date) return; m[s.date] = (m[s.date] || 0) + (+s.minutes || 0); }); return m; }
  function inRange(rng) {
    var all = studyAll(); if (rng === 'all') return all.filter(function (s) { return s.date; });
    var n = +rng, from = ds(addDays(new Date(), -(n - 1)));
    return all.filter(function (s) { return s.date && s.date >= from && s.date <= todayS(); });
  }
  function streak(m) {
    var d = new Date(), n = 0; if (!m[ds(d)]) d = addDays(d, -1);
    while (m[ds(d)] > 0) { n++; d = addDays(d, -1); }
    return n;
  }
  function hourBins(list) {
    var b = []; for (var i = 0; i < 24; i++) b.push(0); var used = 0, skipped = 0;
    list.forEach(function (s) {
      var m = +s.minutes || 0; if (!m) return;
      if (!/^\d{1,2}:\d{2}$/.test(s.start || '')) { skipped++; return; }
      var t = s.start.split(':'), cur = (+t[0]) * 60 + (+t[1]), left = m; used++;
      while (left > 0) { var h = Math.floor(cur / 60) % 24, ch = Math.min(left, 60 - cur % 60); b[h] += ch; cur += ch; left -= ch; }
    });
    return { b: b, used: used, skipped: skipped };
  }
  function weekdayBins(list) { var b = [0, 0, 0, 0, 0, 0, 0]; list.forEach(function (s) { var d = new Date(s.date + 'T00:00:00'); if (!isNaN(d)) b[d.getDay()] += +s.minutes || 0; }); return b; }
  function sumList(l) { return l.reduce(function (a, s) { return a + (+s.minutes || 0); }, 0); }

  function insights(list, m) {
    var o = [], tot = sumList(list); if (!tot) return o;
    var hb = hourBins(list); var hs = hb.b.reduce(function (a, x) { return a + x; }, 0);
    if (hs >= 60) {
      var best = -1, bi = 0; for (var h = 0; h < 24; h++) { var v = hb.b[h] + hb.b[(h + 1) % 24]; if (v > best) { best = v; bi = h; } }
      o.push(['⏰', 'Jam paling produktif: <b>' + p2(bi) + '.00–' + p2((bi + 2) % 24) + '.00</b> (' + Math.round(best / hs * 100) + '% waktu belajar yang tercatat jamnya). Taruh materi tersulit di rentang ini.']);
    }
    var wd = weekdayBins(list), wm = Math.max.apply(null, wd);
    if (wm > 0 && list.length >= 3) { var wi = wd.indexOf(wm); o.push(['📅', 'Hari paling rajin: <b>' + HARI_L[wi] + '</b> (' + fm(wm) + ' pada periode ini).']); }
    var wk = 0, pw = 0, now = new Date();
    for (var i = 0; i < 7; i++) { wk += m[ds(addDays(now, -i))] || 0; pw += m[ds(addDays(now, -i - 7))] || 0; }
    if (wk || pw) {
      if (!pw) o.push(['📈', 'Minggu ini <b>' + fm(wk) + '</b>. Belum ada data minggu lalu untuk dibandingkan.']);
      else { var df = Math.round((wk - pw) / pw * 100); o.push([df >= 0 ? '📈' : '📉', 'Dibanding 7 hari sebelumnya, waktu belajarmu <b>' + (df >= 0 ? 'naik ' : 'turun ') + Math.abs(df) + '%</b> (' + fm(wk) + ' vs ' + fm(pw) + ').']); }
    }
    var g = +S.cfg.goal || 0;
    if (g) { var hit = 0; for (var j = 0; j < 7; j++) if ((m[ds(addDays(now, -j))] || 0) >= g) hit++; o.push(['🎯', 'Target harian ' + fm(g) + ' tercapai <b>' + hit + ' dari 7 hari</b> terakhir.']); }
    var pb = list.filter(function (s) { return s.mode === 'pomodoro' || s.mode === 'fokus'; });
    if (pb.length >= 3) {
      var dn = pb.filter(function (s) { return s.done; }).length, av = Math.round(sumList(pb) / pb.length);
      o.push(['🍅', pb.length + ' sesi fokus, rata-rata <b>' + av + ' mnt</b>; <b>' + Math.round(dn / pb.length * 100) + '%</b> diselesaikan penuh.' + (dn / pb.length < .6 ? ' Coba perpendek durasi fokus agar lebih mudah dituntaskan.' : '')]);
    }
    var a = AD(); if (a) {
      var seen = {}; list.forEach(function (s) { seen[s.courseId] = 1; });
      var miss = courseOptsList().filter(function (c) { return !seen[c.id]; }).map(function (c) { return c.name; });
      if (miss.length && courseOptsList().length > 1) o.push(['📚', 'Belum ada waktu belajar pada periode ini untuk: <b>' + esc(miss.slice(0, 3).join(', ')) + '</b>' + (miss.length > 3 ? ' +' + (miss.length - 3) : '') + '.']);
    }
    return o;
  }

  /* ---------- tampilan ---------- */
  function courseOpts() { return courseOptsList(); }
  var ICO = {
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    skip: '<path d="M5 5l9 7-9 7zM17 5v14" />',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  };
  var ic = function (n) { return '<svg class="fk-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[n] + '</svg>'; };
  var CIRC = 2 * Math.PI * 54;
  function mmss(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return p2(m) + ':' + p2(s % 60); }

  function ringHtml() {
    var r = S.run, ph = r ? r.phase : 'focus', rem = r ? remMs() : S.cfg.focus * 60000, plan = r ? r.plan : rem, pr = plan ? 1 - rem / plan : 0;
    var lbl = !r ? 'Siap fokus' : r.wait ? 'Siap: ' + PH[ph].toLowerCase() : PH[ph] + (r.paused ? ' · jeda' : '');
    var sub = !r ? (UI.cid || S.cfg.last ? esc(cname(UI.cid || S.cfg.last)) : 'Pilih mata kuliah') : esc(cname(r.cid)) + (r.topic ? ' · ' + esc(r.topic) : '');
    return '<div class="fk-ring ph-' + (ph === 'focus' ? 'f' : 'b') + (r && !r.paused ? ' on' : '') + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="fk-trk" cx="60" cy="60" r="54"/><circle class="fk-prg" id="fkRing" cx="60" cy="60" r="54" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="' + (CIRC * (1 - pr)).toFixed(1) + '"/></svg>' +
      '<div class="fk-tx"><small id="fkLbl">' + esc(lbl) + '</small><b id="fkTime" role="timer" aria-live="off">' + mmss(rem) + '</b><span id="fkSub">' + sub + '</span></div></div>';
  }
  function dotsHtml() {
    var r = S.run, ev = S.cfg.every, cyc = r ? (r.cycle || 0) : 0, filled = r && cyc > 0 && cyc % ev === 0 && r.phase !== 'focus' ? ev : cyc % ev, h = '';
    for (var i = 0; i < ev; i++) h += '<i class="' + (i < filled ? 'on' : (r && r.phase === 'focus' && i === filled ? 'cur' : '')) + '"></i>';
    return '<div class="fk-dots" aria-label="Sesi fokus ke-' + (filled + (r && r.phase === 'focus' ? 1 : 0)) + ' dari ' + ev + '">' + h + '</div>';
  }
  function controlsHtml() {
    var r = S.run, b = function (a, cls, ico, t) { return '<button class="fk-b ' + cls + '" data-fk="' + a + '">' + (ico ? ic(ico) : '') + '<span>' + t + '</span></button>'; };
    if (!r) return b('start', 'pri big', 'play', 'Mulai fokus');
    if (r.wait) return b('resume', 'pri big', 'play', r.phase === 'focus' ? 'Mulai fokus' : 'Mulai istirahat') + (r.phase !== 'focus' ? b('skip', '', 'skip', 'Lewati') : '') + b('finish', 'ghost', 'stop', 'Selesai');
    if (r.paused) return b('resume', 'pri big', 'play', 'Lanjut') + b('finish', 'ghost', 'stop', 'Selesai');
    return b('pause', 'pri big', 'pause', 'Jeda') + (r.phase !== 'focus' ? b('skip', '', 'skip', 'Lewati') : '') + b('finish', 'ghost', 'stop', 'Selesai');
  }
  function stepper(k, lbl, min, max, unit) {
    return '<div class="fk-st"><span>' + lbl + '</span><div><button data-fk="dec" data-k="' + k + '" aria-label="Kurangi ' + lbl + '">−</button><input type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + S.cfg[k] + '" data-fkin="' + k + '" aria-label="' + lbl + '"><button data-fk="inc" data-k="' + k + '" aria-label="Tambah ' + lbl + '">+</button></div><em>' + unit + '</em></div>';
  }
  function tog(k, lbl, hint) { return '<button class="fk-tg' + (S.cfg[k] ? ' on' : '') + '" data-fk="tog" data-k="' + k + '" role="switch" aria-checked="' + (S.cfg[k] ? 'true' : 'false') + '"><span><b>' + lbl + '</b><small>' + hint + '</small></span><i></i></button>'; }
  function settingsHtml() {
    var pre = [15, 25, 30, 45, 50, 90], idle = !S.run;
    var h = '<div class="fk-set"><div class="fk-chips" role="group" aria-label="Durasi fokus">' + pre.map(function (m) { return '<button class="fk-chip' + (S.cfg.focus === m ? ' on' : '') + '" data-fk="preset" data-v="' + m + '">' + m + ' mnt</button>'; }).join('') + '</div>' +
      stepper('focus', 'Durasi fokus', 1, 180, 'menit');
    h += tog('pomo', 'Mode Pomodoro', 'Fokus dan istirahat bergantian. Matikan untuk satu sesi fokus saja.');
    if (S.cfg.pomo) h += stepper('brk', 'Istirahat pendek', 1, 60, 'menit') + stepper('lbrk', 'Istirahat panjang', 1, 90, 'menit') + stepper('every', 'Istirahat panjang setiap', 2, 8, 'sesi') + tog('auto', 'Lanjut otomatis', 'Fase berikutnya langsung berjalan tanpa menekan tombol.');
    h += stepper('goal', 'Target belajar harian', 0, 720, 'menit') + tog('sound', 'Bunyi & getar', 'Bunyi singkat saat fase selesai.');
    if (!idle) h += '<p class="fk-note">Perubahan durasi berlaku mulai fase berikutnya.</p>';
    return h + '</div>';
  }
  function timerCard() {
    var r = S.run, opts = courseOpts(), cid = r ? r.cid : (UI.cid || S.cfg.last);
    if (!opts.some(function (c) { return c.id === cid; })) cid = r ? r.cid : '';
    var h = '<section class="fk-card fk-timer" aria-label="Pengatur waktu fokus">';
    h += '<div class="fk-pick">' +
      '<label><span>Mata kuliah</span><select data-fkin="cid"' + (r ? ' disabled' : '') + '><option value="">— Pilih mata kuliah —</option>' + opts.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === cid ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label><span>Topik / yang dipelajari</span><input type="text" data-fkin="topic" maxlength="80" placeholder="mis. Bab 3 — Integral" value="' + esc(r ? r.topic : UI.topic) + '"' + (r ? ' disabled' : '') + ' autocomplete="off"></label></div>';
    h += ringHtml() + dotsHtml() + '<div class="fk-ctl">' + controlsHtml() + '</div>';
    h += '<button class="fk-gear" data-fk="cfg" aria-expanded="' + (UI.cfgOpen ? 'true' : 'false') + '">' + ic('gear') + '<span>Atur durasi &amp; Pomodoro · ' + S.cfg.focus + (S.cfg.pomo ? '/' + S.cfg.brk : '') + ' mnt</span></button>';
    if (UI.cfgOpen) h += settingsHtml();
    return h + '</section>';
  }

  function summaryCard(m) {
    var td = m[todayS()] || 0, g = +S.cfg.goal || 0, pc = g ? Math.min(100, Math.round(td / g * 100)) : 0, wk = 0, now = new Date();
    for (var i = 0; i < 7; i++) wk += m[ds(addDays(now, -i))] || 0;
    var all = studyAll(), pb = all.filter(function (s) { return s.mode === 'pomodoro' || s.mode === 'fokus'; });
    return '<div class="fk-grid">' +
      '<div class="fk-stat"><b>' + fmS(td) + '</b><span>Hari ini' + (g ? ' · ' + pc + '% target' : '') + '</span>' + (g ? '<i class="fk-pb"><u style="width:' + pc + '%"></u></i>' : '') + '</div>' +
      '<div class="fk-stat"><b>' + fmS(wk) + '</b><span>7 hari terakhir</span></div>' +
      '<div class="fk-stat"><b>' + streak(m) + '<small> hari</small></b><span>Beruntun belajar</span></div>' +
      '<div class="fk-stat"><b>' + (pb.length ? Math.round(sumList(pb) / pb.length) + '<small> mnt</small>' : '—') + '</b><span>Rata-rata sesi fokus</span></div></div>';
  }

  function dayChart(m) {
    var n = UI.rng === '7' ? 7 : 30, now = new Date(), cols = [], mx = 0, g = +S.cfg.goal || 0;
    for (var i = n - 1; i >= 0; i--) { var d = addDays(now, -i), v = m[ds(d)] || 0; mx = Math.max(mx, v); cols.push({ d: d, v: v, today: i === 0 }); }
    var top = Math.max(mx, g, 30), tot = 0; cols.forEach(function (c) { tot += c.v; });
    var h = '<div class="fk-chart' + (n > 7 ? ' dense' : '') + '" style="--n:' + n + '" role="img" aria-label="Bagan waktu belajar per hari, total ' + fm(tot) + '">';
    h += cols.map(function (c, idx) {
      var lab = n === 7 ? HARI[c.d.getDay()] : ((idx % 5 === 0 || c.today) ? c.d.getDate() : '');
      return '<div class="fk-col' + (c.today ? ' td' : '') + (g && c.v >= g ? ' hit' : '') + '" title="' + c.d.getDate() + ' ' + BULAN[c.d.getMonth()] + ' · ' + fm(c.v) + '"><span class="fk-v">' + (n === 7 && c.v ? fmS(c.v) : '') + '</span><div class="fk-bar"><u style="height:' + (c.v / top * 100).toFixed(1) + '%"></u></div><small>' + lab + '</small></div>';
    }).join('') + '</div>';
    return h + '<p class="fk-cap">Total ' + (n === 7 ? '7' : '30') + ' hari: <b>' + fm(tot) + '</b> · rata-rata <b>' + fm(tot / n) + '</b>/hari' + (g ? ' · <span class="fk-lg"></span>target tercapai' : '') + '</p>';
  }
  function hourChart(list) {
    var hb = hourBins(list), mx = Math.max.apply(null, hb.b), pk = mx > 0 ? hb.b.indexOf(mx) : -1;
    if (!hb.used) return '<p class="fk-hint">Belum ada data jam. Catatan dari timer Fokus otomatis menyimpan jam mulai, jadi bagan ini terisi setelah kamu memakai timer.</p>';
    var h = '<div class="fk-hours" role="img" aria-label="Bagan waktu belajar menurut jam, puncak pukul ' + p2(pk) + '.00">' + hb.b.map(function (v, i) {
      return '<div class="fk-hc' + (i === pk ? ' pk' : '') + '" title="' + p2(i) + '.00 · ' + fm(v) + '"><div><u style="height:' + (mx ? (v / mx * 100).toFixed(1) : 0) + '%"></u></div><small>' + (i % 3 === 0 ? i : '') + '</small></div>';
    }).join('') + '</div>';
    return h + '<p class="fk-cap">Puncak produktif pukul <b>' + p2(pk) + '.00–' + p2((pk + 1) % 24) + '.00</b>' + (hb.skipped ? ' · ' + hb.skipped + ' catatan tanpa jam tidak ikut dihitung' : '') + '</p>';
  }
  function weekdayChart(list) {
    var b = weekdayBins(list), mx = Math.max.apply(null, b), order = [1, 2, 3, 4, 5, 6, 0];
    if (!mx) return '';
    return '<div class="fk-wd" role="img" aria-label="Waktu belajar menurut hari dalam seminggu">' + order.map(function (i) {
      return '<div class="fk-wc' + (b[i] === mx ? ' pk' : '') + '" title="' + HARI_L[i] + ' · ' + fm(b[i]) + '"><div><u style="height:' + (b[i] / mx * 100).toFixed(1) + '%"></u></div><b>' + fmS(b[i]) + '</b><small>' + HARI[i] + '</small></div>';
    }).join('') + '</div>';
  }
  function courseChart(list) {
    var t = {}, all = 0; list.forEach(function (s) { var v = +s.minutes || 0; t[s.courseId] = (t[s.courseId] || 0) + v; all += v; });
    var ids = Object.keys(t).sort(function (a, b) { return t[b] - t[a]; }); if (!ids.length) return '';
    var mx = t[ids[0]];
    return '<div class="fk-cb">' + ids.slice(0, 8).map(function (id) { return '<div class="fk-cr"><span title="' + esc(cname(id)) + '">' + esc(cname(id)) + '</span><div class="fk-tr"><u style="width:' + (t[id] / mx * 100).toFixed(1) + '%"></u></div><b>' + fmS(t[id]) + ' <small>' + Math.round(t[id] / all * 100) + '%</small></b></div>'; }).join('') + '</div>';
  }
  function statsCard(m) {
    var list = inRange(UI.rng), rg = [['7', '7 hari'], ['30', '30 hari'], ['all', 'Semua']];
    var h = '<section class="fk-card" aria-label="Statistik waktu produktif"><div class="fk-hd"><h3>Statistik waktu produktif</h3><div class="fk-seg" role="group" aria-label="Periode">' +
      rg.map(function (r) { return '<button data-fk="rng" data-v="' + r[0] + '" class="' + (UI.rng === r[0] ? 'on' : '') + '" aria-pressed="' + (UI.rng === r[0]) + '">' + r[1] + '</button>'; }).join('') + '</div></div>';
    if (!list.length) return h + '<p class="fk-hint">Belum ada catatan belajar pada periode ini. Mulai timer di atas atau catat manual di riwayat.</p></section>';
    h += '<h4>Per hari</h4>' + dayChart(m) + '<h4>Jam paling produktif</h4>' + hourChart(list) + '<h4>Hari paling rajin</h4>' + weekdayChart(list) + '<h4>Per mata kuliah</h4>' + courseChart(list);
    var ins = insights(list, m);
    if (ins.length) h += '<h4>Analisis</h4><ul class="fk-ins">' + ins.map(function (i) { return '<li><span>' + i[0] + '</span><p>' + i[1] + '</p></li>'; }).join('') + '</ul>';
    return h + '</section>';
  }

  function fdate(s) {
    var d = new Date(s + 'T00:00:00'); if (isNaN(d)) return s;
    var t = todayS(), y = ds(addDays(new Date(), -1));
    return s === t ? 'Hari ini' : s === y ? 'Kemarin' : HARI_L[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function historyCard() {
    var all = studyAll().slice(), opts = courses();
    if (UI.hf) all = all.filter(function (s) { return s.courseId === UI.hf; });
    all.sort(function (a, b) { return ((b.date || '') + (b.start || '')).localeCompare((a.date || '') + (a.start || '')); });
    var shown = all.slice(0, UI.hist), h = '<section class="fk-card" aria-label="Riwayat aktivitas belajar"><div class="fk-hd"><h3>Riwayat aktivitas belajar</h3><button class="fk-b sm" data-act="add" data-e="study">+ Catat manual</button></div>';
    h += '<label class="fk-flt"><span>Filter</span><select data-fkin="hf"><option value="">Semua mata kuliah</option>' + opts.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === UI.hf ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>';
    if (!shown.length) return h + '<p class="fk-hint">Belum ada riwayat' + (UI.hf ? ' untuk mata kuliah ini' : '') + '.</p></section>';
    var last = '', dayTot = {}; all.forEach(function (s) { dayTot[s.date] = (dayTot[s.date] || 0) + (+s.minutes || 0); });
    h += '<div class="fk-list">';
    shown.forEach(function (s) {
      if (s.date !== last) { last = s.date; h += '<div class="fk-day"><b>' + esc(fdate(s.date)) + '</b><span>' + fm(dayTot[s.date]) + '</span></div>'; }
      var pm = s.mode === 'pomodoro' || s.mode === 'fokus', tm = s.start ? s.start + (s.end ? '–' + s.end : '') : '';
      h += '<div class="fk-it"><i class="fk-ik' + (pm ? '' : ' mn') + '" aria-hidden="true">' + (pm ? '🍅' : '✍️') + '</i><div class="fk-bd"><b>' + esc(cname(s.courseId)) + '</b><small>' +
        esc([s.topic || s.notes, tm, pm ? (s.done ? 'Tuntas' : 'Dihentikan lebih awal') : 'Dicatat manual'].filter(Boolean).join(' · ')) + '</small></div><strong>' + fm(+s.minutes || 0) + '</strong>' +
        '<div class="fk-ac"><button class="fk-b sm" data-act="edit" data-e="study" data-id="' + esc(s.id) + '">Edit</button><button class="fk-b sm dg" data-act="del" data-e="study" data-id="' + esc(s.id) + '">Hapus</button></div></div>';
    });
    h += '</div>';
    if (all.length > shown.length) h += '<button class="fk-b more" data-fk="more">Tampilkan lebih banyak (' + (all.length - shown.length) + ')</button>';
    return h + '</section>';
  }

  MO.studyView = function () {
    if (!AD()) return '<div class="ac-empty">Data Academic belum siap.</div>';
    if (!UI.cid) UI.cid = S.cfg.last || '';
    var m = byDay();
    return '<div class="fk-root">' + timerCard() + summaryCard(m) + statsCard(m) + historyCard() + '</div>';
  };

  /* ---------- pembaruan tampilan ---------- */
  var root = function () { return D.querySelector('.ad-ov:not([hidden]) .fk-root'); };
  function refresh() { try { if (root() && MO.acadRender) MO.acadRender(); } catch (e) { } }
  var lastTxt = '';
  function paint() {   /* tiap tick: hanya ubah teks waktu & cincin, tanpa render ulang */
    var r = S.run; if (!r) return;
    var t = D.getElementById('fkTime'); if (!t) return;
    var rem = remMs(), s = mmss(rem); if (s !== lastTxt) { lastTxt = s; t.textContent = s; }
    var rg = D.getElementById('fkRing'); if (rg) rg.style.strokeDashoffset = (CIRC * (rem / (r.plan || 1))).toFixed(1);
  }
  function cfgChanged() { persist(); refresh(); }

  /* ---------- interaksi ---------- */
  var KEYS = { focus: [1, 180], brk: [1, 60], lbrk: [1, 90], every: [2, 8], goal: [0, 720] };
  D.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-fk]') : null; if (!b) return;
    var rt = root(); if (!rt || !rt.contains(b)) return;
    var a = b.dataset.fk, k = b.dataset.k;
    if (a === 'start') return start();
    if (a === 'pause') return pause();
    if (a === 'resume') return resume();
    if (a === 'finish') return finish();
    if (a === 'skip') return skipBreak();
    if (a === 'cfg') { UI.cfgOpen = UI.cfgOpen ? 0 : 1; return refresh(); }
    if (a === 'rng') { UI.rng = b.dataset.v; return refresh(); }
    if (a === 'more') { UI.hist += 20; return refresh(); }
    if (a === 'preset') { S.cfg.focus = +b.dataset.v; return cfgChanged(); }
    if (a === 'tog') { S.cfg[k] = S.cfg[k] ? 0 : 1; return cfgChanged(); }
    if (a === 'inc' || a === 'dec') { var lim = KEYS[k], step = k === 'goal' ? 15 : 1; S.cfg[k] = clamp(S.cfg[k] + (a === 'inc' ? step : -step), lim[0], lim[1]); return cfgChanged(); }
  });
  D.addEventListener('change', function (e) {
    var t = e.target, k = t.dataset ? t.dataset.fkin : null; if (!k || !root() || !root().contains(t)) return;
    if (k === 'cid') { UI.cid = t.value; if (t.value) { S.cfg.last = t.value; persist(); } return refresh(); }
    if (k === 'hf') { UI.hf = t.value; UI.hist = 15; return refresh(); }
    if (KEYS[k]) { S.cfg[k] = clamp(t.value, KEYS[k][0], KEYS[k][1]); return cfgChanged(); }
  });
  D.addEventListener('input', function (e) { var t = e.target; if (t.dataset && t.dataset.fkin === 'topic') UI.topic = t.value; });

  /* ---------- mulai ---------- */
  MO.study = { state: function () { return S; }, start: start, pause: pause, resume: resume, finish: finish, stats: function () { return byDay(); } };
  var go = function () { settle(); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', go); else go();
})();
