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
| Tagline resmi | **Lebih Yakin Bersama Vault Core** |

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
| API katalog customer | LOCKED — satu sumber data publik | Data produk yang dijual hanya dibaca melalui GET /api/catalog. DTO publik hanya memuat field yang dibutuhkan katalog/detail. |
| API Owner/Admin produk | LOCKED — privat | /api/admin/products hanya untuk pengelolaan Owner dan tetap dilindungi requireOwnerSession + requireOwner. |
| Rating/ulasan | NOT AVAILABLE | Jangan menampilkan angka rating/ulasan rekaan; belum ada sumber data rating. |
| Toko | SINGLE-VENDOR | Penjual yang ditampilkan kepada pembeli adalah VAULT CORE; urusan mitra tetap internal. |

### Referensi visual detail produk

Referensi terbaru yang diberikan pada 25 November 2026 terdiri dari tiga tampilan:
1. Detail Produk: header VAULT CORE, galeri/thumbnail, nama, indikator stok, rating/ulasan (belum tersedia sampai ada sumber data), keamanan, garansi, harga XTR, Cara Beli & Tips, deskripsi, spesifikasi akun, dan sticky purchase bar.
2. Modal Anti-Hackback: cakupan dan ketentuan garansi yang tercatat untuk SKU.
3. Modal Cara Beli & Tips: langkah pembelian, penyerahan informasi oleh VAULT CORE, dan tips keamanan akun.

### Keputusan path dan data produk (LOCKED, 25 Nov 2026)

- URL katalog khusus MLBB Akun: `/catalog/mlbb-akun`. Halaman ini terkunci ke game MLBB dan subkategori slug `mlbb-akun`; Reset Filter tidak boleh mengembalikan halaman ini ke Semua Game.
- Endpoint publik tunggal daftar produk jual: `GET /api/catalog`. Respons mempertahankan bentuk `{ products, categories }`.
- Halaman utama dan seluruh katalog customer membaca data jual melalui `/api/catalog`; detail produk menggunakan objek produk dari respons yang sama. Tidak diperlukan endpoint publik detail produk terpisah.
- `GET /api/admin/products` tetap merupakan jalur privat Owner untuk manajemen katalog, bukan sumber data halaman penjualan customer.
- DTO publik hanya menyertakan ID, nama, game, kategori Akun, deskripsi, harga XTR, galeri, atribut customer-visible, ketentuan, panduan, status pembelian, dan nilai stok yang memang boleh ditampilkan. Metadata pemeriksaan hak hanya digunakan internal di query backend.
- SKU internal, status database mentah, metadata pemeriksaan hak, stok aktual mentah, harga modal, jumlah terjual, dan rata-rata pengiriman tidak dikirim ke DTO publik.
- Detail tidak memiliki panel status pengiriman, jumlah terjual, rata-rata pengiriman, minimum pembelian, catatan penyerahan manual, kontrol kuantitas, informasi toko, atau rekomendasi produk.
- Pembelian dari detail dilakukan satu akun per aksi. Indikator stok menggunakan `display_stock`: angka 1 ditampilkan sebagai `STOK TERAKHIR`; mode penyembunyian angka tetap hanya menampilkan `STOK TERSEDIA`. Checkout tetap memvalidasi stok aktual di server.

Referensi terbaru ini menetapkan acuan detail produk MLBB dan menggantikan status penolakan screenshot detail yang lebih lama. Referensi dashboard, Semua Game, dan katalog MLBB tetap LOCKED.

## 4. Aturan data dan copywriting

- Nama, harga XTR, galeri, deskripsi, atribut, stok, dan ketentuan produk diambil dari API/backend.
- Stok customer diambil dari nilai `display_stock` yang dihitung backend sesuai mode tampilan produk; angka stok aktual tidak dikirim secara mentah.
- Checkout tetap memvalidasi stok aktual dan reservasi di backend.
- Statistik penjualan/pengiriman tidak ditampilkan pada halaman detail customer.
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

### Sistem desain global (LOCKED, 25 November 2026)

Seluruh halaman menggunakan satu sistem desain bersama. Aturan visual berlaku global; struktur, urutan elemen, data, dan alur pada area LOCKED tetap dipertahankan.

