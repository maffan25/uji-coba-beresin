/* quick.js (v5.7) — Perintah Cepat: ketik satu kalimat, langsung terintegrasi ke modul tujuan.
   Dibuka lewat tombol plus biru di beranda (.sf-fab).
   Contoh  : "buat jadwal rapat BEM hari senin jam 14.00 di aula bersama Budi, ingatkan 30 menit sebelumnya"
             "tugas makalah hukum acara sudah selesai"
             "buat tugas laporan deadline besok jam 17.00"
             "ingatkan saya bayar UKT besok jam 8 pagi"
             "jadwal besok"
   Aksi    : Jadwal  -> acara Kalender (+ pengingat, deteksi bentrok, saran jam kosong)
             Selesai -> mencentang tugas yang cocok di SEMUA modul (sama seperti item di Inbox)
             Tugas / Pengingat -> menambah to-do di menu Task (+ remindAt)
             Agenda  -> ringkasan hari (kuliah, acara, ujian, tenggat, bentrok)
   Keamanan: tidak mengubah file lama. Data ditulis lewat objek hidup modul (MO.apps / MO.acadData) lalu disimpan
             oleh modul itu sendiri (pola yang sama dengan inbox.js). Semua aksi bisa DIURUNGKAN.
   Titik sambung kecil di file lain: index.html (muat quick.css/quick.js), sw.js (cache), pages.js (daftar lapisan
   'qc-ov' agar tombol Kembali di HP menutup panel ini). Data kuliah dibaca dari MO.acadData.D() = gabungan semua kampus
   (record = objek yang sama, jadi centang tersimpan benar). */
