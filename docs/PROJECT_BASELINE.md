# VAULT CORE — Project Baseline & Change Control

> Dokumen pengendali. Baca sebelum mengubah kode, desain, database, konfigurasi deployment, atau transaksi.
> Prinsip: perbaiki satu bagian, lindungi seluruh bagian lain.

## 1. Aturan utama

1. Pertahankan semua implementasi `LOCKED`; ubah hanya dengan instruksi eksplisit pemilik.
2. Kerjakan ruang lingkup yang diminta dan bug terkait saja.
3. Audit dokumentasi, repository, API, database, dependensi, dan deployment sebelum coding.
4. Utamakan perubahan lokal/minimal. Hindari refactor global.
5. Data produk, harga, stok, spesifikasi, dan status harus bersumber dari backend/database.
6. Gunakan repository, branch, Worker, database, bot, dan domain yang sudah ada. Jangan membuat infrastruktur baru.
7. Nyatakan PASS/FAIL/NOT TESTED/BLOCKED berdasarkan bukti.
8. Deployment bukan bukti tampilan/perilaku benar; verifikasi produksi juga.
9. Periksa diff, simpan commit dan rollback point, lalu regression test sebelum rilis.

## 2. Identitas proyek

| Item | Nilai |
|---|---|
| Repository | `aryaandrayugabali01-hue/vault-core-app-` |
| Branch utama | `main` |
| Website | https://vaultcore.biz.id |
| API | https://api.vaultcore.biz.id |
| Workers | `vault-core-web`, `vault-core-api`, `vault-core-gateway` |
| Database | Neon PostgreSQL, `vault_core` |
| Stack | Next.js/Vinext, Node.js/Express, Cloudflare Workers, Neon, Telegram Mini App |
| Pembayaran | Telegram Stars (XTR) saja |

Checkout, invoice, dan pembayaran tetap melalui VAULT CORE Telegram Mini App. Website publik menampilkan katalog dan detail produk.

## 3. Register LOCKED / CHANGE

| Area | Status | Aturan |
|---|---|---|
| Dashboard / halaman utama | LOCKED | Pertahankan desain dan perilaku yang telah disetujui. |
| Halaman Semua Game | LOCKED | Jangan mengubah struktur visual/navigasi yang disetujui. |
| Kategori MLBB dan subkategori Akun | LOCKED | Pertahankan baseline visual yang disetujui. |
| Urutan lima filter MLBB | LOCKED | Win Rate, Jumlah Skin, Jumlah Hero, Rank Saat Ini, Akun Terhubung Pada. |
| Harga produk yang ditetapkan | LOCKED | Jangan mengubah nilai harga melalui pekerjaan UI. |
| Checkout dan pembayaran XTR | LOCKED | Jangan mengubah invoice, validasi harga/stok, atau konfirmasi pembayaran di luar instruksi eksplisit. |
| Detail produk MLBB | APPROVED / LOCKED (25 Nov 2026) | Ikuti referensi tiga tampilan terbaru: detail produk penuh, modal Anti-Hackback, modal Cara Beli & Tips. |
| Detail produk game lain | CHANGE | Terapkan struktur konsisten dengan data produk dan kebijakan SKU yang tersedia. |
| Modal Garansi dan Panduan | APPROVED / LOCKED (25 Nov 2026) | Dua modal terpisah, mobile-first, overlay gelap, scroll internal, close X, body scroll lock. |
| API katalog | CHANGE terbatas | Perubahan hanya untuk data yang diperlukan detail produk; pertahankan kontrak transaksi. |
| Rating/ulasan | NOT AVAILABLE | Jangan menampilkan angka rating/ulasan rekaan; belum ada sumber data rating. |
| Toko | SINGLE-VENDOR | Penjual yang ditampilkan kepada pembeli adalah VAULT CORE; urusan mitra tetap internal. |

### Referensi visual detail produk