- **Font utama:** Plus Jakarta Sans, bobot 400–900. Font dimuat satu kali dari root layout dan diwariskan ke seluruh teks, tombol, input, select, dan textarea. Fallback sistem hanya berlaku saat font eksternal tidak dapat dimuat.
- **CTA utama tunggal:** emas `#FFC928` dengan teks gelap `#111827`. Hover `#FFDF36`, pressed `#E7B516`. Semua aksi utama pembelian, checkout, konfirmasi, beranda, dan Owner memakai satu token ini. CTA utama tidak boleh hijau atau ungu.
- **Aksi sekunder:** permukaan navy/transparent, border netral, teks terang. Tidak memakai fill warna CTA utama.
- **Warna semantik:** hijau `#00D68A` hanya untuk sukses/tersedia/terpenuhi; merah untuk error/stok habis; biru untuk informasi dan modal panduan/kebijakan; emas untuk brand, aksi utama, harga, dan state terpilih.
- **Permukaan:** keluarga charcoal/black/navy. Latar gambar per game/halaman tetap dipertahankan; geometri visual baseline yang telah disetujui tidak diubah.
- **Kontrol:** radius CTA 11px, shadow CTA bersama, focus ring emas, dan state disabled netral. Ukuran CTA boleh mengikuti kebutuhan komponen mobile yang telah disetujui.
- **Sumber token:** warna, tipografi, radius, shadow, dan motion global berada di `frontend/src/app/globals.css`. Komponen menggunakan token, bukan warna CTA literal baru.

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
| CAT-03 | MLBB/Akun | Route /catalog/mlbb-akun tetap terkunci ke MLBB/Akun. |
| CAT-04 | Lima filter MLBB | Urutan dan fungsi tidak berubah. |
| CAT-05 | Kartu produk | Nama, gambar, harga, stok berasal dari backend. |
| CAT-06 | Detail produk | Struktur dan urutan sesuai referensi terbaru; elemen yang ditetapkan untuk dihapus tetap tidak tampil. |
| CAT-07 | Galeri | Gambar utama dan thumbnail bekerja. |
| CAT-08 | Spesifikasi | Semua atribut customer-visible berasal dari backend. |
| CAT-09 | Anti-Hackback | Ketentuan sesuai SKU; SKU tanpa ketentuan ditandai belum tersedia. |
| CAT-10 | Cara Beli & Tips | Data panduan kategori ditampilkan dan VAULT CORE menjadi pihak yang berhubungan dengan pembeli. |
| CAT-11 | Modal | Dua modal terpisah, X berfungsi, scroll internal, body belakang terkunci. |
| CAT-12 | Sticky purchase bar | Harga satu akun XTR benar; aksi hanya menuju alur Mini App. |
| CAT-13 | Detail ringkas | Tidak menampilkan sold count, rata-rata pengiriman, minimum pembelian, atau panel penyerahan manual. |
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
| 2026-11-25 | `0c7b03f91094c854189df77f946b043e16cdd6d0` | Membuat baseline pengendali dan mencatat acuan detail terbaru | `docs/PROJECT_BASELINE.md` | Dokumen saja; tidak mengubah aplikasi. |
| 2026-11-25 | `0c240e841ceb198aebb5e48a501be057f84336af` | Mengunci route `/catalog/mlbb-akun`, menyederhanakan detail, membersihkan DTO `/api/catalog`, dan menghapus statistik/panel yang tidak diminta | `frontend/src/app/catalog/mlbb-akun/page.jsx`, `frontend/src/app/catalog/page.jsx`, `frontend/src/app/globals.css`, `frontend/src/app/page.jsx`, `backend/routes/catalog.js`, `tests/core.test.js`, `docs/PROJECT_BASELINE.md` | CI dan deployment produksi SUCCESS. |
| 2026-11-25 | `cf78e1dd8e97d68658dadf26e4895dd38cc7e08e` | Panduan MLBB 4 langkah + 3 tips keamanan, mode stok terakhir SKU ML-001, dan pembersihan metadata internal pada DTO customer | `database/migrations/022_mlbb_account_purchase_guide.sql`, `database/migrations/023_mlbb_account_last_stock_display.sql`, `frontend/src/app/catalog/page.jsx`, `frontend/src/app/globals.css`, `backend/routes/catalog.js`, `tests/core.test.js`, `docs/PROJECT_BASELINE.md` | CI SUCCESS (run 45576618965); production deployment SUCCESS (run 45576775159); migration 022/023 applied and verified on Neon. |
| 2026-11-25 | `f2a8b8ddac5bdcd36fce04db1e3eae8c4a5a7922` | Perbaikan wrapping spesifikasi panjang, konversi newline literal pada deskripsi/atribut/ketentuan, dan refresh data katalog saat membuka detail produk | `frontend/src/app/catalog/page.jsx`, `frontend/src/app/globals.css`, `frontend/src/lib/product-attributes.js`, `tests/core.test.js` | 56/56 backend/core tests PASS; Mini App build PASS; API dry-run PASS; production workflow SUCCESS. |

