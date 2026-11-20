# VAULT CORE
## Kontrak Spesifikasi Produk, Teknis, dan Pelaksanaan Proyek

| Informasi | Nilai |
|---|---|
| Nama proyek | VAULT CORE |
| Jenis dokumen | Kontrak spesifikasi dan acuan pelaksanaan proyek |
| Versi | 1.2 — Addendum CR-02 |
| Tanggal dokumen | 21 November 2026 |
| Status | Draft revisi untuk persetujuan pemilik; fondasi teknis dapat dimulai dalam ruang lingkup yang disetujui |
| Model usaha | Single-Vendor Store |
| Kanal utama | Telegram Bot dan Telegram Mini App |
| Domain rencana | `vaultcore.web.id` (belum dikonfirmasi kepemilikannya dan konfigurasi DNS-nya) |

> **Kedudukan dokumen.** Dokumen ini menjadi acuan ruang lingkup, arsitektur, perilaku sistem, dan kriteria penerimaan VAULT CORE. Dokumen ini bukan pendapat hukum atau pengganti kontrak jasa profesional yang ditandatangani para pihak. Perubahan terhadap ruang lingkup atau perilaku yang telah disetujui harus dicatat sebagai revisi dokumen atau change request.
>
> **Riwayat revisi:** v1.1 menilai tiga permintaan perubahan CR-01; v1.2 mencatat CR-02 dan keputusan implementasi yang dapat dijalankan. Pengiriman kredensial akun game, penerimaan pembayaran XTR melalui alamat wallet manual, dan angka stok publik yang sengaja berbeda dari stok aktual tidak dimasukkan. Alternatif operasional yang dapat diterapkan dijelaskan dalam Bagian 25 dan menggantikan ketentuan lama apabila terdapat perbedaan.

---

# 1. Tujuan Proyek

VAULT CORE adalah toko digital **Single-Vendor** yang diakses melalui Telegram Bot dan Telegram Mini App. Seluruh katalog, persediaan, harga jual, harga modal, pemrosesan pesanan, pembayaran, pemenuhan pesanan, layanan pelanggan, dan laporan usaha dikelola oleh satu pemilik toko.

Tujuan pengembangan:

1. Menyediakan katalog digital yang mudah digunakan melalui Telegram.
2. Memisahkan kategori game dan tingkatan produk agar katalog tidak menjadi satu daftar panjang.
3. Mengelola stok secara terpusat dan mencegah penjualan melebihi stok tersedia.
4. Memproses pembayaran produk digital menggunakan Telegram Stars (XTR) sesuai ketentuan Telegram.
5. Memenuhi pesanan setelah pembayaran terverifikasi, dengan pencatatan transaksi yang dapat diaudit.
6. Menyediakan dashboard pemilik untuk mengelola produk, persediaan, pesanan, modal, harga jual, margin, keuntungan, refund, dan laporan.
7. Menargetkan pengalaman penggunaan yang cepat, responsif, aman, dan nyaman di perangkat Android.

# 2. Prinsip dan Keputusan yang Dikunci

| Area | Keputusan proyek |
|---|---|
| Model toko | Single-Vendor; tidak ada pendaftaran penjual lain |
| Pemilik stok | Pemilik VAULT CORE |
| Kanal penjualan | Telegram Bot dan Telegram Mini App |
| Frontend | Next.js / React |
| Backend | Node.js + Express |
| Bot | Telegraf / Telegram Bot API |
| Database | PostgreSQL |
| Pembayaran produk digital | Telegram Stars, mata uang `XTR` |
| Hak akses | Customer dan Owner/Admin |
| Pengelolaan katalog | Owner/Admin |
| Pengelolaan modal | Owner/Admin; nilai historis transaksi tidak berubah ketika modal produk diperbarui |
| Pengiriman | Otomatis setelah konfirmasi pembayaran valid dan stok/layanan siap; hanya untuk produk yang memiliki hak pemenuhan yang sah |
| Tampilan stok | Jumlah publik harus bersumber dari stok tersedia aktual; mode tampilan dapat menyembunyikan angka rinci tanpa memalsukan jumlah |
| Pembayaran | Telegram Stars melalui invoice Bot API untuk produk digital di dalam Telegram; tidak ada alamat wallet XTR manual |
| Laporan | Penjualan, biaya/modal, margin, profit, refund, dan rekonsiliasi Stars |
| Antarmuka | Premium dark gaming, mobile-first |
| Metode rilis | Tahap pengembangan, pengujian, staging, lalu produksi setelah persetujuan |

Keputusan teknologi di atas menjadi baseline. Penggantian teknologi utama memerlukan alasan teknis dan persetujuan pemilik proyek.

# 3. Batas Produk dan Kepatuhan Katalog

## 3.1 Kategori katalog awal

Kategori tampilan awal:

1. Mobile Legends: Bang Bang (MLBB)
2. Roblox
3. Garena Free Fire
4. Genshin Impact

Tiap kategori dapat memiliki tingkatan:

- **Silver** — produk entry-level.
- **Gold** — produk utama dengan target harga jual sekitar Rp500.000.
- **Platinum** — produk premium dengan harga yang ditentukan pemilik.

Kategori dan tier merupakan cara pengelompokan katalog. Ketersediaan suatu jenis produk untuk dijual tetap melewati pemeriksaan ketentuan penerbit game, hak distribusi, aturan platform, dan hukum yang berlaku.

## 3.2 Jenis produk yang dapat didukung

Sistem katalog fleksibel pada tingkat tipe data dan metode pemenuhan, tetapi setiap SKU tetap harus memiliki dasar hak penjualan/pemenuhan yang dapat dibuktikan. Tipe produk yang dapat didukung meliputi:

- Kode redeem, voucher, lisensi, gift code, atau kode digital yang sah untuk dialihkan.
- Top-up atau pembelian item melalui jalur resmi/berwenang.
- Layanan digital seperti coaching, pelatihan, jasa push-rank yang tidak meminta kredensial utama, atau layanan lain yang telah diperiksa dan diperbolehkan.
- File, akses, atau konten digital milik toko yang memiliki hak distribusi.
- Instruksi pemenuhan atau kode klaim yang memang diterbitkan untuk dapat dipindahtangankan.

Sistem boleh menyimpan dan mengirim payload digital terenkripsi untuk tipe produk yang disetujui, misalnya kode redeem atau lisensi. Fleksibilitas format data tidak berarti seluruh jenis kredensial atau aset pihak ketiga otomatis layak dijual.

## 3.3 Batas produk, kredensial akun, dan pemeriksaan SKU

Sistem tidak menyediakan katalog, penyimpanan, pemrosesan, atau pengiriman otomatis untuk:

- Paket kredensial akun game `Email:Password` atau pemindahan kendali akun yang dilarang oleh penerbit/platform.
- Password, cookie, session token, recovery code, OTP, backup code, atau data autentikasi yang dapat digunakan untuk mengambil alih akun.
- Koin, mata uang, item, atau aset virtual yang diperoleh atau dialihkan melalui cara yang dilarang ketentuan penerbit/platform.
- Produk yang memakai merek, gambar, logo, atau materi berhak cipta tanpa hak penggunaan yang diperlukan.
- Layanan yang meminta pelanggan memberikan password utama atau kode autentikasi akun kepada operator.

Kredensial akun tidak dapat diaktifkan hanya dengan alasan penjual menyatakan bersedia menanggung risikonya. Jika penerbit menyediakan program transfer atau distribusi resmi, SKU tetap memerlukan bukti otorisasi tertulis dan pemeriksaan khusus sebelum dapat masuk katalog. Status awal SKU baru adalah `DRAFT` atau `PENDING_REVIEW`, bukan `ACTIVE`.

