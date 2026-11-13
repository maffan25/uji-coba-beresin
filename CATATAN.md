# Beresin 5.0 — aplikasi online + offline

v6.2 (Hilangkan reload otomatis kunjungan pertama + percepat hitung-naik angka)
- PERBAIKAN (online.js): pada kunjungan PERTAMA (atau setelah data situs dihapus) halaman memuat ulang sendiri ±1,5 dtk setelah dibuka, sehingga terasa "refresh" dan status layar/isian hilang. Penyebab: clients.claim() di sw.js memicu controllerchange, dan handler-nya selalu memanggil location.reload(). Kini reload hanya terjadi bila halaman memang sudah dikendalikan SW lama (pembaruan) DAN pengguna sendiri menekan "Muat ulang". Tab lain yang menekan tombol itu tidak lagi memuat ulang tab ini di tengah pengisian form.
- Diuji (Chromium, SW aktif): kunjungan pertama sebelum = 2 kali load, penanda halaman hilang; sesudah = 1 kali load, penanda utuh. Alur pembaruan v61→v62: toast "Muat ulang" muncul, TANPA klik tidak ada reload, setelah klik tepat 1 reload, cache lama (v61) terhapus.
- PERCEPAT (app.js, blok hitung-naik angka): keyOf() menjalankan querySelectorAll + gulir linear untuk SETIAP angka sehingga kerja tumbuh kuadratis saat daftar panjang. Kini daftar per-root disimpan selama satu putaran sinkron (indeks/kunci tetap sama persis). Terukur dengan 600 tugas: waktu fungsi ini ±154 ms → ±30 ms per 6 siklus buka-tutup (CPU 4x lambat).
- Diuji: 11 menu (Academic…Settings) buka → Esc → buka → tombol Kembali: semuanya menutup bersih, halaman tidak reload, 0 galat JS; tekan cepat 30 siklus (jeda 40 ms): tidak ada lapisan tersangkut; CLS 0.
- Catatan jujur: sisa waktu buka-tutup menu berdaftar panjang kini didominasi layout/paint bawaan browser, bukan JavaScript; titik JS yang tersisa (pengamat DOM yang memindai seluruh dokumen setelah tiap render) hanya ±16 ms/siklus pada HP terbayang. Pengukuran memakai Chromium tanpa GPU nyata.
- Berkas berubah: online.js, app.js, index.html & sw.js (versi ?v=62, cache beresin-v62).

v6.1 (Tumpukan kartu mata kuliah: satu box per kampus)
- BARU: tab Academic → Mata Kuliah kini menampilkan SEMUA kampus sekaligus, masing-masing sebagai box (Kampus 1, Kampus 2, dst.). Kartu mata kuliah bertumpuk seperti kertas di dalam box; yang terlihat hanya tepi atasnya (warna + nama).
- Menggulir box (roda mouse, geser jari, panah atas/bawah, tombol ^ v di papan nama, atau klik tepi kertas) memilih kartu: kartu terpilih naik keluar dari box dan tampil penuh, kartu sebelumnya turun masuk ke tumpukan. Animasi mengikuti posisi gulir (halus, ada snap per kartu). Di ujung tumpukan, gulir otomatis diteruskan ke halaman.
- Data tidak berubah. Tiap box dirender dari data kampusnya sendiri (split(id)); mengetuk Edit/Hapus/+ Mata kuliah di box kampus lain otomatis memindahkan kampus aktif. Filter Semua/Aktif/Selesai berlaku di semua box. Kartu di Dashboard tidak diubah.
- Berkas: app.js (blok "TUMPUKAN KARTU", vCourse, hook di renderBody/onClick/build), campus.css (gaya box + kertas), index.html & sw.js (versi ?v=61, cache beresin-v61).
- Diuji di Chromium (desktop + HP): gulir roda, tombol, klik tepi kertas, edit dari box kampus ke-2, filter, kampus kosong; 0 galat JS.

v6.0 (Perbaikan "makin lemot seiring data bertambah" + pembatalan perubahan v5.9 yang memperberat penutupan)
- Pengukuran dengan 600 tugas (CPU 4x): buka Task ±310 ms dan tutup ±460–650 ms (v5.8) vs buka ±165 ms dan tutup ±240 ms (v6.0). Dengan data kosong biayanya hanya ±50 ms — jadi kelambatan tumbuh mengikuti jumlah data, bukan kebocoran memori (diuji 4×48 siklus: node, listener, heap, animasi tidak bertambah).
- BARU (pages.css): kartu tugas di luar layar tidak lagi ikut dihitung layout/paint (content-visibility:auto pada .tk3-note, tinggi perkiraan 96px, overflow-clip-margin:32px agar ikon bulat di sudut kartu tidak terpotong).
- pages.js: markUnder() tidak memanggil getComputedStyle bila hanya ada satu lapisan (sebelumnya ±90 ms/siklus dengan 600 tugas karena memaksa layout seluruh daftar). nx-quiet tidak dinyalakan-lalu-dimatikan saat membuka menu.
- DIBATALKAN dari v5.9: penundaan pemanasan beranda (350→900 ms) dan penutup latar (360→450 ms). Di uji penutupan, itu memindahkan kerja ke saat menu ditutup (±62 → ±103 ms). app.js kembali sama persis dengan v5.8.
- Batasan: hanya daftar Task yang diberi content-visibility; menu lain dengan daftar panjang (Calendar, Finance, Goal, dll.) belum dioptimalkan karena belum ada data uji.

