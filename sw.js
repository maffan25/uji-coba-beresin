/* sw.js — Beresin online + offline.
   - Inti aplikasi di-cache saat pertama dibuka; pdf.js & font di-cache saat dipakai.
   - Halaman: jaringan dulu (update cepat), tapi jika jaringan lambat >3,5 dtk atau mati, langsung pakai cache (tidak menggantung).
   - Versi baru menunggu sampai pengguna menekan "Muat ulang" (data yang sedang diisi tidak hilang mendadak). */
const V = 'beresin-v62';
const CORE = ['./', 'index.html', 'app.css?v=62', 'perf2.js?v=62', 'perf3.js?v=62', 'app.js?v=62', 'online.js?v=62', 'activity.js?v=62', 'inbox.js?v=62', 'inbox.css?v=62', 'smart.js?v=62', 'smart.css?v=62', 'scan.js?v=62', 'scan.css?v=62', 'pages.css?v=62', 'pages.js?v=62', 'study.css?v=62', 'campus.css?v=62', 'study.js?v=62', 'quick.css?v=62', 'quick.js?v=62', 'banks.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'pdfjs/pdf.min.mjs', 'pdfjs/pdf.worker.min.mjs'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === location.origin, font = /(fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net)$/.test(u.hostname);
  if (!same && !font) return;
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match('index.html') || await caches.match('./');
      const net = fetch(r).then(x => { if (x && x.ok) { const c = x.clone(); caches.open(V).then(k => k.put('index.html', c)); } return x; });
      if (!cached) return net;
      return Promise.race([net, new Promise(res => setTimeout(() => res(cached), 3500))]).catch(() => cached);
    })());
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(x => { if (x && (x.ok || x.type === 'opaque')) { const c = x.clone(); caches.open(V).then(k => k.put(r, c)); } return x; }).catch(() => hit);
    return hit || net;
  }));
});
