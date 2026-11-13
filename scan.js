/* scan.js — v5.2 "Scan & Isi Otomatis"
   Foto (kamera/galeri), PDF, teks → dibaca → dikenali sebagai Task / Kalender / Keuangan → dicek pengguna → dimasukkan.
   Lapisan tambahan: tidak mengubah kode modul lain. Data ditulis LEWAT objek hidup tiap modul
   (MO.apps['mo-task-v1'], MO.apps['mo-cal-v1'], MO.fin) lalu disimpan oleh modul itu sendiri — pola yang sama dengan Inbox/Planner.
   Membaca foto memakai Tesseract.js (dimuat dari CDN saat pertama dipakai, perlu internet sekali; PDF bertext & teks tempel jalan offline). */
(function () {
  'use strict';
  if (window.BeresinScan) return;
  var D = document, W = window, MO = W.MyOffice = W.MyOffice || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var uid = function () { return MO.kit && MO.kit.uid ? MO.kit.uid() : Math.random().toString(36).slice(2, 9); };

  /* =====================  TANGGAL / JAM / NOMINAL  ===================== */
  function iso(y, m, d) { var x = new Date(y, m - 1, d); if (x.getFullYear() !== y || x.getMonth() !== m - 1 || x.getDate() !== d) return ''; return y + '-' + pad(m) + '-' + pad(d); }
  function todayS() { var d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function addDays(s, n) { var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function dowOf(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
  var MON = { januari: 1, january: 1, jan: 1, februari: 2, pebruari: 2, february: 2, feb: 2, peb: 2, maret: 3, march: 3, mar: 3, april: 4, apr: 4, mei: 5, may: 5, juni: 6, june: 6, jun: 6, juli: 7, july: 7, jul: 7, agustus: 8, august: 8, agu: 8, agt: 8, aug: 8, september: 9, sept: 9, sep: 9, oktober: 10, october: 10, okt: 10, oct: 10, november: 11, nopember: 11, nov: 11, nop: 11, desember: 12, december: 12, des: 12, dec: 12 };
  var MONRX = 'januari|january|februari|pebruari|february|maret|march|april|juni|june|juli|july|agustus|august|september|oktober|october|nopember|november|desember|december|jan|feb|peb|mar|apr|mei|may|jun|jul|agu|agt|aug|sept|sep|okt|oct|nov|nop|des|dec';
  var DOW = { minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };
  var WDRX = "(senin|selasa|rabu|kamis|jum'?at|sabtu|ahad|minggu(?!\\s+(?:depan|ini|lalu|ke\\b|\\d)))";
  var RD_ISO = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;
  var RD_NUM = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/;
  var RD_TXT = new RegExp('\\b(\\d{1,2})(?:\\s*(?:-|–|s\\.?\\s?d\\.?|sampai)\\s*(\\d{1,2}))?\\s+(' + MONRX + ')\\b\\.?(?:,?\\s*(\\d{4}))?', 'i');
  var RD_TXT2 = new RegExp('\\b(' + MONRX + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b', 'i');
  var RD_DM = /\b(\d{1,2})\/(\d{1,2})\b(?![\/\d])/;
  var RD_REL = /\b(hari ini|besok|lusa|kemarin)\b/i;
  var RD_WD = new RegExp('\\b' + WDRX + '\\b', 'i');
  var RT_RANGE = /(?:\b(?:pukul|jam|pkl\.?)\s*)?\b([01]?\d|2[0-3])[.:]([0-5]\d)\s*(?:wib|wita|wit)?\s*(?:-|–|—|s\.?\s?d\.?|sampai|hingga|to|until)\s*([01]?\d|2[0-3])[.:]([0-5]\d)(?!\d)\s*(?:wib|wita|wit)?/i;
  var RT_ONE = /(?:\b(?:pukul|jam|pkl\.?)\s*)?\b([01]?\d|2[0-3])[.:]([0-5]\d)(?!\d)\s*(?:wib|wita|wit)?/i;
  var RT_H = /\b(?:pukul|jam|pkl\.?)\s*([01]?\d|2[0-3])\b(?![.:\d])\s*(?:wib|wita|wit)?/i;
  var RA_RP = /(?:rp\.?|idr)\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)(?:\s*(rb|ribu|jt|juta|k)\b)?/i;
  var RA_UNIT = /\b(\d+(?:[.,]\d+)?)\s*(rb|ribu|jt|juta|k)\b/i;
  var RA_PLAIN = /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b/;

  function cut(s, m) { return s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); }
  function parseAmt(str, unit) {
    var s = String(str), v;
    if (unit) { v = parseFloat(s.replace(',', '.')); var u = unit.toLowerCase(); return Math.round(v * (/^(jt|juta)$/.test(u) ? 1e6 : 1e3)); }
    if (/^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(s)) { s = s.replace(/[.,]\d{1,2}$/, function (x) { return x.length === 4 ? x : ''; }); return +s.replace(/[.,]/g, ''); }
    if (/^\d+$/.test(s)) return +s;
    if (/^\d+[.,]\d{1,2}$/.test(s)) return Math.round(parseFloat(s.replace(',', '.')));
    return 0;
  }
  function amountOf(line) {
    var m = RA_RP.exec(line); if (m) { var v = parseAmt(m[1], m[2]); if (v >= 100) return v; }
    m = RA_UNIT.exec(line); if (m) { v = parseAmt(m[1], m[2]); if (v >= 1000) return v; }
    m = RA_PLAIN.exec(line); if (m) { v = parseAmt(m[0]); if (v >= 1000) return v; }
    return 0;
  }

  var K_RCPT = /\b(struk|nota|kasir|sub\s*-?total|grand\s*total|total\s*belanja|kembali(an)?|ppn|tunai|cash|change|receipt|terima kasih|thank you)\b/i;
  var K_INCOME = /\b(gaji|pemasukan|diterima|terima|uang saku|beasiswa|honor|fee|upah|pendapatan|salary|transfer masuk)\b/i;
  var K_EXPENSE = /\b(total|bayar|dibayar|beli|belanja|pembelian|pengeluaran|transfer ke|lunas)\b/i;
  var K_PAID = /\b(lunas|dibayar|telah dibayar|sudah dibayar|paid)\b/i;
  var K_BILL = /\b(tagihan|invoice|jatuh tempo|due|cicilan|listrik|pdam|wifi|internet|spp|ukt|kost|kos|sewa)\b/i;
  var K_EVENT = /\b(rapat|meeting|rakor|kuliah|kelas|kajian|ujian|uts|uas|kuis|quiz|seminar|presentasi|sidang|acara|agenda|jadwal|workshop|pelatihan|webinar|konser|wawancara|interview|pengajian|bimbingan|praktikum|musyawarah|mubes|latihan|training|reuni|walimah|pernikahan|undangan)\b/i;
  var K_TASK = /\b(tugas|deadline|dead line|batas|kumpul|dikumpulkan|submit|kerjakan|mengerjakan|selesaikan|laporan|makalah|revisi|to-?do|reminder|ingatkan|jangan lupa|harus|perlu|siapkan|persiapan|follow ?up|hubungi|kirim|bayar|isi)\b/i;
  var K_URGENT = /\b(urgent|segera|asap|penting|mendesak)\b/i;
  var RX_UJIAN = /\b(ujian|uts|uas|ujikom|kuis|quiz|ulangan|exam|midterm|sidang)\b/i, RX_PRES = /\b(presentasi|presentation|pitch|seminar|paparan|sempro|semhas)\b/i;

  function letters(s) { return (s.match(/[A-Za-z\u00C0-\u024F\u0600-\u06FF]/g) || []).length; }
  function cleanTitle(s) {
    s = s.replace(/\b(pukul|pkl|jam|wib|wita|wit|tanggal|tgl|pada)\b\.?/gi, ' ');
    s = s.replace(/^\s*(?:[-–—•*·▪■□☐☑✓✔>]|\[\s*[xX ]?\s*\]|\(?\d{1,2}[.)])\s+/, '');
    s = s.replace(/\b(s\.?\s?d\.?|sampai|hingga|to|until)\s*$/i, ' ').replace(/^\s*(s\.?\s?d\.?|sampai|hingga)\b/i, ' ');
    s = s.replace(/\s+/g, ' ').replace(/^[\s,;:\-–—|/()]+|[\s,;:\-–—|/(]+$/g, '');
    s = s.replace(/^(tugas|deadline|agenda|jadwal|acara|todo|to-do|reminder|catatan)\s*[:\-–]\s*/i, function (m, w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() + ': '; }).replace(/:\s*$/, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function analyse(line, today) {
    var rest = line, f = { date: '', date2: '', t1: '', t2: '', amount: 0, rp: false, kind: '' }, m, y, mo, d;
    function infer(mm, dd) { var yy = +today.slice(0, 4), s = iso(yy, mm, dd); if (s && s < addDays(today, -30)) s = iso(yy + 1, mm, dd); return s; }
    if ((m = RD_ISO.exec(rest))) { f.date = iso(+m[1], +m[2], +m[3]); if (f.date) { rest = cut(rest, m); f.kind = 'abs'; } }
    if (!f.date && (m = RD_NUM.exec(rest))) { var a = +m[1], b = +m[2]; y = +m[3]; if (y < 100) y += 2000; if (b > 12 && a <= 12) { var t = a; a = b; b = t; } f.date = iso(y, b, a); if (f.date) { rest = cut(rest, m); f.kind = 'abs'; } }
    if (!f.date && (m = RD_TXT.exec(rest))) {
      mo = MON[m[3].toLowerCase()]; d = +m[1]; y = m[4] ? +m[4] : 0; f.date = y ? iso(y, mo, d) : infer(mo, d);
      if (f.date) { if (m[2]) { var e = +m[2]; f.date2 = y ? iso(y, mo, e) : infer(mo, e); if (f.date2 && f.date2 < f.date) f.date2 = ''; } rest = cut(rest, m); f.kind = 'abs'; }
    }
    if (!f.date && (m = RD_TXT2.exec(rest))) { mo = MON[m[1].toLowerCase()]; d = +m[2]; y = m[3] ? +m[3] : 0; f.date = y ? iso(y, mo, d) : infer(mo, d); if (f.date) { rest = cut(rest, m); f.kind = 'abs'; } }
    if (!f.date && (m = RD_DM.exec(rest))) { if (+m[2] <= 12 && +m[1] <= 31) { f.date = infer(+m[2], +m[1]); if (f.date) { rest = cut(rest, m); f.kind = 'abs'; } } }
    if (f.kind === 'abs') rest = rest.replace(new RegExp('\\b' + WDRX + '\\b[,\\s]*', 'ig'), ' ');
    if (!f.date && (m = RD_REL.exec(rest))) { var off = { 'hari ini': 0, besok: 1, lusa: 2, kemarin: -1 }[m[1].toLowerCase()]; f.date = addDays(today, off); rest = cut(rest, m); f.kind = 'rel'; }
    if (!f.date && (m = RD_WD.exec(rest))) { var wd = DOW[m[1].toLowerCase().replace("'", '')]; if (wd != null) { f.date = addDays(today, (wd - dowOf(today) + 7) % 7); rest = cut(rest, m); f.kind = 'dow'; } }
    /* nominal */
    if ((m = RA_RP.exec(rest))) { var v = parseAmt(m[1], m[2]); if (v >= 100) { f.amount = v; f.rp = true; rest = cut(rest, m); } }
    if (!f.amount && (m = RA_UNIT.exec(rest))) { v = parseAmt(m[1], m[2]); if (v >= 1000) { f.amount = v; rest = cut(rest, m); } }
    if (!f.amount && (m = RA_PLAIN.exec(rest))) { v = parseAmt(m[0]); if (v >= 1000) { f.amount = v; rest = cut(rest, m); } }
    /* jam */
    if ((m = RT_RANGE.exec(rest))) { f.t1 = pad(+m[1]) + ':' + m[2]; f.t2 = pad(+m[3]) + ':' + m[4]; rest = cut(rest, m); }
    else if ((m = RT_ONE.exec(rest))) { f.t1 = pad(+m[1]) + ':' + m[2]; rest = cut(rest, m); }
    else if ((m = RT_H.exec(rest))) { f.t1 = pad(+m[1]) + ':00'; rest = cut(rest, m); }
    f.title = cleanTitle(rest); f.hasText = letters(f.title) >= 3;
    return f;
  }

  function normalize(raw) {
    return String(raw || '').replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/[\u00a0\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); }).filter(function (l) { return l.length > 1; });
  }
  function catFor(t, o) {
    if (o === 'task') return /(kuliah|tugas|makalah|laporan|ujian|kuis|skripsi|praktikum)/i.test(t) ? 'Belajar' : /(rapat|meeting)/i.test(t) ? 'Rapat' : /(klien|invoice|kerja|proyek)/i.test(t) ? 'Kerja' : /(bayar|tagihan|administrasi|surat|berkas)/i.test(t) ? 'Administrasi' : /(dokter|obat|klinik|kesehatan)/i.test(t) ? 'Kesehatan' : /(rumah|bersih|masak)/i.test(t) ? 'Rumah' : 'Lainnya';
    if (o === 'cal') return /(sholat|shalat|kajian|pengajian|ibadah|tahlil)/i.test(t) ? 'Ibadah' : /(bem|himpunan|organisasi|musyawarah|mubes|rakor|kepanitiaan)/i.test(t) ? 'Organisasi' : /(kuliah|kelas|ujian|uts|uas|kuis|praktikum|bimbingan|seminar|sidang)/i.test(t) ? 'Kuliah' : /(rapat|meeting|klien|kerja|interview|wawancara)/i.test(t) ? 'Pekerjaan' : 'Pribadi';
    if (o === 'exp') return /(makan|resto|warung|bakso|nasi|ayam|geprek|cafe|kafe)/i.test(t) ? 'Makanan' : /(minum|kopi|teh|boba|jus|es )/i.test(t) ? 'Minuman' : /(grab|gojek|bensin|pertamina|parkir|tol|ojek|kereta|bus|travel)/i.test(t) ? 'Transportasi' : /(buku|spp|ukt|kursus|fotokopi|print|atk|alat tulis)/i.test(t) ? 'Pendidikan' : /(netflix|spotify|langganan|pulsa|paket data|internet|wifi)/i.test(t) ? 'Langganan' : /(apotek|obat|dokter|klinik|rumah sakit)/i.test(t) ? 'Kesehatan' : /(bioskop|game|hiburan|tiket)/i.test(t) ? 'Hiburan' : /(sabun|shampo|skincare|indomaret|alfamart|supermarket|minimarket)/i.test(t) ? 'Kebutuhan pribadi' : 'Lainnya';
    return /gaji|salary/i.test(t) ? 'Gaji' : /honor|freelance|fee/i.test(t) ? 'Freelance' : /beasiswa/i.test(t) ? 'Beasiswa' : /uang saku/i.test(t) ? 'Uang saku' : 'Lainnya';
  }
  function mk(type, o) {
    return Object.assign({ id: uid(), type: type, on: true, title: '', date: '', date2: '', t1: '', t2: '', amount: 0, fin: 'Expense', pri: 'Medium', cat: '', note: '', src: '', dup: false, noDate: false }, o);
  }

  function receipt(lines, today) {
    var strong = 0, totLine = '', totAmt = 0, amts = 0, maxAmt = 0, date = '', i, l, a, items = [];
    for (i = 0; i < lines.length; i++) {
      l = lines[i]; if (K_RCPT.test(l)) strong++;
      a = amountOf(l); if (a) { amts++; if (a > maxAmt) maxAmt = a; }
      if (!date) { var f0 = analyse(l, today); if (f0.kind === 'abs') date = f0.date; }
      if (a && /\b(grand\s*total|total(\s*(bayar|belanja|tagihan))?|jumlah(\s*bayar)?)\b/i.test(l) && !/sub\s*-?total/i.test(l)) { totLine = l; totAmt = a; }
      else if (a && !/\b(tunai|cash|kembali|kembalian|change|ppn|pajak|sub\s*-?total|diskon)\b/i.test(l) && items.length < 12) items.push(l.replace(/\s+/g, ' '));
    }
    if (!((strong >= 2 && amts >= 1) || (totLine && amts >= 3))) return null;
    var amount = totAmt || maxAmt; if (!amount) return null;
    var name = ''; for (i = 0; i < Math.min(lines.length, 6); i++) { l = lines[i]; if (letters(l) >= 3 && !amountOf(l) && !K_RCPT.test(l) && analyse(l, today).kind !== 'abs' && l.length <= 40) { name = l; break; } }
    name = cleanTitle(name || 'Belanja');
    return mk('fin', { title: name, date: date || today, amount: amount, fin: 'Expense', cat: catFor(items.join(' ') + ' ' + name, 'exp'), note: items.length ? 'Dari struk: ' + items.join('; ').slice(0, 400) : 'Dari struk', src: totLine || name });
  }

  function parse(raw, o) {
    o = o || {}; var today = o.today || todayS(), lines = normalize(raw), out = [], others = [], ctx = '';
    var rc = receipt(lines, today);
    if (rc) return { cands: [rc], others: [], lines: lines.length, receipt: true };
    lines.forEach(function (line) {
      var f = analyse(line, today), type = '', date = f.date;
      if (f.date && !f.hasText && !f.t1 && !f.amount) { ctx = f.date; return; }
      if (!f.hasText) { if (letters(line) >= 2) others.push(line); return; }
      var paid = K_PAID.test(line), bill = K_BILL.test(line) && !paid, inc = K_INCOME.test(line), exp = K_EXPENSE.test(line) || paid;
      if (f.amount && (inc || (exp && !K_TASK.test(line) && !bill) || paid)) type = 'fin';
      else if ((f.t1 || K_EVENT.test(line)) && (f.date || ctx) && !(bill && !f.t1)) type = 'cal';
      else if (f.date || K_TASK.test(line) || bill || /^\s*(?:[-•*·▪■□☐☑✓✔]|\[\s*[xX ]?\s*\])/.test(line)) type = 'task';
      else if (f.t1) type = 'cal';
      if (!type) { others.push(line); return; }
      if (type === 'cal' && !date) date = ctx;
      var c = mk(type, { title: f.title.slice(0, 120), date: date || '', date2: f.date2 && f.date2 !== date ? f.date2 : '', t1: f.t1, t2: f.t2, amount: f.amount, src: line });
      if (type === 'task') {
        c.cat = catFor(line, 'task'); c.pri = bill || K_URGENT.test(line) ? 'High' : 'Medium'; if (f.amount) c.note = 'Nominal: Rp ' + f.amount.toLocaleString('id-ID');
        c.t1 = f.t1; c.t2 = f.t2;
      } else if (type === 'cal') {
        c.cat = catFor(line, 'cal'); c.kind = RX_UJIAN.test(line) ? 'ujian' : RX_PRES.test(line) ? 'presentasi' : '';
        if (!c.date) { c.date = today; c.noDate = true; }
      } else { c.fin = inc ? 'Income' : 'Expense'; c.cat = catFor(line, inc ? 'inc' : 'exp'); if (!c.date) c.date = today; }
      out.push(c);
    });
    var seen = {}; out = out.filter(function (c) { var k = c.type + '|' + c.title.toLowerCase() + '|' + c.date + '|' + c.amount; if (seen[k]) return false; seen[k] = 1; return true; });
    return { cands: out, others: others.slice(0, 40), lines: lines.length, receipt: false };
  }

  /* =====================  DATA MODUL (lewat objek hidup)  ===================== */
  function ap(k) { return MO.apps && MO.apps[k]; }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u0600-\u06FF]+/g, ' ').trim(); }
  function accounts() { var F = MO.fin; return F && F.D && F.D.acc ? F.D.acc.filter(function (a) { return a.active !== false; }) : []; }
  function markDup(c) {
    c.dup = false; var T = ap('mo-task-v1'), C = ap('mo-cal-v1'), F = MO.fin, t = norm(c.title);
    try {
      if (c.type === 'task' && T) c.dup = (T.D.task || []).some(function (x) { return norm(x.title) === t && (x.due || '') === (c.date || ''); });
      else if (c.type === 'cal' && C) c.dup = (C.D.ev || []).some(function (x) { return norm(x.title) === t && x.start === c.date; });
      else if (c.type === 'fin' && F) c.dup = (F.D.tx || []).some(function (x) { return +x.amount === +c.amount && x.date === c.date && x.type === c.fin; });
    } catch (e) { }
    return c;
  }
  function valid(c, accId) {
    if (!c.on || !String(c.title).trim()) return false;
    if (c.type === 'fin') return +c.amount > 0 && !!accId && !!c.date;
    if (c.type === 'cal') return !!c.date;
    return true;
  }
  function insertAll(list, accId, srcName) {
    var res = { task: 0, cal: 0, fin: 0, undo: [], err: '' }, T = ap('mo-task-v1'), C = ap('mo-cal-v1'), F = MO.fin, addedT = [], addedC = [], addedF = [];
    list.forEach(function (c) {
      var title = String(c.title).trim().slice(0, 160), note = ['Dari scan' + (srcName ? ' · ' + srcName : ''), c.note].filter(Boolean).join(' — ');
      if (c.type === 'task' && T && T.D) {
        var cats = T.D.cats || [], cat = cats.indexOf(c.cat) >= 0 ? c.cat : '';
        var o = { id: uid(), kind: 'todo', title: title, status: 'To Do', priority: c.pri || 'Medium', due: c.date || '', dueTime: c.t1 || '', endTime: c.t2 || '', category: cat, desc: note, pin: false, doneAt: '', parentId: '', remindAt: '', goalRef: '', projId: '' };
        T.D.task.push(o); addedT.push(o.id); res.task++;
      } else if (c.type === 'cal' && C && C.D) {
        var cc = (C.D.cat || []).filter(function (x) { return x.name === c.cat; })[0] || (C.D.cat || [])[0];
        var ev = { id: 'sc-' + uid(), title: title, start: c.date, end: c.date2 || c.date, startTime: c.t1 || '', endTime: c.t2 || '', allDay: !c.t1, catId: cc ? cc.id : '', remind: c.t1 ? '15' : '', location: '', notes: note, confirmed: true };
        if (c.kind) ev.kind = c.kind;
        (C.D.ev || (C.D.ev = [])).push(ev); addedC.push(ev.id); res.cal++;
      } else if (c.type === 'fin' && F && F.D && accId) {
        var kind = c.fin === 'Income' ? 'Pemasukan' : 'Pengeluaran', fc = (F.D.cat || []).filter(function (x) { return x.kind === kind && x.name === c.cat && !x.archived; })[0] || (F.D.cat || []).filter(function (x) { return x.kind === kind && x.name === 'Lainnya'; })[0];
        var tx = { id: uid(), type: c.fin === 'Income' ? 'Income' : 'Expense', date: c.date, amount: +c.amount, accId: accId, catId: fc ? fc.id : '', tagId: '', desc: title, notes: note, method: '', scope: 'Pribadi' };
        F.D.tx.push(tx); addedF.push(tx.id); res.fin++;
      }
    });
    try { if (addedT.length) T.save(); if (addedC.length) C.save(); if (addedF.length) { if (F.save) F.save(); else localStorage.setItem('mo-fin-v1', JSON.stringify(F.D)); } } catch (e) { res.err = String(e && e.message || e); }
    res.undo = function () {
      try {
        if (addedT.length) { T.D.task = T.D.task.filter(function (x) { return addedT.indexOf(x.id) < 0; }); T.save(); }
        if (addedC.length) { C.D.ev = C.D.ev.filter(function (x) { return addedC.indexOf(x.id) < 0; }); C.save(); }
        if (addedF.length) { F.D.tx = F.D.tx.filter(function (x) { return addedF.indexOf(x.id) < 0; }); if (F.save) F.save(); else localStorage.setItem('mo-fin-v1', JSON.stringify(F.D)); }
      } catch (e) { }
      poke();
    };
    poke(); return res;
  }
  function poke() { try { if (W.BeresinInbox && W.BeresinInbox.refresh) W.BeresinInbox.refresh(true); } catch (e) { } try { if (MO.smart && MO.smart.invalidate) MO.smart.invalidate(); } catch (e) { } }

  /* =====================  PEMBACA: gambar (OCR) · PDF · teks  ===================== */
  var OCR_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', pdfP = null, ocrP = null;
  function loadScript(src) { return new Promise(function (res, rej) { var s = D.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = function () { rej(new Error('Mesin baca foto tidak bisa dimuat (butuh internet saat pertama kali).')); }; D.head.appendChild(s); }); }
  function ocrReady() { if (W.Tesseract) return Promise.resolve(); return ocrP || (ocrP = loadScript(OCR_SRC).catch(function (e) { ocrP = null; throw e; })); }
  function loadPdf() {
    if (pdfP) return pdfP; var base = D.baseURI;
    return (pdfP = import(new URL('pdfjs/pdf.min.mjs', base).href).then(function (m) { m.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', base).href; return m; }).catch(function (e) { pdfP = null; throw e; }));
  }
  function bitmapOf(file) {
    if (W.createImageBitmap) return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return imgEl(file); });
    return imgEl(file);
  }
  function imgEl(file) { return new Promise(function (res, rej) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('Gambar tidak bisa dibuka')); }; im.src = u; }); }
  function prep(src, w, h) {
    var s = Math.min(1, 2200 / Math.max(w, h)), cv = D.createElement('canvas'); cv.width = Math.max(1, Math.round(w * s)); cv.height = Math.max(1, Math.round(h * s));
    var x = cv.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(src, 0, 0, cv.width, cv.height);
    var id = x.getImageData(0, 0, cv.width, cv.height), p = id.data, hist = new Uint32Array(256), i, g, n = p.length / 4;
    for (i = 0; i < p.length; i += 4) { g = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0; p[i] = g; hist[g]++; }
    var lo = 0, hi = 255, acc = 0; for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.01) { lo = i; break; } } acc = 0; for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.01) { hi = i; break; } }
    var rng = Math.max(40, hi - lo);
    for (i = 0; i < p.length; i += 4) { g = (p[i] - lo) * 255 / rng; g = g < 0 ? 0 : g > 255 ? 255 : g; p[i] = p[i + 1] = p[i + 2] = g; }
    x.putImageData(id, 0, 0); return cv;
  }

  /* =====================  UI  ===================== */
  var ov = null, bodyEl = null, footEl = null, titleEl = null, inCam = null, inImg = null, inFile = null;
  var st = null, stream = null, camFacing = 'environment', camShots = 0, runId = 0, worker = null, curProg = null;
  function fresh() { return { step: 'pick', files: [], paste: '', text: '', cands: [], others: [], note: '', msg: '', receipt: false, accId: '', src: '', res: null }; }
  var ICO = {
    cam: '<path d="M4 8h3l1.6-2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
    img: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3L16 12l4 4.5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', back: '<path d="M15 5l-7 7 7 7"/>', ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', flip: '<path d="M4 8h12l-3-3M20 16H8l3 3"/>',
    wand: '<path d="M4 20 15 9M14 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1zM18 12l.7-1.4L20 10l-1.3-.6L18 8l-.6 1.4L16 10l1.4.6z"/>'
  };
  var svg = function (n, c) { return '<svg class="' + (c || 'sc-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[n] + '</svg>'; };

  function build() {
    if (ov) return;
    ov = D.createElement('div'); ov.className = 'sc-ov'; ov.hidden = true; ov.tabIndex = -1;
    ov.innerHTML = '<section class="sc-win" role="dialog" aria-modal="true" aria-label="Scan dan isi otomatis"><header class="sc-h"><button type="button" class="sc-x" data-a="close" aria-label="Tutup">' + svg('x') + '</button><div><h2>Scan &amp; isi otomatis</h2><p class="sc-sub"></p></div></header><div class="sc-b"></div><footer class="sc-f"></footer></section>' +
      '<input type="file" accept="image/*" capture="environment" hidden data-in="cam"><input type="file" accept="image/*" multiple hidden data-in="img"><input type="file" accept=".pdf,.txt,.csv,.md,.json,.ics,text/plain,application/pdf,image/*" multiple hidden data-in="file">';
    D.body.appendChild(ov);
    bodyEl = ov.querySelector('.sc-b'); footEl = ov.querySelector('.sc-f'); titleEl = ov.querySelector('.sc-sub');
    inCam = ov.querySelector('[data-in="cam"]'); inImg = ov.querySelector('[data-in="img"]'); inFile = ov.querySelector('[data-in="file"]');
    ov.addEventListener('click', onClick); ov.addEventListener('input', onInput); ov.addEventListener('change', onInput);
    [inCam, inImg, inFile].forEach(function (i) { i.addEventListener('change', function () { addFiles(i.files); i.value = ''; }); });
  }
  function open() {
    build(); st = fresh(); ov.hidden = false; D.documentElement.classList.add('sc-lock'); render(); try { ov.focus({ preventScroll: true }); } catch (e) { }
  }
  function close() { runId++; stopCam(); killWorker(); if (ov) ov.hidden = true; D.documentElement.classList.remove('sc-lock'); }
  function go(step) { st.step = step; render(); }
  function sizeTxt(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  function render() {
    var top = bodyEl ? bodyEl.scrollTop : 0, h = '', f = '';
    ov.className = 'sc-ov sc-s-' + st.step;
    if (st.step === 'pick') {
      titleEl.textContent = 'Foto, PDF, atau teks → otomatis jadi Task, Kalender, Keuangan';
      h += '<p class="sc-lead">Foto jadwal, daftar tugas, undangan, tagihan, atau struk belanja. Hasil bacaan kamu periksa dulu sebelum dimasukkan.</p>';
      h += '<div class="sc-tiles"><button type="button" class="sc-tile" data-a="cam">' + svg('cam', 'sc-ti') + '<b>Kamera</b><small>Foto langsung</small></button><button type="button" class="sc-tile" data-a="img">' + svg('img', 'sc-ti') + '<b>Foto</b><small>Dari galeri</small></button><button type="button" class="sc-tile" data-a="file">' + svg('file', 'sc-ti') + '<b>File</b><small>PDF, teks, gambar</small></button></div>';
      if (st.files.length) {
        h += '<div class="sc-q">' + st.files.map(function (x, i) { return '<div class="sc-qi"><span class="sc-qt">' + (x.type.indexOf('image') === 0 ? svg('img') : svg('file')) + '</span><div><b>' + esc(x.name) + '</b><small>' + sizeTxt(x.size) + '</small></div><button type="button" class="sc-qx" data-a="rmf" data-i="' + i + '" aria-label="Hapus">' + svg('x') + '</button></div>'; }).join('') + '</div>';
      }
      h += '<details class="sc-paste"' + (st.paste ? ' open' : '') + '><summary>Atau tempel / ketik teks</summary><textarea data-f="paste" rows="6" placeholder="Contoh:\nSenin 17 Nov 09.00 Rapat BEM\nTugas Fiqih dikumpulkan 20/11\nBayar UKT Rp 2.500.000">' + esc(st.paste) + '</textarea></details>';
      if (st.msg) h += '<p class="sc-warn">' + esc(st.msg) + '</p>';
      var n = st.files.length + (st.paste.trim() ? 1 : 0);
      f = '<button type="button" class="sc-pri" data-a="run"' + (n ? '' : ' disabled') + '>' + svg('wand') + 'Baca &amp; kenali' + (n ? ' (' + n + ')' : '') + '</button>';
    } else if (st.step === 'cam') {
      titleEl.textContent = 'Arahkan ke dokumen, lalu ketuk tombol bulat';
      h = '<div class="sc-cam"><video playsinline muted autoplay></video><div class="sc-cam-bar"><button type="button" class="sc-cb" data-a="flip" aria-label="Ganti kamera">' + svg('flip') + '</button><button type="button" class="sc-shot" data-a="shot" aria-label="Ambil foto"></button><button type="button" class="sc-cb" data-a="camdone" aria-label="Selesai">' + svg('ok') + '<em class="sc-cn"' + (camShots ? '' : ' hidden') + '>' + camShots + '</em></button></div></div>';
      f = '';
      setTimeout(startCam, 0);
    } else if (st.step === 'busy') {
      titleEl.textContent = 'Sedang membaca…';
      h = '<div class="sc-busy"><div class="sc-spin"></div><b id="sc-pl">Menyiapkan…</b><div class="sc-bar"><i id="sc-pb"></i></div><small>Foto diproses di perangkatmu. Pertama kali butuh internet untuk memuat mesin baca.</small></div>';
      f = '<button type="button" class="sc-sec" data-a="cancel">Batal</button>';
    } else if (st.step === 'review') {
      var nOn = st.cands.filter(function (c) { return valid(c, st.accId); }).length, accs = accounts();
      titleEl.textContent = st.cands.length ? st.cands.length + ' item dikenali — periksa lalu tambahkan' : 'Belum ada item yang dikenali';
      if (st.msg) h += '<p class="sc-warn">' + esc(st.msg) + '</p>';
      if (st.receipt) h += '<p class="sc-hint">Terbaca sebagai <b>struk belanja</b>: dicatat sebagai satu pengeluaran sebesar total.</p>';
      if (st.cands.some(function (c) { return c.type === 'fin'; })) {
        h += '<label class="sc-acc">Akun untuk transaksi' + (accs.length ? '<select data-f="acc">' + accs.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === st.accId ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>' : '<small class="sc-bad">Belum ada akun di Finance. Buat akun dulu agar transaksi bisa masuk.</small>') + '</label>';
      }
      h += '<div class="sc-list">' + st.cands.map(cardHtml).join('') + '</div>';
      if (!st.cands.length) h += '<p class="sc-empty">Tidak ada tanggal, jam, nominal, atau kata kunci tugas/jadwal yang terbaca. Periksa teks hasil baca di bawah (bisa kamu perbaiki), atau tambahkan baris secara manual.</p>';
      if (st.others.length) h += '<details class="sc-oth"><summary>Baris lain (' + st.others.length + ') — ketuk untuk menjadikannya item</summary>' + st.others.map(function (l, i) { return '<div class="sc-ol"><span>' + esc(l) + '</span><button type="button" data-a="oth" data-t="task" data-i="' + i + '">+ Task</button><button type="button" data-a="oth" data-t="cal" data-i="' + i + '">+ Kalender</button></div>'; }).join('') + '</details>';
      h += '<details class="sc-raw"><summary>Teks hasil baca (bisa diedit)</summary><textarea data-f="text" rows="8">' + esc(st.text) + '</textarea><button type="button" class="sc-sec" data-a="reparse">Analisis ulang</button></details>';
      f = '<button type="button" class="sc-sec" data-a="again">' + svg('back') + 'Kembali</button><button type="button" class="sc-pri" data-a="add"' + (nOn ? '' : ' disabled') + '>' + svg('ok') + 'Tambahkan ' + nOn + ' item</button>';
    } else if (st.step === 'done') {
      var r = st.res; titleEl.textContent = 'Selesai';
      h = '<div class="sc-done"><div class="sc-ok">' + svg('ok', 'sc-oki') + '</div><h3>' + (r.task + r.cal + r.fin) + ' item ditambahkan</h3><div class="sc-go">' +
        (r.task ? '<button type="button" data-a="goto" data-r="#task">Task · ' + r.task + '</button>' : '') + (r.cal ? '<button type="button" data-a="goto" data-r="#calendar">Kalender · ' + r.cal + '</button>' : '') + (r.fin ? '<button type="button" data-a="goto" data-r="#finance">Keuangan · ' + r.fin + '</button>' : '') + '</div>' + (r.err ? '<p class="sc-warn">' + esc(r.err) + '</p>' : '') + '<p class="sc-hint">Salah masuk? Ketuk Urungkan — semua yang barusan ditambahkan dihapus.</p></div>';
      f = '<button type="button" class="sc-sec" data-a="undo">Urungkan</button><button type="button" class="sc-pri" data-a="close">Selesai</button>';
    }
    bodyEl.innerHTML = h; footEl.innerHTML = f; footEl.hidden = !f;
    if (st.step === 'review') bodyEl.scrollTop = top;
  }

  function cardHtml(c, i) {
    var seg = [['task', 'Task'], ['cal', 'Kalender'], ['fin', 'Keuangan']].map(function (t) { return '<button type="button" data-a="type" data-v="' + t[0] + '" aria-pressed="' + (c.type === t[0]) + '"' + (t[0] === 'fin' && !accounts().length ? ' disabled' : '') + '>' + t[1] + '</button>'; }).join('');
    return '<div class="sc-card' + (c.on ? '' : ' off') + '" data-i="' + i + '" data-t="' + c.type + '"><div class="sc-ch"><label class="sc-ck"><input type="checkbox" data-f="on"' + (c.on ? ' checked' : '') + '><span></span></label><div class="sc-seg" role="group">' + seg + '</div><button type="button" class="sc-del" data-a="del" aria-label="Buang">' + svg('x') + '</button></div>' +
      '<input class="sc-in" data-f="title" value="' + esc(c.title) + '" placeholder="Judul" maxlength="160">' +
      '<div class="sc-row"><label>Tanggal<input type="date" data-f="date" value="' + esc(c.date) + '"></label><label class="sc-tm">Mulai<input type="time" data-f="t1" value="' + esc(c.t1) + '"></label><label class="sc-tm">Selesai<input type="time" data-f="t2" value="' + esc(c.t2) + '"></label>' +
      '<label class="sc-am">Jumlah (Rp)<input type="number" inputmode="numeric" min="0" data-f="amount" value="' + (c.amount || '') + '"></label><label class="sc-fk">Jenis<select data-f="fin"><option value="Expense"' + (c.fin === 'Expense' ? ' selected' : '') + '>Pengeluaran</option><option value="Income"' + (c.fin === 'Income' ? ' selected' : '') + '>Pemasukan</option></select></label></div>' +
      '<div class="sc-meta">' + (c.dup ? '<span class="sc-chip w">Sudah ada — jangan dobel?</span>' : '') + (c.noDate ? '<span class="sc-chip w">Tanggal belum terbaca, diisi hari ini</span>' : '') + (c.type === 'fin' && !(+c.amount > 0) ? '<span class="sc-chip w">Isi jumlahnya</span>' : '') + '<span class="sc-src" title="' + esc(c.src) + '">“' + esc(c.src.slice(0, 70)) + '”</span></div></div>';
  }

  function onInput(e) {
    var t = e.target, f = t.dataset && t.dataset.f; if (!f) return;
    if (f === 'paste') { st.paste = t.value; var b = footEl.querySelector('[data-a="run"]'); if (b) { var n = st.files.length + (st.paste.trim() ? 1 : 0); b.disabled = !n; b.innerHTML = svg('wand') + 'Baca &amp; kenali' + (n ? ' (' + n + ')' : ''); } return; }
    if (f === 'text') { st.text = t.value; return; }
    if (f === 'acc') { st.accId = t.value; cands().forEach(markDup); render(); return; }
    var card = t.closest('.sc-card'); if (!card) return; var c = st.cands[+card.dataset.i]; if (!c) return;
    if (f === 'on') { c.on = t.checked; card.classList.toggle('off', !c.on); }
    else if (f === 'amount') c.amount = +t.value || 0; else c[f] = t.value;
    if (f === 'noDate') return; if (f === 'date') c.noDate = false;
    if (e.type === 'change') { markDup(c); var keep = bodyEl.scrollTop; render(); bodyEl.scrollTop = keep; } else updateAdd();
  }
  function cands() { return st.cands; }
  function updateAdd() { var b = footEl.querySelector('[data-a="add"]'); if (!b) return; var n = st.cands.filter(function (c) { return valid(c, st.accId); }).length; b.disabled = !n; b.innerHTML = svg('ok') + 'Tambahkan ' + n + ' item'; }

  function onClick(e) {
    var b = e.target.closest && e.target.closest('[data-a]'); if (!b || !ov.contains(b)) return; var a = b.dataset.a;
    switch (a) {
      case 'close': return close();
      case 'cam': return openCam();
      case 'img': return inImg.click();
      case 'file': return inFile.click();
      case 'rmf': st.files.splice(+b.dataset.i, 1); return render();
      case 'run': return run();
      case 'cancel': runId++; killWorker(); st.msg = 'Dibatalkan.'; return go('pick');
      case 'shot': return shot();
      case 'flip': camFacing = camFacing === 'environment' ? 'user' : 'environment'; stopCam(); return startCam();
      case 'camdone': stopCam(); return go('pick');
      case 'again': st.msg = ''; return go('pick');
      case 'reparse': return analyse2(st.text, true);
      case 'del': st.cands.splice(+b.closest('.sc-card').dataset.i, 1); return render();
      case 'type': { var c = st.cands[+b.closest('.sc-card').dataset.i]; c.type = b.dataset.v; if (c.type === 'cal' && !c.date) { c.date = todayS(); c.noDate = true; } if (c.type === 'fin' && !c.cat) c.cat = 'Lainnya'; markDup(c); return render(); }
      case 'oth': { var line = st.others[+b.dataset.i], f = analyse(line, todayS()), tp = b.dataset.t, cc = mk(tp, { title: f.title || line, date: f.date || (tp === 'cal' ? todayS() : ''), t1: f.t1, t2: f.t2, src: line, cat: catFor(line, tp), noDate: tp === 'cal' && !f.date }); st.others.splice(+b.dataset.i, 1); st.cands.push(markDup(cc)); return render(); }
      case 'add': return doAdd();
      case 'undo': if (st.res && st.res.undo) st.res.undo(); st.res = null; st.msg = 'Dibatalkan — item yang barusan ditambahkan sudah dihapus.'; return go('review');
      case 'goto': { var r = b.dataset.r; close(); if (W.__bsJump) try { W.__bsJump(); } catch (x) { } setTimeout(function () { if (MO.routes && MO.routes[r]) MO.routes[r](); }, 80); return; }
    }
  }

  /* ---- kamera ---- */
  function addFiles(list) {
    for (var i = 0; i < list.length; i++) { var f = list[i]; if (f && f.size) st.files.push(f); }
    st.msg = ''; if (st.step !== 'pick') st.step = 'pick'; render();
  }
  function openCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !W.isSecureContext) return inCam.click();
    camShots = 0; go('cam');
  }
  function startCam() {
    var v = bodyEl.querySelector('video'); if (!v || stream) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
      if (st.step !== 'cam') { s.getTracks().forEach(function (t) { t.stop(); }); return; } stream = s; v.srcObject = s; v.play && v.play().catch(function () { });
    }).catch(function () { stopCam(); st.step = 'pick'; render(); inCam.click(); });
  }
  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  function shot() {
    var v = bodyEl.querySelector('video'); if (!v || !v.videoWidth) return;
    var cv = D.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
    cv.toBlob(function (bl) { if (!bl) return; var f; try { f = new File([bl], 'foto-' + (st.files.length + 1) + '.jpg', { type: 'image/jpeg' }); } catch (e) { f = bl; f.name = 'foto-' + (st.files.length + 1) + '.jpg'; } st.files.push(f); camShots++; var n = bodyEl.querySelector('.sc-cn'); if (n) { n.hidden = false; n.textContent = camShots; } var sh = bodyEl.querySelector('.sc-shot'); if (sh) { sh.classList.remove('flash'); void sh.offsetWidth; sh.classList.add('flash'); } }, 'image/jpeg', 0.92);
  }

  /* ---- proses ---- */
  function prog(label, frac) { var l = D.getElementById('sc-pl'), b = D.getElementById('sc-pb'); if (l && label) l.textContent = label; if (b && frac != null) b.style.width = Math.max(3, Math.min(100, Math.round(frac * 100))) + '%'; }
  function killWorker() { if (worker) { try { worker.terminate(); } catch (e) { } worker = null; } }
  function getWorker() {
    if (worker) return Promise.resolve(worker);
    return ocrReady().then(function () { return W.Tesseract.createWorker('ind+eng', 1, { logger: function (m) { if (curProg && m && m.status === 'recognizing text') curProg(m.progress); } }); }).then(function (w) { worker = w; return w; });
  }
  function ocrCanvas(cv) { return getWorker().then(function (w) { return w.recognize(cv); }).then(function (r) { return (r && r.data && r.data.text) || ''; }); }
  function readImage(file, label, id, base, span) {
    curProg = function (p) { if (id === runId) prog(null, base + span * p); };
    prog(label + ' · menyiapkan foto', base);
    return bitmapOf(file).then(function (bm) { var cv = prep(bm, bm.width || bm.naturalWidth, bm.height || bm.naturalHeight); if (bm.close) try { bm.close(); } catch (e) { } prog(label + ' · membaca teks', base + span * 0.05); return ocrCanvas(cv); });
  }
  function readPdf(file, label, id, base, span) {
    prog(label + ' · membuka PDF', base);
    return Promise.all([loadPdf(), file.arrayBuffer()]).then(function (a) {
      return a[0].getDocument({ data: a[1] }).promise.then(function (pdf) {
        var n = Math.min(pdf.numPages, 30), out = [], p = Promise.resolve();
        for (var k = 1; k <= n; k++) (function (k) {
          p = p.then(function () {
            if (id !== runId) return; var b2 = base + span * (k - 1) / n;
            return pdf.getPage(k).then(function (pg) {
              return pg.getTextContent().then(function (tc) {
                var rows = {}; tc.items.forEach(function (it) { if (!it.str || !it.str.trim()) return; var y = Math.round(it.transform[5] / 3); (rows[y] = rows[y] || []).push([it.transform[4], it.str]); });
                var txt = Object.keys(rows).map(Number).sort(function (x, y) { return y - x; }).map(function (y) { return rows[y].sort(function (x, z) { return x[0] - z[0]; }).map(function (q) { return q[1]; }).join(' '); }).join('\n');
                if (txt.replace(/\s/g, '').length >= 25) { out.push(txt); return; }
                /* halaman hasil pindai (tanpa teks) → OCR */
                var vp = pg.getViewport({ scale: 2 }), cv = D.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
                return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () { curProg = function (q) { if (id === runId) prog(null, b2 + span / n * q); }; prog(label + ' · hal. ' + k + ' (pindai) membaca teks', b2); return ocrCanvas(prep(cv, cv.width, cv.height)); }).then(function (t) { out.push(t); });
              });
            });
          });
        })(k);
        return p.then(function () { return out.join('\n'); });
      });
    });
  }
  function run() {
    var id = ++runId, files = st.files.slice(), texts = [], errs = [], total = files.length || 1;
    st.src = files.map(function (f) { return f.name; }).join(', ').slice(0, 80); go('busy');
    var chain = Promise.resolve();
    files.forEach(function (f, i) {
      chain = chain.then(function () {
        if (id !== runId) return; var label = 'Berkas ' + (i + 1) + '/' + files.length, base = i / total, span = 1 / total, name = (f.name || '').toLowerCase(), type = f.type || '';
        var job = /pdf/.test(type) || /\.pdf$/.test(name) ? readPdf(f, label, id, base, span) : /^image\//.test(type) || /\.(jpe?g|png|webp|heic|bmp|gif)$/.test(name) ? readImage(f, label, id, base, span) : f.text();
        return job.then(function (t) { if (t && t.trim()) texts.push(t); }).catch(function (er) { errs.push((f.name || 'berkas') + ': ' + (er && er.message || 'gagal dibaca')); });
      });
    });
    chain.then(function () {
      if (id !== runId) return; killWorker(); curProg = null;
      if (st.paste.trim()) texts.push(st.paste);
      st.msg = errs.length ? errs.join(' · ') : '';
      analyse2(texts.join('\n'), false);
    });
  }
  function analyse2(text, again) {
    st.text = text; var r = parse(text); st.cands = r.cands; st.others = r.others; st.receipt = r.receipt;
    var accs = accounts(); if (!st.accId || !accs.some(function (a) { return a.id === st.accId; })) st.accId = accs[0] ? accs[0].id : '';
    st.cands.forEach(function (c) { markDup(c); if (c.dup) c.on = false; if (c.type === 'fin' && !st.accId) c.on = false; });
    if (!text.trim() && !st.msg) st.msg = 'Tidak ada teks yang terbaca. Coba foto lebih terang & lurus, atau tempel teksnya di bawah.';
    else if (!again && r.lines && !r.cands.length && !st.msg) st.msg = '';
    go('review');
  }
  function doAdd() {
    var list = st.cands.filter(function (c) { return valid(c, st.accId); }); if (!list.length) return;
    st.res = insertAll(list, st.accId, st.src); go('done');
  }

  D.addEventListener('keydown', function (e) { if (e.key !== 'Escape' || !ov || ov.hidden) return; e.stopPropagation(); e.preventDefault(); if (st.step === 'cam') { stopCam(); go('pick'); } else close(); }, true);

  /* ---- tombol di header ---- */
  /* window + capture (sama seperti tombol Inbox): mendahului penangkap klik umum tombol header di app.js yang kalau tidak
     akan memunculkan dialog "Coming soon" dan membuat beranda tetap terkunci (win-open) setelah Scan ditutup. */
  W.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#scanBtn'); if (!b) return; e.stopImmediatePropagation(); e.preventDefault(); open(); }, true);
  W.BeresinScan = { open: open, close: close, parse: parse, analyse: analyse, _insert: insertAll, _mark: markDup };
})();