Pemeriksaan dilakukan per game dan per SKU. Ketentuan penerbit dapat berbeda dan berubah; daftar game pada kontrak ini adalah kategori katalog, bukan persetujuan otomatis untuk memperdagangkan akun atau itemnya.

## 3.4 Asuransi, garansi, dan upsell

Penawaran awal seperti jaminan 30 hari, bonus top-up, dan express delivery hanya dapat diaktifkan setelah syarat, cakupan, pengecualian, biaya, sumber pemenuhan, dan kemampuan operasionalnya ditetapkan secara tertulis.

Klaim seperti “akun aman dari hack/retrieve” atau jaminan hasil yang tidak dapat dikendalikan toko tidak boleh ditampilkan sebagai kepastian. Garansi yang disetujui harus menjelaskan apa yang dijamin, masa berlaku, bukti yang dibutuhkan, cara klaim, dan bentuk penyelesaiannya.

# 4. Pengguna, Peran, dan Hak Akses

## 4.1 Customer

Customer dapat:

- Membuka Mini App dari bot.
- Melihat kategori, tier, detail, harga, dan stok produk.
- Membuat pesanan.
- Membayar melalui Telegram Stars.
- Melihat status dan riwayat pesanan miliknya.
- Mengakses bukti/informasi pemenuhan yang ditujukan kepadanya.
- Meminta bantuan pembayaran melalui `/paysupport`.

Customer tidak dapat melihat harga modal, margin, profit, data pelanggan lain, data rahasia stok, atau fungsi administrasi.

## 4.2 Owner/Admin

Owner memiliki akses penuh terhadap:

- Dashboard ringkasan usaha.
- Kategori, tier, produk, harga jual, dan status produk.
- Harga modal dan biaya terkait.
- Stok, kode digital yang sah, dan status pemenuhan.
- Pesanan, pembayaran, delivery, refund, serta pengaduan.
- Laporan dan ekspor data.
- Pengaturan bot, toko, promosi, serta kebijakan layanan.
- Audit log dan pengelolaan akses admin.

Jika akun Admin tambahan diaktifkan, haknya harus dapat dibatasi berdasarkan peran. Fitur multi-seller tetap tidak termasuk dalam proyek.

# 5. Struktur Navigasi dan UI

## 5.1 Mini App Customer

Navigasi yang direncanakan:

- Home
- Store / Katalog
- Orders / Pesanan
- Profile / Bantuan

Struktur katalog:

1. Customer memilih kategori game.
2. Sistem menampilkan tier Silver, Gold, dan Platinum.
3. Customer memilih produk.
4. Halaman detail menampilkan deskripsi, harga XTR, stok tersedia, syarat, waktu pemenuhan, dan kebijakan terkait.
5. Customer melanjutkan checkout.

## 5.2 Kartu produk

Kartu produk menampilkan sekurang-kurangnya:

- Nama produk.
- Kategori game dan tier.
- Gambar/ilustrasi yang boleh digunakan.
- Harga jual dalam XTR.
- Informasi harga IDR indikatif jika dikonfigurasi.
- Jumlah stok tersedia aktual atau label ketersediaan non-numerik sesuai mode Display Stock.
- Ringkasan deskripsi.
- Status ketersediaan.

Owner dapat memilih `EXACT_COUNT`, `IN_STOCK_ONLY`, atau `HIDE_COUNT` dan mengatur ambang stok rendah. Angka numerik dan label kelangkaan hanya berasal dari stok tersedia aktual. Sistem tidak menyediakan angka publik buatan yang berbeda dari stok yang benar-benar dapat dijual.

## 5.3 Prinsip tampilan

- Desain premium dark gaming, mobile-first, responsif.
- Navigasi kategori mudah dijangkau dengan satu tangan.
- Komponen konsisten dan tidak tumpang tindih dengan area kontrol Telegram.
- Teks harga, stok, status, dan tombol aksi mudah dibaca.
- Ada loading, empty state, error state, dan konfirmasi aksi.
- Gambar dioptimalkan dan dimuat sesuai kebutuhan.
- Tidak menampilkan data modal/profit kepada customer.

# 6. Arsitektur dan Struktur Sumber

Struktur dasar proyek:

```text
vault-core-app/
├── backend/
│   ├── controllers/
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   ├── productController.js
│   │   ├── inventoryController.js
│   │   ├── deliveryController.js
│   │   └── reportController.js
│   ├── models/
│   │   ├── Customer.js
│   │   ├── Product.js
│   │   ├── InventoryItem.js
│   │   ├── Order.js
│   │   ├── Transaction.js
│   │   ├── Delivery.js
│   │   └── AdminAuditLog.js
│   ├── routes/
│   │   ├── api.js
│   │   ├── telegramWebhook.js
│   │   └── admin.js
│   ├── services/
│   │   ├── telegramStarsService.js
│   │   ├── inventoryService.js
│   │   ├── deliveryService.js
│   │   ├── profitService.js
│   │   └── refundService.js
│   ├── middleware/
│   │   ├── validateTelegramInitData.js
│   │   ├── adminAuth.js
│   │   └── rateLimit.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── encryption.js
│   └── server.js
│
├── frontend/
│   ├── public/
│   │   └── assets/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   ├── services/
│   │   └── admin/
│   └── package.json
│
├── bot/
│   ├── handlers/
│   │   ├── start.js
│   │   ├── help.js
│   │   ├── payments.js
│   │   └── support.js
│   ├── services/
│   └── bot.js
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── docs/
├── tests/
├── .env.example
├── package.json
└── README.md
```

Struktur di atas adalah struktur logis. Penyesuaian teknis kecil seperti pemisahan package, shared types, atau folder konfigurasi diperbolehkan selama fungsi, batas modul, dan dokumentasinya dipertahankan.

# 7. Modul dan Kebutuhan Fungsional

## 7.1 Modul Customer

- Integrasi Telegram Mini App.
- Validasi identitas Telegram dari data mentah `initData` pada backend.
- Katalog kategori, tier, pencarian, filter, dan detail produk.
- Keranjang/checkout untuk satu atau lebih produk jika aturan stok mendukung.
- Ringkasan total pembayaran.
- Status pesanan real-time atau pembaruan berkala.
- Riwayat pesanan dan akses informasi delivery.
- Tombol bantuan.

## 7.2 Modul Produk

Setiap produk setidaknya menyimpan:

- ID internal dan SKU unik.
- Nama dan deskripsi.
- Kategori game.
- Tier.
- Tipe produk.
- Gambar dan media.
- Harga jual XTR.
- Harga tampilan IDR (opsional dan diberi label sesuai sumber konversinya).
- Harga modal default.
- Status pemeriksaan kepatuhan.
- Status aktif/nonaktif.
- Jumlah stok aktual.
- Estimasi waktu pemenuhan.
- Syarat penjualan dan kebijakan refund.
- Metadata sumber produk/hak distribusi bila relevan.

## 7.3 Modul Inventaris dan Display Stock

Owner dapat:

- Menambah satu item stok atau melakukan input massal.
- Mengubah status stok.
- Menonaktifkan item yang rusak, tidak valid, atau tidak lagi dapat dipenuhi.
- Melihat stok tersedia, dicadangkan, terjual, dan dibatalkan.
- Melihat riwayat perubahan stok.
- Menghubungkan satu item inventaris dengan satu order bila jenis produk memerlukan stok unit.
- Memilih mode `EXACT_COUNT`, `IN_STOCK_ONLY`, atau `HIDE_COUNT` untuk tampilan publik.
- Mengatur ambang stok rendah dan teks label yang jujur, misalnya “Stok terbatas”, yang hanya tampil ketika stok aktual berada pada/di bawah ambang.