| 2026-11-25 | fda9509c83e3fc2f3d4fa27f4331d1d774cdef04 | Header dan bottom navigation bersama untuk Dashboard, Katalog, Detail Produk, dan portal Owner; perbaikan wrapping spesifikasi serta newline bertingkat | `frontend/src/components/store-navigation.jsx`, route storefront/Owner, `frontend/src/app/globals.css`, `frontend/src/lib/product-attributes.js`, `tests/core.test.js` | CI perlu pengulangan setelah penyesuaian tes. |

## 9. Status audit data produksi (25 Nov 2026)

- Produk aktif yang diperiksa: 7 SKU.
- SKU MLBB `ML-001` memuat ketentuan Anti-Hackback 14 hari kalender, klaim melalui dukungan resmi dengan nomor pesanan/kronologi/bukti, refund 100% untuk klaim valid, dan pemrosesan maksimal 48 jam sejak bukti lengkap diterima.
- SKU aktif lainnya memiliki ketentuan masing-masing; jangan menampilkan garansi Anti-Hackback ML-001 seolah berlaku untuk semua SKU.
- Tabel klaim garansi ada di database, tetapi endpoint klaim belum terpasang pada API aplikasi saat audit.
- SKU `ML-001` menggunakan `EXACT_COUNT` agar sisa satu unit tampil sebagai `STOK TERAKHIR`; perubahan hanya berlaku untuk SKU tersebut.
- Panduan `mlbb-akun` berisi 4 langkah pembelian dan 3 tips keamanan, disimpan pada migration `022_mlbb_account_purchase_guide.sql`.
- Rating/ulasan belum tersedia di model/data backend yang diperiksa.
- Model toko adalah single-vendor; tampilkan VAULT CORE.
- Lima order yang tercatat pada saat audit tidak menghasilkan penjualan FULFILLED; statistik terjual harus mengikuti data aktual.

## 10. Sisa verifikasi

- [ ] Pemeriksaan visual langsung pada perangkat Android/viewport produksi dengan tiga referensi.
- [ ] Uji interaksi klik thumbnail, expand atribut, modal X, scroll lock, dan sticky bar pada browser nyata.
- [ ] Evaluasi endpoint klaim garansi sebagai pekerjaan backend terpisah; jangan menampilkan alur submit klaim aktif sebelum tersedia.
- [ ] Tambahkan model rating/ulasan hanya melalui instruksi dan desain backend yang disetujui.


## 12. Visual correction — 25 Nov 2026

The latest three-screen owner reference controls the MLBB product detail visual and supersedes the earlier compact-callout-only composition. Keep the approved data and route rules in sections 3–4 unchanged.

- Center the VAULT CORE brand above a compact toolbar with back, search, share, and cart actions.
- Use a short landscape gallery and thumbnail strip.
- Use near-black/navy surfaces with gold price and purchase CTA.
- Main content order: product title and stock; truthful rating status; three inline trust indicators; left-aligned gold XTR price with final-price note; separate blue Anti-Hackback trigger; compact three-row sales/delivery/minimum-purchase panel; full-width single-row Cara Beli & Tips trigger; description; account specifications with contextual emoji; remaining product content and terms.
- Sales and average-delivery values are shown as “Belum tersedia” while the public catalog DTO does not expose those fields; minimum purchase is the approved constant 1. Price, stock, attributes, warranty terms, and guide steps remain backed by selected-product data or approved constants.
- Rating and review counts remain “Belum tersedia” until a real backend source exists; do not copy sample values from the reference.
- Both information sheets remain dark-navy blue-neon bottom sheets with gold “Mengerti” actions.
- Sticky purchase area has a separate cart icon button and a wide gold buy button.

## 13. Product terms footer — 25 Nov 2026

- The customer-facing `Ketentuan Produk` section is the last content section in the detail page scroll area.
- Place it after the Telegram Stars transaction notice and immediately before the scroll area closes; the sticky purchase bar remains the bottom-fixed purchase control.
- Preserve the exact customer_terms text from the selected product backend record. Render the section only when non-warranty terms exist; do not hardcode product-specific account claims across other SKUs.
- Use a subtle top divider and the global design tokens. Preserve paragraph line breaks.