Referensi terbaru yang diberikan pada 25 November 2026 terdiri dari tiga tampilan:
1. Detail Produk: galeri, nama, rating/ulasan, keamanan, garansi, harga XTR, ringkasan pengiriman/penjualan, Cara Beli & Tips, deskripsi, atribut akun, dan sticky purchase bar.
2. Modal Anti-Hackback: cakupan dan ketentuan garansi yang tercatat untuk SKU.
3. Modal Cara Beli & Tips: langkah pembelian, penyerahan informasi oleh VAULT CORE, dan tips keamanan akun.

Referensi terbaru ini menetapkan acuan detail produk MLBB dan menggantikan status penolakan screenshot detail yang lebih lama. Referensi dashboard, Semua Game, dan katalog MLBB tetap LOCKED.

## 4. Aturan data dan copywriting

- Nama, harga XTR, galeri, deskripsi, atribut, stok, dan ketentuan produk diambil dari API/backend.
- Jumlah terjual hanya dihitung dari item pesanan berstatus FULFILLED.
- Rata-rata pengiriman hanya dihitung dari pesanan FULFILLED yang memiliki paid_at dan fulfilled_at.
- Jika tidak ada data, tampilkan “Belum tersedia”; jangan mengarang angka.
- Rating dan jumlah ulasan belum memiliki sumber backend/database.
- Informasi akun/data akun diberikan oleh VAULT CORE kepada pembeli. Pembeli berurusan dengan VAULT CORE; jangan membebankan urusan internal mitra kepada pembeli.
- Ketentuan garansi harus berasal dari data resmi SKU. Jangan menggeneralisasi garansi satu SKU ke semua SKU.
- Untuk SKU tanpa ketentuan Anti-Hackback tercatat, tampilkan status belum tersedia.
- Panduan pembelian diambil dari purchase_guide kategori backend. Jangan mengubah aturan transaksi atau instruksi login yang sudah tercatat tanpa persetujuan.
- Jangan menambahkan IDR atau metode pembayaran selain Telegram Stars (XTR).

## 5. Prosedur perubahan

### Sebelum coding
1. Baca baseline dan instruksi terbaru.
2. Periksa branch/commit dan perubahan lokal.
3. Telusuri halaman, komponen, CSS, API, query, schema/migration, dan workflow terkait.
4. Catat LOCKED, CHANGE, bug, dan file yang perlu diubah.

### Saat coding
1. Ubah hanya file/jalur yang diperlukan.
2. Gunakan CSS scoped/local untuk halaman yang dikerjakan.
3. Pertahankan API dan database kompatibel.
4. Jangan membuat fitur, produk, atau data statis di frontend di luar ruang lingkup.

### Setelah coding
1. Periksa diff dan file yang berubah.
2. Jalankan lint/type-check/build/test yang tersedia.
3. Jalankan regression test pada bagian terkait dan area LOCKED yang berpotensi terdampak.
4. Bandingkan hasil pada viewport yang sama dengan referensi.
5. Deploy setelah gerbang tes lulus, lalu verifikasi domain dan perilaku produksi.

## 6. Regression test minimum

| ID | Area | Kriteria |
|---|---|---|
| CAT-01 | Semua Game | Tidak berubah dari baseline terkunci. |
| CAT-02 | Kategori dan navigasi | Tab dan navigasi tetap benar. |
| CAT-03 | MLBB/Akun | Tetap sesuai baseline terkunci. |
| CAT-04 | Lima filter MLBB | Urutan dan fungsi tidak berubah. |
| CAT-05 | Kartu produk | Nama, gambar, harga, stok berasal dari backend. |
| CAT-06 | Detail produk | Struktur dan urutan sesuai referensi terbaru. |
| CAT-07 | Galeri | Gambar utama dan thumbnail bekerja. |
| CAT-08 | Spesifikasi | Semua atribut customer-visible berasal dari backend. |
| CAT-09 | Anti-Hackback | Ketentuan sesuai SKU; SKU tanpa ketentuan ditandai belum tersedia. |
| CAT-10 | Cara Beli & Tips | Data panduan kategori ditampilkan dan VAULT CORE menjadi pihak yang berhubungan dengan pembeli. |
| CAT-11 | Modal | Dua modal terpisah, X berfungsi, scroll internal, body belakang terkunci. |
| CAT-12 | Sticky purchase bar | Harga/subtotal XTR benar; aksi hanya menuju alur Mini App. |
| CAT-13 | Statistik | Sold count dan waktu pengiriman berasal dari order FULFILLED. |
| CAT-14 | Checkout | Validasi harga/stok dan invoice XTR tidak berubah. |
| CAT-15 | Mobile | Tidak ada overflow/clipping pada Android. |
| CAT-16 | Build/test | Semua pemeriksaan CI yang relevan lulus. |
| CAT-17 | Produksi | Website, API, aset, gateway, dan webhook terverifikasi. |