`Display Stock` adalah pengaturan presentasi, bukan pengganti sumber inventaris. Sistem tidak menyediakan `display_stock_override` atau angka stok publik buatan yang sengaja berbeda dari jumlah aktual. Jumlah stok tersedia dihitung dari stok yang benar-benar dapat dijual dikurangi reservasi aktif dan unit yang dinonaktifkan.

Sistem wajib mencegah dua order menggunakan item stok yang sama. Pengurangan dan reservasi stok dilakukan melalui transaksi database yang atomik.

## 7.4 Modul Pesanan

- Membuat nomor order unik.
- Menyimpan snapshot nama, SKU, harga, biaya, dan jumlah pada saat order dibuat.
- Memiliki status pesanan yang eksplisit.
- Mencegah order kedaluwarsa tetap dibayar tanpa pemeriksaan ulang.
- Menyimpan hubungan antara order, invoice, pembayaran, delivery, dan refund.
- Mendukung pembatalan dan pemulihan reservasi stok.

## 7.5 Modul Pembayaran

- Pembuatan invoice Telegram Stars untuk produk digital.
- Pemeriksaan kesiapan order pada tahap pre-checkout.
- Penerimaan update pembayaran berhasil.
- Penyimpanan Telegram payment charge ID.
- Verifikasi nilai, mata uang, payload, pemilik order, dan status order.
- Idempotensi: event pembayaran yang sama tidak boleh menambah transaksi atau mengirim produk dua kali.
- Rekonsiliasi transaksi dan saldo Stars yang tercatat.
- Refund melalui mekanisme Telegram yang tersedia.

## 7.6 Modul Delivery

- Hanya berjalan setelah pembayaran valid tercatat.
- Hanya berjalan setelah sistem memastikan item tersedia atau layanan dapat dijadwalkan.
- Memiliki status `PENDING`, `PROCESSING`, `DELIVERED`, `FAILED`, atau `REVIEW_REQUIRED`.
- Menyimpan waktu, metode, dan hasil pemenuhan.
- Jika pengiriman gagal, order masuk antrean retry atau pemeriksaan manual tanpa membuat pemenuhan ganda.
- Isi delivery berupa kode/lisensi yang sah, instruksi resmi, atau detail layanan. Kredensial login akun game tidak termasuk.

## 7.7 Modul Owner Dashboard

Dashboard minimum:

- Total order.
- Order menunggu pembayaran.
- Order dibayar.
- Order selesai.
- Order gagal/dibatalkan/refund.
- Omzet bruto.
- Biaya modal.
- Biaya lain.
- Profit kotor dan profit bersih.
- Produk terlaris.
- Persediaan tersedia dan bernilai modal.
- Riwayat transaksi.

Dashboard wajib dapat difilter berdasarkan rentang tanggal, game, tier, SKU, dan status.

# 8. Ketentuan Pembayaran Telegram Stars

## 8.1 Prinsip wajib

Untuk penjualan barang/jasa digital di dalam Telegram Bot atau Mini App, pembayaran harus menggunakan Telegram Stars (`XTR`) melalui invoice Bot API sesuai dokumentasi Telegram yang berlaku. Pembayaran tidak diproses dengan skenario customer mengirim Stars secara manual ke alamat wallet lalu backend mendeteksi transaksi blockchain. Telegram Stars pada saldo personal pengguna bukan alamat wallet XTR untuk pembayaran manual; saldo tersebut tunduk pada batas penggunaan dalam Terms of Service Telegram.

## 8.2 Alur resmi

1. Backend membuat order dan payload unik.
2. Bot mengirim invoice menggunakan `sendInvoice` dengan currency `XTR`.
3. Telegram mengirim update `pre_checkout_query`.
4. Bot memvalidasi order, jumlah XTR, payload, masa berlaku, stok, serta status pesanan.
5. Bot menjawab menggunakan `answerPreCheckoutQuery` maksimal 10 detik setelah menerima `pre_checkout_query`, sesuai ketentuan Bot API; jika tidak dapat dipenuhi, checkout harus ditolak dengan alasan yang dapat dipahami.
6. Setelah update `successful_payment` diterima, backend memverifikasi dan menyimpan detail pembayaran.
7. Backend menandai order dibayar secara atomik.
8. Backend memulai proses delivery.
9. Bot memberi notifikasi hasil kepada customer.

`provider_token` tidak diperlukan untuk invoice Telegram Stars digital; implementasi harus mengikuti dokumentasi Bot API terkini.

## 8.3 Data pembayaran yang disimpan

- `telegram_payment_charge_id`.
- User Telegram ID.
- Order ID dan invoice payload.
- Currency (`XTR`).
- Total Stars.
- Waktu update diterima.
- Status validasi.
- Status refund jika ada.
- Raw update yang sudah disanitasi bila diperlukan untuk audit, tanpa menyimpan token rahasia.

## 8.4 Refund dan dukungan

- Bot wajib merespons `/paysupport`.
- Admin memiliki alur pencatatan alasan refund.
- Refund menggunakan `refundStarPayment` sesuai Bot API.
- Sistem menyimpan ID transaksi refund dan menautkannya ke order asal.
- Refund tidak otomatis menghapus jejak transaksi atau audit log.
- Kebijakan refund harus ditampilkan sebelum pembayaran.

## 8.5 Metode manual dan rekonsiliasi

Tidak tersedia opsi pembayaran manual dengan alamat wallet XTR. Admin tidak boleh menandai order sebagai lunas hanya berdasarkan tangkapan layar, pesan customer, atau klaim transfer Stars. Status `PAID` hanya berasal dari `successful_payment` Telegram yang valid.

Owner dapat melakukan rekonsiliasi administratif atas transaksi Stars yang sudah diterima menggunakan data resmi Bot API. Rekonsiliasi tidak dapat membuat transaksi pembayaran yang tidak ada, mengubah pembayaran gagal menjadi sukses, atau menggantikan invoice.

## 8.6 Harga XTR dan pelaporan IDR

Harga target Gold sekitar Rp500.000 adalah target harga jual komersial, bukan nilai tetap yang dapat langsung dianggap setara dengan sejumlah Stars tertentu.

- Harga invoice disimpan dalam XTR.
- Harga acuan IDR disimpan terpisah dengan sumber dan tanggal penetapan.
- Nilai penerimaan Stars dan nilai pencairan/reward aktual harus dibedakan.
- Tarif, biaya, VAT, konversi, potongan, atau kelayakan pencairan dapat berubah dan harus diverifikasi saat operasional.
- Sistem tidak boleh menjanjikan nilai rupiah bersih tertentu hanya berdasarkan jumlah XTR tanpa data konversi/penerimaan yang valid.

# 9. Model Data Minimum

Skema final dapat disesuaikan pada tahap implementasi, tetapi entitas dan relasi berikut wajib tercakup.

## 9.1 Customer

- `id`
- `telegram_user_id` (unik)
- `telegram_username` (opsional)
- `display_name` (opsional)
- `created_at`, `updated_at`, `last_seen_at`

## 9.2 Product

- `id`, `sku`, `name`, `description`
- `game_category`, `tier`, `product_type`
- `price_xtr`, `display_price_idr`
- `default_cost_idr`
- `compliance_status`, `is_active`
- `stock_policy`, `delivery_type`
- `created_at`, `updated_at`

## 9.3 InventoryItem

- `id`, `product_id`
- `inventory_code` atau identifier stok non-rahasia
- `cost_idr_snapshot`
- `status` (`AVAILABLE`, `RESERVED`, `SOLD`, `DISABLED`)
- `secret_payload_encrypted` hanya untuk kode redeem, lisensi, voucher, atau payload digital sah yang memang harus dirahasiakan
- `created_at`, `updated_at`, `sold_at`

