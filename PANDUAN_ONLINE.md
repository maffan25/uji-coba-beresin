# Menjadikan Beresin bisa diakses online

Aplikasi ini web statis (tanpa server). Cukup diunggah ke hosting HTTPS, lalu dibuka dari HP.

## Cara tercepat (gratis)
1. **Cloudflare Pages / Netlify / Vercel**: buat proyek baru → unggah isi folder ini (index.html harus di akar) → dapat alamat `https://nama-kamu.pages.dev` (atau netlify.app / vercel.app).
   - Netlify drag & drop: seret folder ini ke https://app.netlify.com/drop
   - Berkas `vercel.json` dan `_headers` sudah disiapkan (sw.js tidak di-cache, tipe berkas pdf.js benar).
2. Buka alamat itu di Chrome HP → menu ⋮ → **Pasang aplikasi / Tambahkan ke layar utama** (atau tekan tombol "Pasang" yang muncul sendiri). iPhone: Safari → Bagikan → Tambahkan ke Layar Utama.
3. Setelah terpasang, aplikasi terbuka layar penuh, memuat versi terbaru saat ada internet, dan tetap jalan saat offline.

## Jadi file APK (opsional)
- Buka https://www.pwabuilder.com → masukkan alamat hosting dari langkah 1 → pilih Android → unduh paket. APK ini memuat alamat online kamu (selalu versi terbaru) dan tetap punya cache offline.
- Pakai Capacitor dari folder ini (mode lokal) juga bisa, tetapi pembaruan harus lewat APK baru. Untuk selalu online, isi `server.url` dengan alamat hosting.

## Memperbarui
Ganti berkas di hosting. Pengguna melihat "Versi baru tersedia → Muat ulang". Jika kamu mengubah app.js/app.css, naikkan nomor `?v=` di index.html dan nama `V` + daftar CORE di sw.js.

## Catatan data
Data tersimpan di perangkat (localStorage/IndexedDB), bukan di server. Gunakan fitur sambung perangkat/ekspor untuk memindahkan data. Jangan hapus "data situs" di pengaturan browser.