(function () {
  'use strict';
  var D = document, MO = window.MyOffice = window.MyOffice || {};
  if (MO.quick) return;

  /* ================= util ================= */
  var NOW = function () { return new Date(); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var today = function () { return ymd(NOW()); };
  var mk = function (s) { var a = s.split('-'); return new Date(+a[0], a[1] - 1, +a[2], 12); };
  var addDay = function (s, n) { var d = mk(s); d.setDate(d.getDate() + n); return ymd(d); };
  var dayDiff = function (a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+x[0], x[1] - 1, +x[2]) - Date.UTC(+y[0], y[1] - 1, +y[2])) / 864e5); };
  var tmin = function (t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  var mt = function (n) { n = Math.max(0, Math.min(1439, Math.round(n))); return pad(Math.floor(n / 60)) + ':' + pad(n % 60); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uid = function () { return (MO.kit && MO.kit.uid) ? MO.kit.uid() : Math.random().toString(36).slice(2, 9); };
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var fd = function (s) { var a = s.split('-'); return +a[2] + ' ' + BLN[a[1] - 1] + ' ' + a[0]; };
  var fdw = function (s) {
    var dd = dayDiff(s, today()), n = dd === 0 ? 'Hari ini' : dd === 1 ? 'Besok' : dd === 2 ? 'Lusa' : HARI[mk(s).getDay()];
    return n + ', ' + fd(s);
  };
  var hm = function (t) { return String(t || '').replace(':', '.'); };
  var cap = function (s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  var DONE = /^(Selesai|Done|Tercapai|Completed)$/i, CANC = /^(Dibatalkan|Archived|Batal|Cancelled)$/i;
  var fin = function (s) { return DONE.test(s || '') || CANC.test(s || ''); };

  /* ================= akses data modul (objek hidup, sama dengan inbox.js) ================= */
  var STORES = { task: 'mo-task-v1', cal: 'mo-cal-v1', work: 'mo-work-v1', org: 'mo-org-v1', proj: 'mo-proj-v1', goal: 'mo-goal-v1', acad: 'mo-acad-v1' };
  var FB = {};
  function data(sk) {
    if (sk === 'acad') { if (MO.acadData && MO.acadData.D()) return MO.acadData.D(); }
    else { var ap = MO.apps && MO.apps[STORES[sk]]; if (ap && ap.D) return ap.D; }
    if (!FB[sk]) { try { FB[sk] = JSON.parse(localStorage.getItem(STORES[sk])) || {}; } catch (e) { FB[sk] = {}; } }
    return FB[sk];
  }
  function persist(sk) {
    if (sk === 'acad' && MO.acadData) return MO.acadData.save();
    var ap = MO.apps && MO.apps[STORES[sk]]; if (ap && ap.save) return ap.save();
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
  function cfgSmart() { try { var o = JSON.parse(localStorage.getItem('mo-smart-v1')); return (o && o.cfg) || {}; } catch (e) { return {}; } }

  /* ================= parser tanggal / jam bahasa Indonesia ================= */
  var MONTHS = { januari: 1, jan: 1, februari: 2, feb: 2, pebruari: 2, maret: 3, mar: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agu: 8, agt: 8, agus: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, nop: 11, desember: 12, des: 12 };
  var MRX = '(januari|pebruari|februari|maret|april|agustus|september|oktober|november|desember|agus|agu|agt|sept|sep|okt|nov|nop|des|jan|feb|mar|apr|mei|juni|juli|jun|jul)';
  var WDN = { minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
  var WRX = "(senin|selasa|rabu|kamis|jum['’]?at|sabtu|minggu|ahad)";
  var valid = function (y, m, d) { var x = new Date(y, m - 1, d, 12); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d; };
  function wdIndex(w) { w = w.toLowerCase().replace(/['’]/g, ''); return WDN[w]; }

  function cut(s, m) { return s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); }
  var snap = function (n) { var o = [0, 5, 15, 30, 60, 1440], b = o[0]; o.forEach(function (v) { if (Math.abs(v - n) < Math.abs(b - n)) b = v; }); return b; };

  function xReminder(s, r) {
    var m = /(?:\b(?:dan\s+)?(?:tolong\s+)?(?:ingatkan|ingetin|ingat\s*kan|pengingat|reminder|alarm)(?:\s+(?:saya|aku|gue|ku|nya))?(?:\s+(?:untuk|ya|dong))?\s*)(?:(\d+(?:[.,]\d+)?)\s*(menit|jam|hari)(?:\s+sebelum(?:nya)?)?|(setengah|sejam|sehari|tepat\s+waktu|saat\s+itu\s+juga))?/i.exec(s);
    var m2 = !m && /\b(\d+(?:[.,]\d+)?)\s*(menit|jam|hari)\s+sebelum(?:nya)?\b/i.exec(s);
    var mm = m || m2; if (!mm) return s;
    r.hasRemind = true;
    if (mm[1]) { var n = parseFloat(String(mm[1]).replace(',', '.')), u = mm[2].toLowerCase(); r.remindRaw = Math.round(n * (u === 'jam' ? 60 : u === 'hari' ? 1440 : 1)); }
    else if (mm[3]) { var w = mm[3].toLowerCase().replace(/\s+/g, ' '); r.remindRaw = w === 'setengah' ? 30 : w === 'sejam' ? 60 : w === 'sehari' ? 1440 : 0; }
    if (r.remindRaw != null) r.remind = String(snap(r.remindRaw));
    return cut(s, mm);
  }

  function xDuration(s, r) {
    var m = /\b(?:selama\s+)?(?:(\d+(?:[.,]\d+)?)\s*(jam|menit)|setengah\s+jam|sejam|satu\s+jam|dua\s+jam|tiga\s+jam)\b(?!\s*\d)(?!\s+sebelum)/i.exec(s);
    if (!m) return s;
    var low = m[0].toLowerCase(), n;
    if (m[1]) n = Math.round(parseFloat(m[1].replace(',', '.')) * (m[2].toLowerCase() === 'jam' ? 60 : 1));
    else n = /setengah/.test(low) ? 30 : /dua/.test(low) ? 120 : /tiga/.test(low) ? 180 : 60;
    if (n >= 5 && n <= 720) { r.dur = n; return cut(s, m); }
    return s;
  }

  function hr(h, per) {
    if (per) per = per.toLowerCase();
    if (per === 'siang') return h < 11 ? h + 12 : h;
    if (per === 'sore' || per === 'petang') return h < 12 ? h + 12 : h;
    if (per === 'malam') return h === 12 ? 0 : (h >= 5 && h < 12 ? h + 12 : h);
    return h;
  }
  function xTime(s, r) {
    var m, h, mi, per;
    var RG = /(?:\bdari\s+)?(?:\b(?:jam|pukul)\s*)(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|s\/d|sd|sampai|hingga)\s*(?:(?:jam|pukul)\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|petang|malam)?/i;
    var RG2 = /\b(\d{1,2})[:.](\d{2})\s*(?:-|–|—|s\/d|sd|sampai|hingga)\s*(\d{1,2})[:.](\d{2})\b/;
    if ((m = RG.exec(s) || RG2.exec(s)) && +m[1] < 24 && +m[3] < 24) {
      per = m[5];
      var a = +m[1], b = +m[3];
      if (per) { b = hr(b, per); if (b - a > 12 && a + 12 <= b) a += 12; }
      else if (a >= 1 && b <= 7 && a < b) { a += 12; b += 12; r.assumed = 'Saya anggap jam ' + hm(mt(a * 60)) + '–' + hm(mt(b * 60)) + ' (sore) — ubah bila salah.'; }
      r.t0 = mt(a * 60 + (+m[2] || 0)); r.t1 = mt(b * 60 + (+m[4] || 0));
      return cut(s, m);
    }
    if ((m = /\b(?:jam|pukul)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|petang|malam|subuh)?/i.exec(s)) && +m[1] < 25) {
      h = +m[1]; mi = +m[2] || 0; per = m[3];
      if (h === 24) h = 0;
      var h2 = hr(h, per);
      if (!per && h >= 1 && h <= 6) { h2 = h + 12; r.assumed = 'Saya anggap jam ' + hm(mt(h2 * 60)) + ' (sore) — ubah bila salah.'; }
      r.t0 = mt(h2 * 60 + mi); return cut(s, m);
    }
    if ((m = /(?:^|[^\d.:\/-])(\d{1,2})[:.](\d{2})(?![\d:.])(?!\s*(?:jt|rb|ribu|juta))/.exec(s)) && +m[1] < 24 && +m[2] < 60) {
      var idx = m.index + m[0].indexOf(m[1]);
      r.t0 = mt(+m[1] * 60 + +m[2]);
      return s.slice(0, idx) + ' ' + s.slice(idx + (m[1].length + 1 + m[2].length));
    }
    return s;
  }

  function xDate(s, r) {
    var td = today(), t = mk(td), m, per;
    /* kata waktu setelah penanda hari: "besok sore" -> besok + sore */
    if ((m = /\b(besok|lusa|nanti|hari\s+ini|tadi|senin|selasa|rabu|kamis|jum['’]?at|sabtu|minggu|ahad)\s+(pagi|siang|sore|malam)\b/i.exec(s))) { per = m[2]; s = s.slice(0, m.index) + m[1] + s.slice(m.index + m[0].length); }
    else if ((m = /\b(pagi|siang|sore|malam)\s+ini\b/i.exec(s))) { per = m[1]; s = s.slice(0, m.index) + ' hari ini ' + s.slice(m.index + m[0].length); }
    if (per) r.period = per.toLowerCase();

    if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s)) && valid(+m[1], +m[2], +m[3])) { r.d = m[0]; return cut(s, m); }
    var RT = new RegExp('\\b(?:pada\\s+)?(?:tanggal|tgl\\.?)\\s*(\\d{1,2})(?:\\s+(?:bulan\\s+)?' + MRX + ')?(?:\\s+(\\d{4}))?\\b', 'i');
    var RM = new RegExp('\\b(?:pada\\s+)?(\\d{1,2})\\s+' + MRX + '(?:\\s+(\\d{4}))?\\b', 'i');
    var RS = /\b(?:pada\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/;
    function fromDM(dd, mo, yr) {
      var y = yr ? (yr < 100 ? 2000 + yr : yr) : t.getFullYear();
      if (!valid(y, mo, dd)) return null;
      var d = y + '-' + pad(mo) + '-' + pad(dd);
      if (!yr && dayDiff(d, td) < 0) { if (!valid(y + 1, mo, dd)) return null; d = (y + 1) + '-' + pad(mo) + '-' + pad(dd); }
      return d;
    }
    if ((m = RM.exec(s)) && MONTHS[m[2].toLowerCase()]) { var d1 = fromDM(+m[1], MONTHS[m[2].toLowerCase()], m[3] ? +m[3] : 0); if (d1) { r.d = d1; return cut(s, m); } }
    if ((m = RT.exec(s))) {
      var dd = +m[1], d2;
      if (m[2] && MONTHS[m[2].toLowerCase()]) d2 = fromDM(dd, MONTHS[m[2].toLowerCase()], m[3] ? +m[3] : 0);
      else {
        var y = t.getFullYear(), mo = t.getMonth() + 1;
        if (dd < t.getDate()) { mo++; if (mo > 12) { mo = 1; y++; } }
        d2 = valid(y, mo, dd) ? y + '-' + pad(mo) + '-' + pad(dd) : null;
      }
      if (d2) { r.d = d2; return cut(s, m); }
    }
    if ((m = RS.exec(s)) && +m[2] >= 1 && +m[2] <= 12) { var d3 = fromDM(+m[1], +m[2], m[3] ? +m[3] : 0); if (d3) { r.d = d3; return cut(s, m); } }

    if ((m = /\b(\d+)\s+hari\s+(lagi|ke\s+depan|kedepan)\b/i.exec(s))) { r.d = addDay(td, +m[1]); return cut(s, m); }
    if ((m = /\b(?:pada\s+)?(besok\s+lusa|lusa|besok|hari\s+ini)\b/i.exec(s))) {
      var w = m[1].toLowerCase().replace(/\s+/g, ' ');
      r.d = addDay(td, w === 'hari ini' ? 0 : w === 'besok' ? 1 : 2); return cut(s, m);
    }
    var nextWeek = false, mw;
    if ((mw = /\b(?:di\s+)?minggu\s+(?:depan|besok)\b/i.exec(s))) { nextWeek = true; s = cut(s, mw); }
    var RW = new RegExp('\\b(?:pada\\s+)?(?:hari\\s+)?' + WRX + '(?:\\s+(depan|ini|besok))?\\b', 'i');
    if ((m = RW.exec(s))) {
      var wd = wdIndex(m[1]), nxt = nextWeek || (m[2] && /depan|besok/i.test(m[2])), dow = (t.getDay() + 6) % 7, off = (wd + 6) % 7, dd2;
      if (!(wd === 0 && /^minggu$/i.test(m[1]) && !/hari\s+minggu/i.test(m[0]) && !m[2] && !nextWeek && false)) {
        if (nxt) dd2 = (7 - dow) + off; else { dd2 = off - dow; if (dd2 < 0) dd2 += 7; }
        r.d = addDay(td, dd2); return cut(s, m);
      }
    }
    if (nextWeek) { r.d = addDay(td, 7); }
    return s;
  }

  function xPeople(s, r) {
    var m = /\b(?:bersama|dengan|bareng|sama)\s+(.+?)(?=\s+(?:di|pada|untuk|selama|ingatkan|pengingat|jam|pukul|hari|tanggal|tgl|besok|lusa|nanti)\b|[;.]\s|$)/i.exec(s);
    if (!m) return s;
    var raw = m[1].replace(/[,;.\s]+$/, '');
    var ppl = raw.split(/\s*(?:,|&|\+|\bdan\b)\s*/i).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!ppl.length) return s;
    r.people = ppl; return cut(s, m);
  }
  function xPlace(s, r) {
    var m = /\b(?:di|ke|@)\s+(.+?)(?=\s+(?:bersama|dengan|bareng|sama|pada|untuk|selama|ingatkan|pengingat|jam|pukul|hari|tanggal|tgl|besok|lusa|nanti)\b|[,;]|$)/i.exec(s);
    if (!m) return s;
    var loc = m[1].replace(/[,;.\s]+$/, '').trim();
    if (!loc) return s;
    r.place = loc; return cut(s, m);
  }

  var CREATE = /^\s*(?:tolong\s+)?(?:buat(?:kan)?|bikin(?:kan)?|tambah(?:kan)?|catat(?:kan)?|jadwalkan|atur|set|masukkan|input|add|create)\b\s*/i;
  var EVN = /\b(rapat|meeting|janji|kuliah|kelas|acara|agenda|jadwal|kegiatan|kajian|presentasi|ujian|sidang|pertemuan|bertemu|ketemu|konsul|bimbingan|seminar|webinar|olahraga|latihan|praktikum|kunjungan|syuro|rakor|musyawarah|diskusi|workshop|training)\b/i;
  function cleanTitle(s, drop) {
    s = String(s || '');
    if (drop) s = s.replace(drop, ' ');
    s = s.replace(CREATE, ' ').replace(/^\s*(?:tolong\s+)?(?:jadwal|jawal|jadual|jdwl|jadwl|acara|agenda|kegiatan)\b\s*/i, ' ');
    s = s.replace(/\b(tolong|dong|deh|ya|please|nanti|kak)\b/gi, ' ');
    s = s.replace(/\b(deadline|tenggat|due|paling\s+lambat|batas\s+waktu)\b/gi, ' ');
    s = s.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
    for (var i = 0; i < 3; i++) s = s.replace(/\s+(pada|di|ke|untuk|jam|pukul|dari|sampai|hari|tanggal|tgl|dan|dengan|bersama|sama)$/i, '').replace(/^(pada|di|untuk|dan)\s+/i, '');
    return s.trim();
  }

  /* ================= parse: kalimat -> maksud + isian ================= */
  var DONE_RX = /\b(?:sudah|udah|telah|dah|sdh|sudh|abis|baru\s+saja|barusan)?\s*(?:selesai|selese|beres|kelar|tuntas|rampung|dikerjakan|dikerjain|kukerjakan|ku\s*kerjakan|di\s*kerjakan|dicentang|dikumpul(?:kan)?|terkumpul)\b/i;
  var DONE_PRE = /^\s*(?:tolong\s+)?(?:centang|ceklis|ceklist|checklist|check|tandai|selesaikan|tuntaskan|beresin|kelarin)\b\s*/i;
  var AGENDA_RX = /^\s*(?:tolong\s+)?(?:(?:lihat|cek|tampilkan|tunjukkan|buka|apa|ada\s+apa(?:\s+saja)?)\s+)?(?:jadwal|jawal|agenda|acara|kegiatan)\b/i;

  function parse(text) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    var r = { raw: raw, intent: 'unknown' };
    if (!raw) return r;

    var isCreate = CREATE.test(raw), after = raw.replace(CREATE, '');
    var first = (after.match(/^[a-z-]+/i) || [''])[0].toLowerCase();

    /* 1) selesai */
    if (!isCreate && (DONE_PRE.test(raw) || (DONE_RX.test(raw) && !/^\s*ingatkan/i.test(raw)))) {
      var q = raw.replace(DONE_PRE, ' ').replace(DONE_RX, ' ');
      q = q.replace(/\b(?:sudah|udah|telah|dah|sdh|sudh|tolong|dong|ya|deh|dari)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      r.intent = 'done'; r.q = q; return r;
    }

    /* 2) ingatkan ... */
    var remindLead = /^\s*(?:tolong\s+)?(?:ingatkan|ingetin|ingat\s*kan)\b/i.test(raw);

    var s = raw, X = {};
    s = xReminder(s, X); s = xDuration(s, X); s = xTime(s, X); s = xDate(s, X);

    /* 3) agenda (lihat jadwal) */
    if (!isCreate && !remindLead && (AGENDA_RX.test(raw) || /^\s*(?:ada\s+apa|apa\s+saja|apa\s+yang)\b/i.test(raw) || /\bada\s+apa\b/i.test(raw))) {
      var rest = s.replace(AGENDA_RX, ' ').replace(/\b(ada\s+apa(?:\s+saja)?|apa\s+saja|apa|lihat|cek|tampilkan|tunjukkan|buka|jadwal|agenda|acara|kegiatan|saya|aku|ku|ku|hari|pada|di|untuk)\b/gi, ' ').replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!X.t0 && !rest || /^\s*(?:lihat|cek|tampilkan|tunjukkan|buka|ada\s+apa|apa)\b/i.test(raw)) {
        r.intent = 'agenda'; r.d = X.d || today(); return r;
      }
    }

    var kind = isCreate ? (/^(tugas|task|to-?do|todo)$/.test(first) ? 'task' : /^(pengingat|reminder|alarm)$/.test(first) ? 'remind' : 'event')
      : remindLead ? 'remind' : /^\s*(?:tugas|task|todo|to-do)\b/i.test(raw) ? 'task' : null;
    if (!kind) kind = (X.d || X.t0 || X.period) && EVN.test(raw) ? 'event' : null;
    if (!kind) return r;

    var f = { raw: raw, intent: kind, d: X.d || '', t0: X.t0 || '', t1: X.t1 || '', dur: X.dur || 0, remind: X.remind, hasRemind: !!X.hasRemind, assumed: X.assumed || '', approx: '' };
    if (!f.t0 && X.period) {
      var P = { pagi: '08:00', siang: '13:00', sore: '16:00', malam: '19:30' };
      f.t0 = P[X.period]; f.approx = 'Jam diperkirakan dari kata "' + X.period + '" — sesuaikan bila perlu.';
    }

    if (kind === 'event') {
      s = xPeople(s, X); s = xPlace(s, X);
      f.people = X.people || []; f.place = X.place || '';
      var title = cleanTitle(s);
      var ppl = f.people.join(' dan ');
      if (!title) title = ppl ? 'Bertemu ' + ppl : 'Jadwal baru';
      else if (ppl) title += ' bersama ' + ppl;
      f.title = cap(title);
      if (!f.d) f.d = today();
      if (f.t0 && !f.t1) f.t1 = mt(Math.min(1439, tmin(f.t0) + (f.dur || 60)));
      if (f.t0 && f.t1 && tmin(f.t1) <= tmin(f.t0)) f.t1 = mt(Math.min(1439, tmin(f.t0) + (f.dur || 60)));
      if (!f.hasRemind) f.remind = '15';
      if (f.remind == null) f.remind = '15';
      return f;
    }

    /* tugas / pengingat */
    s = s.replace(/\b(?:penting|urgent|mendesak|prioritas\s+tinggi|prioritas|high)\b/gi, function () { f.priority = 'High'; return ' '; });
    s = s.replace(/\b(?:prioritas\s+rendah|santai|low)\b/gi, function () { f.priority = 'Low'; return ' '; });
    s = s.replace(/^\s*(?:tolong\s+)?(?:buat(?:kan)?|bikin(?:kan)?|tambah(?:kan)?|catat(?:kan)?|masukkan|input|add|create)?\s*(?:tugas|task|to-?do|todo|pengingat|reminder|alarm)\b/i, ' ');
    s = s.replace(/^\s*(?:tolong\s+)?(?:ingatkan|ingetin|ingat\s*kan)(?:\s+(?:saya|aku|gue|ku))?\b/i, ' ').replace(/^\s*(?:untuk|agar|supaya)\b/i, ' ');
    f.title = cap(cleanTitle(s)) || (kind === 'remind' ? 'Pengingat' : 'Tugas baru');
    f.priority = f.priority || 'Medium';
    if (kind === 'remind') {
      if (!f.d) { f.d = (f.t0 && tmin(f.t0) <= tmin(mt(NOW().getHours() * 60 + NOW().getMinutes() + 1))) ? addDay(today(), 1) : today(); }
      f.remind = X.hasRemind && X.remind != null ? X.remind : '0';
    } else { f.remind = X.hasRemind && X.remind != null ? X.remind : ''; }
    return f;
  }

  /* ================= cari item untuk dicentang ================= */
  var STOPW = { tugas: 1, task: 1, todo: 1, 'to': 1, 'do': 1, pekerjaan: 1, kerjaan: 1, yang: 1, untuk: 1, buat: 1, bikin: 1, tentang: 1, mengenai: 1, soal: 1, si: 1, ke: 1, itu: 1, ini: 1, saya: 1, aku: 1, gue: 1, ku: 1, dari: 1, nya: 1, dan: 1, di: 1, sudah: 1, udah: 1, mata: 1, kuliah: 0 };
  function toks(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff]+/g, ' ').split(' ').filter(function (w) { return w.length > 1 && !STOPW[w]; });
  }
  function hit(t, w) { return w === t || (t.length >= 4 && w.indexOf(t) === 0) || (w.length >= 4 && t.indexOf(w) === 0) || (t.length >= 5 && w.indexOf(t) > -1); }
  function score(q, it) {
    var qt = toks(q); if (!qt.length) return 0;
    var tt = toks(it.title), ht = toks(it.title + ' ' + (it.ctx || '')), m = 0, mt_ = 0;
    var wsum = 0;
    qt.forEach(function (t) {
      var inT = tt.some(function (w) { return hit(t, w); });
      if (inT) { mt_++; wsum += 1; m++; }
      else if (ht.some(function (w) { return hit(t, w); })) { m++; wsum += 0.6; }
    });
    var qcov = wsum / qt.length, tcov = tt.length ? mt_ / tt.length : 0;
    var sc = qcov * 0.75 + tcov * 0.25;
    var low = String(it.title).toLowerCase(), ql = String(q).toLowerCase().trim();
    if (ql && low.indexOf(ql) > -1) sc = Math.max(sc, 0.9);
    return sc;
  }

  function openItems() {
    var out = [], td = today();
    function add(o) { o.k = o.sk + ':' + o.id; out.push(o); }
    var done = function () { return { status: 'Done', doneAt: td }; }, sel = function (s) { return function () { return { status: s }; }; };
    var T = data('task').task || [], A = data('acad'), W = data('work'), O = data('org'), P = data('proj'), G = data('goal');
    T.forEach(function (t) {
      if (fin(t.status) || (t.kind === 'event')) return;
      add({ sk: 'task', arr: 'task', id: t.id, mod: t.parentId ? 'Sub-tugas' : 'Task', title: t.title, ctx: t.category, date: t.due || '', comp: done });
    });
    var cs = {}; (A.course || []).forEach(function (c) { cs[c.id] = c; });
    (A.task || []).forEach(function (x) { if (fin(x.status) || x.done) return; var c = cs[x.courseId]; add({ sk: 'acad', arr: 'task', id: x.id, mod: 'Tugas kuliah', title: x.title, ctx: [c && c.name, x.type].filter(Boolean).join(' '), date: x.deadline || '', comp: sel('Selesai') }); });
    (W.job || []).forEach(function (j) { if (fin(j.status)) return; add({ sk: 'work', arr: 'job', id: j.id, mod: 'Pekerjaan', title: j.title, ctx: j.client || '', date: j.deadline || '', comp: sel('Selesai') }); });
    (W.wtask || []).forEach(function (x) { if (fin(x.status)) return; var j = (W.job || []).filter(function (q) { return q.id === x.jobId; })[0]; add({ sk: 'work', arr: 'wtask', id: x.id, mod: 'Tugas kerja', title: x.title, ctx: j && j.title, date: x.deadline || '', comp: sel('Selesai') }); });
    (O.followup || []).forEach(function (f) { if (fin(f.status)) return; add({ sk: 'org', arr: 'followup', id: f.id, mod: 'Organisasi', title: f.task, ctx: 'tindak lanjut rapat', date: f.due || '', comp: sel('Selesai') }); });
    (P.proj || []).forEach(function (p) { if (fin(p.status)) return; add({ sk: 'proj', arr: 'proj', id: p.id, mod: 'Proyek', title: p.name, date: p.target || '', comp: sel('Selesai') }); });
    (P.ptask || []).forEach(function (x) { if (fin(x.status)) return; var p = (P.proj || []).filter(function (q) { return q.id === x.projId; })[0]; add({ sk: 'proj', arr: 'ptask', id: x.id, mod: 'Tugas proyek', title: x.title, ctx: p && p.name, date: x.due || '', comp: sel('Selesai') }); });
    (P.ms || []).forEach(function (m) { if (m.done) return; var p = (P.proj || []).filter(function (q) { return q.id === m.projId; })[0]; add({ sk: 'proj', arr: 'ms', id: m.id, mod: 'Milestone', title: m.title, ctx: p && p.name, date: m.date || '', comp: function () { return { done: true, doneAt: td }; } }); });
    (G.goal || []).forEach(function (g) { if (fin(g.status)) return; add({ sk: 'goal', arr: 'goal', id: g.id, mod: 'Goal', title: g.name, date: g.deadline || '', comp: sel('Tercapai') }); });
    out = out.filter(function (o) { return o.title; });
    return out;
  }
  function findItems(q) {
    var items = openItems();
    var res = items.map(function (it) { return { it: it, sc: score(q, it) }; }).filter(function (x) { return x.sc >= 0.34; })
      .sort(function (a, b) { return (b.sc - a.sc) || String(a.it.date || '9').localeCompare(String(b.it.date || '9')); });
    return res;
  }
  function complete(it) { var u = patch(it, it.comp()); return u; }

  /* ================= jadwal tetap: bentrok & jam kosong ================= */
  var DAYRX = /\b(minggu|ahad|senin|selasa|rabu|kamis|jumat|sabtu)\b/g;
  var RANGE = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|s\/d|sd|sampai|hingga)\s*(\d{1,2})(?:[:.](\d{2}))?/, ONE = /(?:jam|pukul)?\s*(\d{1,2})[:.](\d{2})/;
  function parseSched(str, sks) {
    var s = String(str || '').toLowerCase().replace(/['’`]/g, ''), ms = [], m, out = [], pend = [];
    DAYRX.lastIndex = 0; while ((m = DAYRX.exec(s))) ms.push({ wd: WDN[m[1]], i: m.index, j: m.index + m[0].length });
    var dflt = (+sks > 0 ? +sks : 2) * 50;
    ms.forEach(function (d, k) {
      var seg = s.slice(d.j, k + 1 < ms.length ? ms[k + 1].i : s.length), c = seg.search(/[;\n]/); if (c > -1) seg = seg.slice(0, c);
      pend.push(d.wd);
      var a = null, b = null, rg = RANGE.exec(seg), o;
      if (rg && +rg[1] < 24 && +rg[3] < 24 && (rg[2] || rg[4] || rg[0].indexOf(':') > -1 || rg[0].indexOf('.') > -1 || (+rg[3] > +rg[1]))) { a = +rg[1] * 60 + (+rg[2] || 0); b = +rg[3] * 60 + (+rg[4] || 0); if (b <= a) b = a + dflt; }
      else if ((o = ONE.exec(seg)) && +o[1] < 24) { a = +o[1] * 60 + +o[2]; b = a + dflt; }
      if (a != null) { pend.forEach(function (w) { out.push({ wd: w, s: a, e: b }); }); pend = []; }
    });
    return out;
  }
  var exDur = function (type) { return /kuis|quiz/i.test(type) ? 30 : /presentasi/i.test(type) ? 45 : 120; };

  /* semua kegiatan pada satu tanggal: blok berjam (menghalangi) + catatan lunak */
  function dayInfo(date, skipId) {
    var blocks = [], soft = [], C = data('cal'), T = data('task').task || [], A = data('acad');
    (C.ev || []).forEach(function (e) {
      if (e.tk || e.sp || !e.start || (skipId && e.id === skipId)) return;
      var sd = String(e.start).slice(0, 10), ed = String(e.end || e.start).slice(0, 10);
      if (date < sd || date > ed) return;
      if (e.allDay || !e.startTime) { soft.push({ label: e.title, note: 'seharian' }); return; }
      var s = tmin(e.startTime), en = e.endTime ? tmin(e.endTime) : s + 60;
      if (sd !== ed) { if (date === sd) en = 1440; else if (date === ed) { s = 0; en = e.endTime ? tmin(e.endTime) : 60; } else { s = 0; en = 1440; } }
      if (en <= s) en = s + 60;
      blocks.push({ s: s, e: en, label: e.title, src: 'Kalender' });
    });
    T.forEach(function (t) {
      if (t.kind !== 'event' || fin(t.status) || t.due !== date) return;
      if (!t.dueTime) { soft.push({ label: t.title, note: 'tanpa jam' }); return; }
      var s = tmin(t.dueTime), en = t.endTime ? tmin(t.endTime) : s + 60; if (en <= s) en = s + 60;
      blocks.push({ s: s, e: en, label: t.title, src: 'Task' });
    });
    var sems = {}; (A.sem || []).forEach(function (x) { sems[x.id] = x; });
    var wd = mk(date).getDay();
    (A.course || []).forEach(function (c) {
      var sm = sems[c.semId]; if (!(sm && sm.active) || !c.schedule) return;
      parseSched(c.schedule, c.sks).forEach(function (p) { if (p.wd === wd) blocks.push({ s: p.s, e: p.e, label: c.name, src: 'Kuliah' }); });
    });
    (A.exam || []).forEach(function (x) {
      if (x.done || !x.date || String(x.date).slice(0, 10) !== date) return;
      var c = (A.course || []).filter(function (q) { return q.id === x.courseId; })[0], lb = (x.type || 'Ujian') + (c ? ' ' + c.name : '');
      var tm = String(x.date).slice(11, 16), s = tmin(tm);
      if (s == null) { soft.push({ label: lb, note: 'jam belum diisi' }); return; }
      blocks.push({ s: s, e: s + exDur(x.type), label: lb, src: 'Ujian' });
    });
    var dl = openItems().filter(function (it) { return String(it.date || '').slice(0, 10) === date; });
    blocks.sort(function (a, b) { return a.s - b.s; });
    return { blocks: blocks, soft: soft, due: dl };
  }
  function clash(info, s, e) { return info.blocks.filter(function (b) { return b.s < e && b.e > s; }); }

  function dayWindow() {
    var c = cfgSmart(), w = tmin(c.wake), sl = tmin(c.sleep);
    var a = w != null ? w + 60 : 7 * 60, b = sl != null ? sl - 30 : 21 * 60 + 30;
    a = Math.max(6 * 60, Math.min(a, 10 * 60)); b = Math.max(18 * 60, Math.min(b, 23 * 60));
    return [a, b];
  }
  function slotsOn(date, dur, pref, skipId, limit) {
    var info = dayInfo(date, skipId), win = dayWindow(), buf = 10, out = [], nowMin = null;
    if (date === today()) { var n = NOW(); nowMin = Math.ceil((n.getHours() * 60 + n.getMinutes() + 15) / 15) * 15; }
    for (var s = win[0]; s + dur <= win[1]; s += 15) {
      if (nowMin != null && s < nowMin) continue;
      var ok = !info.blocks.some(function (b) { return b.s - buf < s + dur && b.e + buf > s; });
      if (ok) out.push(s);
    }
    out.sort(function (a, b) { return Math.abs(a - pref) - Math.abs(b - pref); });
    var pick = [];
    out.forEach(function (s) { if (pick.length < (limit || 3) && pick.every(function (p) { return Math.abs(p - s) >= 45; })) pick.push(s); });
    return pick.sort(function (a, b) { return a - b; });
  }
  function suggest(f) {
    var s0 = tmin(f.t0), dur = (tmin(f.t1) - s0) || 60, res = [];
    var same = slotsOn(f.d, dur, s0, f.skipId, 3);
    same.forEach(function (s) { res.push({ d: f.d, t0: mt(s), t1: mt(s + dur) }); });
    if (res.length < 2) {
      for (var i = 1; i <= 3 && res.length < 4; i++) {
        var d = addDay(f.d, i), sl = slotsOn(d, dur, s0, f.skipId, 1);
        if (sl.length) res.push({ d: d, t0: mt(sl[0]), t1: mt(sl[0] + dur) });
      }
    }
    return res;
  }

  /* ================= aksi: buat acara / tugas ================= */
  function createEvent(f) {
    var ap = MO.apps && MO.apps['mo-cal-v1'], C = data('cal');
    if (!C.ev) C.ev = [];
    var cats = C.cat || [], cat = cats.filter(function (c) { return c.id === 'c4'; })[0] ? 'c4' : '';
    var allDay = !f.t0;
    var notes = [f.people && f.people.length ? 'Bersama: ' + f.people.join(', ') : '', 'Dibuat lewat Perintah Cepat'].filter(Boolean).join('\n');
    var ev = { id: uid(), title: f.title, catId: cat, kind: '', allDay: allDay, remind: f.remind == null ? '' : String(f.remind), start: f.d, end: f.d, startTime: allDay ? '' : f.t0, endTime: allDay ? '' : (f.t1 || ''), location: f.place || '', notes: notes, confirmed: true, qc: 1 };
    C.ev.push(ev); persist('cal');
    askNotif(ev.remind !== '');
    return function () { var i = C.ev.indexOf(ev); if (i < 0) { for (i = 0; i < C.ev.length; i++) if (C.ev[i].id === ev.id) break; } if (i > -1 && i < C.ev.length) C.ev.splice(i, 1); persist('cal'); };
  }
  function createTask(f) {
    var T = data('task'); if (!T.task) T.task = [];
    var rec = { id: uid(), kind: 'todo', title: f.title, status: 'To Do', priority: f.priority || 'Medium', due: f.d || '', dueTime: f.t0 || '', endTime: '', category: '', desc: 'Dibuat lewat Perintah Cepat', pin: false, doneAt: '', parentId: '', remindAt: '', goalRef: '', projId: '' };
    if (f.remind !== '' && f.remind != null && f.d) {
      var base = f.t0 ? tmin(f.t0) : 9 * 60, at = base - (+f.remind || 0), dd = f.d;
      while (at < 0) { at += 1440; dd = addDay(dd, -1); }
      rec.remindAt = dd + 'T' + mt(at);
    }
    T.task.push(rec); persist('task');
    askNotif(!!rec.remindAt);
    return function () { var i; for (i = 0; i < T.task.length; i++) if (T.task[i].id === rec.id) { T.task.splice(i, 1); break; } persist('task'); };
  }
  function askNotif(want) { try { if (want && window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { } }

  MO.quick = {
    parse: parse, findItems: findItems, openItems: openItems, dayInfo: dayInfo, suggest: suggest, clash: clash,
    createEvent: createEvent, createTask: createTask, complete: complete, score: score,
    _setNow: function (fn) { NOW = fn; }
  };

  /* =====================================================================================
     UI
     ===================================================================================== */
  var ov, sheet, inp, res, undoFn = null, cur = null, recog = null, tmr = 0;
  var IC = {
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', send: '<path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/>', check: '<path d="M20 6 9 17l-5-5"/>', warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
  };
  var svg = function (p, c) { return '<svg class="' + (c || 'qc-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var EX = [
    'buat jadwal rapat BEM hari senin jam 14.00 di aula bersama Budi',
    'tugas makalah sudah selesai',
    'buat tugas laporan deadline besok jam 17.00',
    'ingatkan saya bayar UKT besok jam 8 pagi',
    'jadwal besok'
  ];

  function build() {
    if (ov) return;
    ov = D.createElement('div'); ov.className = 'qc-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Perintah cepat');
    ov.innerHTML = '<div class="qc-sheet"><div class="qc-hd"><div class="qc-ttl">' + svg(IC.bolt, 'qc-i qc-bolt') + '<b>Perintah Cepat</b></div><button type="button" class="qc-x" aria-label="Tutup">' + svg(IC.x) + '</button></div>' +
      '<div class="qc-in"><textarea id="qcT" rows="2" placeholder="Ketik perintah… mis. buat jadwal rapat besok jam 10 di aula bersama Budi" enterkeyhint="send" autocomplete="off" autocapitalize="sentences"></textarea>' +
      '<div class="qc-btns"><button type="button" class="qc-mic" aria-label="Bicara" hidden>' + svg(IC.mic) + '</button><button type="button" class="qc-go" aria-label="Jalankan">' + svg(IC.send) + '</button></div></div>' +
      '<div class="qc-ex" id="qcEx"></div><div class="qc-res" id="qcR" aria-live="polite"></div><div class="qc-foot"><button type="button" class="qc-lnk" data-a="gotask">Buka form Tugas manual</button></div></div>';
    D.body.appendChild(ov);
    sheet = ov.firstChild; inp = ov.querySelector('#qcT'); res = ov.querySelector('#qcR');
    var ex = ov.querySelector('#qcEx');
    ex.innerHTML = EX.map(function (t) { return '<button type="button" class="qc-chip" data-t="' + esc(t) + '">' + esc(t.length > 42 ? t.slice(0, 40) + '…' : t) + '</button>'; }).join('');
    ex.addEventListener('click', function (e) { var b = e.target.closest('.qc-chip'); if (!b) return; inp.value = b.getAttribute('data-t'); inp.focus(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.qc-x').addEventListener('click', close);
    ov.querySelector('.qc-go').addEventListener('click', function () { run(inp.value); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(inp.value); } });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    ov.querySelector('.qc-foot').addEventListener('click', function (e) { if (e.target.closest('[data-a="gotask"]')) goRoute('#task'); });
    res.addEventListener('click', onRes); res.addEventListener('input', onField); res.addEventListener('change', onField);
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = ov.querySelector('.qc-mic');
    if (SR) {
      mic.hidden = false;
      mic.addEventListener('click', function () {
        if (recog) { try { recog.stop(); } catch (e) { } return; }
        try {
          recog = new SR(); recog.lang = 'id-ID'; recog.interimResults = false; recog.maxAlternatives = 1;
          mic.classList.add('on');
          recog.onresult = function (ev) { var t = ev.results[0][0].transcript; inp.value = t; run(t); };
          recog.onend = recog.onerror = function () { mic.classList.remove('on'); recog = null; };
          recog.start();
        } catch (e) { mic.classList.remove('on'); recog = null; }
      });
    }
  }

  function open(prefill) {
    build(); ov.hidden = false;
    requestAnimationFrame(function () { ov.classList.add('on'); });
    if (typeof prefill === 'string') inp.value = prefill;
    setTimeout(function () { try { inp.focus(); } catch (e) { } }, 60);
  }
  function close() {
    if (!ov || ov.hidden) return;
    ov.classList.remove('on'); ov.hidden = true;
    if (recog) { try { recog.stop(); } catch (e) { } }
  }
  function msg(h, cls) { res.innerHTML = '<div class="qc-card ' + (cls || '') + '">' + h + '</div>'; }

  /* ---------- jalankan perintah ---------- */
  function run(text) {
    text = String(text || '').trim(); if (!text) { inp.focus(); return; }
    var p = parse(text); cur = null; undoFn = null;
    if (p.intent === 'done') return doDone(p);
    if (p.intent === 'agenda') return showAgenda(p.d);
    if (p.intent === 'event' || p.intent === 'task' || p.intent === 'remind') { cur = p; return showForm(); }
    msg('<b>Perintah belum dikenali.</b><div class="qc-sub">Coba salah satu bentuk ini:</div><ul class="qc-ul">' +
      '<li><b>Jadwal</b>: buat jadwal rapat BEM hari senin jam 14.00 di aula bersama Budi</li>' +
      '<li><b>Selesai</b>: tugas makalah sudah selesai</li>' +
      '<li><b>Tugas</b>: buat tugas laporan deadline besok jam 17.00</li>' +
      '<li><b>Pengingat</b>: ingatkan saya bayar UKT besok jam 8 pagi</li>' +
      '<li><b>Agenda</b>: jadwal besok</li></ul>', 'qc-warn');
  }

  /* ---------- selesai ---------- */
  function doDone(p) {
    var q = p.q, list = findItems(q), parts = q.split(/\s*(?:,|&|\bdan\b)\s*/i).filter(Boolean);
    if (!q.replace(/\s/g, '')) { msg('<b>Tugas yang mana?</b><div class="qc-sub">Contoh: <i>tugas makalah sudah selesai</i></div>', 'qc-warn'); return; }
    if ((!list.length || list[0].sc < 0.6) && parts.length > 1) {
      var done = [], miss = [], fns = [];
      parts.forEach(function (pt) {
        var l = findItems(pt);
        if (l.length && l[0].sc >= 0.6 && (!l[1] || l[0].sc - l[1].sc >= 0.2)) { var u = complete(l[0].it); if (u) { fns.push(u); done.push(l[0].it); } else miss.push(pt); } else miss.push(pt);
      });
      if (done.length) {
        undoFn = function () { fns.forEach(function (f) { f(); }); };
        msg('<div class="qc-ok">' + svg(IC.check) + '<b>' + done.length + ' tugas dicentang</b></div><ul class="qc-ul">' + done.map(function (it) { return '<li>' + esc(it.title) + ' <span class="qc-tag">' + esc(it.mod) + '</span></li>'; }).join('') + '</ul>' +
          (miss.length ? '<div class="qc-sub qc-w">Tidak ketemu: ' + esc(miss.join(', ')) + '</div>' : '') + '<div class="qc-act"><button type="button" class="qc-b" data-a="undo">Urungkan</button></div>', '');
        return;
      }
    }
    if (!list.length) { msg('<b>Tidak ada tugas terbuka yang cocok</b> dengan “' + esc(q) + '”.<div class="qc-sub">Cek ejaan, atau buka Inbox/Task untuk mencentang manual.</div>', 'qc-warn'); return; }
    var top = list[0], confident = top.sc >= 0.7 && (!list[1] || top.sc - list[1].sc >= 0.2);
    if (confident) {
      var u1 = complete(top.it);
      if (u1) {
        undoFn = u1;
        var others = list.slice(1, 4);
        msg('<div class="qc-ok">' + svg(IC.check) + '<b>Dicentang selesai</b></div>' + itemRow(top.it) +
          '<div class="qc-act"><button type="button" class="qc-b" data-a="undo">Urungkan</button></div>' +
          (others.length ? '<div class="qc-sub">Bukan ini? Mungkin maksudmu:</div>' + others.map(function (x) { return itemRow(x.it, true); }).join('') : ''), '');
        return;
      }
    }
    msg('<b>Pilih tugas yang dimaksud</b><div class="qc-sub">Ada beberapa yang mirip dengan “' + esc(q) + '”.</div>' + list.slice(0, 5).map(function (x) { return itemRow(x.it, true); }).join(''), '');
  }
  function itemRow(it, btn) {
    var dl = it.date ? ' · ' + (dayDiff(String(it.date).slice(0, 10), today()) < 0 ? 'lewat ' : '') + fd(String(it.date).slice(0, 10)) : '';
    return '<div class="qc-it"><div class="qc-itx"><b>' + esc(it.title) + '</b><small>' + esc(it.mod) + esc(dl) + '</small></div>' +
      (btn ? '<button type="button" class="qc-b qc-sm" data-a="pick" data-k="' + esc(it.k) + '">Selesai</button>' : '') + '</div>';
  }
  function pickItem(k) {
    var it = openItems().filter(function (x) { return x.k === k; })[0];
    if (!it) { msg('<b>Item sudah tidak ada / sudah selesai.</b>', 'qc-warn'); return; }
    var u = complete(it);
    if (u) { undoFn = u; msg('<div class="qc-ok">' + svg(IC.check) + '<b>Dicentang selesai</b></div>' + itemRow(it) + '<div class="qc-act"><button type="button" class="qc-b" data-a="undo">Urungkan</button></div>', ''); }
  }

  /* ---------- agenda ---------- */
  function showAgenda(d) {
    var info = dayInfo(d), h = '<div class="qc-hd2">' + svg(IC.cal) + '<b>' + esc(fdw(d)) + '</b></div>';
    var rows = info.blocks.map(function (b) { return { t: b.s, h: '<div class="qc-it"><div class="qc-tm">' + hm(mt(b.s)) + '–' + hm(mt(b.e)) + '</div><div class="qc-itx"><b>' + esc(b.label) + '</b><small>' + esc(b.src) + '</small></div></div>' }; });
    var tight = [];
    for (var i = 1; i < info.blocks.length; i++) if (info.blocks[i].s < info.blocks[i - 1].e) tight.push(info.blocks[i - 1].label + ' ↔ ' + info.blocks[i].label);
    h += rows.map(function (r) { return r.h; }).join('');
    info.soft.forEach(function (s) { h += '<div class="qc-it"><div class="qc-tm">—</div><div class="qc-itx"><b>' + esc(s.label) + '</b><small>' + esc(s.note) + '</small></div></div>'; });
    if (info.due.length) h += '<div class="qc-sub">Tenggat hari ini:</div>' + info.due.slice(0, 6).map(function (it) { return itemRow(it); }).join('') + (info.due.length > 6 ? '<div class="qc-sub">+' + (info.due.length - 6) + ' lainnya</div>' : '');
    if (!info.blocks.length && !info.soft.length && !info.due.length) h += '<div class="qc-sub">Tidak ada jadwal atau tenggat. Hari yang lega 🎉</div>';
    if (tight.length) h = '<div class="qc-card qc-warn qc-mini">' + svg(IC.warn) + 'Bentrok: ' + esc(tight.join('; ')) + '</div>' + h;
    var fr = slotsOn(d, 60, 10 * 60, null, 3);
    if (fr.length) h += '<div class="qc-sub">Jam kosong (1 jam): ' + fr.map(function (s) { return hm(mt(s)) + '–' + hm(mt(s + 60)); }).join(' · ') + '</div>';
    msg(h, '');
  }

  /* ---------- formulir pratinjau ---------- */
  var REMS = [['', 'Tanpa pengingat'], ['0', 'Tepat waktu'], ['5', '5 menit sebelum'], ['15', '15 menit sebelum'], ['30', '30 menit sebelum'], ['60', '1 jam sebelum'], ['1440', '1 hari sebelum']];
  function sel(k, opts, v) { return '<select data-f="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
  function showForm() {
    var f = cur, ev = f.intent === 'event', h = '';
    var label = ev ? 'Jadwal baru' : f.intent === 'remind' ? 'Pengingat' : 'Tugas baru';
    h += '<div class="qc-hd2">' + svg(ev ? IC.cal : IC.check) + '<b>' + label + '</b><small>periksa lalu simpan</small></div>';
    h += '<div class="qc-fm">';
    h += '<label class="qc-f full"><span>' + (ev ? 'Judul acara' : 'Judul') + '</span><input type="text" data-f="title" value="' + esc(f.title) + '"></label>';
    h += '<label class="qc-f"><span>' + (ev ? 'Tanggal' : 'Tenggat / tanggal') + '</span><input type="date" data-f="d" value="' + esc(f.d) + '"></label>';
    h += '<label class="qc-f"><span>' + (ev ? 'Mulai' : 'Jam') + '</span><input type="time" data-f="t0" value="' + esc(f.t0) + '"></label>';
    if (ev) {
      h += '<label class="qc-f"><span>Selesai</span><input type="time" data-f="t1" value="' + esc(f.t1) + '"></label>';
      h += '<label class="qc-f"><span>Pengingat</span>' + sel('remind', REMS, f.remind == null ? '15' : f.remind) + '</label>';
      h += '<label class="qc-f full"><span>Lokasi</span><input type="text" data-f="place" value="' + esc(f.place) + '" placeholder="opsional"></label>';
      h += '<label class="qc-f full"><span>Bersama (pisahkan dengan koma)</span><input type="text" data-f="people" value="' + esc((f.people || []).join(', ')) + '" placeholder="opsional"></label>';
    } else {
      h += '<label class="qc-f"><span>Prioritas</span>' + sel('priority', [['Low', 'Rendah'], ['Medium', 'Sedang'], ['High', 'Tinggi']], f.priority) + '</label>';
      h += '<label class="qc-f"><span>Pengingat</span>' + sel('remind', REMS, f.remind == null ? '' : f.remind) + '</label>';
    }
    h += '</div><div id="qcN"></div><div class="qc-act"><button type="button" class="qc-b ghost" data-a="cancel">Batal</button><button type="button" class="qc-b pri" id="qcSave" data-a="save">Simpan</button></div>';
    res.innerHTML = '<div class="qc-card">' + h + '</div>';
    notes();
  }
  function notes() {
    var f = cur, box = res.querySelector('#qcN'), save = res.querySelector('#qcSave'); if (!box) return;
    var h = '', conflict = false;
    if (f.assumed) h += '<div class="qc-note">' + svg(IC.clock) + esc(f.assumed) + '</div>';
    if (f.approx) h += '<div class="qc-note">' + svg(IC.clock) + esc(f.approx) + '</div>';
    if (f.intent === 'event') {
      if (!f.d) h += '<div class="qc-note qc-w">' + svg(IC.warn) + 'Tanggal belum diisi.</div>';
      else {
        if (dayDiff(f.d, today()) < 0) h += '<div class="qc-note qc-w">' + svg(IC.warn) + 'Tanggal ini sudah lewat.</div>';
        var info = dayInfo(f.d);
        if (!f.t0) h += '<div class="qc-note">' + svg(IC.clock) + 'Tanpa jam → disimpan sebagai acara <b>seharian</b>. Isi jam bila perlu.</div>';
        else {
          var s = tmin(f.t0), e = f.t1 ? tmin(f.t1) : s + 60; if (e <= s) e = s + 60;
          var cl = clash(info, s, e);
          if (cl.length) {
            conflict = true;
            h += '<div class="qc-note qc-w">' + svg(IC.warn) + '<div><b>Bentrok dengan:</b> ' + cl.map(function (b) { return esc(b.label) + ' (' + hm(mt(b.s)) + '–' + hm(mt(b.e)) + ', ' + esc(b.src) + ')'; }).join('; ') + '</div></div>';
            var sg = suggest({ d: f.d, t0: mt(s), t1: mt(e) });
            if (sg.length) h += '<div class="qc-sub">Saran waktu kosong:</div><div class="qc-sg">' + sg.map(function (x, i) { return '<button type="button" class="qc-chip" data-a="sg" data-i="' + i + '">' + (x.d === f.d ? '' : esc(fdw(x.d).split(',')[0]) + ' · ') + hm(x.t0) + '–' + hm(x.t1) + '</button>'; }).join('') + '</div>';
            f._sg = sg;
          } else {
            var near = info.blocks.filter(function (b) { return (b.e <= s && s - b.e < 15) || (b.s >= e && b.s - e < 15); });
            if (near.length) h += '<div class="qc-note">' + svg(IC.clock) + 'Mepet dengan ' + esc(near[0].label) + ' (jeda &lt; 15 menit).</div>';
          }
        }
        if (info.due.length >= 3) h += '<div class="qc-note">' + svg(IC.warn) + 'Hari itu ada ' + info.due.length + ' tenggat tugas.</div>';
        info.soft.filter(function (x) { return /jam belum/.test(x.note); }).forEach(function (x) { h += '<div class="qc-note">' + svg(IC.warn) + esc(x.label) + ' di hari itu belum punya jam.</div>'; });
      }
    } else if (f.intent !== 'event' && !f.d && f.remind !== '' && f.remind != null) h += '<div class="qc-note qc-w">' + svg(IC.warn) + 'Isi tanggal agar pengingat bisa dipasang.</div>';
    if (f.intent === 'remind' && !f.t0) h += '<div class="qc-note">' + svg(IC.clock) + 'Jam belum diisi → pengingat jam 09.00.</div>';
    box.innerHTML = h;
    if (save) save.textContent = f.intent === 'event' ? (conflict ? 'Tetap jadwalkan' : 'Jadwalkan') : 'Simpan';
    if (save) save.classList.toggle('warn', conflict);
  }
  function onField(e) {
    var el = e.target, k = el.getAttribute && el.getAttribute('data-f'); if (!k || !cur) return;
    var v = el.value;
    if (k === 'people') cur.people = v.split(/\s*,\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    else if (k === 'remind') cur.remind = v;
    else cur[k] = v;
    cur.assumed = cur.assumed && (k === 't0') ? '' : cur.assumed; if (k === 't0') cur.approx = '';
    if (cur.intent === 'event' && k === 't0' && cur.t0) { var s = tmin(cur.t0), e1 = cur.t1 ? tmin(cur.t1) : null; if (e1 == null || e1 <= s) { cur.t1 = mt(Math.min(1439, s + (cur.dur || 60))); var i1 = res.querySelector('[data-f="t1"]'); if (i1) i1.value = cur.t1; } }
    clearTimeout(tmr); tmr = setTimeout(notes, e.type === 'input' ? 250 : 0);
  }
  function onRes(e) {
    var b = e.target.closest('[data-a]'); if (!b) return; var a = b.getAttribute('data-a');
    if (a === 'cancel') { res.innerHTML = ''; cur = null; return; }
    if (a === 'undo') { if (undoFn) { try { undoFn(); } catch (x) { } undoFn = null; msg('<div class="qc-ok">' + svg(IC.check) + '<b>Dibatalkan</b></div><div class="qc-sub">Perubahan terakhir sudah dikembalikan.</div>', ''); } return; }
    if (a === 'pick') { pickItem(b.getAttribute('data-k')); return; }
    if (a === 'sg') {
      var x = cur && cur._sg && cur._sg[+b.getAttribute('data-i')]; if (!x) return;
      cur.d = x.d; cur.t0 = x.t0; cur.t1 = x.t1; cur.assumed = ''; cur.approx = '';
      ['d', 't0', 't1'].forEach(function (k) { var i = res.querySelector('[data-f="' + k + '"]'); if (i) i.value = cur[k]; }); notes(); return;
    }
    if (a === 'save') save();
  }
  function save() {
    var f = cur; if (!f) return;
    f.title = String(f.title || '').trim() || (f.intent === 'event' ? 'Jadwal baru' : 'Tugas baru');
    if (f.intent === 'event') {
      if (!f.d) { notes(); return; }
      if (f.t0 && !f.t1) f.t1 = mt(Math.min(1439, tmin(f.t0) + (f.dur || 60)));
      var u = createEvent(f); undoFn = u;
      var rl = f.remind === '' || f.remind == null ? 'tanpa pengingat' : 'pengingat ' + (REMS.filter(function (o) { return o[0] === String(f.remind); })[0] || ['', ''])[1].toLowerCase();
      msg('<div class="qc-ok">' + svg(IC.check) + '<b>Masuk ke Kalender</b></div><div class="qc-it"><div class="qc-itx"><b>' + esc(f.title) + '</b><small>' + esc(fdw(f.d)) + (f.t0 ? ' · ' + hm(f.t0) + (f.t1 ? '–' + hm(f.t1) : '') : ' · seharian') + (f.place ? ' · ' + esc(f.place) : '') + ' · ' + esc(rl) + '</small></div></div>' +
        '<div class="qc-act"><button type="button" class="qc-b" data-a="undo">Urungkan</button><button type="button" class="qc-b ghost" data-a="gocal">Buka Kalender</button></div>', '');
    } else {
      if (f.intent === 'remind' && !f.t0) f.t0 = '09:00';
      if (!f.d && f.intent === 'remind') f.d = today();
      var u2 = createTask(f); undoFn = u2;
      msg('<div class="qc-ok">' + svg(IC.check) + '<b>' + (f.intent === 'remind' ? 'Pengingat dipasang' : 'Masuk ke Task') + '</b></div><div class="qc-it"><div class="qc-itx"><b>' + esc(f.title) + '</b><small>' + (f.d ? esc(fdw(f.d)) + (f.t0 ? ' · ' + hm(f.t0) : '') : 'tanpa tenggat') + (f.remind !== '' && f.remind != null && f.d ? ' · diingatkan' : '') + '</small></div></div><div class="qc-act"><button type="button" class="qc-b" data-a="undo">Urungkan</button></div>', '');
    }
    cur = null;
  }
  function goRoute(h) {
    close(); window.__cuSkip = Date.now() + 1800; if (window.__bsJump) window.__bsJump();
    var a = D.querySelector('.nav a[href="' + h + '"]');
    if (a) a.click(); else if (MO.routes && MO.routes[h]) MO.routes[h](); else location.hash = h;
  }
  /* tombol "Buka Kalender" memakai jalur lompat yang sama dengan Inbox */
  D.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-a="gocal"]'); if (!b || !ov || ov.hidden) return;
    goRoute('#calendar');
  }, true);

  /* ---------- pemicu: tombol plus biru beranda (.sf-fab) ---------- */
  function paintPlus() {
    var p = D.querySelector('.sf-fab'); if (!p || p.__qc) return;
    p.__qc = 1; p.setAttribute('aria-label', 'Perintah cepat'); p.title = 'Ketik perintah cepat';
  }
  function mount() {
    if (!D.body) return;
    paintPlus(); setTimeout(paintPlus, 600); setTimeout(paintPlus, 2000);
    /* capture + stopImmediatePropagation → menggantikan aksi lama plus (lompat ke menu Task) */
    D.addEventListener('click', function (e) {
      var p = e.target.closest && e.target.closest('.sf-fab'); if (!p) return;
      e.preventDefault(); e.stopImmediatePropagation(); open();
    }, true);
  }
  MO.quick.open = open; MO.quick.close = close; MO.quick.run = function (t) { open(t); run(t); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', mount); else mount();
})();