Tidak ada kolom, form admin, API, atau mekanisme delivery untuk penyimpanan password akun game, cookie, session token, OTP, recovery code, atau kredensial pengambilalihan akun. Payload digital yang diizinkan harus dienkripsi, ditampilkan hanya kepada pemesan yang berhak, dan dibatasi aksesnya.

## 9.4 Order dan OrderItem

Order:

- `id`, `order_number`, `customer_id`
- `status`, `subtotal_xtr`, `total_xtr`
- `reference_total_idr` (opsional)
- `created_at`, `expires_at`, `paid_at`, `completed_at`

OrderItem:

- `id`, `order_id`, `product_id`, `inventory_item_id` (jika diperlukan)
- `sku_snapshot`, `name_snapshot`, `quantity`
- `unit_price_xtr_snapshot`
- `unit_cost_idr_snapshot`
- `line_total_xtr`

## 9.5 Transaction

- `id`, `order_id`, `customer_id`
- `provider` (`TELEGRAM_STARS`)
- `provider_charge_id` (unik)
- `currency`, `amount`
- `status`, `raw_payload_sanitized`
- `paid_at`, `refunded_at`, `created_at`

## 9.6 Delivery

- `id`, `order_id`, `order_item_id`
- `delivery_type`, `status`, `attempt_count`
- `delivered_at`, `failure_reason`
- `delivery_reference` atau isi pengiriman terenkripsi sesuai kebutuhan

## 9.7 Expense dan AuditLog

Expense menyimpan biaya tambahan yang dialokasikan ke order atau periode laporan. AuditLog menyimpan aktor, tindakan, objek, waktu, dan ringkasan perubahan sebelum/sesudah tanpa mencatat rahasia.

# 10. Perhitungan Modal, Margin, dan Profit

## 10.1 Rumus

- **Omzet bruto IDR indikatif** = nilai penjualan yang dikonversi memakai acuan kurs/valuasi yang disimpan untuk laporan.
- **Modal barang** = snapshot biaya inventaris yang benar-benar terjual.
- **Biaya lain** = biaya operasional/transaksi/refund yang dicatat dan dialokasikan.
- **Profit kotor** = pendapatan penjualan acuan IDR − modal barang.
- **Profit bersih operasional** = pendapatan bersih yang direalisasikan − modal barang − biaya lain.
- **Margin kotor (%)** = profit kotor ÷ pendapatan penjualan acuan IDR × 100.

Laporan harus membedakan nilai transaksi XTR, valuasi IDR indikatif, serta penerimaan/pencairan yang benar-benar direalisasikan. Satu angka tidak boleh digunakan untuk menyamarkan perbedaan tersebut.

## 10.2 Snapshot historis

Ketika order dibuat atau dibayar, sistem menyimpan snapshot harga jual dan harga modal yang berlaku untuk order tersebut. Perubahan harga produk di kemudian hari tidak boleh mengubah histori modal, harga jual, atau profit order lama.

## 10.3 Biaya dan refund

Biaya administrasi, biaya top-up resmi, biaya layanan, potongan, dan refund harus tercatat sebagai pos terpisah. Owner dapat memperbarui nilai biaya untuk transaksi berikutnya tanpa mengubah histori transaksi terdahulu.

# 11. Status dan Transisi Pesanan

Status minimum:

- `PENDING_PAYMENT`
- `PAYMENT_PROCESSING`
- `PAID`
- `FULFILLMENT_PENDING`
- `FULFILLMENT_PROCESSING`
- `COMPLETED`
- `PAYMENT_EXPIRED`
- `CANCELLED`
- `FULFILLMENT_FAILED`
- `REFUND_PENDING`
- `REFUNDED`
- `MANUAL_REVIEW`

Aturan:

1. Order hanya dapat menjadi `PAID` setelah pembayaran sukses diverifikasi.
2. Order yang sudah `COMPLETED` tidak boleh dikirim ulang akibat webhook duplikat.
3. Order yang gagal dipenuhi harus terlihat dan dapat ditindaklanjuti owner.
4. Pembatalan order melepaskan reservasi stok sesuai aturan masa reservasi.
5. Refund tidak otomatis mengembalikan stok digital yang telah ditampilkan/digunakan. Kebijakan pengembalian stok ditentukan berdasarkan tipe produk dan bukti penggunaan.
6. Semua perubahan status penting dicatat dalam audit log.

# 12. Keamanan dan Privasi

Persyaratan minimum:

- Validasi `Telegram.WebApp.initData` di backend; data `initDataUnsafe` dari frontend tidak dijadikan sumber otoritatif.
- Validasi tanggal autentikasi (`auth_date`) dan menolak data yang kedaluwarsa sesuai batas waktu yang dikonfigurasi.
- Token bot, kredensial database, session secret, dan encryption key hanya berada di environment secret, bukan dalam repository.
- `.env.example` berisi nama variabel dan contoh kosong, bukan rahasia produksi.
- Admin memakai autentikasi dan otorisasi server-side.
- Rate limiting untuk login, endpoint order, dan endpoint sensitif.
- Validasi schema pada seluruh input API.
- Perlindungan terhadap SQL injection, XSS, CSRF jika relevan, replay, dan IDOR.
- Webhook Telegram diverifikasi menggunakan secret token webhook dan/atau mekanisme resmi yang sesuai.
- Pembayaran dan delivery menerapkan idempotensi.
- Data pribadi diminimalkan dan hanya disimpan sesuai tujuan yang dijelaskan.
- Log tidak boleh memuat bot token, password, kode autentikasi, atau payload rahasia.
- Backup database terenkripsi dan memiliki prosedur pemulihan.
- Penghapusan/retensi data mengikuti kebijakan yang ditetapkan dan ketentuan hukum.

Pemrosesan data pribadi wajib ditinjau terhadap UU Pelindungan Data Pribadi Indonesia dan kewajiban lain yang berlaku. Pendaftaran PSE Lingkup Privat, NIB, KBLI, dan kewajiban OSS/Komdigi harus diperiksa oleh pemilik bersama penasihat yang kompeten sebelum operasional publik bila kriteria pendaftaran terpenuhi.

# 13. Integrasi Telegram dan Operasional Bot

Bot minimum menyediakan:

- `/start` — sambutan dan tombol membuka Mini App.
- `/help` — bantuan penggunaan.
- `/paysupport` — dukungan masalah pembayaran.
- Notifikasi order dibuat.
- Notifikasi pembayaran diterima.
- Notifikasi delivery selesai atau memerlukan bantuan.
- Notifikasi refund jika diproses.

Bot token dibuat dan disimpan oleh pemilik. Bot production dan bot test wajib dipisahkan. Pengujian pembayaran dilakukan pada test environment sebelum transaksi produksi.

# 14. API Minimum

Nama endpoint final dapat mengikuti konvensi implementasi, tetapi kemampuan berikut wajib tersedia:

| Method | Endpoint logis | Fungsi |
|---|---|---|
| GET | `/api/catalog` | Daftar kategori dan produk aktif |
| GET | `/api/products/:id` | Detail produk |
| POST | `/api/orders` | Membuat order dan reservasi stok |
| GET | `/api/orders/:id` | Status order milik customer |
| GET | `/api/me/orders` | Riwayat order customer |
| POST | `/api/telegram/webhook` | Menerima update Bot API |
| GET/POST | `/api/admin/products` | Daftar dan pengelolaan produk |
| POST/PATCH | `/api/admin/inventory` | Menambah/mengubah stok |
| GET | `/api/admin/orders` | Daftar pesanan |
| GET | `/api/admin/reports/profit` | Laporan profit |
| GET | `/api/admin/audit-logs` | Audit aktivitas admin |

Endpoint admin harus memerlukan autentikasi dan pemeriksaan izin pada backend. Menyembunyikan tombol admin pada frontend bukan kontrol keamanan yang memadai.