## 14. Detail content safety and stock freshness — 25 Nov 2026

- Convert escaped customer text sequences (\`\\n\`, \`\\r\\n\`, \`\\r\`) into real line breaks for product descriptions, visible account attributes, and customer terms. Keep the original backend content; only normalize its display representation.
- The mobile account-specification rows use a constrained two-column grid. Long labels and values wrap inside their own columns without overlapping adjacent rows.
- Refresh the public catalog snapshot when a customer opens a product detail. The displayed availability, stock badge, price, description, gallery, and attributes then use the latest customer DTO. If refresh fails, retain the last successful snapshot; checkout continues to validate price and stock on the server.
- Preserve the approved detail composition, XTR checkout flow, Telegram Mini App transaction restriction, image gallery source URLs, and sticky purchase bar.


## 15. Shared navigation and detail rendering — 25 Nov 2026

- Reuse the approved Dashboard header frame across Dashboard, Katalog, Detail Produk, and Owner routes: VAULT CORE brand, centered search or Owner label, and right-side actions.
- Reuse the approved four-item bottom navigation on every route: Dashboard, Katalog, Kategori, Owner. The Owner route remains protected by the existing authentication/session checks.
- On product detail, keep the purchase action bar immediately above the shared bottom navigation.
- Long account specification labels and values occupy independent wrapping columns.
- Customer terms normalize repeated escaped newline sequences before display.
- Preserve existing product data, price, stock, XTR checkout, catalog filters, and page content.

## 16. Customer catalog footer — 25 Nov 2026

- Footer katalog memakai permukaan charcoal/navy dan token warna global Vault Core; layout mobile memakai satu kolom dan tidak mengubah header, bottom navigation, kartu produk, filter, atau detail produk.
- Konten FAQ khusus Mobile Legends tampil saat kategori MLBB dipilih dan mode uji tidak aktif. Isinya mengikuti materi pembelian, pemeriksaan akun, keamanan email/perangkat, bind, penyelesaian pesanan, dan penggantian nama yang diberikan pemilik proyek.
- Langkah transaksi wajib menjelaskan bahwa website publik hanya untuk melihat katalog/detail; pembuatan pesanan, pembayaran invoice Telegram Stars (XTR), dan pemantauan pesanan dilakukan melalui VAULT CORE Telegram Mini App.
- Informasi akun yang diterima pembeli disampaikan oleh VAULT CORE. Jangan menampilkan nama mitra sebagai pihak yang harus dihubungi pembeli.
- Informasi garansi mengarahkan pembeli ke ketentuan pada detail SKU. Periode 14 hari kalender disebut hanya untuk produk yang tercakup dalam ketentuan Garansi Anti-Hackback tersebut; klaim valid mendapat refund 100% dengan pemrosesan maksimal 48 jam sejak laporan dan bukti diterima.
- Panel metode pembayaran hanya menampilkan Telegram Stars (XTR). Dilarang menambahkan logo bank, minimarket, e-wallet, PayLater, atau QRIS karena bertentangan dengan kontrak pembayaran.
- Navigasi footer hanya mengarah ke route dan anchor yang benar-benar tersedia. Halaman legal, karier, kanal sosial, dan URL kontak eksternal yang belum ada tidak dibuat sebagai tautan mati.
- Baris hak cipta tidak menyalin identitas badan usaha atau tahun berdiri milik situs referensi.

## 17. Official brand tagline — 25 Nov 2026

<badge>LOCKED · BRAND IDENTITY</badge>

**Tagline resmi VAULT CORE: “Lebih Yakin Bersama Vault Core”.**

- Gunakan persis seperti penulisan di atas pada identitas brand, footer, metadata SEO, Open Graph, materi promosi, dan komunikasi pelanggan.
- Tagline ini adalah identitas brand utama, bukan tagline sementara atau opsi copywriting.
- Jangan mengganti, memparafrasekan, menambahkan klausa, atau menggunakan tagline alternatif pada kanal resmi tanpa instruksi eksplisit pemilik proyek.

## 18. Dashboard buyer protection brand lockup — 25 Nov 2026

- Header section **Perlindungan Pembeli** memakai aset logo resmi `/assets/01-brand/vaultcore-horizontal.svg`.
- Tagline yang tampil persis: **Lebih Yakin Bersama Vault Core**.
- Tiga kartu mempertahankan gaya dan urutan yang disetujui: Anti-Hackback (hijau), Akun Dicek Manual (biru), dan Garansi Refund (ungu). Pertahankan ikon, gradien, border, radius, serta grid tiga kolom.
- Teks kartu customer-facing:
  - Anti-Hackback: “Perlindungan sesuai masa garansi dan ketentuan produk.”
  - Akun Dicek Manual: “Detail akun diperiksa VAULT CORE sebelum ditampilkan.”
  - Garansi Refund: “Refund atau penggantian mengikuti ketentuan produk.”
- Lingkup perubahan hanya brand lockup, tagline, dan copy singkat tiga kartu. Struktur Dashboard, katalog, detail, navigasi, data produk, serta alur transaksi tetap dipertahankan.


## 19. Dashboard game cards — 25 Nov 2026

- Section **Game dan subkategori Akun** on the Dashboard uses a horizontal, touch-scrollable portrait carousel for the four existing games: Mobile Legends, Free Fire, Roblox, and Genshin Impact.
- Card width follows approximately 58% of the mobile viewport (with bounded sizing), with portrait aspect ratio `0.53`, horizontal scroll-snap, and the existing game-specific background artwork and official logo assets.
- The four game entries, product counts, and catalog destinations remain data-driven from the existing catalog state. No API, database, product, payment, or navigation behavior was changed.
- Implementation commit: `34060e754517c05fa0f68ca8f3d4784929896d81`.
- CI run `45635391740`: **SUCCESS**. Production deployment run `45635391811`: **SUCCESS**; the existing `vault-core-web` Worker was deployed, and public root/www/API, TLS, API/database health, and storefront asset checks passed.
- Direct Android screenshot comparison: `NOT TESTED` in this execution; deployment and public endpoint checks are verified, but a rendered device screenshot was not captured.


## 19. Dashboard game-card artwork correction — 25 Nov 2026

- Keep the four primary game cards (Mobile Legends, Free Fire, Roblox, Genshin Impact) as the approved large portrait horizontal carousel.
- Each card uses exactly one official game artwork source from the existing `GAME_ART` mapping. Do not layer the local category illustration/logo behind or over the official image; do not show a second brand mark.
- The official artwork fills the entire card area edge-to-edge using `object-fit: cover`. The game name, “Subkategori Akun”, and live account count sit over a dark bottom gradient for legibility.
- Preserve the existing game ordering, category links, backend-derived account counts, card dimensions, carousel behavior, shared header/bottom navigation, and all other approved Dashboard sections.
- Scope is limited to artwork composition and card copy overlay. Do not change catalog/product data, backend behavior, pricing, stock, routes, or transaction flow.


## 20. Dashboard game-card size adjustment — 25 Nov 2026

- Reduce portrait game-card dimensions to 75% of the prior approved size across mobile and desktop.
- Preserve aspect ratio, full-bleed single official artwork, bottom text gradient, carousel behavior, game order, links, live account counts, and all other Dashboard sections.
- Mobile flex-basis: `clamp(173px, 43.5vw, 315px)`; desktop flex-basis: `clamp(225px, 43.5vw, 315px)`; narrow-screen override: `58.5vw`.
- Scope is card sizing only. Product data, backend, catalog, pricing, stock, and transaction behavior remain unchanged.

## 21. Dashboard sizing alignment — 25 Nov 2026

- Gunakan delapan screenshot UniPin yang disediakan pada 25 November 2026 sebagai referensi **ukuran dan ritme spacing saja**.
- Acuan diterapkan pada area Dashboard mobile: gutter horizontal, jarak vertikal antarbagian, jarak heading ke grid, gap antargrid, padding isi kartu, ukuran gambar pada kartu produk/panduan, dan skala font.
- Ukuran grid utama pada viewport mobile memakai gap 16px; grid Perlindungan Pembeli 14px. Pada viewport sangat sempit, grid dua kolom memakai gap 10px dan grid Perlindungan Pembeli memakai gap 8px.
- Teks heading, label, harga, deskripsi, dan CTA dinaikkan ke skala yang mudah dibaca pada layar ponsel.
- **Hanya nilai ukuran** yang boleh diambil dari referensi. Pertahankan seluruh warna, gradient, background, logo, ikon, artwork, border, radius, struktur konten, urutan section, dan perilaku carousel milik VAULT CORE.
- Jangan menyalin identitas visual, komponen, copywriting, metode pembayaran, promo, maupun aset UniPin.
- Area dashboard, katalog, detail produk, navigation, data produk, harga, stok, checkout XTR, dan perlindungan pembeli tetap mengikuti aturan LOCKED sebelumnya.
