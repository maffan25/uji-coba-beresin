/* smart.js (v5.0) — Smart Planner + Smart Insight.
   Planner : membaca jadwal TETAP (kuliah, ujian, rapat, acara berjam) dan pekerjaan FLEKSIBEL (tugas kuliah, tugas kerja, Task,
             tindak lanjut organisasi, tugas proyek, persiapan ujian), lalu menyusun blok waktu yang realistis:
             tidak menabrak jadwal tetap, memberi jeda & makan, membatasi beban harian, menaruh kerja berat di jam fokus,
             belajar ujian mendekati hari-H (termasuk review subuh bila ujian pagi), dan mendahulukan tugas kuliah dari organisasi.
   Insight : analisis & saran lintas modul + per menu (tabrakan, risiko tenggat, saran tunda/izin rapat lewat simulasi "bagaimana jika",
             beban hari, keuangan, serta kelancaran/kecepatan aplikasi: ukuran penyimpanan, gambar besar, data menumpuk).
   Keamanan: hanya MEMBACA data modul. Satu-satunya penulisan = acara Kalender buatan planner (ditandai sp:1, bisa dihapus/diurungkan)
             dan pengaturan milik sendiri di 'mo-smart-v1'. Semua perhitungan berjalan hanya saat dibuka (tanpa pengamat DOM berat). */