# 15. Kinerja, Ketersediaan, dan Pengalaman Pengguna

Target kualitas:

- Target loading awal Mini App: maksimal 3 detik pada perangkat, jaringan, dan skenario uji yang disepakati.
- Halaman katalog menggunakan pagination/lazy loading bila daftar produk besar.
- Gambar dikompresi dan memakai format modern bila didukung.
- Endpoint katalog dan produk memiliki target respons yang ditetapkan saat pengujian beban.
- Proses pembayaran dan webhook tidak bergantung pada tab Mini App tetap terbuka.
- Error ditangani dengan pesan yang dapat dipahami pengguna.
- Sistem menyediakan monitoring error dan status layanan.

Angka 3 detik adalah target penerimaan performa yang harus diukur pada kondisi uji yang terdokumentasi, bukan jaminan untuk seluruh jaringan/perangkat.

# 16. Pengujian dan Kriteria Penerimaan

Proyek dinyatakan siap uji penerimaan jika semua kriteria kritis berikut lolos.

## 16.1 Customer dan Mini App

- [ ] Bot `/start` dapat mengirim tombol pembuka Mini App.
- [ ] Mini App terbuka pada Android Telegram.
- [ ] Data identitas Telegram diverifikasi oleh backend.
- [ ] Kategori game tampil dan dapat dibuka.
- [ ] Tier Silver, Gold, dan Platinum tampil sesuai konfigurasi.
- [ ] Harga, deskripsi, dan stok sesuai database.
- [ ] Customer tidak dapat mengakses harga modal atau halaman admin.
- [ ] Order customer hanya dapat dilihat oleh customer tersebut.

## 16.2 Inventaris dan Order

- [ ] Owner dapat membuat dan memperbarui produk.
- [ ] Owner dapat menambah dan menonaktifkan stok.
- [ ] Display Stock mendukung `EXACT_COUNT`, `IN_STOCK_ONLY`, dan `HIDE_COUNT`.
- [ ] Label stok rendah hanya tampil berdasarkan stok tersedia aktual dan ambang yang dikonfigurasi.
- [ ] Backend tidak menerima angka display stock buatan yang berbeda dari stok aktual.
- [ ] Stok tersedia dihitung dari status stok aktual.
- [ ] Dua customer yang membeli unit terakhir secara bersamaan tidak dapat memperoleh unit yang sama.
- [ ] Order memiliki nomor unik.
- [ ] Order menyimpan snapshot harga dan modal.
- [ ] Order kedaluwarsa melepaskan reservasi stok secara benar.

## 16.3 Pembayaran

- [ ] Invoice memakai currency `XTR` untuk produk digital.
- [ ] Tidak ada pembayaran manual dengan alamat wallet XTR.
- [ ] Admin tidak dapat mengubah order menjadi `PAID` hanya dari bukti gambar atau klaim customer.
- [ ] Pre-checkout memeriksa payload, jumlah, order, dan stok.
- [ ] Pre-checkout gagal jika order tidak valid atau stok tidak tersedia.
- [ ] Pembayaran sukses mengubah status order secara atomik.
- [ ] Event sukses duplikat tidak membuat pembayaran ganda.
- [ ] Telegram charge ID tersimpan.
- [ ] Pembayaran gagal/tidak selesai tidak menghasilkan delivery.
- [ ] `/paysupport` berfungsi.
- [ ] Refund uji dapat ditautkan ke transaksi asal.

## 16.4 Delivery

- [ ] Delivery hanya dimulai setelah pembayaran terverifikasi.
- [ ] SKU yang dipublikasikan memiliki status pemeriksaan/otorisasi yang disyaratkan.
- [ ] Tidak ada field, API, atau alur yang mengumpulkan dan mengirim password akun game, cookie, session token, OTP, atau recovery code.
- [ ] Delivery tidak dijalankan dua kali akibat webhook duplikat.
- [ ] Kegagalan delivery terlihat oleh Owner.
- [ ] Pengiriman ulang tercatat dan terkendali.
- [ ] Customer menerima notifikasi hasil pemenuhan.

## 16.5 Keuangan dan Audit

- [ ] Harga modal dapat diubah untuk order berikutnya.
- [ ] Perubahan modal tidak mengubah snapshot order lama.
- [ ] Profit dan margin dihitung sesuai rumus yang disetujui.
- [ ] Nilai XTR dibedakan dari valuasi IDR.
- [ ] Refund dan biaya lain mengurangi angka laporan sesuai kategorinya.
- [ ] Perubahan produk, harga, stok, order manual, dan refund tercatat dalam audit log.
- [ ] Laporan dapat difilter berdasarkan periode, game, tier, produk, dan status.

## 16.6 Keamanan dan Performa

- [ ] Bot token dan secret tidak ada di source code atau git history.
- [ ] Endpoint admin menolak akses tanpa autentikasi.
- [ ] Pengujian IDOR dilakukan pada order dan data pelanggan.
- [ ] Webhook menerima hanya update valid.
- [ ] Input API divalidasi.
- [ ] Backup dan prosedur restore diuji.
- [ ] Hasil benchmark loading Mini App dilampirkan.

Kriteria kritis yang gagal berarti rilis produksi ditunda sampai diperbaiki atau terdapat pengecualian tertulis yang disetujui pemilik.

# 17. Tahapan Pelaksanaan dan Deliverables

## Tahap 0 — Persetujuan dan kesiapan akses

Deliverables:

- Kontrak ini disetujui.
- Nama bot dan akun BotFather disiapkan pemilik.
- Domain dan akses DNS disiapkan.
- Hosting dan database ditetapkan.
- Daftar produk yang boleh dijual dan dokumen hak distribusi diperiksa.
- Harga awal XTR serta aturan refund disetujui.

## Tahap 1 — Fondasi proyek

Deliverables:

- Repository/folder `vault-core-app/`.
- Struktur frontend, backend, bot, dan database.
- Konfigurasi `.env.example`.
- README instalasi dan menjalankan proyek.
- Migrasi database awal.
- Validasi Telegram Mini App.
- Model Customer, Product, Inventory, Order, Transaction, Delivery, dan AuditLog.
- API katalog dan order dasar.

## Tahap 2 — Mini App dan pembayaran

Deliverables:

- Home dan katalog kategori.
- Halaman tier dan detail produk.
- Checkout.
- Invoice Telegram Stars.
- Pre-checkout dan successful-payment handler.
- Idempotensi dan penyimpanan charge ID.
- Delivery otomatis untuk SKU yang telah disetujui.
- Riwayat order dan bantuan pembayaran.

## Tahap 3 — Owner Dashboard dan keuangan

Deliverables:

- Dashboard ringkasan.
- CRUD produk dan kategori.
- Manajemen stok.
- Daftar dan detail order.
- Modal, harga jual, biaya, margin, dan profit.
- Refund dan penanganan order gagal.
- Audit log dan ekspor laporan.

## Tahap 4 — QA, staging, dan rilis

Deliverables:

- Pengujian unit, integrasi, dan end-to-end.
- Pengujian pembayaran Stars di test environment.
- Pengujian keamanan dasar.
- Benchmark performa.
- Backup dan uji pemulihan.
- Deployment staging.
- UAT dan daftar temuan.
- Deployment produksi setelah persetujuan tertulis.
- Dokumentasi operasional dan backup source code.

# 18. Serah Terima dan Kepemilikan

Setelah serah terima yang disepakati, pemilik proyek harus memperoleh:

- Seluruh source code proyek yang dibuat khusus untuk VAULT CORE.
- Repository atau arsip ZIP source code.
- File README dan dokumentasi konfigurasi.
- Database schema dan migration files.
- `.env.example` tanpa secret produksi.
- Daftar layanan eksternal dan konfigurasi yang diperlukan.
- Instruksi deployment, backup, restore, dan pemulihan.
- Daftar akun/akses yang harus dimiliki pemilik.
- Daftar keterbatasan dan pekerjaan yang belum selesai.

Kredensial produksi diserahkan melalui kanal aman dan tidak dicantumkan dalam dokumen atau repository publik. Kepemilikan akun Telegram, domain, hosting, database, dan layanan pihak ketiga harus berada di bawah kendali pemilik proyek.

# 19. Perubahan Ruang Lingkup

Perubahan yang termasuk change request:

- Menambah game atau kategori baru.
- Mengubah teknologi inti.
- Menambah multi-seller/marketplace.
- Menambah metode pembayaran di luar rancangan ini.
- Menambah aplikasi native Android/iOS terpisah.
- Menambah sistem referral, loyalty, membership, atau langganan.
- Menambah integrasi pihak ketiga yang belum tercantum.
- Mengubah alur transaksi, refund, atau pemenuhan secara material.

Setiap perubahan harus memiliki catatan: kebutuhan, alasan, dampak ke database/API/UI, risiko, estimasi pekerjaan, dan persetujuan pemilik. Permintaan lisan atau pesan singkat tidak dianggap mengubah kontrak sampai dicatat dalam revisi/issue yang disepakati.

# 20. Hal yang Belum Diketahui dan Harus Diputuskan

Hal berikut belum ditetapkan oleh informasi proyek saat dokumen ini dibuat:

1. Username bot Telegram dan kepemilikan token BotFather.
2. Konfirmasi domain `vaultcore.web.id`, registrar, dan akses DNS.
3. Provider hosting produksi dan lokasi database.
4. Apakah PostgreSQL dikelola sendiri atau menggunakan layanan terkelola.
5. Daftar final SKU yang telah lolos pemeriksaan hak penjualan.
6. Harga XTR tiap SKU dan aturan penetapan ulang harga.
7. Kurs/valuasi XTR ke IDR untuk laporan indikatif dan sumber datanya.
8. Kebijakan refund per tipe produk.
9. SLA layanan customer support dan waktu pemenuhan.
10. Jumlah akun admin serta kebijakan MFA.
11. Masa retensi order, transaksi, dan data pelanggan.
12. Persyaratan legal usaha, NIB, KBLI, PSE, dan dokumen privasi yang relevan.
13. Target jumlah pengguna bersamaan dan volume transaksi.

Nilai atau keputusan pada daftar tersebut tidak boleh dianggap telah disetujui sebelum pemilik mengonfirmasikannya.

# 21. Risiko dan Ketergantungan

| Risiko/ketergantungan | Dampak | Pengendalian |
|---|---|---|
| Produk tidak memiliki hak jual | Produk harus ditolak/nonaktif | Pemeriksaan SKU sebelum publikasi |
| Perubahan kebijakan penerbit game | Katalog/layanan dapat perlu dihentikan | Review kebijakan berkala |
| Perubahan aturan Telegram Stars | Pembayaran dapat perlu diperbarui | Ikuti dokumentasi Bot API terkini |
| Refund/chargeback | Selisih laporan dan risiko kehilangan nilai | Simpan charge ID dan audit trail |
| Stok ganda | Pesanan tidak dapat dipenuhi | Reservasi atomik dan constraint database |
| Webhook terlambat/berulang | Status order tidak konsisten | Idempotensi, retry terkendali, rekonsiliasi |
| Token bocor | Pengambilalihan bot/sistem | Secret manager dan rotasi token |
| Data pribadi berlebihan | Risiko privasi/kepatuhan | Minimasi data dan retensi terukur |
| Gangguan penyedia hosting | Aplikasi tidak tersedia | Backup, monitoring, dan prosedur restore |

# 22. Ketentuan Operasional dan Layanan Pelanggan

- Customer harus dapat menemukan identitas pengelola dan kanal bantuan.
- Ketentuan layanan, kebijakan privasi, deskripsi produk, waktu pemenuhan, dan kebijakan refund harus dapat dibaca sebelum pembayaran.
- Bukti pembayaran Telegram disimpan sebagai referensi transaksi.
- Keluhan pembayaran diproses melalui `/paysupport` dan sistem tiket/rekap internal.
- Keluhan delivery memiliki nomor order dan status tindak lanjut.
- Admin tidak boleh mengubah bukti atau histori transaksi tanpa jejak audit.
- Informasi stok dan waktu pemenuhan harus sesuai kondisi aktual.

# 23. Definisi Selesai (Definition of Done)

Proyek dianggap selesai untuk masa uji setelah:

1. Semua modul yang disepakati telah tersedia pada environment staging/produksi sesuai tahap.
2. Semua kriteria penerimaan kritis pada Bagian 16 lulus.
3. Tidak ada bug kritis atau tinggi yang belum memiliki penyelesaian yang disetujui.
4. Pembayaran test Stars, pemrosesan order, dan delivery berhasil diuji end-to-end.
5. Dashboard modal/profit menghasilkan nilai sesuai data uji dan snapshot historis.
6. Dokumentasi instalasi, deployment, backup, dan restore diserahkan.
7. Pemilik menyetujui hasil UAT dan menerima source code.

Status “selesai untuk masa uji” tidak berarti seluruh risiko bisnis, hukum, kebijakan penerbit game, atau layanan pihak ketiga telah dihilangkan.

# 24. Persetujuan Pemilik Proyek

Dengan meninjau dan menyetujui dokumen ini, pemilik mengonfirmasi bahwa:

- [ ] Model usaha Single-Vendor telah benar.
- [ ] Struktur teknologi dan direktori telah diterima sebagai baseline.
- [ ] Alur pembayaran Telegram Stars melalui invoice resmi telah diterima.
- [ ] Pembayaran manual melalui alamat wallet XTR tidak termasuk ruang lingkup.
- [ ] Display Stock menampilkan stok aktual atau label yang diturunkan dari stok aktual.
- [ ] Sistem tidak mengelola pengiriman kredensial akun game.
- [ ] Penghitungan modal, margin, dan profit telah diterima.
- [ ] Batas produk dan pemeriksaan kepatuhan katalog telah dipahami.
- [ ] Tahapan, deliverables, dan kriteria penerimaan telah diterima.
- [ ] Daftar hal yang belum diketahui akan ditetapkan sebelum tahap terkait dimulai.

| Persetujuan | Isian |
|---|---|
| Nama pemilik proyek | ______________________________ |
| Tanggal persetujuan | ______________________________ |
| Versi dokumen yang disetujui | ______________________________ |
| Catatan/revisi | ______________________________ |
| Tanda tangan/persetujuan digital | ______________________________ |

---

# Lampiran A — Referensi Resmi

Referensi berikut menjadi rujukan implementasi dan harus diperiksa kembali ketika pengembangan atau operasional dilakukan karena dokumentasi dan ketentuan dapat berubah.

1. Telegram Bot Payments API untuk Digital Goods and Services: https://core.telegram.org/bots/payments-stars
2. Telegram Bot API: https://core.telegram.org/bots/api
3. Telegram Mini Apps dan validasi `initData`: https://core.telegram.org/bots/webapps
4. Telegram Terms of Service for Stars: https://telegram.org/tos/stars
5. Telegram Bot Platform Developer Terms: https://telegram.org/tos/bot-developers
6. Pendaftaran PSE Lingkup Privat Komdigi: https://pse.komdigi.go.id/pertanyaan-umum
7. UU Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022

## Lampiran B — Catatan Pembayaran Penting