v5.9 (Buka-tutup menu berulang lebih ringan — hasil pengukuran, bukan tebakan)
- Diukur di Chromium (siklus buka→tutup 4 menu berulang, jejak performa): kerja thread utama per siklus turun dari ±230–260 ms menjadi ±175–190 ms (≈25–30%); hitung ulang gaya (style recalc) per siklus turun dari ±55–65 ms menjadi ±25 ms (≈55%). Uji tekan cepat (jeda 5 ms, 25 siklus × 11 menu): 0 menu macet/tersangkut, riwayat tetap 3, 0 galat JS.
- app.js: "pemanasan beranda" (win-warm) ditunda 350 → 900 ms. Saat menu dibuka-tutup cepat, beranda tidak lagi dihitung ulang tiap kali (sebelumnya jalan di tiap buka lalu dibatalkan saat tutup). Penutup latar (win-cover) 360 → 450 ms agar latar tidak dilukis lebih lama dari perlu.
- pages.js: markUnder() tidak lagi memanggil getComputedStyle bila hanya ada satu lapisan (sebelumnya memaksa hitung ulang gaya di setiap perubahan lapisan). Kelas nx-quiet tidak lagi dinyalakan lalu dimatikan 50 ms kemudian saat MEMBUKA menu (2 hitung ulang gaya akar sia-sia); tetap dipakai saat menutup.
- index.html & sw.js: versi ?v=59, cache beresin-v59. Berkas lain tidak disentuh.
- Catatan jujur: pengukuran memakai Chromium tanpa GPU nyata; angka di HP akan berbeda, tetapi arah penghematan sama. Pembukaan PERTAMA tiap menu masih paling berat (jendela dibangun sekali, ±50–100 ms di PC, lebih lama di HP); buka berikutnya memakai jendela yang sama.

v5.8 (Halaman Penuh — perbaikan navigasi, animasi, dan layout PC)
- DIHAPUS: animasi ikon menu saat MASUK/KELUAR menu. Penyebabnya: gerak klik ikon (ic-go/lvGo) yang tertahan lalu jalan lagi saat menu ditutup, ikon hidup (lv-on) yang mulai ulang karena beranda disembunyikan, dan transisi hover ikon yang dilepas. Blok "Gerak ikon menu 3D" di app.js dibuang, pengamat ikon hidup tidak lagi mengubah status saat menu terbuka, dan pages.js memasang kelas sementara nx-quiet (tanpa transisi) tepat setelah menu ditutup. Ikon tetap "melayang" halus seperti biasa.
- BARU: setiap menu = HALAMAN BARU PENUH, juga di PC/tablet (sebelumnya hanya HP). Menu Academic, Work, Organization, Project, Task, Calendar, Finance, Goal, Documents, Analytics, Settings, plus Inbox dan Scan: tanpa tepi gelap, sudut, bayangan kartu, atau jendela mengambang. Latar opak, masuk dengan geser-pudar singkat (opacity+transform), tutup bergeser keluar.
- BARU: tidak menumpuk. Bila ada halaman baru di atas halaman lain (mis. Scan di atas Inbox), lapisan di bawahnya disembunyikan (atribut data-pg-under, pages.js + pages.css). Lembar form (…-ov2) tetap muncul di atas halamannya.
- PERBAIKAN: tombol Kembali (HP) / gestur kembali kini menutup SATU lapisan saja. Sebelumnya, bila dua halaman terbuka, Escape menyebar ke semua modul sehingga keduanya tertutup sekaligus.
- PERBAIKAN: tombol + (Perintah Cepat) di tablet/PC dipindah ke pojok kanan-bawah. Di tengah-bawah ia menutupi kartu menu (Task, Calendar, Goal …) sehingga mengetuk kartu malah membuka Perintah Cepat. Di HP tetap di tengah.
- Cetak struk Finance (print) tidak terpengaruh: aturan halaman penuh hanya untuk layar (@media screen).
- Berkas berubah: pages.css, pages.js, app.js (blok ikon menu, pengamat ikon hidup, animasi tutup), index.html & sw.js (versi ?v=58, cache beresin-v58). Berkas lain tidak disentuh.

