/* pages.js — v5.8 "Halaman Penuh" (+ v5.1 "Mode Halaman")
   v5.8: halaman tidak menumpuk — lapisan di bawah halaman teratas diberi data-pg-under (disembunyikan lewat pages.css);
   ikon menu tidak bergerak saat menu ditutup (kelas nx-quiet sementara).
   Menu diperlakukan seperti halaman: membuka menu = satu langkah riwayat (history), sehingga
   tombol/gestur KEMBALI di HP menutup menu (bukan keluar dari aplikasi), dan berurutan bila ada
   lapisan bertumpuk (menu → form/detail). Tidak mengubah modul lama: hanya mengamati lapisan di <body>
   dan menutup lapisan teratas lewat jalur "Escape" yang sudah didukung tiap modul (+ tombol tutup sebagai cadangan).
   Aman: tanpa pengamat DOM berat (hanya anak langsung <body>), tanpa pembacaan layout kecuali saat tombol Kembali ditekan. */
(function () {
  'use strict';
  if (window.__bsPages) return; window.__bsPages = 1;
  var D = document, B = D.body, W = window;
  if (!B || !W.history || !history.pushState) return;

  var LAYER = /(^|\s)(ac-ov|ad-ov|wo-ov|es-ov|fn-ov|ac-ov2|wo-ov2|es-ov2|sp-ov|ib-ov|sm-ov|sc-ov|qc-ov|ac-soon)(\s|$)/;
  var CLOSE_BTN = '.ac-x,.wo-x,.es-x,.ib-x,.ib-xb,.sc-x,.qc-x,[data-x="close"],[aria-label="Tutup"],[aria-label="Close"]';

  var pushed = 0;        // jumlah langkah riwayat yang kita buat (= jumlah lapisan terbuka)
  var waiting = 0;       // 1 selama menunggu popstate hasil history.go() buatan kita
  var hold = 0;          // jangan sinkronkan sebelum waktu ini (memberi waktu animasi tutup selesai)
  var tSync = 0, tGo = 0;

  function cls(e) { var c = e.className; return typeof c === 'string' ? c : ''; }
  function layers() {
    var out = [], c = B.children;
    for (var i = 0; i < c.length; i++) {
      var e = c[i];
      if (e.nodeType !== 1 || e.hidden) continue;
      if (LAYER.test(cls(e))) out.push(e);
    }
    return out;
  }

  /* ---- v5.8: tidak menumpuk ----
     Halaman = menu penuh (ac/ad/wo/es/fn/ib/sc). Lembar form (…-ov2) dan dialog kecil tetap boleh di atas halaman,
     tetapi apa pun yang berada DI BAWAH halaman teratas disembunyikan, jadi yang terlihat selalu satu halaman. */
  var PAGE = /(^|\s)(ac-ov|ad-ov|wo-ov|es-ov|fn-ov|ib-ov|sc-ov)(\s|$)/, SHEET = /(^|\s)(ac-ov2|wo-ov2|es-ov2)(\s|$)/;
  var rafU = 0;
  function zOf(e) { var z = parseInt(getComputedStyle(e).zIndex, 10); return isNaN(z) ? 0 : z; }
  function markUnder() {
    rafU = 0;
    var c = B.children, L = [], i, e, k;
    for (i = 0; i < c.length; i++) {
      e = c[i];
      if (e.nodeType !== 1) continue;
      if (e.hasAttribute('data-pg-under')) e.removeAttribute('data-pg-under');   // mulai bersih; dipasang ulang di bawah
      if (e.hidden || !LAYER.test(cls(e))) continue;
      L.push({ e: e, z: 0, i: i });
    }
    if (L.length < 2) return;                                                      // v5.9: satu lapisan saja -> tanpa getComputedStyle (memaksa restyle)
    for (k = 0; k < L.length; k++) L[k].z = zOf(L[k].e);
    L.sort(function (a, b) { return a.z - b.z || a.i - b.i; });
    var tp = -1;
    for (k = L.length - 1; k >= 0; k--) { var cn = cls(L[k].e); if (PAGE.test(cn) && !SHEET.test(cn)) { tp = k; break; } }
    for (k = 0; k < tp; k++) L[k].e.setAttribute('data-pg-under', '');
  }
  function schedUnder() { if (!rafU) rafU = requestAnimationFrame(markUnder); }   // rAF = sebelum frame berikut dilukis → tidak ada kedipan tumpukan

  function sync() {
    tSync = 0; schedUnder();
    if (waiting) return;
    var left = hold - Date.now();
    if (left > 0) { tSync = setTimeout(sync, left + 10); return; }
    var n = layers().length;
    if (n > pushed) {
      while (pushed < n) { try { history.pushState({ bsLayer: pushed + 1 }, ''); } catch (e) { pushed = n; break; } pushed++; }
    } else if (n < pushed) {
      var k = pushed - n; pushed = n; waiting = 1;
      try { history.go(-k); } catch (e) { waiting = 0; return; }
      clearTimeout(tGo); tGo = setTimeout(function () { if (waiting) { waiting = 0; sched(); } }, 600);   // jaga-jaga bila popstate tak datang
    }
  }
  function sched() { if (!tSync) tSync = setTimeout(sync, 30); }

  /* Beberapa modul (mis. Finance) memakai overlay yang sudah ada di <body> dan hanya membalik atribut hidden,
     jadi atribut tiap anak langsung <body> ikut diamati (jumlahnya kecil; subtree:false tidak melihat atribut anak). */
  var ATTR = { attributes: true, attributeFilter: ['hidden', 'class'] };
  var mo = new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) {
      var a = recs[i].addedNodes;
      for (var j = 0; a && j < a.length; j++) if (a[j].nodeType === 1) mo.observe(a[j], ATTR);
    }
    schedUnder(); sched();
  });
  mo.observe(B, { childList: true });
  for (var i = 0; i < B.children.length; i++) mo.observe(B.children[i], ATTR);
  // jaring pengaman (sama seperti penguncian scroll di app.js): perubahan lewat jalur lain tetap tertangkap
  D.addEventListener('click', function () { setTimeout(sched, 120); }, true);
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape') setTimeout(sched, 120); }, true);

  /* lapisan paling atas = z-index tertinggi, seri → yang paling akhir di DOM */
  function top() {
    var L = layers(), best = null, bz = -1;
    for (var i = 0; i < L.length; i++) {
      var z = parseInt(getComputedStyle(L[i]).zIndex, 10); if (isNaN(z)) z = 0;
      if (z >= bz) { bz = z; best = L[i]; }
    }
    return best;
  }

  function closeTop() {
    var el = top(); if (!el) return;
    var before = layers().length;
    /* v5.8: bila ada lebih dari satu lapisan, tutup HANYA yang teratas lewat tombol tutupnya sendiri.
       (Escape menyebar ke seluruh dokumen sehingga modul lain di bawahnya ikut menutup → satu kali "Kembali" menutup dua halaman.) */
    if (before > 1) {
      var xb = el.querySelector('.ac-x,.wo-x,.es-x,.ib-x,.ib-xb,.sc-x,.qc-x,[data-x="close"],[data-act="close"],[data-a="close"]');
      if (xb) { xb.click(); return; }
    }
    var tgt = el.firstElementChild || el;
    try { tgt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })); } catch (e) { }
    // Cadangan: bila Escape tidak menutup apa pun, tekan tombol tutup bawaan lapisan itu.
    setTimeout(function () {
      if (!el.isConnected || el.hidden || layers().length < before) return;
      var b = el.querySelector(CLOSE_BTN); if (b) b.click();
    }, 260);
  }

  W.addEventListener('popstate', function () {
    if (waiting) { waiting = 0; clearTimeout(tGo); sched(); return; }
    if (pushed > 0) {
      pushed--;
      hold = Date.now() + 300;      // beri modul waktu menutup dirinya; sinkron sesudahnya
      closeTop();
      sched();
    }
  });

  // Halaman dimuat ulang saat berada di langkah buatan kita: bersihkan penanda agar tidak membingungkan.
  try { if (history.state && history.state.bsLayer) history.replaceState(null, ''); } catch (e) { }

  sched();

  /* v5.8: sesaat setelah menu ditutup, beranda tidak boleh menjalankan transisi apa pun (efek hover ikon yang dilepas,
     animasi ikon dsb.) — semua perubahan gaya dari "menu terbuka" ke "menu tertutup" diterapkan seketika. */
  var R = D.documentElement, wasOpen = R.classList.contains('win-open'), tQ = 0;
  new MutationObserver(function () {
    var now = R.classList.contains('win-open');
    if (now === wasOpen) return; wasOpen = now;
    clearTimeout(tQ);
    if (now) { R.classList.remove('nx-quiet'); return; }   // v5.9: saat membuka tidak perlu menyalakan lalu mematikan (2 restyle sia-sia); beranda tersembunyi
    R.classList.add('nx-quiet');
    tQ = setTimeout(function () { R.classList.remove('nx-quiet'); }, 700);
  }).observe(R, { attributes: true, attributeFilter: ['class'] });
  // saat menu terbuka, 'nx-quiet' dilepas lagi dengan cepat (beranda tersembunyi); yang penting aktif tepat ketika menu ditutup.

  schedUnder();
  sched();
})();