- Digital goods/services yang dijual di dalam Telegram harus menggunakan Telegram Stars (`XTR`).
- Alur inti adalah `sendInvoice` → `pre_checkout_query` → `answerPreCheckoutQuery` → `successful_payment` → delivery.
- `telegram_payment_charge_id` harus disimpan untuk kebutuhan refund dan penelusuran transaksi.
- Bot harus menyediakan dukungan pembayaran melalui `/paysupport`.
- `initData` dari Mini App wajib diverifikasi di server; `initDataUnsafe` tidak boleh dipercaya sebagai sumber identitas.
- Harga jual yang direncanakan dalam rupiah harus dipetakan ke harga Stars secara terpisah dan ditinjau kembali sesuai biaya, konversi, serta penerimaan aktual.

---

**Akhir isi kontrak dasar v1.0 — dilanjutkan Addendum Revisi CR-01 v1.1 di bawah ini.**


# 25. Addendum CR-01 — Evaluasi Tiga Permintaan Revisi Pemilik

Addendum ini mencatat permintaan revisi yang disampaikan setelah draft v1.0. Addendum berlaku sebagai penjelasan dan pengganti ketentuan yang bertentangan di bagian sebelumnya. Status dokumen tetap **DRAFT** sampai pemilik menyetujui versi 1.1.

## 25.1 Katalog: pengiriman kredensial akun `Email:Pass`

**Permintaan:** sistem menerima dan mengirim segala jenis digital asset termasuk kredensial akun game tanpa memandang aturan penerbit.

**Keputusan:** tidak dapat diakomodasi untuk kredensial akun game, password, session token, cookie, OTP, atau recovery code, serta pemindahan kendali akun yang dilarang oleh penerbit/platform.

**Alternatif yang masuk ruang lingkup:** sistem tetap mendukung berbagai format payload digital yang hak jual dan hak pengalihannya dapat dibuktikan, seperti kode redeem, voucher, lisensi, gift code, file milik toko, dan instruksi layanan. Produk game yang memerlukan izin distributor harus menyimpan bukti otorisasi dan lolos pemeriksaan SKU sebelum status `ACTIVE`.

Rujukan kebijakan penerbit yang diperiksa saat revisi:

- Garena menyatakan jual beli akun Free Fire melanggar Terms of Service dan akun bersifat personal/non-transferable: https://ffsupport.garena.com/hc/en-us/articles/4501218599066-Account-Trading
- HoYoverse menyatakan akun tidak boleh ditransfer/dibagikan dan penjualan atau pemindahan kendali dapat memicu tindakan terhadap akun: https://genshin.hoyoverse.com/en-us/company/terms
- Roblox melarang penjualan akun atau kredensial akses pada Terms of Use: https://en.help.roblox.com/hc/en-us/articles/115004647846-Roblox-Terms-of-Use
- Ketentuan MLBB melarang perdagangan/penjualan Virtual Items di dalam atau di luar game kecuali secara tegas diizinkan Moonton: https://www.mobilelegends.com/news/articleldetail?newsid=2728920

Referensi tersebut menunjukkan bahwa kebijakan tidak seragam antar-game. Oleh karena itu, setiap tipe produk harus diperiksa berdasarkan ketentuan terbaru yang berlaku bagi game dan wilayah terkait.

## 25.2 Pembayaran: alamat wallet XTR manual

**Permintaan:** menambahkan opsi customer mengirim XTR ke wallet address secara manual agar biaya administrasi dapat dikelola sendiri.

**Keputusan:** tidak dapat diakomodasi sebagai metode pembayaran Mini App. Telegram mendokumentasikan pembayaran digital melalui invoice `sendInvoice` dengan currency `XTR`, diikuti `pre_checkout_query`, `answerPreCheckoutQuery`, dan `successful_payment`. Telegram Stars tidak menggunakan alamat wallet XTR untuk alur pembayaran manual tersebut.

**Alternatif yang masuk ruang lingkup:**

- Harga invoice XTR ditentukan oleh Owner per SKU.
- Biaya modal, biaya operasional, serta nilai penerimaan/pencairan dicatat terpisah pada laporan.
- Owner dapat mengelola asumsi valuasi IDR dan biaya untuk pelaporan tanpa mengubah protokol pembayaran Telegram.
- Pembayaran hanya dinyatakan berhasil setelah update `successful_payment` valid diterima dan diverifikasi backend.

Rujukan resmi:

- Telegram Bot Payments API for Digital Goods and Services: https://core.telegram.org/bots/payments-stars
- Telegram Bot API (`sendInvoice`, `answerPreCheckoutQuery`, `getMyStarBalance`, dan transaksi Stars): https://core.telegram.org/bots/api
- Telegram Terms of Service for Stars, termasuk batas penggunaan saldo Stars personal: https://telegram.org/tos/stars

## 25.3 Stok: Display Stock untuk pemasaran

**Permintaan:** Owner mengatur angka stok yang terlihat customer meskipun angka tersebut berbeda dari stok sebenarnya.

**Keputusan:** angka stok publik yang sengaja berbeda dari stok tersedia aktual tidak dapat diakomodasi karena menyesatkan customer dan dapat menghasilkan pesanan yang tidak dapat dipenuhi.

**Alternatif yang masuk ruang lingkup:** fitur `Display Stock` disediakan sebagai pengaturan tampilan dengan tiga mode:

| Mode | Tampilan kepada customer | Sumber data |
|---|---|---|
| `EXACT_COUNT` | Angka stok aktual, misalnya “Sisa 2” | Stok tersedia aktual |
| `IN_STOCK_ONLY` | “Tersedia” tanpa angka rinci | Stok tersedia aktual lebih dari 0 |
| `HIDE_COUNT` | Tidak menampilkan angka stok; tombol beli tetap mengikuti ketersediaan aktual | Stok tersedia aktual tetap menjadi validasi checkout |

Owner juga dapat menetapkan `low_stock_threshold`. Label “Stok terbatas” hanya ditampilkan jika jumlah stok tersedia aktual berada pada atau di bawah ambang tersebut. Stok yang telah direservasi untuk order aktif tidak dihitung sebagai stok bebas untuk dijual. Backend selalu menjadi sumber kebenaran dan menolak checkout bila stok aktual tidak tersedia.

## 25.4 Dampak terhadap keputusan pengembangan

Dengan CR-01, ruang lingkup yang dapat dilanjutkan adalah:

1. Katalog fleksibel untuk produk digital yang hak jual/pemenuhannya sah, tanpa pengelolaan kredensial akun game.
2. Pembayaran produk digital melalui invoice Telegram Stars resmi, tanpa alamat wallet XTR manual.
3. Display Stock dengan mode tampilan dan label stok rendah berbasis data inventaris aktual, tanpa angka stok palsu.

Karena ketiga permintaan awal tidak seluruhnya disetujui dalam bentuk yang diminta, **pengembangan implementasi belum dianggap mendapat persetujuan final dari pemilik**. Tahap coding dimulai setelah pemilik menyetujui versi 1.1 atau mengajukan revisi tertulis lanjutan.

## 25.5 Persetujuan Addendum CR-01

- [ ] Saya menerima pembatasan pengiriman kredensial akun game dan menyetujui tipe digital asset alternatif pada Bagian 25.1.
- [ ] Saya menerima pembayaran Telegram Stars melalui invoice resmi dan tanpa wallet address XTR manual.
- [ ] Saya menerima Display Stock yang menggunakan angka stok aktual atau label ketersediaan berdasarkan stok aktual.
- [ ] Saya menyetujui ruang lingkup v1.1 untuk menjadi acuan tahap implementasi.

| Persetujuan | Isian |
|---|---|
| Nama pemilik proyek | ______________________________ |
| Tanggal | ______________________________ |
| Versi disetujui | 1.1 — CR-01 |
| Catatan | ______________________________ |
| Tanda tangan/persetujuan digital | ______________________________ |