v5.7 (GABUNGAN v5.5 rekan + Perintah Cepat; lonceng dihapus; Mode Tampilan pindah ke Setting)
- DIHAPUS: tombol lonceng Notifikasi + panelnya (blok "A. Notifikasi sungguhan" di revisi5 dalam app.js, dan tombolnya di index.html) karena sudah digantikan Inbox. Mesin pengingat Kalender (toast + notifikasi browser sesuai pengaturan pengingat acara) TIDAK disentuh, jadi pengingat tetap berbunyi. Panel "Pengingat" milik HUD pencarian kini tanpa pemicu (kode dibiarkan, tidak aktif).
- DIPINDAH: ikon palet "Tema dan wallpaper" (panel Mode hemat) dihapus dari header. Mode hemat sekarang ada di Pengaturan → tab "Mode Tampilan" (pilihan Normal / Hemat, tersimpan di mo-lite, memakai MO.cosmos.setLite yang sama).
- BARU: Perintah Cepat dibuka lewat tombol plus biru di beranda (menggantikan lompat ke menu Task; di panel ada tautan "Buka form Tugas manual"). Tombol ⚡ di header, tombol melayang oranye, dan pintasan Ctrl+K milik Perintah Cepat dihapus (Ctrl+K tetap milik pencarian HUD).
  Ketik satu kalimat, aplikasi langsung bertindak:
  · JADWAL  "buat jadwal rapat BEM hari senin jam 14.00 di aula bersama Budi, ingatkan 30 menit sebelumnya" -> acara Kalender (tanggal, jam, lokasi, peserta, pengingat). Pratinjau bisa diedit; bila bentrok dengan kuliah (semua kampus) / acara Kalender / acara Task / ujian muncul peringatan + SARAN jam kosong yang bisa diketuk.
  · SELESAI "tugas makalah hukum acara sudah selesai" -> mencari di SEMUA modul (Task, tugas kuliah semua kampus, pekerjaan, tindak lanjut organisasi, proyek, milestone, goal) lalu mencentang seperti tombol Selesai di Inbox. Cocok jelas -> langsung dicentang (ada Urungkan); mirip beberapa -> pilih dulu.
  · TUGAS   "buat tugas laporan keuangan deadline besok jam 17.00 penting ingatkan 1 jam sebelumnya" -> to-do di Task (+ prioritas, tenggat, remindAt).
  · INGATKAN "ingatkan saya bayar UKT besok jam 8 pagi" · AGENDA "jadwal besok" / "cek jadwal hari senin".
  Bahasa dipahami: hari ini/besok/lusa, nama hari (+ "depan"), "minggu depan", "tanggal 20 november", 25/11, "N hari lagi", jam 14.00 / jam 2 siang / jam 9-11 / "selama 90 menit", "besok malam"; tombol mikrofon (Chrome Android).
- Aman untuk kerja bersama: file BARU quick.js + quick.css; data ditulis lewat objek hidup modul (record sama dengan hasil Scan), Riwayat Aktivitas ikut mencatat, semua aksi bisa Urungkan.
- Titik sambung / perubahan di file rekan: index.html (+quick.css/quick.js; tombol lonceng, tombol palet, dan panel Tampilan dibuang beserta skrip panelnya); sw.js (cache beresin-v55b, + 2 berkas); pages.js ('qc-ov','.qc-x'); app.js (blok notifikasi revisi5 dibuang, tab Pengaturan "Mode Tampilan" + ikon, teks petunjuk beranda).
- Batasan: pengingat berbunyi hanya saat aplikasi terbuka (sama seperti sebelumnya).

