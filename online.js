/* online.js v3.8 — Beresin sebagai aplikasi online.
   1) Mendaftarkan service worker (hanya di http/https) dan menampilkan "Versi baru tersedia" bila ada pembaruan.
   2) Menandai status koneksi (offline / kembali online) tanpa mengganggu tampilan.
   3) Menawarkan "Pasang aplikasi" (Android/Chrome/Edge) satu kali, bisa ditunda.
   4) Meminta penyimpanan permanen agar data di perangkat tidak dihapus otomatis oleh browser. */
(function () {
  'use strict';
  if (window.__bsOnline) return; window.__bsOnline = 1;
  var D = document, W = window, N = navigator;
  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

  /* ---------- gaya (kecil, mengikuti safe-area HP) ---------- */
  var st = D.createElement('style');
  st.textContent = '.bso{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147483000;transform:translate(-50%,24px);opacity:0;pointer-events:none;max-width:min(92vw,420px);display:flex;align-items:center;gap:10px;padding:10px 12px 10px 16px;border-radius:16px;background:rgba(17,24,45,.96);color:#fff;font:500 13px/1.35 Inter,system-ui,sans-serif;box-shadow:0 14px 34px -10px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08) inset;transition:transform .38s cubic-bezier(.22,1,.36,1),opacity .28s ease}' +
    '.bso.on{transform:translate(-50%,0);opacity:1;pointer-events:auto}' +
    '.bso i{flex:none;width:8px;height:8px;border-radius:50%;background:#34d399}.bso.off i{background:#fbbf24}' +
    '.bso span{flex:1;min-width:0}' +
    '.bso button{flex:none;border:0;border-radius:11px;padding:7px 12px;font:600 12.5px Inter,system-ui,sans-serif;color:#0b1020;background:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.bso button.g{background:transparent;color:rgba(255,255,255,.72);padding:7px 8px}' +
    '@media (prefers-reduced-motion:reduce){.bso{transition:opacity .2s}}';
  D.head.appendChild(st);

  var box = null, hideT = 0;
  function toast(html, cls, ms) {
    if (!box) { box = D.createElement('div'); box.className = 'bso'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); D.body.appendChild(box); }
    clearTimeout(hideT); box.className = 'bso ' + (cls || '');
    box.innerHTML = html;
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('on'); }); });
    if (ms) hideT = setTimeout(hide, ms);
    return box;
  }
  function hide() { if (box) box.classList.remove('on'); }

  /* ---------- status koneksi ---------- */
  function offline() { toast('<i></i><span>Tidak ada internet — Beresin tetap jalan, data aman di perangkat.</span>', 'off'); }
  function online(first) { if (!first) toast('<i></i><span>Kembali online.</span>', '', 2200); }
  W.addEventListener('offline', offline);
  W.addEventListener('online', function () { online(false); });
  function boot() { if (N.onLine === false) offline(); }

  /* ---------- service worker + pembaruan ---------- */
  var reloading = false, userAsked = false, hadCtl = !!(N.serviceWorker && N.serviceWorker.controller);
  /* v6.2: reload otomatis HANYA bila (a) halaman ini sudah dikendalikan SW lama (artinya ini pembaruan, bukan kunjungan pertama —
     di kunjungan pertama clients.claim() juga memicu controllerchange sehingga halaman memuat ulang sendiri ±1,5 dtk setelah dibuka)
     dan (b) pengguna sendiri menekan "Muat ulang". Tab lain yang menekan tombol itu tidak lagi memuat-ulang tab ini di tengah pengisian form. */
  function askReload(reg) {
    var b = toast('<i></i><span>Versi baru Beresin tersedia.</span><button class="g" data-x="later">Nanti</button><button data-x="now">Muat ulang</button>');
    b.onclick = function (e) {
      var x = e.target && e.target.getAttribute && e.target.getAttribute('data-x');
      if (x === 'later') hide();
      if (x === 'now') { userAsked = true; if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); else location.reload(); }
    };
  }
  if ('serviceWorker' in N && /^https?:$/.test(location.protocol)) {
    N.serviceWorker.addEventListener('controllerchange', function () { if (reloading || !hadCtl || !userAsked) return; reloading = true; location.reload(); });
    W.addEventListener('load', function () {
      N.serviceWorker.register('sw.js').then(function (reg) {
        if (reg.waiting && N.serviceWorker.controller) askReload(reg);
        reg.addEventListener('updatefound', function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener('statechange', function () { if (w.state === 'installed' && N.serviceWorker.controller) askReload(reg); });
        });
        /* cek pembaruan saat aplikasi dibuka kembali dari latar belakang */
        D.addEventListener('visibilitychange', function () { if (!D.hidden) { try { reg.update(); } catch (e) { } } });
      }).catch(function () { });
    });
  }

  /* ---------- tawaran "Pasang aplikasi" ---------- */
  var deferred = null;
  W.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    var t = +LS.get('bs-inst-later') || 0;
    if (Date.now() - t < 7 * 864e5) return;
    setTimeout(function () {
      if (!deferred) return;
      var b = toast('<i></i><span>Pasang Beresin di layar utama agar terbuka seperti aplikasi.</span><button class="g" data-x="later">Nanti</button><button data-x="ok">Pasang</button>');
      b.onclick = function (ev) {
        var x = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-x');
        if (x === 'later') { LS.set('bs-inst-later', String(Date.now())); hide(); }
        if (x === 'ok' && deferred) { hide(); deferred.prompt(); deferred.userChoice.then(function () { deferred = null; }, function () { }); }
      };
    }, 4000);
  });
  W.addEventListener('appinstalled', function () { deferred = null; hide(); });
  W.__bsInstall = function () { if (deferred) { deferred.prompt(); } };   /* bisa dipanggil dari tombol Pengaturan bila diinginkan */

  /* ---------- penyimpanan permanen ---------- */
  try { if (N.storage && N.storage.persist) N.storage.persist(); } catch (e) { }

  if (D.body) boot(); else D.addEventListener('DOMContentLoaded', boot);
})();