Status pengujian hanya boleh PASS jika bukti tersedia. Pengujian yang belum dilakukan tetap NOT TESTED.

## 7. Rilis dan rollback

Rilis hanya setelah ruang lingkup terpenuhi, area LOCKED aman, test/build lulus, diff diperiksa, commit dan rollback point tercatat, serta deployment dan verifikasi produksi selesai. Jika terjadi regresi pada dashboard, katalog, harga, stok, checkout, atau XTR, hentikan rilis dan evaluasi rollback berdasarkan diff/riwayat commit.

## 8. Change log

| Tanggal | Commit | Ruang lingkup | File | Pengujian / deployment |
|---|---|---|---|---|
| 2026-11-25 | `a4fa611b8b7e4e2b8302eafd91b2ab93a766f1ef` | Halaman detail produk mobile-first, modal Anti-Hackback dan Cara Beli & Tips, statistik penjualan/pengiriman dari pesanan selesai | `frontend/src/app/catalog/page.jsx`, `frontend/src/app/globals.css`, `backend/routes/catalog.js`, `tests/core.test.js` | 50 test backend/core PASS; build Mini App PASS; API Worker dry-run PASS; production workflow SUCCESS. |
| 2026-11-25 | `a4fa611b8b7e4e2b8302eafd91b2ab93a766f1ef` | Baseline awal dan change control | `docs/PROJECT_BASELINE.md` | Dibuat setelah implementasi detail terbaru; verifikasi browser langsung masih perlu dilakukan. |

## 9. Status audit data produksi (25 Nov 2026)

- Produk aktif yang diperiksa: 7 SKU.
- SKU MLBB `ML-001` memuat ketentuan Anti-Hackback 14 hari kalender, klaim melalui dukungan resmi dengan nomor pesanan/kronologi/bukti, refund 100% untuk klaim valid, dan pemrosesan maksimal 48 jam sejak bukti lengkap diterima.
- SKU aktif lainnya memiliki ketentuan masing-masing; jangan menampilkan garansi Anti-Hackback ML-001 seolah berlaku untuk semua SKU.
- Tabel klaim garansi ada di database, tetapi endpoint klaim belum terpasang pada API aplikasi saat audit.
- Rating/ulasan belum tersedia di model/data backend yang diperiksa.
- Model toko adalah single-vendor; tampilkan VAULT CORE.
- Lima order yang tercatat pada saat audit tidak menghasilkan penjualan FULFILLED; statistik terjual harus mengikuti data aktual.

## 10. Sisa verifikasi

- [ ] Pemeriksaan visual langsung pada perangkat Android/viewport produksi dengan tiga referensi.
- [ ] Uji interaksi klik thumbnail, expand atribut, modal X, scroll lock, dan sticky bar pada browser nyata.
- [ ] Evaluasi endpoint klaim garansi sebagai pekerjaan backend terpisah; jangan menampilkan alur submit klaim aktif sebelum tersedia.
- [ ] Tambahkan model rating/ulasan hanya melalui instruksi dan desain backend yang disetujui.