---

**Akhir dokumen — VAULT CORE Project Contract v1.2 (Draft Revisi CR-02)**


# 26. Addendum CR-02 — Permintaan Perubahan Operasional dan Keputusan Implementasi

**Tanggal:** 21 November 2026  
**Status:** Keputusan ruang lingkup teknis; menunggu persetujuan pemilik untuk penguncian kontrak.  
**Menggantikan:** Tidak menghapus CR-01. Bagian ini menjelaskan ulang keputusan untuk tiga permintaan yang diajukan setelah CR-01.

Pemilik meminta agar tiga kemampuan berikut dimasukkan: pengiriman Email:Password secara otomatis, alamat wallet XTR manual, dan `display_stock_override` yang dapat berbeda dari stok aktual. Permintaan dicatat seluruhnya. Keputusan implementasinya adalah sebagai berikut.

## 26.1 Sistem kredensial dan pengiriman payload digital

**Permintaan dicatat:** menyimpan string teks dan mengirimkannya otomatis setelah pembayaran.

**Keputusan implementasi:** VAULT CORE akan memiliki layanan digital fulfillment yang dapat menyimpan dan mengirim payload teks/kode untuk produk yang sah untuk dialihkan, termasuk redeem code, voucher, license key, gift code, kode aktivasi, dan instruksi layanan. Payload disimpan terenkripsi, hanya dapat diakses oleh service delivery yang berwenang, dan tidak dikirim sebelum pembayaran tervalidasi.

Sistem tidak akan menyediakan fitur untuk menjual atau mengirim paket kredensial `Email:Password` akun game, password email, session cookie/token, OTP, recovery code, atau data yang memberikan kendali atas akun pihak ketiga. Kolom bebas yang dapat dipakai untuk mengemas kredensial tersebut juga tidak akan ditambahkan. Tipe pemenuhan harus dipilih dari enum yang diizinkan dan SKU wajib melewati review sebelum aktif.

**Implementasi yang disetujui untuk tahap fondasi:**

- `fulfillment_type`: `REDEEM_CODE`, `VOUCHER_CODE`, `LICENSE_KEY`, `GIFT_CODE`, `DIGITAL_FILE`, `SERVICE_INSTRUCTIONS`.
- `payload_ciphertext`: ciphertext hasil enkripsi server-side; tidak ada plaintext di log, analytics, atau response admin list.
- `delivery_status`: `PENDING`, `READY`, `DELIVERED`, `FAILED`, `REVOKED`.
- Akses payload dicatat dalam audit log dan dibatasi berdasarkan order yang telah `PAID`.
- Idempotency key mencegah pengiriman ganda ketika webhook atau job diulang.

## 26.2 Fleksibilitas pembayaran dan alamat wallet XTR manual

**Permintaan dicatat:** menampilkan alamat wallet XTR manual agar pelanggan mengirim pembayaran langsung.

**Keputusan implementasi:** tidak ada alamat wallet XTR manual dalam checkout Telegram Mini App. Telegram Stars (`XTR`) adalah unit pembayaran Telegram Bot Platform yang diproses melalui invoice Bot API, bukan alamat tujuan wallet yang dapat diperlakukan seperti alamat transfer blockchain. Pembayaran digital di dalam Telegram harus memakai Telegram Stars sesuai ketentuan Telegram.

Implementasi v1 menyediakan provider pembayaran `TELEGRAM_STARS` melalui `sendInvoice`, `pre_checkout_query`, `answerPreCheckoutQuery`, dan update `successful_payment`. Sistem menyimpan `telegram_payment_charge_id`, `provider_payment_charge_id` jika tersedia, jumlah XTR, payload invoice, waktu, dan status verifikasi.

Arsitektur boleh menggunakan interface `PaymentProvider` agar provider lain dapat ditambahkan pada versi mendatang. Provider pembayaran eksternal hanya dapat diaktifkan untuk kanal dan jenis transaksi yang secara resmi mengizinkannya, dengan pemeriksaan kebijakan platform terlebih dahulu. Interface tersebut tidak mengubah checkout Mini App Telegram menjadi transfer wallet manual dan tidak boleh digunakan untuk menghindari kewajiban Stars atas digital goods/services di Telegram.

## 26.3 `display_stock_override`

**Permintaan dicatat:** Owner mengatur angka stok yang terlihat customer secara manual tanpa mengikuti stok database.

**Keputusan implementasi:** field bernama `display_stock_override` dapat disediakan hanya sebagai *display cap* yang tidak boleh melebihi stok tersedia aktual. Nilai override tidak menjadi sumber kebenaran checkout, tidak dapat membuat produk terlihat tersedia ketika stok aktual nol, dan tidak boleh menampilkan angka lebih besar dari stok yang benar-benar dapat dipenuhi.

Aturan:

```text
sellable_stock = max(0, on_hand - reserved - unavailable)
public_stock = min(display_stock_override, sellable_stock)  // bila override diatur
public_stock = sellable_stock                               // bila override null
```

Mode tampilan `EXACT_COUNT`, `IN_STOCK_ONLY`, dan `HIDE_COUNT` tetap tersedia. Label `LOW_STOCK` hanya dapat ditampilkan jika `sellable_stock` berada pada atau di bawah `low_stock_threshold`. Semua reservasi dan pengurangan stok menggunakan stok aktual secara atomik di database.

## 26.4 Keputusan yang masuk backlog implementasi

| Permintaan | Keputusan | Hasil implementasi |
|---|---|---|
| Penyimpanan/pengiriman string digital | Disetujui dengan batas tipe produk | Encrypted fulfillment untuk kode/voucher/lisensi/instruksi yang sah; bukan kredensial akun game |
| Wallet XTR manual | Tidak dapat diterapkan sebagai metode XTR | Invoice Telegram Stars resmi; payment-provider interface untuk integrasi lain yang sah di kanal yang sesuai |
| `display_stock_override` bebas | Disetujui terbatas | Display cap yang tidak melebihi stok tersedia aktual; checkout selalu memakai stok aktual |

## 26.5 Dampak pada jadwal dan pelaksanaan

Fondasi proyek dapat mulai dikerjakan pada ruang lingkup yang disetujui: struktur direktori, konfigurasi, koneksi database, migrasi awal, validasi Telegram Mini App, katalog, inventaris aktual, order, dan interface pembayaran Telegram Stars. Modul delivery menggunakan tipe payload yang diizinkan pada Bagian 26.1.

Fitur yang tidak disetujui dalam bentuk yang diminta tidak akan dibangun. Setiap perluasan yang sah dapat diajukan sebagai change request dengan deskripsi use case, kanal, bukti hak distribusi, dampak teknis, dan pemeriksaan kebijakan terkait.

## 26.6 Persetujuan Addendum CR-02

- [ ] Saya menerima encrypted delivery untuk kode/voucher/lisensi/instruksi digital yang sah, dengan pengecualian kredensial akun game dan data autentikasi.
- [ ] Saya menerima invoice Telegram Stars resmi untuk transaksi digital di Telegram; tidak menggunakan alamat wallet XTR manual.
- [ ] Saya menerima `display_stock_override` sebagai display cap yang tidak dapat melebihi stok tersedia aktual.
- [ ] Saya menyetujui fondasi teknis Tahap 1 dimulai berdasarkan ruang lingkup v1.2.

| Persetujuan | Isian |
|---|---|
| Nama pemilik proyek | ______________________________ |
| Tanggal | ______________________________ |
| Versi disetujui | 1.2 — CR-02 |
| Catatan | ______________________________ |
| Tanda tangan/persetujuan digital | ______________________________ |

---

**Akhir dokumen — VAULT CORE Project Contract v1.2 (Draft Revisi CR-02)**