v5.5 (GABUNGAN v5.4 rekan + Scan & Isi Otomatis; tombol Insight melayang dihapus tuntas)
- BARU: tombol Scan (ikon bingkai-teks) di header, di samping Inbox. Sumber: Kamera (viewfinder dalam aplikasi; bila kamera diblokir/HTTP → kamera bawaan HP), Foto galeri, File (PDF, gambar, .txt/.csv/.md), atau tempel teks. Boleh beberapa berkas sekaligus.
  · Dibaca: foto → OCR Tesseract.js (bahasa Indonesia+Inggris; dimuat dari CDN jsdelivr saat pertama dipakai, jadi butuh internet SEKALI; foto diproses di perangkat). PDF bertext dibaca langsung (tanpa internet); halaman PDF hasil pindai otomatis di-OCR. Teks tempel/.txt langsung dianalisis.
  · Dikenali otomatis (aturan Indonesia): tanggal (17 Nov 2026, 17/11, 2026-11-17, besok, Senin), jam (09.00-11.00, pukul 9), nominal (Rp 2.500.000, 85rb, 2jt), lalu diklasifikasi → Task (tugas/tenggat/tagihan), Kalender (rapat/kuliah/ujian/acara + jam), Keuangan (pengeluaran/pemasukan + nominal). Struk belanja dikenali dan dicatat sebagai SATU pengeluaran sebesar total.
  · Layar periksa: tiap item bisa diubah jenis, judul, tanggal, jam, nominal, atau dibuang; item yang sudah ada (judul+tanggal sama) otomatis tidak dicentang. Teks hasil baca bisa diedit lalu "Analisis ulang". Tombol Urungkan menghapus semua yang barusan ditambahkan.
  · Keamanan data: ditulis LEWAT objek hidup modul (MO.apps['mo-task-v1'].D.task, MO.apps['mo-cal-v1'].D.ev, MO.fin.D.tx) lalu disimpan oleh modul itu sendiri (fallback Finance: localStorage dari objek hidup yang sama). Format item sama persis dengan input manual (Kalender: confirmed:true, id berawalan sc-). Inbox & Smart Planner dipicu menyegarkan diri.
  · File baru: scan.js, scan.css. Diubah (kecil): index.html (tombol #scanBtn + muat scan.*), pages.js (sc-ov masuk daftar LAYER + .sc-x tombol tutup → tombol Kembali HP menutup Scan), sw.js (cache beresin-v55, scan.* masuk CORE, cdn.jsdelivr.net boleh di-cache), semua ?v=54 → ?v=55. Merge 3 arah (dasar v5.1 → v5.4 rekan + perubahan saya): app.js, inbox.*, activity.js, study.*, campus.css milik rekan TIDAK diubah.
  · Penting: klik #scanBtn ditangani lewat window + capture + stopImmediatePropagation (pola yang sama dengan #inboxBtn). Tanpa ini, penangkap klik umum '.tools button' di app.js memunculkan dialog "Coming soon" dan beranda tetap terkunci (win-open) setelah Scan ditutup.
  · Header: di layar ≤430px tombol header sedikit dirapatkan (scan.css bagian bawah) agar muat 6 ikon.
- DIHAPUS TUNTAS: di v5.4 aturan CSS tombol ✦ sudah dibuang rekan tetapi kode pembuatnya masih ada di smart.js. Sekarang blok fab/tick/pengamat/interval di smart.js juga dibuang (diganti pendengar Esc kecil untuk lembar insight bila dibuka lewat API) dan sisa selektor .sm-fab di smart.css dibersihkan. Insight tetap lewat tab Insight di Inbox (milik rekan; tidak disentuh). API MO.smart (openInsight, forModule, dll.) tetap ada. Pengaturan lama S.cfg.fabY tidak terpakai lagi (aman dibiarkan).
- Riwayat Aktivitas (activity.js) otomatis ikut mencatat item hasil scan karena data disimpan lewat modul (sudah diuji).

v5.4 (GABUNGAN v5.3 rekan + Opsi Kampus di Academic)
- Basis = v5.3 rekan utuh (Inbox baru, Smart Planner/Insight, Riwayat Aktivitas, Fokus Belajar). Tombol ✦ Insight melayang sudah dihapus di versi rekan; tidak ditambah/diubah lagi di sini.
- BARU Opsi Kampus (opsional) di Academic: bilah "Kampus" di bawah header (chip kampus, ✎ ganti nama/hapus, + Kampus). Tanpa menambah kampus, perilaku sama seperti sebelumnya; data lama otomatis menjadi "Kampus utama".
- Tiap kampus TERPISAH: semester, mata kuliah, tugas, ujian, jam belajar & Fokus Belajar, RUMUS NILAI (skala & bobot), IP, IPK, serta analisis. Tidak ada angka yang digabung lintas kampus. Hapus kampus hanya menghapus datanya; Kampus utama tidak bisa dihapus.
- Analytics: tab Akademik, kartu IPK, dan insight IPK dihitung per kampus (insight IPK satu per kampus). Beban waktu/tenggat/ujian 7 hari tetap lintas kampus (soal jadwal, bukan nilai).
- Kalender, Inbox (Kotak masuk, Smart Planner, Insight), Riwayat Aktivitas membaca SEMUA kampus; mengetuk item dari Inbox/Riwayat otomatis membuka kampus pemilik item.
- Format simpanan 'mo-acad-v1' tidak berubah bagi pembaca lama: cfg/sem/course/task/exam/study berisi gabungan semua kampus (cfg = kampus utama). Tambahan: campuses[], campusSel, sem[].campusId.
- Untuk pengembang: kode Academic memakai D = data kampus terpilih (seperti dulu). Pembaca lintas modul pakai MO.acadData.D() (gabungan, record sama dengan aslinya, JANGAN push/hapus pada array-nya), MO.acadData.scoped() (kampus terpilih; untuk modul di dalam Academic seperti Fokus Belajar), MO.acadSlice(idKampus), MO.acadCampuses(), MO.acadData.focus(arr,id), MO.acadGo(tab, idKampus). Perubahan ditandai "v5.2"/"v5.4".
- File baru: campus.css. Diubah: app.js (blok Academic + analitik), inbox.js (1 hook), activity.js (1 hook), study.js (1 baris: data kampus terpilih), index.html, sw.js (cache beresin-v54).

v5.3 (GABUNGAN: Inbox model baru + Riwayat Aktivitas [rekan] + Fokus Belajar di Academic [baru])
- Basis = v5.2 rekan (Inbox baru, Smart Planner/Insight, activity.js). Ditambahkan: tab "Fokus Belajar" di Academic (study.js, study.css).
- Fokus Belajar: timer Pomodoro, durasi fokus bisa diatur (preset + 1–180 mnt), istirahat pendek/panjang, lanjut otomatis, mode fokus tunggal, target harian, bunyi & getar; statistik waktu produktif (bagan per hari, jam produktif, hari rajin, per mata kuliah + analisis otomatis); riwayat belajar per tanggal dengan filter, Edit/Hapus/Catat manual.
- Data disimpan ke D.study Academic ('mo-acad-v1') berbentuk lama {id, courseId, date, minutes, notes} + kolom opsional {topic, mode, start, end, plan, done}. Pengaturan & timer berjalan di 'mo-study-v1'. Karena itu Analitik, Smart Planner/Insight, Inbox, Cadangan data, dan Riwayat Aktivitas ikut membaca otomatis.
- Penyambungan dengan rekan: activity.js — tautan "Waktu belajar" kini membuka tab Fokus (tabs.study = 'fokus') dan label memuat topik. app.js — 3 sisipan kecil (TABS, PAGE, dispatcher MO.studyView). Tombol Insight melayang: sudah dihapus rekan (startWatch tidak dipanggil lagi), tidak diubah.
- index.html & sw.js: semua ?v=53, cache beresin-v53, memuat study.css/study.js. Muat ulang sekali agar versi baru aktif.

v5.2 (Inbox model baru + Riwayat Aktivitas + Insight hanya di Inbox)
- Tampilan Inbox dibuat ulang: header ikon 3D + judul besar + "N perlu tindakan", tab pil gradien (Inbox · Smart Planner · Insight · Riwayat Aktivitas), kategori berpil titik warna, kartu bulat bertag (Task/Proyek/Kalender/…), lencana tanggal ("Lewat 1 hr", "12 Nov 15:30") dan aksi ✓ · jam · >. Kelompok: Terlambat · Hari ini · Perlu tindak lanjut · Segera (tiap kelompok menampilkan 3 teratas + "Lihat semua"). Mode gelap ikut tema.
- Cari & menu (tandai semua dibaca, arsip) pindah ke ikon bulat di header. Geser kartu (kanan = selesai, kiri = jadwal ulang), tekan lama / Shift+klik = pilih beberapa tetap ada.
- Smart Planner: navigasi hari ‹ ›, bilah waktu (jadwal tetap / blok fokus / istirahat), 3 kartu angka (waktu luang, beban jatuh tempo, kandidat tugas), tombol "Terapkan ke Kalender", daftar jadwal, kartu "Tidak muat" dan "Pengaturan planner".
- Insight: kartu Beban hari ini vs waktu luang, Risiko tenggat, Pola produktivitas, Keseimbangan 7 hari, Rekomendasi (+ insight terperinci dengan tombol aksi di bawahnya). Semua aturan sederhana pada data lokal, tanpa AI/jaringan.
- Insight KHUSUS di Inbox: tombol ✦ melayang di setiap menu (Academic, Work, Organization, …) DIHAPUS.
- RIWAYAT AKTIVITAS (baru, activity.js): mencatat otomatis semua kegiatan lintas modul — dibuat, selesai, status berubah, dijadwalkan ulang, diganti nama, dibatalkan, dihapus — dikelompokkan per hari dengan garis waktu. Ketuk nama untuk membuka sumbernya. Filter Semua/Dibuat/Selesai/Diubah/Dihapus. Disimpan di 'mo-activity-v1' (maks. 500, ikut Cadangan data). Hanya mencatat sejak versi ini aktif.
- File baru: activity.js. Diubah: inbox.js, inbox.css, smart.js, smart.css, index.html, sw.js (cache beresin-v52). Muat ulang sekali agar versi baru aktif.

v5.1 (Mode Halaman + tanpa zoom saat scroll)
- Menu kini terasa seperti HALAMAN BARU, bukan jendela yang ditumpuk di atas beranda:
  · Latar menu opak (pemandangan/beranda tidak lagi tembus di balik scrim), di HP jendela memenuhi layar tanpa tepi/sudut kartu; di desktop tetap kartu di atas latar solid.
  · Masuk dengan geser-pudar ringan 0,22 dtk (opacity + transform, compositor); zoom/skala jendela lama (winIn) dimatikan untuk menu utama.
  · Tombol/gestur KEMBALI di HP menutup menu (bukan keluar aplikasi). Tiap lapisan = satu langkah riwayat: menu → form/detail ditutup berurutan. Esc di desktop dan tombol X tetap bekerja dan merapikan riwayat otomatis.
  · Posisi gulir beranda kembali persis seperti sebelum menu dibuka.
- Efek ikon menu yang "muncul ngezoom" saat pertama kali digulir ke arah mereka dihapus: ikon langsung tampil normal (animasi lvIn + opacity 0 awal dinonaktifkan). Gerak ikon saat DIKETUK tetap ada.
- File baru: pages.css, pages.js (lapisan tambahan; kode lama tidak diubah). Diubah: index.html (muat pages.*), sw.js (cache beresin-v51). Muat ulang sekali agar versi baru aktif.
- Diuji (Chromium, emulasi HP & desktop): 11 menu terbuka opak, Back menutup & scroll beranda kembali, menu→form dan Work→kartu menutup bertahap, 5x buka-tutup cepat tanpa riwayat menumpuk, 0 galat JS.

v5.0 (fitur baru: Smart Planner + Smart Insight di dalam Inbox)
- Inbox kini punya 3 tampilan: Kotak masuk · Planner · Insight (angka di tab = sesi tersisa hari ini / jumlah hal yang perlu perhatian).
- SMART PLANNER: menyusun blok waktu 5–14 hari (bawaan 7) dari semua modul.
  Jadwal TETAP (tidak digeser): jam kuliah (dibaca dari kolom Jadwal mata kuliah, mis. "Senin & Rabu 09:00-12:00"), ujian/presentasi, rapat Organization (hanya tanggal → diasumsikan 19:30, bisa diatur jamnya), acara Kalender berjam, acara Task berjam.
  Pekerjaan FLEKSIBEL: tugas kuliah, pekerjaan & tugas kerja, to-do Task, tindak lanjut organisasi, tugas proyek, dan persiapan ujian.
  Aturan: tidak menabrak jadwal tetap (ada jeda), sisakan makan siang & Maghrib/makan malam, batas fokus per hari (hari kuliah padat = kapasitas berkurang), kerja berat di jam fokus pilihanmu, maksimal ±90 mnt per sesi dan tidak beruntun tanpa jeda, tugas kuliah didahulukan dari organisasi, yang lewat tenggat dikerjakan paling awal.
  Ujian: waktu belajar menurut tingkat kesulitan (Mudah 1,5 j · Sedang 3 j · Sulit 5 j; bisa diubah per ujian, dikurangi jam belajar tercatat 7 hari terakhir), makin dekat ujian makin banyak, sesi dimulai H-3/H-5/H-7, dan untuk ujian pagi ada review singkat subuh yang selesai ≥30 mnt sebelum berangkat. Sesi < 30 mnt tidak dibuat.
  Ketuk sesi → ubah estimasi (±15 mnt), ubah tingkat kesulitan, lewati, atau buka sumber. Ikon roda gigi → jam bangun/tidur, jam fokus, kapasitas, rentang hari, jeda, waktu makan.
  "Terapkan ke Kalender" memasukkan sesi sebagai acara Kalender (bisa Urungkan / Hapus / Perbarui). Acara planner tidak dianggap jadwal tetap dan tidak muncul di Inbox sebagai "belum dikonfirmasi".
- SMART INSIGHT: analisis lintas modul (tab Insight) dan per menu (tombol ✦ melayang di Academic, Work, Organization, Project, Task, Kalender, Goal, Finance, Document, Analytics, Settings; bisa digeser naik/turun).
  Isi: kesiapan ujian, tabrakan jadwal, tugas tidak muat/lewat tenggat, beban hari, jendela luang terbaik, batch pekerjaan kecil, tagihan, tindak lanjut, proyek berisiko, goal, keuangan (proyeksi, anggaran, saldo minus).
  Saran tunda/izin rapat memakai simulasi: planner dijalankan ulang tanpa rapat itu lalu dibandingkan (waktu inti yang terselamatkan + kualitas jam belajar), disertai usulan hari alternatif.
  Kelancaran & kecepatan aplikasi: pantau ukuran penyimpanan (peringatan ≥50% kuota), gambar besar yang memberatkan, tugas selesai menumpuk.
- Keamanan data: hanya MEMBACA data modul. Menulis hanya acara Kalender buatan planner (ditandai sp:1) dan pengaturan sendiri di 'mo-smart-v1' (ikut Cadangan data). Cadangkan data sebelum memperbarui seperti biasa.
- Ringan: tanpa pengamat DOM berat; perhitungan hanya saat dibuka (beberapa milidetik); animasi hanya transform/opacity.
- Agar akurat: isi kolom Jadwal setiap mata kuliah, jam ujian, dan tanggal tenggat. Smart Insight akan memberi tahu bila ada yang kurang.
- File baru: smart.js, smart.css. Diubah: inbox.js (tab mode), index.html (muat smart), sw.js (cache beresin-v50). Muat ulang sekali agar versi baru aktif.

v4.9 (fitur baru: Inbox Terpadu)
- Tombol Inbox (ikon 3D) di header, tepat di samping lonceng Notifikasi. Angka merah = jumlah item belum dibaca.
- Inbox menampung semua yang perlu ditindaklanjuti dari seluruh modul, dikelompokkan: Lewat tenggat · Hari ini · Perlu tindak lanjut · 7 hari ke depan. Tab: Semua, Tugas, Pekerjaan, Tagihan, Proyek, Agenda.
  Sumber: Task, Kalender, Academic (tugas kuliah, ujian), Work (pekerjaan, tugas kerja, tagihan: "Perlu ditagih" & "Menunggu pembayaran"), Organization (tindak lanjut), Project (proyek, tugas, milestone), Goal.
  Agenda 3 hari ke depan yang belum dikonfirmasi tampil sampai ditekan "Konfirmasi".
- Tampilan ala Gmail: baris tebal = belum dibaca, bintang, pencarian, pilih beberapa (ketuk ikon bulat / tekan lama), mode gelap mengikuti tema.
- Aksi per item: ketuk baris = langsung membuka modul sumbernya (Academic langsung ke tab Tugas/Ujian) · geser kanan = Selesai · geser kiri = Jadwalkan ulang · Arsipkan · Urungkan (6 detik). Di desktop ikon aksi muncul saat kursor di atas baris.
  Jadwalkan ulang mengubah tanggal di modul sumbernya (jam dipertahankan); item tanpa tanggal (tagihan) ditunda di Inbox saja.
- Status baca/bintang/arsip/tunda disimpan terpisah di 'mo-inbox-v1' (ikut Cadangan data). Arsip muncul lagi otomatis bila tanggal sumbernya berubah.
- Keamanan data: Inbox tidak menulis langsung ke localStorage. Perubahan dilakukan lewat objek data hidup tiap modul (app.js: MO.apps, MO.acadData) lalu disimpan oleh modul itu sendiri, sehingga tidak ada data yang tertimpa saat modul menyimpan ulang.
- Buka/tutup mulus: kelas ib-ov didaftarkan ke kunci scroll, pembeku animasi beranda, dan fade-tutup yang sama dengan menu lain (app.js: LAYER, COVER, OV). Lompat ke modul memakai __bsJump seperti Status Kegiatan.
- File baru: inbox.js, inbox.css. Diubah: index.html (tombol, ikon, tautan), app.js (3 regex + 2 titik sambung kecil), sw.js (cache beresin-v49). Muat ulang sekali agar versi baru aktif.

v4.8 (perbaikan lanjutan dari hasil uji di Chromium)
- Settings → Status Kegiatan: sebelumnya HANYA teks judul (tombol kecil, mis. 46×17 px di baris 360×69 px) yang bisa diketuk; mengetuk badge, baris status, atau area kosong baris tidak melakukan apa-apa, sehingga terasa "kadang lancar kadang macet". Kini seluruh baris adalah area ketuk (min-height 56px, kursor pointer); tombol judul tetap ada untuk keyboard.
- Academic → dashboard Semua/Aktif/Selesai: kartu yang baru masuk menampilkan tile logo kosong sesaat lalu gambarnya muncul (terukur: img belum siap pada frame pertama). Kini objek Image hasil decode disimpan (sebelumnya langsung dibuang), semua logo dipanaskan saat Academic dibuka dan saat pindah filter, dan <img> memakai decoding="sync". Pada pengujian ulang tidak ada lagi frame dengan gambar belum siap.
- Cache: ?v=48 dan sw.js V = beresin-v48 (muat ulang sekali agar versi baru aktif).

v4.7 (perbaikan delay/berat, lanjutan v4.6)
- Settings → Status Kegiatan → klik item: penyebab delay = pembacaan layout paksa bertumpuk (getComputedStyle di anyLayer & scan wx, place() dipicu aria-selected overlay tersembunyi, getter scrollTop) + fade penutupan Settings. Kini: window.__bsJump() (turbo) dipanggil sebelum Settings ditutup (tanpa fade, tanpa reflow paksa); anyLayer/wx hanya memakai atribut hidden; place() digabung satu rAF dan dilewati bila overlay tersembunyi.
- Status Kegiatan: daftar dirender 40 item dulu + tombol "Tampilkan lebih banyak" (sebelumnya ratusan item / ±2000 node DOM sekaligus).
- Task: animasi goyang tak-berhenti (tk3Sway) kini hanya 4 kartu pertama (sebelumnya 100 elemen → ±31 fps di HP lambat, kini ±61 fps).
- Academic → dashboard: pindah Semua/Aktif/Selesai hanya memperbarui pill, teks jumlah, dan daftar kartu (tidak merender ulang seluruh dashboard). Logo mata kuliah dikonversi sekali ke blob URL (cache) tanpa loading=lazy sehingga tidak muncul belakangan; rail kembali ke kartu pertama.
- Ketahanan data: App() dan Academic menggabungkan nilai awal ke data lama/hasil restore (sebelumnya modul bisa crash "forEach of undefined" bila ada kunci data yang hilang).
- Diukur (Chromium, CPU 4x, 381 item): median frame pertama klik item Status Kegiatan ±350 ms → ±150 ms; kerja main-thread Task 1346 → 820 ms.

v4.6 (perbaikan delay/berat)
- Work Office → klik proyek: animasi masuk "dunia" memakai clip-path + skala yang memaksa gambar ulang seluruh halaman tiap frame, ditambah hitung-naik angka yang mengubah teks tiap frame (layout ulang tiap frame). Kini hanya fade 0,14 dtk (opacity), dan angka di detail pekerjaan langsung tampil final. Beban render turun ±85% pada pengukuran CPU 6x lebih lambat.
- Work Office: gambar sampul disimpan sebagai data-URL (ratusan KB) dan ikut di-escape/di-parse/dibandingkan di setiap render. Kini dikonversi sekali ke blob URL (cache) sehingga HTML kecil.
- Work Office: kartu carousel tidak lagi "meluncur" dari posisi awal saat carousel dibuat ulang (kembali dari detail); redup kartu memakai lapisan opacity, bukan filter brightness yang menggambar ulang gambar.
- Settings → Status Kegiatan: klik item kini menutup Pengaturan lebih dulu lalu membuka modul tujuan. Sebelumnya Pengaturan (310 item) tetap hidup di belakang, lalu disimpan dan dirender ulang penuh setelah modul tujuan terbuka. Daftar status memakai content-visibility, dan hitung-naik angka dilewati saat lompat antar-menu.
- Semua menu: fokus tombol tutup ditunda satu frame agar klik buka menu tidak memaksa layout sinkron.
- App kit: act() boleh mengembalikan MO.kit.SKIP untuk membatalkan simpan + render ulang otomatis.

v4.5

v4.5
- Penyebab glitch/"efek refresh" saat klik tombol di dalam menu ditemukan dan diperbaiki: Work Office, Organization, dan Finance membangun ulang SELURUH bingkai (header, logo, deretan tab) di setiap klik. Akibatnya deretan tab kembali ke posisi awal (tab yang baru diketuk melompat keluar layar), logo/ikon dibuat ulang lalu "muncul belakangan", kolom cari kehilangan fokus tiap ketikan, dan animasi tekan→pegas tombol terputus.
- perf3.js (baru): window.__morph(el, html) menggantikan el.innerHTML = html dan hanya mengubah bagian yang berbeda. Dipakai di Work, Organization, Finance, Academic (isi + panel kanan), dan kerangka generik (Project, Task, Calendar, Goal, Documents, Analytics, Settings). Elemen yang tidak berubah tetap objek yang sama; ikon/logo 3D yang dikelola skrip lain dibiarkan.
- Tab aktif otomatis digeser agar terlihat penuh bila berada di tepi deretan tab.
- Pengukuran sentuh: cache ukuran sebelumnya per elemen (selalu meleset karena elemen dibuat ulang tiap render) → kini per kelas elemen; tidak ada lagi pembacaan layout di setiap sentuhan. Jalur keyboard tidak lagi memanggil ripple.
- Pendengar carousel (Work) dan hero (Organization) dipasang sekali saja (elemen kini bertahan antar render).
- Diuji (Chromium, CPU diperlambat 4x): 0 galat JS di 11 menu; 263 dari 265 render identik dengan cara lama (2 sisanya hanya render pertama sebelum logo didekorasi); jumlah layout turun 30–60% di Organization, Project, Task, Calendar, Goal, Documents, Settings.

v4.4
- Interaksi di dalam menu: transisi warna/latar/garis/bayangan tombol dan tab dimatikan (hanya transform & opacity yang dianimasikan). Sebelumnya warna teks bertransisi 200 ms sementara latar gradient langsung berganti sehingga label tab lama putih-di-atas-putih (hilang) dan label tab baru gelap-di-atas-gradient = glitch.
- Efek riak (bercak lingkaran di atas label) dimatikan; umpan balik sentuh = tekan lalu pegas (compositor).
- Pointerdown tidak lagi membaca layout (getBoundingClientRect/getComputedStyle) di setiap sentuhan; ukuran yang di-cache dipakai ulang.
- render() tidak lagi men-set scrollTop bila sudah di atas (menghindari layout sinkron).


v4.3
- Menutup menu tanpa jeda: jendela langsung memudar 100 ms lewat Web Animations (opacity, compositor) tanpa menunggu frame; tidak ada lagi tahap tunggu 2 frame.
- Beranda digambar lebih dulu di balik menu opaque (±0,35 dtk setelah menu terbuka, saat menganggur) sehingga saat menutup tinggal memudarkan jendela. Diuji: tidak ada piksel beranda yang tembus di 11 menu.
- Status beku animasi beranda dilepas ±0,16 dtk SETELAH jendela hilang, bukan di frame penutupan.


v4.2
- Perbaikan glitch saat menutup menu: beranda dipulihkan lebih dulu di balik jendela yang masih utuh, lalu jendela memudar hanya dengan opacity 0,14 dtk (tanpa skala) — sama ringannya dengan saat membuka. Memudar tidak lagi dipotong kerja berat di frame pertama.
- Pemanasan beranda: ±0,7 dtk setelah menu terbuka dan browser menganggur, layout beranda dihitung diam-diam (tetap tersembunyi dan beku) sehingga menutup menu murah.


v4.1
- Menutup menu memudar halus 170 ms (opacity+transform, ditangani compositor) sementara beranda langsung dipulihkan; berlaku untuk semua menu (Finance, Work, Organization, Academic, Document, Task, Calendar, Goal, Analytics, Settings, Project). Buka ulang di tengah pudar membatalkan pudar. Mode "kurangi gerakan" tetap langsung menutup.
- Tombol tutup merespons sentuhan seketika (tanpa highlight, skala saat ditekan).


v3.9
- Project Management: warna detail proyek diperbaiki (aturan CSS banner salah mengenai pembungkus isi, teks jadi putih di latar putih). Tab jadi satu baris geser, kartu angka 2 kolom, profil ringkas, teks ganda dibersihkan.
- Buka/tutup menu lebih cepat: beranda memakai content-visibility saat menu terbuka; pembacaan ukuran yang memaksa hitung ulang tata letak dibuang dari klik/launch/enter.


v3.8
- Logo/ikon di dalam jendela menu (Task, Calendar, Finance, dst.) kini bergerak mulus: tidak lagi dimatikan ±1,7 dtk lalu menyala mendadak, dan tidak lagi dibekukan selama menu terbuka. Saat menu muncul, logo masuk dengan gerak pegas (membesar halus lalu mantap). Perubahan ada di blok paling bawah app.css ("v3.8") dan dua aturan lama yang dipersempit.
- Bisa diakses online lewat hosting HTTPS lalu dipasang sebagai aplikasi (PWA). Baca PANDUAN_ONLINE.md.
- online.js: pendaftaran service worker, tanda offline/online, tawaran "Pasang aplikasi", pemberitahuan "Versi baru tersedia", minta penyimpanan permanen.
- sw.js: halaman dibuka dari cache bila jaringan lambat >3,5 dtk (tidak menggantung); versi baru menunggu tombol "Muat ulang".
- manifest: ikon maskable terpisah, orientasi bebas (tablet landscape), id/lang/kategori.
- Perbaikan: atribut onload tautan font Inter & Chakra Petch rusak (tanda \' ) sehingga font itu tidak pernah aktif.

v3.7: beranda dibekukan saat menu terbuka, animasi masuk isi dimatikan, fade 0,14 dtk.