(function () {
  'use strict';
  var D = document, root = D.documentElement, MO = window.MyOffice = window.MyOffice || {};
  if (MO.smart) return;
  var KEY = 'mo-smart-v1';

  /* ================= util ================= */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var addDay = function (s, n) { var a = s.split('-'); return ymd(new Date(+a[0], a[1] - 1, +a[2] + n, 12)); };
  var dayDiff = function (a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+x[0], x[1] - 1, +x[2]) - Date.UTC(+y[0], y[1] - 1, +y[2])) / 864e5); };
  var wdOf = function (s) { var a = s.split('-'); return new Date(+a[0], a[1] - 1, +a[2], 12).getDay(); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var tmin = function (t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  var hm = function (m) { m = Math.max(0, Math.round(m)); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); };
  var c15 = function (m) { return Math.ceil(m / 15 - 1e-9) * 15; }, f15 = function (m) { return Math.floor(m / 15 + 1e-9) * 15; };
  var dur = function (m) { m = Math.round(m); if (m < 60) return m + ' mnt'; var h = Math.floor(m / 60), r = m % 60; return h + ' j' + (r ? ' ' + r + ' mnt' : ''); };
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HR = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], HS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var fd = function (s) { var a = s.split('-'); return +a[2] + ' ' + BLN[a[1] - 1]; };
  var rp = function (n) { return 'Rp ' + Math.round(+n || 0).toLocaleString('id-ID'); };
  var today = function () { return ymd(new Date()); };
  function dlabel(d, td) {
    td = td || today(); var n = dayDiff(d, td);
    return n === 0 ? 'hari ini' : n === 1 ? 'besok' : n === 2 ? 'lusa' : n === -1 ? 'kemarin' : n < 0 ? -n + ' hari lalu' : HR[wdOf(d)] + ' ' + fd(d);
  }
  var cap1 = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var parseDT = function (v) { var m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(String(v || '')); return m ? { d: m[1], t: m[2] != null ? pad(+m[2]) + ':' + m[3] : '' } : null; };
  var tsOf = function (d, min) { var a = d.split('-'); return new Date(+a[0], a[1] - 1, +a[2], Math.floor(min / 60), min % 60).getTime(); };
  var DONE = /^(Selesai|Done|Tercapai|Completed)$/i, CANC = /^(Dibatalkan|Archived|Batal|Cancelled)$/i;
  var fin = function (s) { return DONE.test(s || '') || CANC.test(s || ''); };
  var has = function (v) { return v !== '' && v != null; };

  /* ================= pengaturan & status milik planner ================= */
  var DEF = { wake: '05:00', sleep: '22:30', peak: 'pagi', cap: 360, meals: 1, hor: 7, buf: 15 };
  var S = (function () {
    var o; try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
    o = o && typeof o === 'object' ? o : {}; o.cfg = Object.assign({}, DEF, o.cfg || {}); o.ov = o.ov || {}; o.dis = o.dis || {}; o.ap = o.ap || null; return o;
  })();
  var saveS = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  var PEAK = { pagi: [360, 660, 'pagi (06–11)'], siang: [660, 900, 'siang (11–15)'], malam: [1140, 1320, 'malam (19–22)'] };

  /* ================= akses data modul (hanya baca) ================= */
  var STORES = { task: 'mo-task-v1', cal: 'mo-cal-v1', work: 'mo-work-v1', org: 'mo-org-v1', proj: 'mo-proj-v1', goal: 'mo-goal-v1', acad: 'mo-acad-v1', fin: 'mo-fin-v1', docs: 'mo-docs-v1' };
  var FB = {};
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function data(sk) {
    if (sk === 'acad') { if (MO.acadData) return MO.acadData.D() || {}; }
    else { var ap = MO.apps && MO.apps[STORES[sk]]; if (ap) return ap.D || {}; }
    return FB[sk] || (FB[sk] = lsGet(STORES[sk]));
  }

  /* ================= parser jadwal kuliah ================= */
  var DAYRX = /\b(minggu|ahad|senin|selasa|rabu|kamis|jumat|sabtu)\b/g, DAYN = { minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
  var RANGE = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|s\/d|sd|sampai|hingga)\s*(\d{1,2})(?:[:.](\d{2}))?/, ONE = /(?:jam|pukul)?\s*(\d{1,2})[:.](\d{2})/;
  function parseSched(str, sks) {
    var s = String(str || '').toLowerCase().replace(/['’`]/g, ''), ms = [], m, out = [], pend = [];
    DAYRX.lastIndex = 0; while ((m = DAYRX.exec(s))) ms.push({ wd: DAYN[m[1]], i: m.index, j: m.index + m[0].length });
    var dflt = (+sks > 0 ? +sks : 2) * 50;
    ms.forEach(function (d, k) {
      var seg = s.slice(d.j, k + 1 < ms.length ? ms[k + 1].i : s.length), cut = seg.search(/[;\n]/); if (cut > -1) seg = seg.slice(0, cut);
      pend.push(d.wd);
      var a = null, b = null, r = RANGE.exec(seg), o;
      if (r && +r[1] < 24 && +r[3] < 24 && (r[2] || r[4] || r[0].indexOf(':') > -1 || r[0].indexOf('.') > -1 || (+r[3] > +r[1]))) { a = +r[1] * 60 + (+r[2] || 0); b = +r[3] * 60 + (+r[4] || 0); if (b <= a) b = a + dflt; }
      else if ((o = ONE.exec(seg)) && +o[1] < 24) { a = +o[1] * 60 + +o[2]; b = a + dflt; }
      if (a != null) { pend.forEach(function (w) { out.push({ wd: w, s: a, e: b }); }); pend = []; }
    });
    return out;
  }
  var exDur = function (type) { return /kuis|quiz/i.test(type) ? 30 : /presentasi/i.test(type) ? 45 : /uts|uas|ujian|sidang|ujikom|final|midterm/i.test(type || '') ? 120 : 90; };

  /* ================= kumpulkan jadwal tetap & pekerjaan fleksibel ================= */
  var RXU = /\b(ujian|uts|uas|ujikom|kuis|quiz|ulangan|exam|midterm|sidang)\b/i, RXP = /\b(presentasi|presentation|pitch|seminar|sempro|semhas|defense)\b/i, RXM = /\b(rapat|meeting|musyawarah|pleno|briefing|koordinasi|syuro|rakor|sidang pleno|evaluasi)\b/i;
  function evKind(e) { var t = String(e.title || ''); return e.kind === 'ujian' || RXU.test(t) ? 'exam' : e.kind === 'presentasi' || RXP.test(t) ? 'present' : RXM.test(t) ? 'meeting' : 'event'; }
  var DIFF = { mudah: [90, 'Mudah'], sedang: [180, 'Sedang'], sulit: [300, 'Sulit'] };
  var START = { mudah: 3, sedang: 5, sulit: 7 };

  function gather(H) {
    var cfg = S.cfg, now = new Date(), td = ymd(now), dates = [], i;
    for (i = 0; i < H; i++) dates.push(addDay(td, i));
    var sleepE = (tmin(cfg.sleep) || 1350) - 45;
    var A = data('acad'), C = data('cal'), T = data('task'), W = data('work'), O = data('org'), P = data('proj');
    var G = { now: now, td: td, dates: dates, H: H, fixed: [], jobs: [], info: [], noSched: [], skipped: [], noDate: 0, notes: [] };
    var inH = function (d) { return d >= dates[0] && d <= dates[H - 1]; }, ovr = function (k) { return S.ov[k] || {}; };
    var fx = function (o) { G.fixed.push(o); };

    function addJob(o) {
      var ov = ovr(o.key);
      if (ov.skip) { G.skipped.push(o); return; }
      o.est0 = o.min; if (+ov.est > 0) o.min = +ov.est; o.min = Math.max(15, c15(o.min));
      o.dlTs = o.dlDate ? tsOf(o.dlDate, o.dlTime ? tmin(o.dlTime) : sleepE) : null;
      o.late = !!(o.dlTs && o.dlTs < now.getTime() - 60000);
      G.jobs.push(o);
    }

    /* kuliah */
    var cs = {}, sems = A.sem || [], semAct = {};
    sems.forEach(function (s) { if (s.active) semAct[s.id] = 1; });
    var anyAct = Object.keys(semAct).length > 0;
    (A.course || []).forEach(function (c) {
      cs[c.id] = c;
      if (anyAct && c.semId && !semAct[c.semId]) return;
      var sc = parseSched(c.schedule, c.sks);
      if (!sc.length) { G.noSched.push(c); return; }
      dates.forEach(function (d) {
        var wd = wdOf(d);
        sc.forEach(function (q) { if (q.wd === wd) fx({ id: 'cls:' + c.id + ':' + d + ':' + q.s, kind: 'class', mod: 'Kuliah', title: c.name, date: d, s: q.s, e: q.e, loc: c.room || '', route: '#academic', tab: 'dash' }); });
      });
    });

    /* persiapan ujian (dipakai ujian Academic & acara Kalender berjenis ujian) */
    var studied = {}; (A.study || []).forEach(function (x) { if (x.courseId && x.date && dayDiff(td, x.date) >= 0 && dayDiff(td, x.date) <= 7) studied[x.courseId] = (studied[x.courseId] || 0) + (+x.minutes || 0); });
    function prep(key, label, courseId, type, date, s, noT, ref) {
      var c = cs[courseId] || {}, ov = ovr(key), xd = dayDiff(date, td);
      if (xd < 0 || (xd === 0 && !noT && s - (now.getHours() * 60 + now.getMinutes()) < 60)) return;
      var sc = (/uas|final/i.test(type) ? 3 : /kuis|quiz/i.test(type) ? 1 : 2) + (+c.sks >= 3 ? 1 : 0), dg = sc <= 1 ? 'mudah' : sc === 2 ? 'sedang' : 'sulit';
      if (/presentasi/i.test(type)) dg = ov.diff ? ov.diff : 'sedang';
      var df = DIFF[ov.diff] ? ov.diff : dg, base = DIFF[df][0], cred = c.id && studied[c.id] ? Math.round(studied[c.id] * 0.8) : 0;
      var need = Math.max(45, base - cred);
      if (xd > START[df]) { G.notes.push({ k: 'prepLater', label: label, date: date, from: addDay(date, -START[df]), df: df, key: key }); return; }
      var job = { key: key, id: key, title: (/presentasi/i.test(type) ? 'Latihan ' : 'Belajar ') + label, label: label, mod: 'Ujian', cat: 'exam', exam: true, deep: true, w: 100 + (df === 'sulit' ? 5 : 0), min: need, maxC: 60, minC: 30, dlDate: date, dlTime: noT ? '' : hm(s), xs: s, xd: xd, df: df, df0: dg, cred: cred, noT: noT, route: '#academic', tab: 'exam', ref: ref };
      addJob(job);
      var j = G.jobs[G.jobs.length - 1]; if (j === job) { job.dlTs = tsOf(date, s); job.late = false; }
    }

    var exSeen = [];
    (A.exam || []).forEach(function (x) {
      if (x.done || (has(x.score))) return;
      var p = parseDT(x.date); if (!p || p.d < td) return;
      var c = cs[x.courseId] || {}, s = tmin(p.t), noT = s == null; if (noT) s = 480;
      var type = x.type || 'Ujian', label = type + ' · ' + (c.name || 'Mata kuliah');
      exSeen.push({ d: p.d, c: x.courseId, n: String(c.name || '').toLowerCase() });
      if (inH(p.d)) fx({ id: 'exm:' + x.id, kind: /presentasi/i.test(type) ? 'present' : 'exam', mod: type, title: c.name ? type + ' — ' + c.name : type, date: p.d, s: s, e: s + exDur(type), loc: x.room || '', approx: noT, route: '#academic', tab: 'exam' });
      prep('prep:' + x.id, label, x.courseId, type, p.d, s, noT, { sk: 'acad', arr: 'exam', id: x.id });
    });

    /* kalender */
    (C.ev || []).forEach(function (e) {
      if (e.tk || e.ax || e.sp || !e.start) return;
      var d = String(e.start).slice(0, 10), ed = String(e.end || e.start).slice(0, 10); if (ed < td) return;
      var kd = evKind(e), tm = e.allDay ? null : tmin(e.startTime), title = String(e.title || 'Acara');
      var dup = exSeen.some(function (x) { return x.d === d && ((e.courseId && x.c === e.courseId) || (x.n && title.toLowerCase().indexOf(x.n) > -1)); });
      if (kd === 'exam' && !dup && ed === d) prep('prep:cal:' + e.id, title, e.courseId, title, d, tm == null ? 480 : tm, tm == null, { sk: 'cal', arr: 'ev', id: e.id });
      if (!inH(d) && !inH(ed)) return;
      if (tm == null || ed !== d) { G.info.push({ date: inH(d) ? d : dates[0], title: title, kind: kd, until: ed !== d ? ed : '' }); return; }
      var en = tmin(e.endTime); if (en == null || en <= tm) en = tm + 60;
      fx({ id: 'cal:' + e.id, kind: kd === 'meeting' ? 'meeting' : kd, movable: kd === 'meeting', mod: kd === 'meeting' ? 'Rapat' : kd === 'exam' ? 'Ujian' : kd === 'present' ? 'Presentasi' : 'Acara', title: title, date: d, s: tm, e: en, loc: e.location || '', route: '#calendar' });
    });

    /* rapat organisasi (hanya tanggal → jam diasumsikan malam, bisa diatur) */
    var orgN = {}; (O.org || []).forEach(function (o) { orgN[o.id] = o.name; });
    (O.meeting || []).forEach(function (m) {
      var p = parseDT(m.date); if (!p || !inH(p.d)) return;
      var key = 'org:meeting:' + m.id, o = ovr(key), s = tmin(o.time), approx = false;
      if (s == null) s = tmin(p.t);
      if (s == null) { s = 1170; approx = true; }
      fx({ id: 'mtg:' + m.id, key: key, kind: 'meeting', movable: true, approx: approx, mod: 'Rapat', title: m.title || 'Rapat', org: orgN[m.orgId] || '', date: p.d, s: s, e: s + (+o.dur > 0 ? +o.dur : 90), route: '#organization' });
    });

    /* Task: acara berjam = tetap, to-do = fleksibel */
    var estT = function (t) {
      if (+t.estMin > 0) return +t.estMin;
      var c = String(t.category || ''); if (/belajar/i.test(c)) return 60; if (/kerja/i.test(c)) return 90; if (/admin/i.test(c)) return 30; if (/rapat/i.test(c)) return 30;
      return t.kind === 'project' ? 120 : t.priority === 'High' ? 60 : t.priority === 'Low' ? 30 : 45;
    };
    (T.task || []).forEach(function (t) {
      if (fin(t.status) || t.parentId) return;
      if (t.kind === 'event') {
        if (!t.due || !inH(t.due)) return; var s = tmin(t.dueTime);
        if (s == null) { G.info.push({ date: t.due, title: t.title, kind: 'event' }); return; }
        var en = tmin(t.endTime); if (en == null || en <= s) en = s + 60;
        fx({ id: 'tke:' + t.id, kind: RXM.test(t.title || '') || /rapat/i.test(t.category || '') ? 'meeting' : 'event', movable: RXM.test(t.title || ''), mod: 'Agenda', title: t.title, date: t.due, s: s, e: en, route: '#task' });
        return;
      }
      if (!t.due) { G.noDate++; return; }
      if (dayDiff(t.due, td) > H + 7) return;
      var pr = t.priority === 'High' ? 65 : t.priority === 'Low' ? 30 : 45;
      addJob({ key: 'task:' + t.id, id: 'task:' + t.id, title: t.title, mod: 'Task', cat: 'task', deep: /belajar|kerja/i.test(t.category || '') || t.kind === 'project', w: t.kind === 'project' ? Math.max(pr, 55) : pr, min: estT(t), maxC: 90, minC: 30, dlDate: t.due, dlTime: t.dueTime || '', route: '#task', ref: { sk: 'task', arr: 'task', id: t.id }, st: t.status === 'In Progress' });
    });

    /* tugas kuliah */
    var estA = function (x) {
      var ty = String(x.type || ''), m = /makalah|paper|jurnal|skripsi|proposal|artikel/i.test(ty) ? 180 : /proyek|project|portofolio/i.test(ty) ? 210 : /laporan|report|praktikum/i.test(ty) ? 135 : /presentasi|ppt|slide/i.test(ty) ? 105 : /kuis|quiz/i.test(ty) ? 45 : 75, f = 1;
      if (+x.weight >= 20) f += 0.15; if (x.priority === 'Tinggi') f += 0.1; else if (x.priority === 'Rendah') f -= 0.15; if (x.status === 'Sedang dikerjakan') f -= 0.35;
      return Math.max(30, Math.round(m * f / 15) * 15);
    };
    (A.task || []).forEach(function (x) {
      if (fin(x.status) || x.done || !x.deadline) return;
      var p = parseDT(x.deadline); if (!p || dayDiff(p.d, td) > H + 7) return;
      var c = cs[x.courseId];
      addJob({ key: 'acad:task:' + x.id, id: 'acad:task:' + x.id, title: x.title, mod: 'Tugas kuliah', cat: 'kuliah', sub: c && c.name, deep: true, w: 85 + (x.priority === 'Tinggi' ? 5 : x.priority === 'Rendah' ? -5 : 0), min: estA(x), maxC: 90, minC: 30, dlDate: p.d, dlTime: p.t, route: '#academic', tab: 'task', ref: { sk: 'acad', arr: 'task', id: x.id }, st: x.status === 'Sedang dikerjakan' });
    });

    /* kerja */
    (W.job || []).forEach(function (j) {
      if (fin(j.status) || !j.deadline) return;
      var p = parseDT(j.deadline); if (!p || dayDiff(p.d, td) > H + 7) return;
      var inc = +j.income > 0, review = /review/i.test(j.status || '');
      addJob({ key: 'work:job:' + j.id, id: 'work:job:' + j.id, title: j.title, mod: 'Pekerjaan', cat: 'kerja', deep: true, w: 60 + (inc ? 10 : 0) + (+j.income >= 1000000 ? 5 : 0), min: review ? 45 : 150, maxC: 90, minC: 30, dlDate: p.d, dlTime: p.t, route: '#work', ref: { sk: 'work', arr: 'job', id: j.id } });
    });
    (W.wtask || []).forEach(function (x) {
      if (fin(x.status) || !x.deadline) return;
      var p = parseDT(x.deadline); if (!p || dayDiff(p.d, td) > H + 7) return;
      addJob({ key: 'work:wtask:' + x.id, id: 'work:wtask:' + x.id, title: x.title, mod: 'Tugas kerja', cat: 'kerja', deep: true, w: 62, min: 75, maxC: 75, minC: 30, dlDate: p.d, dlTime: p.t, route: '#work', ref: { sk: 'work', arr: 'wtask', id: x.id } });
    });
    /* organisasi & proyek */
    (O.followup || []).forEach(function (f) {
      if (fin(f.status) || !f.due) return; var p = parseDT(f.due); if (!p || dayDiff(p.d, td) > H + 7) return;
      addJob({ key: 'org:followup:' + f.id, id: 'org:followup:' + f.id, title: f.task, mod: 'Organisasi', cat: 'org', deep: false, w: 45, min: 45, maxC: 45, minC: 15, dlDate: p.d, dlTime: p.t, route: '#organization', ref: { sk: 'org', arr: 'followup', id: f.id } });
    });
    (P.ptask || []).forEach(function (x) {
      if (fin(x.status) || !x.due) return; var p = parseDT(x.due); if (!p || dayDiff(p.d, td) > H + 7) return;
      addJob({ key: 'proj:ptask:' + x.id, id: 'proj:ptask:' + x.id, title: x.title, mod: 'Tugas proyek', cat: 'proyek', deep: true, w: 55, min: 60, maxC: 90, minC: 30, dlDate: p.d, dlTime: p.t, route: '#project', ref: { sk: 'proj', arr: 'ptask', id: x.id } });
    });
    return G;
  }

  /* ================= mesin penjadwal ================= */
  function sub(list, a, b) {
    var out = [];
    list.forEach(function (iv) { if (b <= iv[0] || a >= iv[1]) { out.push(iv); return; } if (a > iv[0]) out.push([iv[0], a]); if (b < iv[1]) out.push([b, iv[1]]); });
    return out;
  }
  function eCost(job, a, b) {
    var mid = (a + b) / 2, p = PEAK[S.cfg.peak] || PEAK.pagi, c;
    function away(lo, hi) { var d = mid < lo ? lo - mid : mid > hi ? mid - hi : 0; return Math.min(14, d / 30 * 1.2); }
    if (job.deep) {
      c = away(p[0], p[1]); if (mid >= 780 && mid <= 870) c += 5;
      if (job.exam) c = Math.min(c, away(1140, 1290)); else if (mid >= 1290) c += 6;
    } else c = Math.min(8, (mid < 780 ? 780 - mid : mid > 1050 ? mid - 1050 : 0) / 30);
    return c;
  }
  var CAPL = { kuliah: 'Tugas kuliah', kerja: 'Pekerjaan', org: 'Organisasi', task: 'Task', proyek: 'Proyek', exam: 'Ujian' };

  function plan(opt) {
    opt = opt || {};
    var cfg = S.cfg, H = Math.max(3, Math.min(14, +cfg.hor || 7)), G = opt.G || gather(H);
    var wake = tmin(cfg.wake); if (wake == null) wake = 300;
    var sleep = tmin(cfg.sleep); if (sleep == null) sleep = 1350;
    var dStart = wake + 15, dEnd = sleep - 45, buf = +cfg.buf || 0, nowMin = G.now.getHours() * 60 + G.now.getMinutes();
    var meals = cfg.meals ? [[720, 765, 'Makan siang'], [1065, 1125, 'Maghrib & makan malam']] : [];
    var fixed = G.fixed.filter(function (f) { return !(opt.skip && opt.skip[f.id]); });
    var awake = Math.max(300, dEnd - dStart - meals.reduce(function (a, m) { return a + m[1] - m[0]; }, 0));

    var days = G.dates.map(function (d, i) {
      var day = { date: d, idx: i, fixed: [], sess: [], brk: [], free: [], fixedMin: 0, planMin: 0, cap: 0 };
      day.fixed = fixed.filter(function (f) { return f.date === d; }).sort(function (a, b) { return a.s - b.s; });
      var lo = dStart; if (i === 0) lo = Math.max(lo, c15(nowMin + 10));
      var free = lo < dEnd ? [[lo, dEnd]] : [];
      meals.forEach(function (m) { day.brk.push({ s: m[0], e: m[1], title: m[2] }); free = sub(free, m[0], m[1]); });
      day.fixed.forEach(function (f) { day.fixedMin += f.e - f.s; free = sub(free, f.s - (f.kind === 'exam' ? Math.max(buf, 30) : buf), f.e + 10); });
      day.free = free; day.cap = Math.max(90, Math.min(+cfg.cap || 360, (+cfg.cap || 360) - 0.3 * day.fixedMin));
      day.allDay = G.info.filter(function (x) { return x.date === d && !x.until; });
      if (day.allDay.some(function (x) { return !/libur|cuti|holiday/i.test(x.title || ''); })) day.cap = Math.max(90, day.cap * 0.6);
      return day;
    });

    var nowTs = G.now.getTime();
    var jobs = G.jobs.map(function (j) {
      var c = Object.assign({}, j); c.left = c.min; c.by = {}; c.sess = [];
      var dd = c.dlDate ? dayDiff(c.dlDate, G.td) : H - 1;
      c.dlDay = c.late ? 0 : Math.max(0, dd);
      c.hrs = c.dlTs ? (c.dlTs - nowTs) / 36e5 : 999; c.crit = c.hrs <= 36;
      c.latestDay = c.late ? Math.min(H - 1, 2) : Math.min(H - 1, c.dlDay);
      if (c.dlDay <= H - 1 || c.late) {
        c.latest = c.late ? dEnd : c.exam ? c.xs - 30 : Math.min(dEnd, (c.dlTime ? tmin(c.dlTime) - 15 : dEnd));
        if (c.late) c.w += 25;
      } else c.latest = null;
      c.key2 = c.late ? -1000 - c.w * 0.3 + c.hrs / 1000 : c.hrs - c.w * 0.3;
      return c;
    }).sort(function (a, b) { return a.key2 - b.key2; });

    function slotCost(job, di, s, e, extra) {
      var day = days[di];
      var c = eCost(job, s, e) + day.planMin / day.cap * 14;
      var bd = job.by[di] || 0; c += bd >= job.maxC ? 60 : bd > 0 ? 10 : 0;
      if (job.deep) day.sess.forEach(function (x) { if (x.deep && x.e > s - 45 && x.s < e + 45) c += 5; });   /* hindari kerja berat beruntun tanpa jeda */
      return c + (extra || 0);
    }
    function best(job, L, dayList, pf) {
      var bt = null;
      dayList.forEach(function (di) {
        var day = days[di], room = (job.crit || job.late ? day.cap * 1.25 : day.cap) - day.planMin;
        if (room < L - 1e-6) return;
        day.free.forEach(function (iv) {
          var lo = iv[0], hi = iv[1];
          if (job.latest != null && di === job.latestDay) hi = Math.min(hi, job.latest);
          for (var s = c15(lo); s + L <= hi; s += 15) {
            var c = pf ? pf(di, s, s + L) : (job.exam ? 0 : di * 4) + slotCost(job, di, s, s + L);
            if (!bt || c < bt.c - 1e-9) bt = { c: c, di: di, s: s, e: s + L };
          }
        });
      });
      return bt;
    }
    function why(job, di, s, e) {
      var a = [], p = PEAK[cfg.peak] || PEAK.pagi, mid = (s + e) / 2;
      if (job.exam) { var k = job.dlDay - di; a.push(k <= 0 ? 'Review sebelum ujian' : k === 1 ? 'H-1 ujian' : 'H-' + k + ' ujian'); }
      else if (job.late) a.push('Lewat tenggat — dahulukan');
      else a.push('Tenggat ' + dlabel(job.dlDate, G.td) + (job.dlTime ? ' ' + job.dlTime : ''));
      if (job.deep && mid >= p[0] && mid <= p[1]) a.push('jam fokus ' + cfg.peak);
      else if (!job.deep && mid >= 780 && mid <= 1050) a.push('jam santai siang-sore');
      return a.join(' · ');
    }
    function put(job, b, part) {
      var day = days[b.di], L = b.e - b.s, gap = L >= 60 ? 10 : 5;
      day.free = sub(day.free, b.s - gap, b.e + gap); day.planMin += L; job.by[b.di] = (job.by[b.di] || 0) + L; job.left -= L;
      var se = { id: job.id + '#' + job.sess.length, job: job.id, key: job.key, title: job.title, mod: job.mod, cat: job.cat, sub: job.sub || '', date: day.date, s: b.s, e: b.e, why: why(job, b.di, b.s, b.e), exam: !!job.exam, deep: !!job.deep, part: part || '', route: job.route, tab: job.tab || '' };
      job.sess.push(se); day.sess.push(se);
    }
    function chunks(job, dayList, rem, pf, maxL) {
      var guard = 0, mx = maxL || job.maxC, mc = Math.min(job.minC, rem);
      while (rem >= 15 && guard++ < 40) {
        var L = Math.min(mx, rem); if (rem - L > 0 && rem - L < mc) L = rem;
        L = Math.max(15, f15(L));
        var b = best(job, L, dayList, pf), l2 = L;
        while (!b && l2 > mc) { l2 = Math.max(mc, f15(l2 - 15)); b = best(job, l2, dayList, pf); if (l2 <= mc) break; }
        if (!b) break;
        put(job, b); rem -= b.e - b.s;
      }
      return rem;
    }

    jobs.forEach(function (job) {
      if (!job.exam) {
        var dl = []; for (var di = 0; di <= job.latestDay; di++) dl.push(di);
        /* tenggat jauh di luar horizon → hanya jatah proporsional di horizon */
        var tgt = job.left;
        if (job.dlDay > H - 1) { var f = Math.min(1, H / Math.max(H, job.dlDay + 1)); tgt = Math.max(0, c15(job.left * f)); if (tgt < 30 && job.left >= 30) tgt = 0; }
        chunks(job, dl, tgt); job.left = Math.max(0, tgt - (job.min - job.left)); return;
      }
      /* ---- persiapan ujian ---- */
      var xd = job.dlDay, xs = job.xs, total = job.left, pre = [], k, di2;
      var st0 = Math.max(0, xd - START[job.df]), lastDay = Math.min(H - 1, xd - 1), wsum = 0, ws = {};
      for (di2 = st0; di2 <= lastDay; di2++) {
        var fr = days[di2].free.reduce(function (a, iv) { return a + iv[1] - iv[0]; }, 0);
        if (fr < 30 || days[di2].cap - days[di2].planMin < 30) continue;
        k = xd - di2; ws[di2] = 1 / (k + 0.6); wsum += ws[di2]; pre.push(di2);
      }
      /* a. pagi hari-H (subuh bila ujian pagi): sesi review pendek sebelum berangkat */
      var placedMorning = 0;
      if (xd <= H - 1) {
        var win = xs - 30 - dStart, mmin = xd === 0 ? Math.min(total, 120) : (total >= 90 ? (xs < 720 ? 45 : 90) : 0);
        mmin = Math.min(mmin, f15(win));
        if (mmin >= 30) {
          var left0 = job.left;
          chunks(job, [xd], mmin, function (di, s, e) { return (job.latest - e) / 15 + slotCost(job, di, s, e) * 0.2; }, xd === 0 ? 60 : 45);
          placedMorning = left0 - job.left;
        }
      }
      var rem = job.left;
      if (rem >= 15 && pre.length) {
        var quota = {}, sum = 0;
        pre.forEach(function (d) { quota[d] = Math.max(0, f15(rem * ws[d] / wsum)); sum += quota[d]; });
        var diff = rem - sum; quota[pre[pre.length - 1]] += diff;
        pre.slice().reverse().forEach(function (d) {   /* sesi < 30 mnt tidak berguna → gabungkan ke hari terdekat ujian */
          if (quota[d] > 0 && quota[d] < 30) { var tgt = pre.filter(function (x) { return x !== d && quota[x] >= 30; }).sort(function (a, b) { return b - a; })[0]; if (tgt != null) { quota[tgt] += quota[d]; quota[d] = 0; } }
        });
        var order = pre.slice().sort(function (a, b) { return b - a; });
        order.forEach(function (d) { if (quota[d] >= 15) { var q = chunks(job, [d], quota[d], function (di, s, e) { return slotCost(job, di, s, e); }, 60); } });
        /* sisa → hari mana pun menjelang ujian (terdekat ke ujian dulu) */
        if (job.left >= 15) chunks(job, order, job.left, function (di, s, e) { return (xd - di) * 3 + slotCost(job, di, s, e); }, 60);
      } else if (rem >= 15 && xd <= H - 1) chunks(job, [xd], rem, function (di, s, e) { return (job.latest - e) / 15; }, 60);
      job.left = Math.max(0, job.left);
    });

    /* ---- hasil ---- */
    days.forEach(function (day) {
      day.sess.sort(function (a, b) { return a.s - b.s; });
      day.gaps = []; day.free.forEach(function (iv) { if (iv[1] - iv[0] >= 30) day.gaps.push(iv); });
      day.freeMin = day.gaps.reduce(function (a, g) { return a + g[1] - g[0]; }, 0);
      day.util = (day.fixedMin + day.planMin) / awake;
      day.lvl = day.util > 0.8 ? 'padat' : day.util > 0.55 ? 'sibuk' : day.util > 0.25 ? 'sedang' : 'longgar';
    });
    var conf = [];
    days.forEach(function (day) {
      for (var a = 0; a < day.fixed.length; a++) for (var b = a + 1; b < day.fixed.length; b++) {
        var x = day.fixed[a], y = day.fixed[b], ov = Math.min(x.e, y.e) - Math.max(x.s, y.s);
        if (ov > 0) conf.push({ a: x, b: y, date: day.date, min: ov });
      }
    });
    var unplaced = jobs.filter(function (j) { return j.left >= 15; }).map(function (j) { return { job: j, left: j.left }; });
    return { G: G, H: H, days: days, jobs: jobs, unplaced: unplaced, conflicts: conf, awake: awake, dStart: dStart, dEnd: dEnd, now: G.now, td: G.td, skip: opt.skip || null };
  }

  /* ================= cache rencana ================= */
  var memo = null;
  function getPlan(force) { var t = Date.now(); if (!force && memo && t - memo.t < 4000) return memo.p; var p = plan(); memo = { t: t, p: p }; return p; }
  function invalidate() { memo = null; stMemo = null; insMemo = null; }

  /* ================= analisis penyimpanan (kelancaran aplikasi) ================= */
  var stMemo = null, KMOD = { 'mo-task-v1': 'task', 'mo-cal-v1': 'cal', 'mo-work-v1': 'work', 'mo-org-v1': 'org', 'mo-proj-v1': 'proj', 'mo-goal-v1': 'goal', 'mo-acad-v1': 'acad', 'mo-fin-v1': 'fin', 'mo-docs-v1': 'docs', 'mo-an-v1': 'an', 'mo-settings-v1': 'set' };
  var MODN = { acad: 'Academic', work: 'Work Office', org: 'Organization', proj: 'Project', task: 'Task', cal: 'Kalender', goal: 'Goal', fin: 'Finance', docs: 'Document Center', an: 'Analytics', set: 'Settings', inbox: 'Inbox' };
  function storageInfo() {
    var tot = 0, rows = [], i, k, v, n;
    try { for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); if (!/^mo-/.test(k)) continue; v = localStorage.getItem(k) || ''; n = v.length * 2; tot += n; rows.push({ k: k, n: n, v: v }); } } catch (e) { return { tot: 0, rows: [], imgs: [] }; }
    if (stMemo && stMemo.sig === tot + ':' + rows.length) return stMemo;
    var imgs = [];
    rows.forEach(function (r) {
      if (r.n < 300000) return;
      var m = r.v.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+\/=]{90000,}/g);
      if (m) imgs.push({ k: r.k, n: m.length, bytes: m.reduce(function (a, s) { return a + s.length * 2; }, 0) });
    });
    rows.forEach(function (r) { delete r.v; });
    rows.sort(function (a, b) { return b.n - a.n; });
    return (stMemo = { sig: tot + ':' + rows.length, tot: tot, rows: rows, imgs: imgs });
  }
  var mb = function (n) { return (n / 1048576).toFixed(n < 1048576 * 10 ? 1 : 0).replace('.', ',') + ' MB'; };

  /* ================= Smart Insight ================= */
  var LV = { crit: 0, warn: 1, tip: 2, good: 3 }, insMemo = null;
  function metric(P) { return P.unplaced.reduce(function (a, u) { return a + u.left * (u.job.exam ? 2 : u.job.w >= 80 ? 1.5 : 1); }, 0); }
  function quality(P) {
    var q = 0; P.days.forEach(function (d) { d.sess.forEach(function (s) { var L = s.e - s.s; q += eCost({ deep: s.deep, exam: s.exam }, s.s, s.e) * L / 60 + (s.e > 1275 ? 3 * L / 60 : 0); }); }); return q;
  }
  function deferList(P, j, n) {
    return P.jobs.filter(function (x) { return x !== j && !x.exam && !x.late && x.w < j.w && (!x.dlTs || !j.dlTs || x.dlTs >= j.dlTs - 12 * 36e5) && x.sess.some(function (s) { return !j.dlDate || s.date <= j.dlDate; }); })
      .sort(function (a, b) { return (a.w - b.w) || ((b.dlTs || 0) - (a.dlTs || 0)); }).slice(0, n || 2).map(function (x) { return '“' + x.title + '” (' + x.mod + ')'; });
  }
  function altDay(P, afterDate, m) {
    for (var i = 0; i < P.days.length; i++) {
      var d = P.days[i]; if (d.date <= afterDate) continue;
      var clash = d.fixed.some(function (f) { return Math.min(f.e, 1260) - Math.max(f.s, 1170) > 0; });
      if (!clash && d.util < 0.65) return d;
    }
    return null;
  }

  function insights() {
    if (insMemo && Date.now() - insMemo.t < 4000) return insMemo.v;
    var P = getPlan(), G = P.G, td = P.td, out = [], nowT = P.now.getTime();
    function I(o) { o.ord = LV[o.lvl]; o.m = o.m || []; if (S.dis[o.id] === td) return; out.push(o); }
    var planA = function (d) { return { l: 'Lihat jadwal ' + dlabel(d, td), k: 'plan', d: d }; };
    var sortS = function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.s - b.s; };
    var base = metric(P), baseQ = quality(P);

    /* 1. kesiapan ujian */
    P.jobs.filter(function (j) { return j.exam; }).forEach(function (j) {
      var placed = j.min - j.left, ss = j.sess.slice().sort(sortS), xdesc = dlabel(j.dlDate, td) + (j.noT ? '' : ' ' + j.dlTime), M = ['acad', 'cal', 'task'];
      var acts = [ss[0] ? planA(ss[0].date) : planA(j.dlDate)];
      Object.keys(DIFF).forEach(function (k) { if (k !== j.df) acts.push({ l: 'Anggap ' + DIFF[k][1].toLowerCase(), k: 'diff', key: j.key, v: k }); });
      if (j.left >= 15) {
        var df = deferList(P, j, 2);
        I({ id: 'ex-short:' + j.key, lvl: 'crit', ico: '📕', m: M, a: acts, t: 'Waktu belajar ' + j.label + ' kurang ' + dur(j.left),
          x: 'Idealnya ±' + dur(j.min) + ' (' + DIFF[j.df][1].toLowerCase() + '), tetapi baru muat ' + dur(placed) + ' sebelum ujian ' + xdesc + '. Mulai belajar sekarang dengan materi inti' + (df.length ? ', dan tunda dulu ' + df.join(' & ') : '') + '.' });
      } else if (ss.length) {
        var morn = ss.filter(function (s) { return s.date === j.dlDate; })[0], near = j.dlDay <= 1;
        I({ id: 'ex-ok:' + j.key, lvl: near ? 'warn' : 'tip', ico: '📖', m: M, a: acts, t: 'Rencana belajar ' + j.label + ' · ' + ss.length + ' sesi',
          x: 'Ujian ' + xdesc + '. Total ' + dur(placed) + ' (tingkat ' + DIFF[j.df][1].toLowerCase() + (j.cred ? ', sudah dikurangi ' + dur(j.cred) + ' jam belajar tercatat' : '') + '). Mulai ' + dlabel(ss[0].date, td) + ' ' + hm(ss[0].s) + (morn ? ', ditutup review ' + hm(morn.s) + ' sebelum berangkat' : '') + '. Ubah tingkat kesulitan bila materinya lebih berat/ringan.' });
      }
    });
    G.notes.filter(function (n) { return n.k === 'prepLater'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 2).forEach(function (n) {
      I({ id: 'ex-later:' + n.key, lvl: 'tip', ico: '🗓️', m: ['acad', 'cal'], t: n.label + ' · ' + dlabel(n.date, td), x: 'Planner mulai menjadwalkan belajar ' + dlabel(n.from, td) + ' (tingkat ' + DIFF[n.df][1].toLowerCase() + '). Isi jam ujian bila belum ada agar jadwalnya tepat.', a: [{ l: 'Buka Ujian', k: 'go', r: '#academic', tab: 'exam' }] });
    });

    /* 2. rapat vs ujian/tenggat (simulasi "bagaimana jika" tanpa rapat) */
    G.fixed.filter(function (f) { return f.kind === 'meeting' && f.movable && dayDiff(f.date, td) <= 3 && tsOf(f.date, f.e) > nowT; }).forEach(function (m) {
      var sk = {}; sk[m.id] = 1; var P2 = plan({ G: G, skip: sk }), gain = base - metric(P2), qg = baseQ - quality(P2);
      var rel = P.jobs.filter(function (j) { return j.exam && j.dlTs && j.dlTs > tsOf(m.date, m.s) - 36e5; }).sort(function (a, b) { return a.dlTs - b.dlTs; })[0] || P.unplaced.map(function (u) { return u.job; })[0];
      var hrsTo = rel && rel.dlTs ? (rel.dlTs - tsOf(m.date, m.s)) / 36e5 : 999, when = dlabel(m.date, td) + ' ' + hm(m.s) + '–' + hm(m.e);
      var alt = rel ? altDay(P, rel.dlDate, m) : null, altTxt = alt ? ' Alternatif: pindah ke ' + dlabel(alt.date, td) + ' 19:30 (hari itu longgar).' : '';
      var acts = [planA(m.date), { l: 'Buka sumber', k: 'go', r: m.route }];
      if (gain >= 30 || (qg >= 10 && rel && rel.exam && hrsTo < 36)) {
        I({ id: 'mt-whatif:' + m.id, lvl: gain >= 60 ? 'crit' : 'warn', ico: '🤝', m: ['org', 'cal', 'acad', 'task'], a: acts, t: 'Pertimbangkan tunda atau izin rapat “' + m.title + '”',
          x: gain >= 30
            ? (rel ? cap1(rel.label || rel.title) + ' ' + dlabel(rel.dlDate, td) + (rel.dlTime ? ' ' + rel.dlTime : '') + ' butuh waktu yang bertabrakan dengan rapat ' + when + '. ' : 'Rapat ' + when + ' memakan jam kerja penting. ') + 'Tanpa rapat ini, ' + dur(gain) + ' pekerjaan prioritas yang kini tidak muat bisa dijadwalkan.' + altTxt + ' Kirim izin lebih awal agar panitia sempat menyesuaikan.'
            : 'Rapat ' + when + (rel ? ' berakhir ±' + Math.max(1, Math.round(hrsTo)) + ' jam sebelum ' + rel.label + ' (' + dlabel(rel.dlDate, td) + (rel.dlTime ? ' ' + rel.dlTime : '') + ')' : '') + ' dan membuat sesi belajar terdorong ke jam kurang ideal atau mepet waktu tidur. Bila rapat tidak mendesak, minta tunda atau izin; kalau harus hadir, usahakan singkat.' + altTxt });
      } else if (rel && rel.exam && hrsTo >= 0 && hrsTo < 14 && rel.df !== 'mudah') {
        I({ id: 'mt-near:' + m.id, lvl: 'tip', ico: '🤝', m: ['org', 'cal', 'acad'], a: acts, t: 'Rapat “' + m.title + '” dekat dengan ujian', x: 'Jarak rapat (' + when + ') ke ' + rel.label + ' hanya ±' + Math.round(hrsTo) + ' jam. Rencana belajar masih muat, tetapi batasi durasi rapat atau hadir singkat supaya tidur tidak terpotong.' });
      }
    });

    /* 3. risiko tenggat */
    var un = P.unplaced.filter(function (u) { return !u.job.exam && !u.job.late; }).sort(function (a, b) { return a.job.key2 - b.job.key2; });
    var lastD = P.days[P.days.length - 1].date;
    if (un.length >= 3) {
      var tot = un.reduce(function (a, u) { return a + u.left; }, 0), first = un[0].job;
      I({ id: 'overload', lvl: first.hrs <= 36 ? 'crit' : 'warn', ico: '⏳', m: ['task', 'acad', 'work', 'org', 'proj', 'cal'], a: [planA(td)],
        t: 'Beban melebihi kapasitas: ' + dur(tot) + ' belum muat', x: un.length + ' pekerjaan belum muat sebelum tenggatnya, antara lain ' + un.slice(0, 3).map(function (u) { return '“' + u.job.title + '” (' + dur(u.left) + ')'; }).join(', ') + '. Urutkan prioritas: selesaikan yang berbobot nilai/uang lebih dulu, minta perpanjangan untuk yang bisa, dan batalkan/delegasikan yang paling ringan dampaknya.' });
    } else un.forEach(function (u) {
      var j = u.job, df = deferList(P, j, 2);
      I({ id: 'dl-risk:' + j.key, lvl: j.hrs <= 24 ? 'crit' : 'warn', ico: '⏳', m: ['task', 'acad', 'work', 'org', 'proj', 'cal'], a: [planA(j.dlDate <= lastD ? j.dlDate : td), { l: 'Buka sumber', k: 'go', r: j.route, tab: j.tab }],
        t: '“' + j.title + '” belum muat dijadwalkan', x: 'Tenggat ' + dlabel(j.dlDate, td) + (j.dlTime ? ' ' + j.dlTime : '') + ', kurang ' + dur(u.left) + ' dari kebutuhan ' + dur(j.min) + '. ' + (df.length ? 'Tunda dulu ' + df.join(' & ') + '. ' : '') + 'Opsi lain: kerjakan versi inti, minta perpanjangan, atau kecilkan estimasi bila terlalu besar.' });
    });
    var late = P.jobs.filter(function (j) { return j.late; }).sort(function (a, b) { return b.w - a.w; });
    if (late.length) I({ id: 'late', lvl: late.length >= 4 ? 'crit' : 'warn', ico: '⚠️', m: ['task', 'acad', 'work', 'org', 'proj', 'cal'], a: [planA(td)], t: late.length + ' item sudah lewat tenggat', x: 'Paling penting: ' + late.slice(0, 3).map(function (j) { return '“' + j.title + '”'; }).join(', ') + '. Planner menaruhnya di sesi paling awal yang tersedia; selesaikan 1–3 teratas, sisanya jadwalkan ulang.' });

    /* 4. bentrok jadwal tetap */
    P.conflicts.slice(0, 4).forEach(function (c) {
      var mv = c.a.movable ? c.a : c.b.movable ? c.b : null, s = Math.max(c.a.s, c.b.s), e = Math.min(c.a.e, c.b.e);
      I({ id: 'conf:' + c.a.id + c.b.id, lvl: 'crit', ico: '💥', m: ['cal', 'acad', 'org', 'task'], a: [planA(c.date)], t: 'Jadwal bentrok: ' + c.a.title + ' × ' + c.b.title,
        x: cap1(dlabel(c.date, td)) + ' ' + hm(s) + '–' + hm(e) + ' (' + dur(c.min) + ' bersamaan). ' + (mv ? '“' + mv.title + '” berupa rapat, paling mudah digeser atau diizinkan.' : 'Keduanya jadwal tetap — periksa kembali jam yang dimasukkan atau hubungi pihak terkait.') });
    });

    /* 5. beban harian & waktu luang */
    P.days.slice(0, 4).forEach(function (d) {
      if (d.lvl === 'padat') I({ id: 'busy:' + d.date, lvl: 'warn', ico: '🔥', m: ['cal', 'task', 'acad'], a: [planA(d.date)], t: cap1(dlabel(d.date, td)) + ' sangat padat', x: 'Jadwal tetap ' + dur(d.fixedMin) + ' + rencana ' + dur(d.planMin) + ' dari ±' + dur(P.awake) + ' waktu aktif. Jangan tambah komitmen baru dan jaga ' + dur(Math.max(30, d.freeMin)) + ' luang untuk istirahat.' });
    });
    [P.days[0], P.days[1]].forEach(function (d) {
      if (!d) return; var g = d.gaps.slice().sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); })[0];
      if (g && g[1] - g[0] >= 60) I({ id: 'gap:' + d.date, lvl: 'tip', ico: '🕒', m: ['cal', 'task'], a: [planA(d.date)], t: 'Jendela luang terbaik ' + dlabel(d.date, td), x: hm(g[0]) + '–' + hm(g[1]) + ' (' + dur(g[1] - g[0]) + '), cocok untuk tugas baru, istirahat, atau menyicil pekerjaan yang tenggatnya jauh.' });
    });

    /* 6. kualitas data agar planner akurat */
    G.fixed.filter(function (f) { return f.approx && f.kind === 'meeting'; }).slice(0, 3).forEach(function (f) {
      I({ id: 'mt-time:' + f.id, lvl: 'tip', ico: '⏰', m: ['org', 'cal'], a: [{ l: 'Atur jam rapat', k: 'time', id: f.id }], t: 'Jam rapat “' + f.title + '” belum diisi', x: 'Rapat ' + dlabel(f.date, td) + ' hanya bertanggal, jadi planner mengasumsikan ' + hm(f.s) + '–' + hm(f.e) + '. Atur jam sebenarnya agar jadwal belajar/tugas akurat.' });
    });
    if (G.noSched.length) I({ id: 'nosched', lvl: 'tip', ico: '🏫', m: ['acad', 'cal'], a: [{ l: 'Buka Academic', k: 'go', r: '#academic', tab: 'dash' }], t: G.noSched.length + ' mata kuliah belum punya jadwal terbaca', x: G.noSched.slice(0, 3).map(function (c) { return c.name; }).join(', ') + (G.noSched.length > 3 ? ', …' : '') + '. Isi kolom Jadwal (mis. “Senin 09:00–12:00”) agar planner tidak menaruh tugas di jam kuliah.' });
    if (G.noDate >= 3) I({ id: 'nodate', lvl: 'tip', ico: '📅', m: ['task'], a: [{ l: 'Buka Task', k: 'go', r: '#task' }], t: G.noDate + ' to-do belum punya tanggal', x: 'Tugas tanpa tanggal tidak bisa dijadwalkan. Beri tenggat walau perkiraan agar masuk rencana.' });

    /* 7. efisiensi kerja */
    var qw = P.jobs.filter(function (j) { return !j.exam && !j.late && j.min <= 30 && j.left < j.min + 1; });
    if (qw.length >= 3) I({ id: 'quick', lvl: 'tip', ico: '⚡', m: ['task', 'work', 'org', 'proj'], a: [planA(td)], t: qw.length + ' pekerjaan kecil bisa dibatch', x: 'Kerjakan sekaligus dalam satu sesi 30–45 mnt tanpa berpindah konteks: ' + qw.slice(0, 3).map(function (j) { return '“' + j.title + '”'; }).join(', ') + '.' });
    var wip = (data('task').task || []).filter(function (t) { return t.status === 'In Progress' && !t.parentId; }).length;
    if (wip >= 6) I({ id: 'wip', lvl: 'warn', ico: '🧩', m: ['task'], a: [{ l: 'Buka Task', k: 'go', r: '#task' }], t: wip + ' tugas berstatus “Sedang”', x: 'Terlalu banyak yang dikerjakan bersamaan memperlambat semuanya. Pilih 2 teratas berdasarkan tenggat, sisanya kembalikan ke “Belum”.' });
    var unc = (data('cal').ev || []).filter(function (e) { return !e.tk && !e.ax && !e.sp && !e.confirmed && e.start && dayDiff(String(e.start).slice(0, 10), td) >= 0 && dayDiff(String(e.start).slice(0, 10), td) <= 3; }).length;
    if (unc) I({ id: 'unconf', lvl: 'tip', ico: '📬', m: ['cal'], a: [{ l: 'Buka Inbox', k: 'inbox' }], t: unc + ' agenda 3 hari ke depan belum dikonfirmasi', x: 'Konfirmasi agenda yang pasti agar tidak ada kejutan; yang batal bisa diarsipkan di Inbox.' });

    /* 8. modul: Work, Organization, Project, Goal */
    var W = data('work'), O = data('org'), Pj = data('proj'), Gl = data('goal');
    var wait = (W.job || []).filter(function (j) { return +j.income > 0 && j.incomeStatus === 'Sudah ditagih'; }), need = (W.job || []).filter(function (j) { return +j.income > 0 && j.incomeStatus === 'Belum ditagih' && /^(Selesai|Review)$/i.test(j.status || ''); });
    var sm = function (a) { return a.reduce(function (s, j) { return s + (+j.income || 0); }, 0); };
    if (need.length) I({ id: 'inv-need', lvl: 'warn', ico: '🧾', m: ['work', 'fin'], a: [{ l: 'Buka Work Office', k: 'go', r: '#work' }], t: need.length + ' pekerjaan selesai belum ditagih', x: 'Nilai ' + rp(sm(need)) + '. Kirim invoice sekarang agar arus kas tidak tertahan.' });
    if (wait.length) I({ id: 'inv-wait', lvl: 'tip', ico: '💸', m: ['work', 'fin'], a: [{ l: 'Buka Work Office', k: 'go', r: '#work' }], t: wait.length + ' tagihan menunggu pembayaran', x: 'Total ' + rp(sm(wait)) + '. Tandai “Sudah dibayar” saat diterima dan ingatkan klien bila lewat jatuh tempo.' });
    var fuLate = (O.followup || []).filter(function (f) { return !fin(f.status) && f.due && f.due < td; });
    if (fuLate.length) I({ id: 'fu-late', lvl: 'warn', ico: '📋', m: ['org'], a: [{ l: 'Buka Organization', k: 'go', r: '#organization' }], t: fuLate.length + ' tindak lanjut rapat lewat tenggat', x: 'Selesaikan atau minta penanggung jawab memperbarui status; sisanya jadwalkan ulang agar tidak menumpuk sebelum rapat berikutnya.' });
    var mt7 = G.fixed.filter(function (f) { return f.kind === 'meeting' && f.mod === 'Rapat'; }).length;
    if (mt7 >= 3) I({ id: 'mt-many', lvl: 'tip', ico: '🗣️', m: ['org', 'cal'], a: [planA(td)], t: mt7 + ' rapat dalam ' + P.H + ' hari', x: 'Pertimbangkan menggabungkan rapat sejenis atau mempersingkat agenda supaya jam kuliah dan kerja tidak terkikis.' });
    var pk = {}; (Pj.ptask || []).forEach(function (x) { if (!pk[x.projId]) pk[x.projId] = [0, 0]; pk[x.projId][1]++; if (fin(x.status)) pk[x.projId][0]++; });
    (Pj.proj || []).filter(function (p) { return !fin(p.status) && p.target && dayDiff(p.target, td) <= 7 && dayDiff(p.target, td) >= -3 && pk[p.id] && pk[p.id][0] / pk[p.id][1] < 0.6; }).slice(0, 2).forEach(function (p) {
      I({ id: 'pj-risk:' + p.id, lvl: 'warn', ico: '🏗️', m: ['proj'], a: [{ l: 'Buka Project', k: 'go', r: '#project' }], t: 'Proyek “' + p.name + '” berisiko terlambat', x: 'Target ' + dlabel(p.target, td) + ', baru ' + Math.round(pk[p.id][0] / pk[p.id][1] * 100) + '% tugas selesai (' + pk[p.id][0] + '/' + pk[p.id][1] + '). Fokuskan ke tugas kritis atau kurangi cakupan.' });
    });
    var gl = (Gl.goal || []).filter(function (g) { return !fin(g.status) && g.deadline && dayDiff(g.deadline, td) >= 0 && dayDiff(g.deadline, td) <= 14; });
    if (gl.length) I({ id: 'goal-near', lvl: 'tip', ico: '🎯', m: ['goal'], a: [{ l: 'Buka Goal', k: 'go', r: '#goal' }], t: gl.length + ' goal jatuh tempo ≤ 14 hari', x: gl.slice(0, 3).map(function (g) { return '“' + g.name + '” (' + dlabel(g.deadline, td) + ')'; }).join(', ') + '. Pecah jadi langkah kecil dan masukkan ke Task agar ikut terjadwal.' });
    var gL = (Gl.goal || []).filter(function (g) { return !fin(g.status) && g.deadline && g.deadline < td; });
    if (gL.length) I({ id: 'goal-late', lvl: 'warn', ico: '🎯', m: ['goal'], a: [{ l: 'Buka Goal', k: 'go', r: '#goal' }], t: gL.length + ' goal lewat target', x: 'Tinjau ulang: majukan targetnya, kecilkan cakupan, atau tandai selesai/batalkan.' });

    /* 9. keuangan */
    var F = data('fin'), tx = F.tx || [], ym = td.slice(0, 7), dN = +td.slice(8), dim = new Date(+td.slice(0, 4), +td.slice(5, 7), 0).getDate();
    if (tx.length) {
      var sI = 0, sE = 0, byc = {}; tx.forEach(function (t) { if (String(t.date || '').slice(0, 7) !== ym) return; var x = +t.amount || 0; if (t.type === 'Income') sI += x; else if (t.type === 'Expense') { sE += x; byc[t.catId] = (byc[t.catId] || 0) + x; } });
      var proj = dN >= 5 ? sE / dN * dim : 0;
      if (sI > 0 && proj > sI * 1.02) I({ id: 'fin-proj', lvl: 'warn', ico: '📉', m: ['fin', 'an'], a: [{ l: 'Buka Finance', k: 'go', r: '#finance' }], t: 'Pengeluaran bulan ini diproyeksikan melebihi pemasukan', x: 'Dengan laju sekarang, total ±' + rp(proj) + ' vs pemasukan ' + rp(sI) + '. Tahan pengeluaran kategori terbesar sampai akhir bulan.' });
      var cn = {}; (F.cat || []).forEach(function (c) { cn[c.id] = c.name; });
      (F.bud || []).forEach(function (b) {
        if (!(+b.limit > 0) || (b.month && b.month !== ym)) return;
        var sp = byc[b.catId] || 0, pc = sp / +b.limit;
        if (pc >= 1) I({ id: 'bud:' + b.catId, lvl: 'warn', ico: '💳', m: ['fin', 'an'], a: [{ l: 'Buka Finance', k: 'go', r: '#finance' }], t: 'Anggaran ' + (cn[b.catId] || 'kategori') + ' terlampaui', x: 'Terpakai ' + rp(sp) + ' dari ' + rp(b.limit) + ' (' + Math.round(pc * 100) + '%). Hentikan pengeluaran kategori ini atau geser anggaran dari yang longgar.' });
        else if (pc >= 0.85) I({ id: 'bud85:' + b.catId, lvl: 'tip', ico: '💳', m: ['fin'], a: [{ l: 'Buka Finance', k: 'go', r: '#finance' }], t: 'Anggaran ' + (cn[b.catId] || 'kategori') + ' hampir habis', x: Math.round(pc * 100) + '% terpakai; sisa ' + rp(b.limit - sp) + ' untuk ' + (dim - dN) + ' hari lagi.' });
      });
      (F.acc || []).filter(function (a) { return a.active; }).forEach(function (a) {
        var b = +a.opening || 0; tx.forEach(function (t) { var x = +t.amount || 0; if (t.accId === a.id) b += t.type === 'Income' ? x : -x; if (t.type === 'Transfer' && t.toAccId === a.id) b += x; });
        if (b < 0) I({ id: 'accneg:' + a.id, lvl: 'warn', ico: '🏦', m: ['fin'], a: [{ l: 'Buka Finance', k: 'go', r: '#finance' }], t: 'Saldo akun ' + a.name + ' minus', x: 'Saldo ' + rp(b) + '. Periksa transaksi yang salah akun atau pindahkan dana dari akun lain.' });
      });
    }

    /* 10. kelancaran & kecepatan aplikasi */
    var SI = storageInfo(), pct = SI.tot / 5e6;
    if (SI.tot > 1.5e6) {
      var top = SI.rows.slice(0, 3).map(function (r) { return (MODN[KMOD[r.k]] || r.k) + ' ' + mb(r.n); }).join(', ');
      I({ id: 'store', lvl: pct > 0.8 ? 'crit' : pct > 0.5 ? 'warn' : 'tip', ico: '💾', m: ['set', 'an', 'docs'], a: [{ l: 'Buka Settings', k: 'go', r: '#settings' }], t: 'Penyimpanan aplikasi ' + mb(SI.tot) + ' (±' + Math.round(pct * 100) + '% kuota browser)', x: 'Terbesar: ' + top + '. Data besar membuat buka-tutup menu dan simpan terasa lambat, dan jika penuh data baru gagal tersimpan. Ekspor Cadangan, lalu hapus/arsipkan data lama dan kecilkan gambar.' });
    }
    SI.imgs.forEach(function (im) {
      var md = KMOD[im.k] || 'set';
      I({ id: 'img:' + im.k, lvl: im.bytes > 1.5e6 ? 'warn' : 'tip', ico: '🖼️', m: [md, 'set'], a: [{ l: 'Buka ' + (MODN[md] || 'Settings'), k: 'go', r: md === 'acad' ? '#academic' : md === 'fin' ? '#finance' : md === 'work' ? '#work' : md === 'org' ? '#organization' : md === 'proj' ? '#project' : '#' + (md === 'set' ? 'settings' : md === 'cal' ? 'calendar' : md === 'docs' ? 'documents' : md) }], t: im.n + ' gambar besar di ' + (MODN[md] || im.k) + ' (' + mb(im.bytes) + ')', x: 'Foto/sampul beresolusi tinggi dimuat ulang tiap render dan memberatkan memori. Ganti dengan versi lebih kecil (≤ 300 KB) agar menu terasa lebih ringan.' });
    });
    var doneT = (data('task').task || []).filter(function (t) { return fin(t.status); }).length;
    if (doneT >= 150) I({ id: 'done-pile', lvl: 'tip', ico: '🧹', m: ['task', 'set'], a: [{ l: 'Buka Task', k: 'go', r: '#task' }], t: doneT + ' tugas selesai menumpuk di Task', x: 'Hapus/arsipkan tugas selesai lama setelah membuat Cadangan; daftar yang lebih pendek membuat Task dan Inbox lebih cepat.' });

    /* 11. kabar baik */
    if (!out.some(function (o) { return o.ord <= 1; })) {
      var np = P.days.reduce(function (a, d) { return a + d.sess.length; }, 0);
      I({ id: 'ok', lvl: 'good', ico: '✅', m: ['*'], a: [planA(td)], t: 'Jadwal ' + P.H + ' hari ke depan aman', x: np ? np + ' sesi terjadwal tanpa bentrok, semua tenggat muat, dan tetap ada waktu istirahat. Pertahankan ritmenya.' : 'Belum ada pekerjaan bertenggat dalam ' + P.H + ' hari. Manfaatkan untuk menyicil tugas yang tenggatnya lebih jauh.' });
    }
    out.sort(function (a, b) { return a.ord - b.ord; });
    insMemo = { t: Date.now(), v: out };
    return out;
  }
  function forModule(m) {
    var all = insights();
    if (m === 'an') return all.filter(function (i) { return i.ord <= 2; }).slice(0, 8);
    var r = all.filter(function (i) { return i.m.indexOf(m) > -1 || i.m.indexOf('*') > -1; });
    if (!r.length) r = [{ id: 'none:' + m, lvl: 'good', ico: '✨', t: 'Tidak ada hal mendesak di ' + (MODN[m] || 'menu ini'), x: 'Smart Insight memantau tenggat, bentrok jadwal, beban harian, dan kelancaran aplikasi. Semuanya terkendali saat ini.', a: [], m: [m], ord: 3 }];
    return r;
  }
  function counts() {
    var P = getPlan(), td = P.td, n = 0, ins = insights(), now = P.now.getHours() * 60 + P.now.getMinutes();
    P.days[0].sess.forEach(function (s) { if (s.e > now) n++; });
    return { sess: n, crit: ins.filter(function (i) { return i.lvl === 'crit'; }).length, warn: ins.filter(function (i) { return i.lvl === 'warn'; }).length };
  }

  /* ================= UI bersama ================= */
  var V = { c: null, mode: null, host: null, day: null, p: null, sheet: '', ctx: null, acts: {}, tm: 0, dirty: 0 };
  var svg = function (p, c) { return '<svg class="' + (c || 'sm-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    prev: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>', chev: '<path d="m9 18 6-6-6-6"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>', trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>', open: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
  };
  var COL = { exam: '#e5484d', kuliah: '#4f7cff', kerja: '#0f9d8f', org: '#8a5fb5', task: '#d99a2b', proyek: '#9334e6', class: '#4f7cff', meeting: '#8a5fb5', event: '#d6368f', present: '#8b5cf6' };
  var EMO = { exam: '📖', kuliah: '✍️', kerja: '💼', org: '🤝', task: '✅', proyek: '🏗️' }, CATID = { exam: 'c1', kuliah: 'c1', kerja: 'c2', org: 'c3', task: 'c4', proyek: 'c2' };
  var LVN = { crit: 'Perlu tindakan', warn: 'Perhatian', tip: 'Saran', good: 'Kabar baik' }, LVC = { padat: 'Padat', sibuk: 'Sibuk', sedang: 'Sedang', longgar: 'Longgar' };
  var uid = function () { return MO.kit && MO.kit.uid ? MO.kit.uid() : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); };
  var nowMin = function () { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

  /* ---------- Planner ---------- */
  function dayChips(P) {
    return '<div class="sm-days" role="tablist" aria-label="Pilih hari">' + P.days.map(function (d) {
      var w = wdOf(d.date), lb = d.idx === 0 ? 'Hari ini' : d.idx === 1 ? 'Besok' : HS[w], bad = P.conflicts.some(function (c) { return c.date === d.date; }) || P.unplaced.some(function (u) { return u.job.dlDate === d.date; });
      return '<button class="sm-dc lv-' + d.lvl + '" role="tab" data-sm="day" data-d="' + d.date + '" aria-selected="' + (d.date === V.day) + '" title="' + esc(cap1(LVC[d.lvl]) + ' · ' + dur(d.fixedMin + d.planMin)) + '"><small>' + lb + '</small><b>' + +d.date.slice(8) + '</b><i style="--w:' + Math.min(100, Math.round(d.util * 100)) + '%"></i>' + (bad ? '<u aria-label="Ada masalah"></u>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function rowTimes(a, b) { return '<div class="sm-t"><b>' + hm(a) + '</b><i>' + hm(b) + '</i></div>'; }
  function dayHtml(P, day) {
    var td = P.td, isT = day.date === td, nm = nowMin(), rows = [];
    day.fixed.forEach(function (f) { rows.push({ s: f.s, e: f.e, h: '<div class="sm-r fix' + (isT && f.e <= nm ? ' past' : '') + '" data-sm="fix" data-id="' + esc(f.id) + '" style="--c:' + (COL[f.kind] || COL.event) + '" tabindex="0" role="button">' + rowTimes(f.s, f.e) + '<span class="sm-bar"></span><div class="sm-x"><div class="sm-h">' + svg(IC.lock, 'sm-lk') + esc(f.title) + '</div><div class="sm-m">' + esc(f.mod) + (f.org ? ' · ' + esc(f.org) : '') + (f.loc ? ' · ' + esc(f.loc) : '') + (f.approx ? ' · jam perkiraan' : '') + '<em class="sm-tag">Tetap</em></div></div></div>' }); });
    day.sess.forEach(function (s) { rows.push({ s: s.s, e: s.e, h: '<div class="sm-r ses" data-sm="ses" data-id="' + esc(s.id) + '" style="--c:' + (COL[s.cat] || '#0b57d0') + '" tabindex="0" role="button">' + rowTimes(s.s, s.e) + '<span class="sm-bar"></span><div class="sm-x"><div class="sm-h">' + esc(s.title) + '</div><div class="sm-m">' + esc(s.mod) + (s.sub ? ' · ' + esc(s.sub) : '') + ' · ' + dur(s.e - s.s) + '<em class="sm-tag f">Fleksibel</em></div><div class="sm-w">' + esc(s.why) + '</div></div></div>' }); });
    day.brk.forEach(function (b) { rows.push({ s: b.s, e: b.e, h: '<div class="sm-r brk"><div class="sm-t"><b>' + hm(b.s) + '</b></div><span class="sm-bar"></span><div class="sm-x"><div class="sm-m">' + esc(b.title) + '</div></div></div>' }); });
    day.gaps.forEach(function (g) { if (g[1] - g[0] >= 45) rows.push({ s: g[0], e: g[1], h: '<div class="sm-r gap"><div class="sm-t"><b>' + hm(g[0]) + '</b></div><span class="sm-bar"></span><div class="sm-x"><div class="sm-m">Luang ' + dur(g[1] - g[0]) + ' · ' + hm(g[0]) + '–' + hm(g[1]) + '</div></div></div>' }); });
    rows.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    var h = '<div class="sm-dh"><b>' + (isT ? 'Hari ini' : cap1(dlabel(day.date, td))) + ' · ' + HR[wdOf(day.date)].slice(0, 3) + ', ' + fd(day.date) + '</b><span class="lv-' + day.lvl + '">' + LVC[day.lvl] + '</span></div>' +
      '<div class="sm-ds">' + day.fixed.length + ' jadwal tetap · ' + dur(day.planMin) + ' rencana · luang ' + dur(day.freeMin) + '</div>';
    if (day.allDay && day.allDay.length) h += '<div class="sm-info">📌 Seharian: ' + esc(day.allDay.map(function (x) { return x.title; }).join(', ')) + (day.cap < (+S.cfg.cap || 360) * 0.7 && day.allDay.some(function (x) { return !/libur|cuti|holiday/i.test(x.title); }) ? ' — kapasitas hari ini dikurangi' : '') + '</div>';
    P.conflicts.filter(function (c) { return c.date === day.date; }).forEach(function (c) { h += '<div class="sm-alert">💥 Bentrok ' + hm(Math.max(c.a.s, c.b.s)) + '–' + hm(Math.min(c.a.e, c.b.e)) + ': ' + esc(c.a.title) + ' × ' + esc(c.b.title) + '</div>'; });
    if (!rows.length) return h + '<div class="sm-empty">Tidak ada jadwal di hari ini. Manfaatkan untuk menyicil tugas yang tenggatnya lebih jauh atau beristirahat.</div>';
    return h + '<div class="sm-tl">' + rows.map(function (r) { return r.h; }).join('') + '</div>';
  }
  var jm = function (m) { m = Math.round(m); if (m < 60) return m + ' mnt'; var h = Math.floor(m / 60), r = m % 60; return h + ' j' + (r ? ' ' + r + ' m' : ''); };
  function tlBar(P, day) {
    var a = P.dStart, b = P.dEnd, span = Math.max(60, b - a), seg = function (s0, e0, c) {
      var l = Math.max(s0, a), r = Math.min(e0, b); if (r <= l) return '';
      return '<span class="' + c + '" style="left:' + ((l - a) / span * 100).toFixed(2) + '%;width:' + ((r - l) / span * 100).toFixed(2) + '%"></span>';
    }, h = '';
    day.brk.forEach(function (x) { h += seg(x.s, x.e, 'b'); });
    day.fixed.forEach(function (x) { h += seg(x.s, x.e, 'f'); });
    day.sess.forEach(function (x) { h += seg(x.s, x.e, 's'); });
    return '<div class="pl-bar" role="img" aria-label="Susunan waktu hari ini">' + h + '</div><div class="pl-lg"><span><i class="f"></i>Jadwal tetap</span><span><i class="s"></i>Blok fokus</span><span><i class="b"></i>Istirahat</span><span><i class="w"></i>' + hm(a) + '–' + hm(b) + '</span></div>';
  }
  function plannerHtml(P) {
    var day = P.days.filter(function (d) { return d.date === V.day; })[0] || P.days[0]; V.day = day.date;
    var isT = day.date === P.td, nm = nowMin(), ns = 0; P.days.forEach(function (d) { ns += d.sess.length; });
    var lbl = HR[wdOf(day.date)] + ', ' + fd(day.date) + (isT ? ' · hari ini' : day.idx === 1 ? ' · besok' : day.idx === 2 ? ' · lusa' : '');
    var due = 0; P.jobs.forEach(function (j) { if (j.late || j.dlDate === day.date) due += j.min; });
    var h = '<div class="sm-view pl"><div class="pl-nav"><button data-sm="prev" aria-label="Hari sebelumnya"' + (day.idx === 0 ? ' disabled' : '') + '>' + svg(IC.prev) + '</button><div class="pl-date">' + esc(lbl) + '</div><button data-sm="next" aria-label="Hari berikutnya"' + (day.idx >= P.days.length - 1 ? ' disabled' : '') + '>' + svg(IC.next) + '</button></div>';
    h += tlBar(P, day);
    h += '<div class="pl-st"><div><b>' + jm(day.freeMin) + '</b><small>waktu luang</small></div><div><b>' + jm(due) + '</b><small>beban jatuh tempo</small></div><div><b>' + P.jobs.length + '</b><small>kandidat tugas</small></div></div>';
    var ap = S.ap;
    h += '<div class="pl-ap"><button class="pl-apply" data-sm="apply"' + (ns ? '' : ' disabled') + '>' + svg(IC.cal) + (ap ? 'Perbarui Kalender' : 'Terapkan ke Kalender') + '</button>' + (ap ? '<button class="pl-un" data-sm="unapply" aria-label="Hapus dari Kalender" title="Hapus dari Kalender">' + svg(IC.trash) + '</button>' : '') + '</div>';
    if (ap) h += '<p class="pl-apn">Sudah di Kalender · ' + ap.n + ' sesi. Perbarui jika jadwal berubah.</p>';
    if (day.allDay && day.allDay.length) h += '<div class="sm-info">📌 Seharian: ' + esc(day.allDay.map(function (x) { return x.title; }).join(', ')) + '</div>';
    P.conflicts.filter(function (c) { return c.date === day.date; }).forEach(function (c) { h += '<div class="sm-alert">💥 Bentrok ' + hm(Math.max(c.a.s, c.b.s)) + '–' + hm(Math.min(c.a.e, c.b.e)) + ': ' + esc(c.a.title) + ' × ' + esc(c.b.title) + '</div>'; });
    var rows = [];
    day.fixed.forEach(function (f) { rows.push({ s: f.s, e: f.e, h: '<div class="pl-r fx' + (isT && f.e <= nm ? ' past' : '') + '" data-sm="fix" data-id="' + esc(f.id) + '" style="--c:' + (COL[f.kind] || COL.event) + '" tabindex="0" role="button"><b class="pl-t">' + hm(f.s) + '–' + hm(f.e) + '</b><div class="pl-x"><b>' + esc(f.title) + '</b><small>' + esc(f.mod) + ' · ' + jm(f.e - f.s) + (f.loc ? ' · ' + esc(f.loc) : '') + '</small></div></div>' }); });
    day.sess.forEach(function (x) { rows.push({ s: x.s, e: x.e, h: '<div class="pl-r se' + (isT && x.e <= nm ? ' past' : '') + '" data-sm="ses" data-id="' + esc(x.id) + '" style="--c:' + (COL[x.cat] || '#4f7cff') + '" tabindex="0" role="button"><b class="pl-t">' + hm(x.s) + '–' + hm(x.e) + '</b><div class="pl-x"><b>' + esc(x.title) + '</b><small>Blok fokus · ' + esc(x.mod) + (x.sub ? ' · ' + esc(x.sub) : '') + ' · ' + jm(x.e - x.s) + '</small></div></div>' }); });
    rows.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    h += rows.length ? '<div class="pl-tl">' + rows.map(function (r) { return r.h; }).join('') + '</div>' : '<div class="sm-empty">Tidak ada jadwal di hari ini. Manfaatkan untuk menyicil tugas yang tenggatnya lebih jauh atau beristirahat.</div>';
    if (P.unplaced.length) {
      h += '<div class="pl-sec"><b>Tidak muat</b><em>' + P.unplaced.length + '</em></div>';
      P.unplaced.slice(0, 5).forEach(function (u) {
        h += '<article class="pl-no"><div class="pl-nh"><b>' + esc(u.job.title) + '</b><span class="ib-tag">' + esc(u.job.mod) + '</span></div><p>Sisa ' + jm(u.left) + ' belum muat. Saran: sisihkan ' + jm(u.left) + ' di hari lain.</p><div class="pl-na"><button data-sm="go" data-r="' + esc(u.job.route || '') + '" data-tab="' + esc(u.job.tab || '') + '">Buka sumber</button><button data-sm="ins">Lihat saran</button></div></article>';
      });
      if (P.unplaced.length > 5) h += '<p class="sm-foot">+ ' + (P.unplaced.length - 5) + ' lainnya di tab Insight.</p>';
    }
    var notes = P.G.notes.filter(function (n) { return n.k === 'prepLater'; });
    if (notes.length) h += '<div class="sm-info">🗓️ Belajar ' + esc(notes[0].label) + ' dimulai ' + esc(dlabel(notes[0].from, P.td)) + '.</div>';
    h += '<button class="pl-set" data-sm="cfg">Pengaturan planner' + svg(IC.chev, 'sm-i') + '</button>';
    h += '<p class="sm-foot">Jadwal tetap tidak digeser. Sesi fleksibel disusun ulang otomatis saat data berubah. Ketuk jadwal untuk mengubah estimasi atau jam.</p></div>';
    return h;
  }

  /* ---------- Insight ---------- */
  function cardHtml(i, scope) {
    var acts = (i.a || []).slice(); if (i.ord >= 1 && i.id.indexOf('none:') !== 0) acts.push({ l: 'Abaikan hari ini', k: 'dis', id: i.id, q: 1 });
    var ah = acts.map(function (a, j) { var key = scope + ':' + i.id + ':' + j; V.acts[key] = a; return '<button class="' + (a.q ? 'q' : j === 0 ? 'p' : '') + '" data-sm="act" data-k="' + esc(key) + '">' + esc(a.l) + '</button>'; }).join('');
    return '<article class="sm-card l-' + i.lvl + '"><i aria-hidden="true">' + i.ico + '</i><div><h4>' + esc(i.t) + '</h4><p>' + esc(i.x) + '</p>' + (ah ? '<div class="sm-acts">' + ah + '</div>' : '') + '</div></article>';
  }
  function listHtml(list, scope) {
    V.acts = {}; var h = '', last = '';
    list.forEach(function (i) { if (i.lvl !== last) { last = i.lvl; h += '<div class="sm-sec s-' + i.lvl + '">' + LVN[i.lvl] + '</div>'; } h += cardHtml(i, scope); });
    return h;
  }
  function weekStats() {
    var td = today(), A = data('acad'), W = data('work'), O = data('org'), C = data('cal'), T = data('task'), wd = [0, 0, 0, 0, 0, 0, 0], bel = 0, ker = 0, rap = 0, lai = 0, any = 0;
    var inR = function (d) { var n = dayDiff(td, d); return n >= 0 && n < 7; };
    (A.study || []).forEach(function (x) { var d = String(x.date || '').slice(0, 10); if (!d) return; var m = +x.minutes || 0; wd[wdOf(d)] += m; any += m; if (inR(d)) bel += m; });
    (W.log || []).forEach(function (l) { var d = String(l.date || '').slice(0, 10); if (!d) return; var m = Math.round((+l.hours || 0) * 60); wd[wdOf(d)] += m; any += m; if (inR(d)) ker += m; });
    (O.meeting || []).forEach(function (m) { var d = String(m.date || '').slice(0, 10); if (d && inR(d)) rap += 60; });
    (C.ev || []).forEach(function (e) {
      if (e.sp || e.tk || e.ax) return; var d = String(e.start || '').slice(0, 10); if (!d || !inR(d) || dayDiff(d, td) > 0) return;
      if (/rapat|meeting|sidang|briefing/i.test((e.title || '') + ' ' + (e.kind || ''))) { var a = tmin(e.startTime), b = tmin(e.endTime); rap += a != null && b != null && b > a ? b - a : 60; }
    });
    (T.task || []).forEach(function (t) { if (t.parentId || !/^(Done|Selesai)$/i.test(t.status || '')) return; var d = String(t.doneAt || '').slice(0, 10); if (d && inR(d)) lai += 30; });
    return { wd: wd, any: any, bel: bel, ker: ker, rap: rap, lai: lai, tot: bel + ker + rap + lai };
  }
  function insightHtml() {
    var P = getPlan(true), list = insights(), td = P.td, d0 = P.days[0], cfg = S.cfg;
    var due = 0; P.jobs.forEach(function (j) { if (j.late || j.dlDate === td) due += j.min; });
    var avail = d0.freeMin + d0.planMin, over = due > avail, ratio = due ? (avail ? due / avail : 9) : 0;
    var lv = over ? ['Berlebih', '#e5484d'] : ratio > 0.8 ? ['Padat', '#e8a317'] : due ? ['Aman', '#2f9e6b'] : ['Longgar', '#2f9e6b'];
    var h = '<div class="sm-view in">';
    h += '<section class="in-c"><h4>Beban hari ini vs waktu luang</h4><div class="in-pb"><span style="width:' + Math.max(4, Math.min(100, Math.round(ratio * 100))) + '%;background:' + lv[1] + '"></span></div><p class="in-m"><b>' + lv[0] + '</b> · beban ' + jm(due) + ' dari ' + jm(avail) + ' waktu luang</p><p class="in-d">Dasar: tugas jatuh tempo/terlambat (estimasi), jadwal tetap ' + jm(d0.fixedMin) + ', jendela ' + hm(P.dStart) + '–' + hm(P.dEnd) + ', jeda ' + (+cfg.buf || 0) + ' mnt, kapasitas fokus ' + jm(d0.cap) + '.</p></section>';
    var jobs = P.jobs.filter(function (j) { return j.dlDate; }).sort(function (a, b) { return a.dlTs - b.dlTs; }), cum = 0, risks = [];
    jobs.forEach(function (j) { cum += j.min; var di = j.late ? 0 : Math.max(0, dayDiff(j.dlDate, td)), have = 0; for (var i = 0; i <= Math.min(di, P.days.length - 1); i++) have += P.days[i].freeMin + P.days[i].planMin; if (cum > have) risks.push({ j: j, need: cum, have: have }); });
    h += '<section class="in-c"><h4>Risiko tenggat</h4>';
    if (!risks.length) h += '<p class="in-m">Tidak ada tenggat yang berisiko. Semua muat di waktu luang.</p>';
    else risks.slice(0, 4).forEach(function (r) { h += '<div class="in-rk"><b>' + esc(r.j.title) + '</b><small>' + (r.j.late ? 'lewat tenggat' : 'tenggat ' + HS[wdOf(r.j.dlDate)] + ' ' + fd(r.j.dlDate)) + ' · butuh ' + jm(r.need) + ' kumulatif, luang ' + jm(r.have) + '</small></div>'; });
    h += '<p class="in-d">Dasar: estimasi tugas diurutkan menurut tenggat dibanding waktu luang kumulatif sampai tenggat itu.</p></section>';
    var w = weekStats(), mx = Math.max.apply(null, w.wd), bi = w.wd.indexOf(mx);
    h += '<section class="in-c"><h4>Pola produktivitas</h4>';
    if (!mx) h += '<p class="in-m">Belum ada data. Catat waktu belajar (Academic) atau jam kerja (Work) agar pola muncul.</p>';
    else {
      h += '<p class="in-m">Hari paling produktif: <b>' + HR[bi] + '</b> (' + jm(mx) + ')</p><div class="in-bars">' + w.wd.map(function (v, i) { return '<div class="' + (v === mx ? 'top' : v ? 'mid' : 'zero') + '" title="' + HR[i] + ' · ' + jm(v) + '"><span style="height:' + Math.max(3, Math.round(v / mx * 100)) + '%"></span><small>' + HS[i] + '</small></div>'; }).join('') + '</div>';
    }
    h += '<p class="in-d">Dasar: sesi belajar (Academic) dan jam kerja (Work), semua waktu.</p></section>';
    h += '<section class="in-c"><h4>Keseimbangan 7 hari</h4>';
    if (!w.tot) h += '<p class="in-m">Belum ada aktivitas tercatat dalam 7 hari terakhir.</p>';
    else {
      var parts = [['Belajar', w.bel, '#2f6bff'], ['Kerja', w.ker, '#d99a2b'], ['Rapat', w.rap, '#8a5fb5'], ['Lainnya', w.lai, '#2f9e6b']].filter(function (x) { return x[1] > 0; });
      h += '<div class="in-st">' + parts.map(function (x) { return '<span style="flex:' + x[1] + ';background:' + x[2] + '"></span>'; }).join('') + '</div><div class="in-lg">' + parts.map(function (x) { return '<span><i style="background:' + x[2] + '"></i>' + x[0] + ' ' + jm(x[1]) + ' (' + Math.round(x[1] / w.tot * 100) + '%)</span>'; }).join('') + '</div>';
    }
    h += '<p class="in-d">Dasar: sesi belajar, jam kerja, rapat/acara berjam (bila tanpa jam dihitung 60 mnt), dan tugas Task yang selesai (estimasi 30 mnt).</p></section>';
    var late = window.BeresinInbox ? window.BeresinInbox.items().filter(function (i) { return i.diff !== null && i.diff < 0; }).length : 0, rec = [];
    if (over) rec.push('Beban hari ini melebihi waktu luang sebesar ' + jm(due - avail) + '. Jadwalkan ulang tugas berprioritas rendah ke besok.');
    if (risks.length) rec.push('Mulai “' + risks[0].j.title + '” hari ini: butuh ' + jm(risks[0].need) + ' sedangkan luang sampai tenggat ' + jm(risks[0].have) + '.');
    if (late) rec.push(late + ' item sudah terlambat. Selesaikan atau jadwalkan ulang di tab Inbox agar tidak menumpuk.');
    if (!rec.length) rec.push('Tidak ada hal mendesak. Pertahankan ritme dan manfaatkan waktu luang untuk menyicil tugas berikutnya.');
    h += '<section class="in-c"><h4>Rekomendasi</h4><ul class="in-rc">' + rec.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="in-d">Aturan sederhana pada data lokal, tanpa AI dan tanpa jaringan.</p></section>';
    if (list.length) h += '<div class="sm-sec in-sec">Insight terperinci</div>' + listHtml(list, 'g');
    h += '<p class="sm-foot">Insight dihitung ulang dari seluruh modul setiap kali dibuka.</p></div>';
    return h;
  }

  /* ---------- sheet (portal) ---------- */
  function portal() {
    if (V.p) return V.p;
    var p = D.createElement('div'); p.className = 'sm-ov'; p.hidden = true;
    p.innerHTML = '<div class="sm-bg" data-sm="x"></div><div class="sm-sh" role="dialog" aria-modal="true"></div><div class="sm-toast" hidden role="status" aria-live="polite"><span></span><button data-sm="undo">Urungkan</button></div>';
    D.body.appendChild(p); p.addEventListener('click', onClick); p.addEventListener('change', onChange);
    p.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-sm="fix"],[data-sm="ses"]')) { e.preventDefault(); e.target.click(); } });
    V.p = p; return p;
  }
  function openSheet(html, ctx) { var p = portal(); p.querySelector('.sm-sh').innerHTML = html; V.sheet = ctx || 'x'; p.hidden = false; root.classList.add('sm-lock'); var sh = p.querySelector('.sm-sh'); sh.tabIndex = -1; sh.scrollTop = 0; try { sh.focus({ preventScroll: true }); } catch (e) { } }
  function closeSheet() {
    if (!V.p || V.p.hidden) return; V.p.hidden = true; V.sheet = ''; V.ctx = null; root.classList.remove('sm-lock');
    if (V.dirty) { V.dirty = 0; render(); }
  }
  var undoF = null, toastT = 0;
  function toast(msg, undo) {
    if (V.host && V.host.toast && V.c && V.mode) { V.host.toast(msg, undo ? [undo] : null); return; }
    var t = portal().querySelector('.sm-toast'); clearTimeout(toastT); undoF = undo || null; t.querySelector('span').textContent = msg; t.querySelector('button').hidden = !undo; t.hidden = false; V.p.hidden = V.sheet ? false : false;
    if (!V.sheet) V.p.classList.add('only-toast'); toastT = setTimeout(function () { t.hidden = true; undoF = null; if (!V.sheet) { V.p.hidden = true; V.p.classList.remove('only-toast'); } }, undo ? 6500 : 2600);
  }

  function sheetSession(id) {
    var P = getPlan(), s = null, job = null;
    P.days.forEach(function (d) { d.sess.forEach(function (x) { if (x.id === id) s = x; }); });
    if (!s) return; P.jobs.forEach(function (j) { if (j.id === s.job) job = j; });
    var ov = S.ov[s.key] || {}, tag = job && job.exam;
    var h = '<div class="sm-grab"></div><h3>' + esc(s.title) + '</h3><p class="sm-sp">' + esc(s.mod) + (s.sub ? ' · ' + esc(s.sub) : '') + '<br>' + esc(cap1(dlabel(s.date, P.td))) + ' · ' + hm(s.s) + '–' + hm(s.e) + ' (' + dur(s.e - s.s) + ')</p><div class="sm-wb">' + esc(s.why) + '</div>';
    if (job) {
      h += '<div class="sm-kv"><span>Total rencana</span><b>' + dur(job.min) + ' · ' + job.sess.length + ' sesi</b></div>' + (job.left >= 15 ? '<div class="sm-kv bad"><span>Belum muat</span><b>' + dur(job.left) + '</b></div>' : '');
      h += '<div class="sm-st"><span>Estimasi pengerjaan</span><div><button data-sm="est" data-key="' + esc(s.key) + '" data-v="-15" aria-label="Kurangi 15 menit">−</button><b>' + dur(job.min) + '</b><button data-sm="est" data-key="' + esc(s.key) + '" data-v="15" aria-label="Tambah 15 menit">+</button></div></div>';
      if (tag) h += '<div class="sm-ch"><span>Tingkat kesulitan ujian</span><div>' + Object.keys(DIFF).map(function (k) { return '<button data-sm="diffc" data-key="' + esc(s.key) + '" data-v="' + k + '" aria-pressed="' + (job.df === k) + '">' + DIFF[k][1] + '</button>'; }).join('') + '</div></div>';
    }
    h += '<div class="sm-sb"><button class="p" data-sm="go" data-r="' + esc(s.route) + '" data-tab="' + esc(s.tab || '') + '">' + svg(IC.open) + 'Buka sumber</button><button data-sm="skip" data-key="' + esc(s.key) + '">Lewati, jangan jadwalkan</button></div>';
    openSheet(h, 'ses');
  }
  function sheetFixed(id) {
    var P = getPlan(), f = null; P.G.fixed.forEach(function (x) { if (x.id === id) f = x; }); if (!f) return;
    var h = '<div class="sm-grab"></div><h3>' + esc(f.title) + '</h3><p class="sm-sp">' + esc(f.mod) + (f.org ? ' · ' + esc(f.org) : '') + (f.loc ? ' · ' + esc(f.loc) : '') + '<br>' + esc(cap1(dlabel(f.date, P.td))) + ' · ' + hm(f.s) + '–' + hm(f.e) + '</p><div class="sm-wb">Jadwal tetap — planner tidak memindahkannya dan menjaga jeda ' + (S.cfg.buf || 0) + ' menit di sekitarnya.' + (f.movable ? ' Rapat termasuk yang bisa kamu tunda atau izinkan; lihat sarannya di Insight.' : '') + (f.approx ? ' Jam ini hanya perkiraan.' : '') + '</div>';
    if (f.key) {
      var ov = S.ov[f.key] || {};
      h += '<div class="sm-fm"><label>Jam mulai<input type="time" id="smT" value="' + hm(f.s) + '"></label><label>Durasi<select id="smD">' + [30, 45, 60, 90, 120, 150, 180].map(function (m) { return '<option value="' + m + '"' + (m === f.e - f.s ? ' selected' : '') + '>' + dur(m) + '</option>'; }).join('') + '</select></label></div><div class="sm-sb"><button class="p" data-sm="savetime" data-key="' + esc(f.key) + '">Simpan jam rapat</button></div>';
    }
    h += '<div class="sm-sb"><button data-sm="go" data-r="' + esc(f.route || '') + '" data-tab="' + esc(f.tab || '') + '">' + svg(IC.open) + 'Buka sumber</button></div>';
    openSheet(h, 'fix');
  }
  function sheetCfg() {
    var c = S.cfg, P = getPlan(), sk = P.G.skipped;
    var h = '<div class="sm-grab"></div><h3>Atur Smart Planner</h3><p class="sm-sp">Perubahan langsung dipakai untuk menyusun ulang rencana.</p><div class="sm-fm">' +
      '<label>Jam bangun<input type="time" data-sm="cfgv" data-k="wake" value="' + esc(c.wake) + '"></label><label>Jam tidur<input type="time" data-sm="cfgv" data-k="sleep" value="' + esc(c.sleep) + '"></label>' +
      '<label>Jam paling fokus<select data-sm="cfgv" data-k="peak">' + Object.keys(PEAK).map(function (k) { return '<option value="' + k + '"' + (c.peak === k ? ' selected' : '') + '>' + PEAK[k][2] + '</option>'; }).join('') + '</select></label>' +
      '<label>Kapasitas fokus / hari<select data-sm="cfgv" data-k="cap">' + [180, 240, 300, 360, 420, 480].map(function (m) { return '<option value="' + m + '"' + (+c.cap === m ? ' selected' : '') + '>' + dur(m) + '</option>'; }).join('') + '</select></label>' +
      '<label>Rentang rencana<select data-sm="cfgv" data-k="hor">' + [5, 7, 10, 14].map(function (m) { return '<option value="' + m + '"' + (+c.hor === m ? ' selected' : '') + '>' + m + ' hari</option>'; }).join('') + '</select></label>' +
      '<label>Jeda sekitar jadwal tetap<select data-sm="cfgv" data-k="buf">' + [0, 10, 15, 20, 30].map(function (m) { return '<option value="' + m + '"' + (+c.buf === m ? ' selected' : '') + '>' + m + ' menit</option>'; }).join('') + '</select></label>' +
      '<label class="chk"><input type="checkbox" data-sm="cfgv" data-k="meals"' + (c.meals ? ' checked' : '') + '><span>Sisakan waktu makan siang & Maghrib/makan malam</span></label></div>';
    if (sk.length) h += '<div class="sm-sk"><b>Dilewati (' + sk.length + ')</b>' + sk.map(function (j) { return '<div><span>' + esc(j.title) + '</span><button data-sm="unskip" data-key="' + esc(j.key) + '">Pulihkan</button></div>'; }).join('') + '</div>';
    h += '<div class="sm-sb"><button data-sm="cfgreset">Kembalikan bawaan</button><button class="p" data-sm="x">Selesai</button></div>';
    openSheet(h, 'cfg');
  }

  /* ---------- aksi ---------- */
  function afterChange(msg, undo) { invalidate(); saveS(); render(); toast(msg, undo); }
  function applyCal() {
    var ap = MO.apps && MO.apps['mo-cal-v1']; if (!ap || !ap.D) { toast('Kalender belum siap'); return; }
    var P = getPlan(true), td = P.td, ev = ap.D.ev || (ap.D.ev = []), snap = ev.slice(), prev = S.ap;
    var keep = ev.filter(function (e) { return !(e.sp && String(e.start) >= td); }), add = [];
    P.days.forEach(function (d) { d.sess.forEach(function (s) { add.push({ id: 'sp-' + uid(), sp: 1, confirmed: true, title: (EMO[s.cat] || '🗓️') + ' ' + s.title, start: d.date, end: d.date, startTime: hm(s.s), endTime: hm(s.e), allDay: false, kind: 'biasa', catId: CATID[s.cat] || 'c4', remind: '', location: '', notes: 'Smart Planner · ' + s.why }); }); });
    ev.length = 0; Array.prototype.push.apply(ev, keep.concat(add)); ap.save();
    S.ap = { at: Date.now(), n: add.length }; saveS(); invalidate(); render();
    toast(add.length + ' sesi dimasukkan ke Kalender', function () { ev.length = 0; Array.prototype.push.apply(ev, snap); ap.save(); S.ap = prev; saveS(); invalidate(); render(); });
  }
  function unapplyCal() {
    var ap = MO.apps && MO.apps['mo-cal-v1']; if (!ap || !ap.D) return; var ev = ap.D.ev || [], td = today(), snap = ev.slice(), prev = S.ap;
    var keep = ev.filter(function (e) { return !(e.sp && String(e.start) >= td); });
    ev.length = 0; Array.prototype.push.apply(ev, keep); ap.save(); S.ap = null; saveS(); invalidate(); render();
    toast((snap.length - keep.length) + ' sesi dihapus dari Kalender', function () { ev.length = 0; Array.prototype.push.apply(ev, snap); ap.save(); S.ap = prev; saveS(); invalidate(); render(); });
  }
  function ovSet(key, o) { S.ov[key] = Object.assign({}, S.ov[key] || {}, o); }
  function jobMin(key) { var P = getPlan(); var m = 0; P.jobs.forEach(function (j) { if (j.key === key) m = j.min; }); return m; }

  function openInboxMode(mode, date) {
    if (date) V.day = date;
    var go = function () { if (window.BeresinInbox) window.BeresinInbox.open(mode); };
    var cur = curModule();
    if (cur) { closeSheet(); closeModule(cur.el); setTimeout(go, 150); } else go();
  }
  function closeModule(el) {
    try { D.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) { }
    setTimeout(function () {
      if (!el || el.hidden) return;
      var b = el.querySelector('[data-act="close"],[data-a="close"],.ac-x,.ad-closeNav,.wo-x,.es-x,.fn-x'); if (b) b.click();
    }, 90);
  }
  function navTo(r, tab) {
    if (V.host && V.host.go && V.c) { closeSheet(); return V.host.go(r, tab); }
    var cur = curModule(); closeSheet();
    var open = function () { window.__cuSkip = Date.now() + 1800; if (window.__bsJump) window.__bsJump(); if (r === '#academic' && MO.acadGo) MO.acadGo(tab || 'dash'); else if (MO.routes && MO.routes[r]) MO.routes[r](); };
    if (cur) { closeModule(cur.el); setTimeout(open, 150); } else open();
  }
  function doAct(a) {
    if (!a) return;
    switch (a.k) {
      case 'plan': if (V.host && V.c) { V.day = a.d; closeSheet(); V.host.mode('planner'); } else openInboxMode('planner', a.d); break;
      case 'go': navTo(a.r, a.tab); break;
      case 'inbox': if (V.host && V.c) { closeSheet(); V.host.mode('inbox'); } else openInboxMode('inbox'); break;
      case 'dis': S.dis[a.id] = today(); invalidate(); saveS(); render(); if (V.ctx === 'mod') sheetModule(V.modKey); break;
      case 'time': closeSheet(); var P = getPlan(), f = null; P.G.fixed.forEach(function (x) { if (x.id === a.id) f = x; }); if (f) sheetFixed(a.id); break;
      case 'diff': ovSet(a.key, { diff: a.v }); invalidate(); saveS(); render(); if (V.ctx === 'mod') sheetModule(V.modKey); toast('Tingkat kesulitan diubah — rencana disusun ulang'); break;
    }
  }
  function onClick(e) {
    var b = e.target.closest && e.target.closest('[data-sm]'); if (!b) return;
    var a = b.dataset.sm, key = b.dataset.key;
    switch (a) {
      case 'x': return closeSheet();
      case 'day': V.day = b.dataset.d; return render();
      case 'prev': case 'next': var PP = getPlan(), ci = 0; PP.days.forEach(function (d) { if (d.date === V.day) ci = d.idx; }); ci = Math.max(0, Math.min(PP.days.length - 1, ci + (a === 'prev' ? -1 : 1))); V.day = PP.days[ci].date; return render();
      case 'ins': return V.host && V.host.mode('insight');
      case 'cfg': return sheetCfg();
      case 'fix': return sheetFixed(b.dataset.id);
      case 'ses': return sheetSession(b.dataset.id);
      case 'apply': return applyCal();
      case 'unapply': return unapplyCal();
      case 'act': return doAct(V.acts[b.dataset.k]);
      case 'undo': var f = undoF; undoF = null; var t = V.p && V.p.querySelector('.sm-toast'); if (t) t.hidden = true; if (f) f(); return;
      case 'go': return navTo(b.dataset.r, b.dataset.tab);
      case 'est': var m = jobMin(key); if (m) { var was = S.ov[key] ? S.ov[key].est : undefined; ovSet(key, { est: Math.max(15, m + (+b.dataset.v)) }); invalidate(); saveS(); render(); var s0 = V.sheet; closeSheet(); return reopenFor(key); } return;
      case 'diffc': ovSet(key, { diff: b.dataset.v }); invalidate(); saveS(); render(); closeSheet(); return reopenFor(key);
      case 'skip': var pv = S.ov[key] ? Object.assign({}, S.ov[key]) : null; ovSet(key, { skip: 1 }); closeSheet(); return afterChange('Dilewati dari rencana', function () { if (pv) S.ov[key] = pv; else delete S.ov[key]; invalidate(); saveS(); render(); });
      case 'unskip': if (S.ov[key]) delete S.ov[key].skip; invalidate(); saveS(); render(); return sheetCfg();
      case 'savetime': var tv = D.getElementById('smT').value, dv = +D.getElementById('smD').value; if (tmin(tv) == null) return; ovSet(key, { time: tv, dur: dv }); closeSheet(); return afterChange('Jam rapat disimpan — rencana disusun ulang');
      case 'cfgreset': S.cfg = Object.assign({}, DEF); invalidate(); saveS(); render(); return sheetCfg();
      case 'insopen': return openInboxMode('insight');
    }
  }
  function reopenFor(key) { var P = getPlan(); var s = null; P.days.forEach(function (d) { d.sess.forEach(function (x) { if (x.key === key && !s) s = x; }); }); if (s) sheetSession(s.id); }
  function onChange(e) {
    var t = e.target; if (!t.dataset || t.dataset.sm !== 'cfgv') return;
    var k = t.dataset.k, v = t.type === 'checkbox' ? (t.checked ? 1 : 0) : t.value;
    if ((k === 'wake' || k === 'sleep') && tmin(v) == null) return;
    if (k === 'cap' || k === 'hor' || k === 'buf') v = +v;
    S.cfg[k] = v; var keepScroll = V.p.querySelector('.sm-sh').scrollTop; invalidate(); saveS(); var d = V.dirty; V.dirty = 0; render(); V.dirty = d;
  }

  /* ---------- render & mount ---------- */
  function render() {
    if (!V.c || !V.mode) return;
    if (V.sheet) { V.dirty = 1; return; }
    var top = V.c.scrollTop;
    try { V.c.innerHTML = V.mode === 'planner' ? plannerHtml(getPlan(true)) : insightHtml(); }
    catch (err) { V.c.innerHTML = '<div class="sm-view"><div class="sm-empty">Planner gagal dimuat (' + esc(err && err.message) + '). Muat ulang halaman.</div></div>'; if (window.console) console.error(err); }
    if (top) V.c.scrollTop = top;
  }
  function mount(c, mode, host) {
    V.c = c; V.mode = mode; V.host = host; if (!V.day) V.day = today();
    if (!c._sm) { c._sm = 1; c.addEventListener('click', onClick); c.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-sm="fix"],[data-sm="ses"]')) { e.preventDefault(); e.target.click(); } }); }
    if (V.day < today()) V.day = today();
    V.dirty = 0; render();
  }
  function unmount() { closeSheet(); V.c = null; V.mode = null; V.host = null; }

  /* ---------- Insight di setiap menu ---------- */
  var OVC = /(^|\s)(ac-ov|ad-ov|wo-ov|es-ov|fn-ov)(\s|$)/, LBL = { 'Project Management': 'proj', 'Task': 'task', 'Kalender': 'cal', 'Goal': 'goal', 'Document Center': 'docs', 'Analytics': 'an', 'Settings': 'set' };
  function curModule() {
    var ch = D.body ? D.body.children : [], found = null, i, el, cn;
    for (i = 0; i < ch.length; i++) {
      el = ch[i]; cn = typeof el.className === 'string' ? el.className : ''; if (el.hidden || !cn) continue;
      if (/(^|\s)ib-ov(\s|$)/.test(cn)) return null;
      if (OVC.test(cn) && !/ov2/.test(cn)) found = el;
    }
    if (!found) return null;
    var c = found.className, m = /ad-ov/.test(c) ? 'acad' : /wo-ov/.test(c) ? 'work' : /es-ov/.test(c) ? 'org' : /fn-ov/.test(c) ? 'fin' : null;
    if (!m) { var w = found.querySelector('[role="dialog"]'); m = w ? LBL[w.getAttribute('aria-label')] || null : null; }
    return m ? { m: m, el: found } : null;
  }
  function sheetModule(m) {
    V.modKey = m; var P = getPlan(true), list = forModule(m), d0 = P.days[0], nm = nowMin(), next = d0.fixed.filter(function (f) { return f.e > nm; })[0], ns = d0.sess.filter(function (s) { return s.e > nm; }).length;
    var h = '<div class="sm-grab"></div><div class="sm-mh"><div>' + svg(IC.spark, 'sm-sp2') + '<div><h3>Smart Insight</h3><small>' + esc(MODN[m] || '') + '</small></div></div><button class="sm-ib" data-sm="x" aria-label="Tutup">' + svg(IC.x) + '</button></div>';
    h += '<div class="sm-today"><span>Hari ini: <b>' + (next ? hm(next.s) + ' ' + esc(next.title) : 'tidak ada jadwal tetap lagi') + '</b> · ' + ns + ' sesi tersisa · <i class="lv-' + d0.lvl + '">' + LVC[d0.lvl] + '</i></span><button data-sm="act" data-k="m:plan">Buka Planner</button></div>';
    V.acts = { 'm:plan': { k: 'plan', d: today(), l: 'Planner' } };
    var shown = list.slice(0, 7), html = '', last = '';
    shown.forEach(function (i) { if (i.lvl !== last) { last = i.lvl; html += '<div class="sm-sec s-' + i.lvl + '">' + LVN[i.lvl] + '</div>'; } var keep = V.acts; html += cardHtml(i, 'm'); });
    var acts2 = V.acts; V.acts = Object.assign({ 'm:plan': { k: 'plan', d: today() } }, acts2);
    h += html + (list.length > shown.length ? '<button class="sm-more" data-sm="insopen">Lihat ' + (list.length - shown.length) + ' insight lain di Inbox</button>' : '');
    openSheet(h, 'mod'); V.ctx = 'mod';
  }

  /* v5.2: tombol Insight melayang (FAB) dihapus; Insight kini hanya lewat tab Insight di Inbox.
     Hanya tersisa penutup lembar insight dengan tombol Esc (bila dibuka lewat API MO.smart.openInsight). */
  function startWatch() {
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && V.p && !V.p.hidden) { closeSheet(); e.stopPropagation(); } }, true);
  }

  /* ---------- API ---------- */
  MO.smart = {
    mount: mount, unmount: unmount, refresh: function () { invalidate(); render(); }, invalidate: invalidate,
    plan: function () { return getPlan(true); }, insights: insights, forModule: forModule, counts: counts,
    openInsight: sheetModule, sheetOpen: function () { return !!(V.p && !V.p.hidden); }, closeSheet: closeSheet
  };
  /* v5.2: tombol ✦ Insight di setiap menu DIHAPUS — Insight kini hanya ada di Inbox (tab Insight). */
})();
