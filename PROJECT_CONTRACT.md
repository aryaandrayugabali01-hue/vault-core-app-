# VAULT CORE
## Kontrak Spesifikasi Produk, Teknis, dan Pelaksanaan Proyek

| Informasi | Nilai |
|---|---|
| Nama proyek | VAULT CORE |
| Jenis dokumen | Kontrak spesifikasi dan acuan pelaksanaan proyek |
| Versi | 1.6 — Addendum CR-11 (Authorized Account Credentials) |
| Tanggal dokumen | 27 November 2026 |
| Status | Baseline v1.2, CR-03, CR-04, CR-05, CR-09, CR-10, dan CR-11 disetujui melalui instruksi tertulis pemilik; CR-11 menyelaraskan ketentuan kredensial akun dengan dukungan transfer akun bersyarat, 27 November 2026 |
| Model usaha | Single-Vendor Store |
| Kanal utama | Telegram Bot dan Telegram Mini App |
| Domain rencana | `vaultcore.biz.id` (belum dikonfirmasi kepemilikannya dan konfigurasi DNS-nya) |

> **Kedudukan dokumen.** Dokumen ini menjadi acuan ruang lingkup, arsitektur, perilaku sistem, dan kriteria penerimaan VAULT CORE. Dokumen ini bukan pendapat hukum atau pengganti kontrak jasa profesional yang ditandatangani para pihak. Perubahan terhadap ruang lingkup atau perilaku yang telah disetujui harus dicatat sebagai revisi dokumen atau change request.
>
 > **Rekaman persetujuan pemilik:** Status v1.2 CR-02 ditetapkan DISETUJUI berdasarkan instruksi tertulis pemilik proyek. Addendum CR-03 pada Bagian 27 disetujui pada 21 November 2026, CR-04 pada 22 November 2026, dan CR-05 pada 23 November 2026 melalui instruksi tertulis pemilik di percakapan proyek. Rekaman ini menetapkan keputusan operasional internal Owner, bukan sertifikasi hukum atau pengesampingan hak pihak ketiga. Nama legal dan sertifikat tanda tangan elektronik formal tidak tercantum dalam rekaman percakapan.
>
> **Riwayat revisi:** v1.1 menilai CR-01; v1.2 mencatat CR-02; v1.3 menetapkan akuntansi aplikasi XTR-only dan fixture uji melalui CR-03; v1.4 menetapkan dukungan bersyarat transfer akun melalui CR-04; v1.5 melalui CR-05 menetapkan Owner sebagai otoritas internal untuk pencatatan, penilaian internal, persetujuan, rincian katalog, stok, metode pemenuhan, dan pengiriman. v1.6 melalui CR-11 menyelaraskan ketentuan kredensial pada Bagian 3.3 dan 7.6 dengan dukungan transfer akun pada CR-04; kewajiban eksternal, pembayaran XTR, dan sumber stok aktual tetap berlaku.

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
- **Gold** — produk utama; harga jual dan modal ditentukan langsung per SKU dalam XTR.
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

## 3.3 Dukungan akun game, kredensial, dan pemeriksaan SKU

VAULT CORE mendukung katalog, penyimpanan inventaris, pemrosesan, dan pemenuhan akun game pihak ketiga, termasuk kredensial akses akun seperti `Email:Password`, sepanjang Owner menyatakan dan mencatat dasar kepemilikan atau kewenangan penjualan serta metode transfer yang digunakan. Ketentuan ini menggantikan larangan menyeluruh terhadap format kredensial akun pada versi sebelumnya dan harus dibaca bersama Addendum CR-04 Bagian 28 serta CR-11.

Ketentuan operasional:

- Kredensial yang memang diperlukan untuk menyerahkan akun kepada pembeli dapat disimpan sebagai payload inventaris terenkripsi dan dikirim melalui alur delivery yang terotorisasi.
- Data autentikasi tambahan seperti cookie, session token, OTP, recovery code, backup code, atau password email pribadi tidak otomatis termasuk dalam payload akun. Data tersebut hanya boleh diproses bila secara khusus diperlukan untuk metode transfer yang sah, berada dalam kewenangan Owner, dan memiliki kontrol keamanan serta retensi yang sesuai.
- Sistem dilarang menggunakan kredensial untuk mengambil alih akun tanpa kewenangan, melewati autentikasi, menghindari kontrol keamanan penerbit, atau mengakses akun di luar tujuan pemenuhan yang disetujui.
- Produk, item virtual, atau aset lain yang diperoleh melalui cara yang dilarang penerbit/platform tetap tidak dapat dijual.
- Penggunaan merek, gambar, logo, dan materi berhak cipta tetap harus memiliki dasar penggunaan yang sesuai.
- Customer tidak boleh diminta memberikan password utama atau kode autentikasi akun pribadinya kepada operator untuk menerima layanan.

Setiap SKU akun dimulai sebagai `DRAFT` atau `PENDING_REVIEW`. Sebelum aktivasi, Owner wajib mencatat dasar kepemilikan/kewenangan sumber, ketentuan penerbit yang relevan, metode transfer, wilayah, dan hasil pemeriksaan per game/SKU sesuai CR-04 dan CR-05. Deklarasi Owner mengesahkan keputusan internal, tetapi tidak menghapus ketentuan penerbit, hukum, atau hak pihak ketiga. Jika transfer secara tegas dilarang atau sumber tidak memiliki kewenangan yang dinyatakan, SKU harus ditahan dan tidak boleh dijual.

Pemeriksaan dilakukan per game dan per SKU karena ketentuan penerbit dapat berbeda dan berubah. Kategori katalog bukan persetujuan otomatis untuk setiap SKU.

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
- Harga ditampilkan hanya dalam XTR.
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
- Harga modal dan biaya internal dicatat dalam XTR.
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
- Isi delivery dapat berupa kode/lisensi, instruksi resmi, detail layanan, atau payload akun game terenkripsi yang disetujui untuk transfer berdasarkan CR-04 dan CR-11. Kredensial hanya dapat diakses oleh Owner/layanan delivery berwenang setelah pembayaran valid dan pemeriksaan order terpenuhi.

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

## 8.6 Harga dan pelaporan XTR

Seluruh nilai moneter internal VAULT CORE menggunakan satu satuan, yaitu XTR. Harga jual, harga modal, biaya operasional, snapshot order, omzet, refund, margin, dan laba dicatat serta ditampilkan dalam XTR. Harga pada invoice harus sama dengan harga jual SKU yang berlaku pada saat order dibuat.

- `sale_price_xtr` adalah harga jual per unit.
- `cost_price_xtr` adalah biaya modal per unit yang ditetapkan Owner.
- Biaya operasional dicatat langsung dalam XTR.
- Order menyimpan snapshot harga jual dan modal dalam XTR agar perubahan harga produk tidak mengubah histori.
- Laporan menampilkan penerimaan, refund, biaya, dan saldo bersih dalam XTR berdasarkan transaksi Telegram yang terverifikasi.
- Sistem tidak mengonversi atau menampilkan nilai mata uang lain.

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
- `sale_price_xtr`
- `cost_price_xtr`
- `compliance_status`, `is_active`
- `stock_policy`, `delivery_type`
- `created_at`, `updated_at`

## 9.3 InventoryItem

- `id`, `product_id`
- `inventory_code` atau identifier stok non-rahasia
- `cost_xtr_snapshot`
- `status` (`AVAILABLE`, `RESERVED`, `SOLD`, `DISABLED`)
- `secret_payload_encrypted` hanya untuk kode redeem, lisensi, voucher, atau payload digital sah yang memang harus dirahasiakan
- `created_at`, `updated_at`, `sold_at`

Tidak ada kolom, form admin, API, atau mekanisme delivery untuk penyimpanan password akun game, cookie, session token, OTP, recovery code, atau kredensial pengambilalihan akun. Payload digital yang diizinkan harus dienkripsi, ditampilkan hanya kepada pemesan yang berhak, dan dibatasi aksesnya.

## 9.4 Order dan OrderItem

Order:

- `id`, `order_number`, `customer_id`
- `status`, `subtotal_xtr`, `total_xtr`
- `total_xtr`
- `created_at`, `expires_at`, `paid_at`, `completed_at`

OrderItem:

- `id`, `order_id`, `product_id`, `inventory_item_id` (jika diperlukan)
- `sku_snapshot`, `name_snapshot`, `quantity`
- `unit_price_xtr_snapshot`
- `unit_cost_xtr_snapshot`
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

- **Penjualan bruto (XTR)** = total transaksi Stars yang berhasil dan belum dikurangi refund.
- **Modal barang (XTR)** = snapshot biaya inventaris yang benar-benar terjual.
- **Biaya lain (XTR)** = biaya operasional yang dicatat Owner.
- **Profit kotor (XTR)** = penjualan bersih setelah refund − modal barang.
- **Profit bersih (XTR)** = profit kotor − biaya operasional.
- **Margin kotor (%)** = profit kotor ÷ penjualan bersih setelah refund × 100.

Seluruh laporan, saldo, nilai order, biaya, dan laba menggunakan XTR. Tidak ada konversi ke mata uang lain di aplikasi.

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
- [ ] Harga, modal, biaya, refund, dan laporan konsisten menggunakan XTR.
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
2. Konfirmasi domain `vaultcore.biz.id`, registrar, dan akses DNS.
3. Provider hosting produksi dan lokasi database.
4. Apakah PostgreSQL dikelola sendiri atau menggunakan layanan terkelola.
5. Daftar final SKU yang telah lolos pemeriksaan hak penjualan.
6. Harga XTR tiap SKU dan aturan penetapan ulang harga.
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
- Harga jual tiap SKU ditetapkan langsung dalam XTR dan digunakan sebagai dasar invoice Stars.

---

**Akhir isi kontrak dasar v1.0 — dilanjutkan Addendum Revisi CR-01 v1.1 di bawah ini.**


# 25. Addendum CR-01 — Evaluasi Tiga Permintaan Revisi Pemilik

Addendum ini mencatat permintaan revisi yang disampaikan setelah draft v1.0. Addendum berlaku sebagai penjelasan dan pengganti ketentuan yang bertentangan di bagian sebelumnya. Pada saat Addendum CR-01 diterbitkan, status dokumen masih **DRAFT** sampai versi 1.1 disetujui. Status terkini telah diperbarui menjadi **DISETUJUI PEMILIK** untuk versi 1.2 CR-02 berdasarkan rekaman persetujuan pada Bagian 26.6.

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
- Owner mencatat harga modal dan biaya operasional langsung dalam XTR tanpa konversi mata uang di aplikasi.
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

**Akhir Addendum CR-01 — riwayat revisi yang kini menjadi bagian dari VAULT CORE Project Contract v1.2 CR-02.**


# 26. Addendum CR-02 — Permintaan Perubahan Operasional dan Keputusan Implementasi

**Tanggal:** 21 November 2026  
**Status:** DISETUJUI PEMILIK melalui instruksi tertulis pada percakapan proyek, 21 November 2026; menjadi baseline kontrak v1.2 CR-02.  
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

- [x] Saya menerima encrypted delivery untuk kode/voucher/lisensi/instruksi digital yang sah, dengan pengecualian kredensial akun game dan data autentikasi.
- [x] Saya menerima invoice Telegram Stars resmi untuk transaksi digital di Telegram; tidak menggunakan alamat wallet XTR manual.
- [x] Saya menerima `display_stock_override` sebagai display cap yang tidak dapat melebihi stok tersedia aktual.
- [x] Saya menyetujui fondasi teknis Tahap 1 dimulai berdasarkan ruang lingkup v1.2.

| Persetujuan | Isian |
|---|---|
| Nama pemilik proyek | Pemilik proyek; nama legal belum dicantumkan dalam rekaman percakapan |
| Tanggal | 21 November 2026 |
| Versi disetujui | 1.2 — CR-02 |
| Catatan | Persetujuan tertulis diberikan melalui instruksi eksplisit pemilik pada percakapan proyek; mencakup butir 26.1–26.5 dan dimulainya fondasi teknis Tahap 1. |
| Tanda tangan/persetujuan digital | Persetujuan tertulis melalui percakapan proyek pada 21 November 2026; sertifikat/tanda tangan elektronik formal tidak tercatat. |

---

**Akhir dokumen — VAULT CORE Project Contract v1.2 (CR-02, DISETUJUI PEMILIK).**

# 27. Addendum CR-03 — XTR-Only dan Produk Contoh Uji

**Tanggal:** 21 November 2026  
**Status:** Disetujui melalui instruksi tertulis pemilik di percakapan proyek.  
**Berlaku untuk:** Mini App customer, Owner Console, API, bot, database, laporan, dokumentasi operasional, dan pengujian.

## 27.1 Satu satuan nilai uang

VAULT CORE menggunakan **XTR saja** pada seluruh aplikasi dan pencatatan internal. Harga jual, modal, biaya operasional, total order, snapshot item, refund, laporan, margin, dan laba dicatat serta ditampilkan dalam XTR. Tidak ada kolom harga, modal, biaya, konversi, atau tampilan nominal mata uang lain dalam model aplikasi aktif.

Rumus:
- Penjualan bersih = penjualan XTR − refund XTR.
- Profit kotor = penjualan bersih XTR − modal barang XTR.
- Profit bersih = profit kotor XTR − biaya operasional XTR.
- Margin kotor = profit kotor ÷ penjualan bersih × 100%.

Nilai biaya internal dalam XTR merupakan satuan pembukuan internal VAULT CORE, bukan pernyataan nilai pencairan atau kurs eksternal. Pembayaran pelanggan tetap diverifikasi melalui successful_payment Telegram Stars.

## 27.2 Produk contoh uji internal

Owner Console menyediakan tindakan untuk membuat empat produk contoh pada kategori MLBB, Roblox, Free Fire, dan Genshin Impact. Semua produk contoh:
- Menggunakan SKU berawalan TEST- dan nama TEST ONLY.
- Memiliki is_test = true dan referensi internal INTERNAL_TEST_FIXTURE_ONLY.
- Berstatus awal DRAFT, sehingga belum tampil di katalog customer.
- Menggunakan tipe pemenuhan SERVICE_INSTRUCTIONS dengan payload dummy terenkripsi yang jelas bukan kode penukaran.
- Memiliki harga uji 1 XTR dan modal 0 XTR.

Owner dapat mengaktifkan satu produk contoh ketika siap menjalankan pengujian checkout. Produk akan tampil dengan label CONTOH UJI. Aktivasi contoh tidak memberikan hak untuk menjual aset game sungguhan dan tidak mengubah SKU komersial. Pembelian melalui invoice produksi tetap merupakan pembayaran Stars nyata sebesar harga yang tercantum; label uji tidak mengubah sifat pembayaran tersebut.

## 27.3 File inventaris yang ditolak

File unggahan kredensial_sku_produk.csv berisi 24 entri berupa paket Email:Password. Seluruh nilai kredensial dikecualikan dari inventaris dan tidak dimasukkan ke database. Daftar sanitasi hanya mempertahankan identitas SKU dan status penolakan tanpa nilai kredensial. Kandidat pemetaan SKU dalam file sanitasi hanya referensi terhadap katalog; status komersial tetap DRAFT/PENDING_REVIEW sampai hak penjualan/pemenuhan diverifikasi.

## 27.4 Kriteria penerimaan CR-03

- [ ] Harga, modal, biaya, order, transaksi, refund, dan laporan hanya menggunakan XTR.
- [ ] Checkout tidak memerlukan kolom harga mata uang lain.
- [ ] Produk contoh dibuat sebagai DRAFT, ditandai is_test, dan stok dummy dienkripsi.
- [ ] Produk contoh customer menampilkan label CONTOH UJI setelah diaktifkan.
- [ ] Payload inventaris tetap menolak paket Email:Password dan data autentikasi.
- [ ] Produk contoh tidak disajikan sebagai aset komersial atau kode penukaran sungguhan.

---

**Akhir baseline historis v1.3 (CR-03); ketentuan terbaru untuk transfer akun game ditetapkan dalam Addendum CR-04 di Bagian 28.**



# 28. Addendum CR-04 — Dukungan Bersyarat untuk Transfer Akun Game yang Diotorisasi

**Tanggal:** 22 November 2026  
**Status:** Perubahan ruang lingkup diminta dan disetujui pemilik melalui instruksi tertulis untuk merevisi kontrak.  
**Mengubah:** Bagian 3.3, 7.6, 25.1, 26.1, dan 27.3 sepanjang terdapat pertentangan. Ketentuan lain tetap berlaku.

## 28.1 Keputusan ruang lingkup

VAULT CORE dapat mendukung katalog dan pemenuhan produk berupa akun game hanya apabila transfer atau penjualan akun tersebut secara tegas diperbolehkan oleh penerbit/platform yang bersangkutan, dan pemilik toko dapat membuktikan hak untuk menjual serta memindahkan akun itu kepada pembeli.

Dengan ketentuan tersebut, larangan mutlak terhadap seluruh format Email:Password di bagian terdahulu diubah menjadi pembatasan berbasis otorisasi. Format kredensial bukan bukti bahwa suatu transaksi diizinkan. Pernyataan vendor seperti “Internal Vendor Verified” saja tidak memenuhi syarat bukti.

## 28.2 Syarat wajib sebelum SKU akun diaktifkan

Setiap SKU dan sumber stok wajib memiliki catatan pemeriksaan yang memuat:

1. Game, penerbit, wilayah, dan jenis akun yang akan dialihkan.
2. Tautan ketentuan resmi penerbit/platform yang berlaku pada tanggal pemeriksaan.
3. Bukti tertulis dari penerbit atau program transfer resmi yang secara jelas mengizinkan penjualan/pengalihan akun, jika ketentuan publik tidak secara eksplisit mengizinkannya.
4. Bukti rantai kepemilikan dan kewenangan vendor untuk menjual serta mengalihkan setiap akun.
5. Prosedur transfer resmi, batasan wilayah, dan kewajiban pengungkapan kepada pembeli.
6. Tanggal pemeriksaan, identitas pemeriksa, hasil, serta masa berlaku bukti.

Jika ketentuan penerbit melarang jual-beli atau pengalihan akun, atau bukti otorisasi tidak tersedia, SKU terkait tetap PENDING_REVIEW/PAUSED dan tidak boleh dijual atau dikirim. Persetujuan pemilik toko tidak mengesampingkan ketentuan penerbit, hukum, atau aturan platform.

## 28.3 Tipe pemenuhan dan perlindungan data

Untuk SKU yang lolos Bagian 28.2, sistem dapat menambahkan tipe pemenuhan GAME_ACCOUNT_TRANSFER melalui perubahan skema dan validasi backend yang terpisah. Payload akun wajib:

- Dienkripsi dengan enkripsi kuat di sisi server saat disimpan dan saat dikirim melalui kanal yang aman.
- Tidak dicatat dalam log, analytics, error trace, atau daftar inventaris biasa.
- Hanya dapat diakses oleh layanan delivery setelah pembayaran valid dan order memenuhi syarat.
- Memiliki audit log untuk akses, perubahan, pembatalan, dan pengiriman.
- Dihapus atau dinonaktifkan sesuai kebijakan retensi setelah transfer selesai, sepanjang kewajiban audit dan hukum mengizinkan.
- Tidak mencakup email pribadi vendor atau kredensial pihak lain yang tidak diperlukan untuk transfer. Cookie, session token, OTP, recovery code, dan backup code tidak boleh disertakan secara default; pengecualian memerlukan kebutuhan transfer terdokumentasi, kewenangan yang jelas, kontrol akses khusus, dan dasar yang sah.

Sistem tidak boleh mengambil alih akun, melewati autentikasi, mengubah kepemilikan tanpa prosedur resmi, atau membantu menghindari mekanisme keamanan penerbit. Bila transfer resmi tidak membutuhkan pengiriman password, sistem wajib menggunakan metode transfer resmi tersebut.

## 28.4 Status produk dan inventaris

- SKU baru bertipe akun dimulai sebagai DRAFT atau PENDING_REVIEW.
- Produk hanya dapat menjadi ACTIVE setelah bukti pada Bagian 28.2 diverifikasi Owner dan pemeriksaan teknis selesai.
- Setiap unit inventaris harus memiliki referensi sumber/vendor dan status pemeriksaan yang dapat diaudit.
- Stok yang bukti hak transfernya kedaluwarsa, dicabut, atau diperselisihkan otomatis tidak dapat dijual sampai pemeriksaan ulang selesai.
- Pengujian menggunakan data dummy yang jelas tidak dapat digunakan untuk login atau mengambil alih akun. Kredensial akun sungguhan tidak boleh dipakai sebagai fixture UAT.

## 28.5 Penerapan terhadap katalog yang diajukan

Daftar MLBB, Roblox/Blox Fruit, Free Fire, dan Genshin Impact yang diajukan pemilik dapat dicatat sebagai kandidat katalog, bukan otomatis disetujui untuk penjualan. Status kelayakan masing-masing game/SKU saat Addendum ini dibuat adalah belum diketahui dan wajib diverifikasi berdasarkan bukti penerbit yang berlaku.

Referensi vendor internal saja tidak membuktikan bahwa penerbit mengizinkan penjualan atau transfer akun. Jika suatu penerbit melarangnya, kategori akun game tersebut tidak dapat diaktifkan di VAULT CORE.

## 28.6 Pekerjaan implementasi lanjutan

Persetujuan perubahan kontrak ini tidak berarti kode produksi sudah mendukung tipe baru. Sebelum impor inventaris atau transaksi komersial, implementasi harus melalui:
1. Review kebijakan dan bukti transfer per game/SKU.
2. Perubahan enum/schema, validasi payload, enkripsi, kontrol akses, audit log, dan alur delivery.
3. Uji keamanan dengan fixture non-login, lalu UAT Owner.

Pembayaran tetap mengikuti ketentuan CR-03: transaksi produk digital di Telegram menggunakan invoice Telegram Stars (XTR) resmi. Tidak ada perubahan pada aturan pembayaran, pencatatan XTR, atau sumber stok aktual.

## 28.7 Rekaman persetujuan

| Informasi | Nilai |
|---|---|
| Perubahan yang diminta | Mengubah kontrak agar mendukung katalog akun game dan format kredensial secara bersyarat |
| Keputusan | Disetujui sebagai ruang lingkup bersyarat sesuai Bagian 28.1–28.6 |
| Tanggal instruksi | 22 November 2026 |
| Bukti persetujuan | Instruksi tertulis pemilik melalui percakapan proyek |
| Nama legal/tanda tangan elektronik formal | Belum tercatat |

---



# 29. Addendum CR-05 — Owner Product Authority dan Pengelolaan Pemenuhan Internal

**Tanggal:** 23 November 2026  
**Status:** Disetujui melalui instruksi tertulis pemilik di percakapan proyek.  
**Mengubah:** Bagian 4.2, 7.2, 7.3, 25.1, 28.2, dan 28.4 sejauh mengatur alur persetujuan internal, pencatatan bukti, kewenangan katalog, dan pemenuhan. Jika terdapat pertentangan pada tata kelola internal, CR-05 yang berlaku; batas hak eksternal dan ketentuan penerbit tetap berlaku.  
**Berlaku untuk:** katalog, formulir input produk, pemeriksaan internal, hak distribusi yang dicatat, harga, detail produk, inventaris, metode pemenuhan, pengiriman, API, database, Owner Console, audit log, dan prosedur operasional.

## 29.1 Kewenangan internal Owner

Owner VAULT CORE merupakan pemegang keputusan internal tunggal dan bertanggung jawab penuh atas seluruh siklus hidup setiap SKU, mulai dari sebelum produk dimasukkan ke katalog sampai pesanan dipenuhi. Kewenangan internal Owner mencakup:

1. Menentukan apakah SKU akan dibuat, ditampilkan, ditunda, dijeda, diaktifkan, diubah, atau diarsipkan.
2. Mengisi dan mengesahkan seluruh rincian SKU: identitas, kategori, tier, nama, deskripsi, media, harga jual, modal, ketentuan, wilayah, masa berlaku, sumber produk, dan keterangan pelanggan.
3. Menentukan dasar hak/sumber produk, vendor, bukti pendukung, rantai sumber, dan hasil pemeriksaan internal.
4. Menentukan metode pemenuhan yang sesuai dengan jenis produk, prosedur kerja, referensi sumber, stok, dan instruksi kepada pelanggan.
5. Menambahkan, mengubah status, menonaktifkan, atau menarik unit inventaris serta mengelola pemenuhan pesanan.
6. Menyetujui, menolak, memperbarui, atau mencabut persetujuan internal berdasarkan informasi dan bukti yang tersedia.
7. Menentukan pemeriksa internal, catatan pemeriksaan, tanggal peninjauan ulang, dan masa berlaku keputusan internal.

Sistem tidak mengambil keputusan bisnis tersebut secara otomatis. Sistem menyediakan validasi kelengkapan, batas keamanan, pencatatan, riwayat, dan penguncian transaksi. Akun Admin hanya dapat menjalankan kewenangan yang secara teknis diberikan oleh Owner; pada implementasi saat ini endpoint Owner/Admin tetap dilindungi pemeriksaan Owner server-side.

## 29.2 Arti persetujuan internal dan batas hak eksternal

Status pemeriksaan `APPROVED` berarti **Owner telah menyetujui SKU secara internal** berdasarkan deklarasi, sumber, dokumen, dan informasi yang dicatat. Status tersebut bukan opini hukum, bukan sertifikat dari penerbit, dan bukan jaminan bahwa pihak ketiga mengakui hak distribusi.

Kewenangan Owner berlaku untuk pengelolaan internal VAULT CORE. Kewenangan internal tidak dengan sendirinya menciptakan kepemilikan, lisensi, izin penjualan, atau hak transfer yang tidak dimiliki toko; tidak menghapus ketentuan penerbit/platform; dan tidak mengesampingkan hukum yang berlaku. Untuk produk pihak ketiga, Owner wajib memilih dasar hak yang benar dan mencatat bukti yang relevan. Bila ketentuan penerbit melarang penjualan/transfer atau bukti yang diwajibkan tidak tersedia, Owner tidak boleh menyatakan bahwa hak eksternal telah diperoleh. Produk harus ditahan, ditolak, atau dijeda sesuai hasil pemeriksaan.

## 29.3 Catatan hak produk terstruktur

Setiap SKU komersial wajib memiliki catatan pemeriksaan internal terstruktur yang terhubung langsung ke produk. Catatan mencakup sekurang-kurangnya:

| Field | Aturan pencatatan |
|---|---|
| SKU | Diambil dari produk yang sedang diperiksa |
| Rights basis | OWNER_CREATED, OWNER_OWNED, AUTHORIZED_VENDOR, OFFICIAL_DISTRIBUTION, LICENSED_CONTENT, SERVICE, atau OTHER |
| Publisher/platform | Nama penerbit/platform atau INTERNAL_OWNER bila memang produk dibuat/dimiliki internal |
| Official terms URL | Diisi untuk produk yang tunduk pada ketentuan penerbit/platform |
| Authorization evidence reference | Referensi dokumen/URL/nomor otorisasi bila dasar hak bergantung pada otorisasi pihak lain |
| Chain of title | Sumber produk dan urutan perolehan/kewenangan; tidak boleh dikarang |
| Transfer method | Metode pemenuhan/transfer yang benar-benar akan dilakukan |
| Region | Wilayah penggunaan/transfer yang disetujui Owner berdasarkan informasi yang tersedia |
| Reviewer | ID Telegram Owner yang melakukan pemeriksaan, ditetapkan server |
| Reviewed at | Waktu pemeriksaan, ditetapkan server |
| Valid until | Batas peninjauan ulang/masa berlaku keputusan internal |
| Review status | PENDING / APPROVED / REJECTED / EXPIRED |
| Review notes | Catatan alasan dan batasan pemeriksaan |
| Owner attestation | Pernyataan Owner bahwa data yang dimasukkan benar dan ia bertanggung jawab atas keputusan internal |

Field yang bersifat kondisional wajib diisi saat relevan dengan dasar hak. Referensi vendor internal saja tidak boleh ditampilkan sebagai otorisasi penerbit. Sistem menyimpan riwayat pemeriksaan dan perubahan status secara append-only untuk audit. Reviewer dan timestamp tidak dapat ditentukan atau ditimpa dari input browser.

## 29.4 Siklus kerja SKU

1. SKU dibuat dalam status DRAFT atau PENDING_REVIEW.
2. Owner melengkapi identitas produk, deskripsi, rincian penawaran, sumber, dasar hak, metode pemenuhan, wilayah, dan catatan pemeriksaan.
3. Owner mengirim pemeriksaan dan memilih hasil PENDING, APPROVED, atau REJECTED. APPROVED memerlukan deklarasi Owner dan field wajib yang lengkap sesuai dasar hak.
4. Aktivasi komersial hanya dapat dilakukan setelah catatan pemeriksaan internal terkini berstatus APPROVED dan belum melewati valid_until, metode pemenuhan tersedia, serta pemeriksaan teknis dan persediaan memenuhi aturan.
5. Owner dapat menjeda produk atau membuat pemeriksaan baru. Pemeriksaan PENDING, REJECTED, atau EXPIRED mengunci penjualan dan pengiriman baru.
6. Ketika masa berlaku pemeriksaan lewat, SKU tidak lagi memenuhi syarat katalog, checkout, pre-checkout, atau delivery sampai Owner melakukan pemeriksaan ulang.

## 29.5 Keterikatan sumber dan persediaan

Setiap unit inventaris komersial harus memiliki referensi sumber/vendor atau referensi asal internal yang dapat diaudit dan terhubung ke catatan pemeriksaan hak produk yang berlaku saat unit ditambahkan. Sistem tidak boleh menerima stok komersial tanpa referensi sumber serta pemeriksaan internal APPROVED yang masih berlaku. Perubahan atau kedaluwarsa pemeriksaan tidak boleh membuat stok lama otomatis kembali dapat dijual; unit terkait tetap tertahan sampai Owner menyelesaikan pemeriksaan ulang.

Data fixture TEST ONLY tetap menggunakan jalur uji internal yang terpisah, tidak memerlukan bukti komersial, dan tidak boleh dicampurkan dengan katalog atau persediaan komersial.

## 29.6 Bukti dan penyimpanan

Bukti tidak boleh dibuat-buat. Sistem menyimpan metadata pemeriksaan, URL, nomor dokumen, atau referensi bukti yang dimasukkan Owner. Unggahan berkas hanya dapat diaktifkan setelah tersedia object storage yang sudah dikonfigurasi dan diotorisasi pada infrastruktur proyek. Sampai penyimpanan tersebut tersedia, aplikasi tidak boleh mengklaim bahwa berkas biner telah diunggah atau disimpan; Owner menggunakan URL/referensi bukti yang dapat diakses dan dapat diaudit.

## 29.7 Pembayaran, keamanan, dan pemenuhan

CR-05 tidak mengubah kontrak pembayaran: barang/jasa digital di Telegram tetap menggunakan invoice Telegram Stars (`XTR`) resmi, dan hanya `successful_payment` yang tervalidasi yang menandai order sebagai PAID. CR-05 tidak mengizinkan pengiriman tanpa pembayaran valid, pengiriman ganda, penggunaan ulang stok, atau pencatatan kredensial autentikasi yang tidak diperlukan. Setiap proses tambah stok, aktivasi, perubahan pemeriksaan, penahanan stok, pengiriman, dan rekonsiliasi wajib menghasilkan audit log.

## 29.8 Penerapan ke katalog yang sudah ada

CR-05 tidak mengaktifkan SKU komersial secara otomatis dan tidak mengubah harga, modal, atau status produk yang telah tersimpan. Dua belas SKU contoh komersial tetap PENDING_REVIEW sampai Owner mengisi rincian dan membuat keputusan internal untuk masing-masing SKU. Empat fixture TEST ONLY tetap pada status yang sudah ada.

## 29.9 Kriteria penerimaan CR-05

- Owner menjadi otoritas internal untuk seluruh keputusan katalog, rincian produk, pemeriksaan internal, inventaris, dan pemenuhan.
- Semua keputusan hak internal disimpan terstruktur per SKU, dengan reviewer, timestamp, masa berlaku, status, dan riwayat.
- APPROVED hanya dapat dicatat setelah deklarasi Owner serta field wajib sesuai dasar hak terpenuhi.
- Aktivasi dan checkout menolak catatan yang tidak lengkap, ditolak, kedaluwarsa, atau tidak lagi terkini.
- Setiap unit inventaris komersial mempunyai referensi sumber dan terikat pada pemeriksaan hak yang berlaku.
- Bukti yang tidak diberikan tidak boleh diisi dengan data buatan atau ditampilkan sebagai telah diverifikasi.
- Dua belas SKU komersial tidak berubah status secara otomatis.
- Fixture internal, Telegram Stars XTR, keamanan stok, dan jalur delivery tetap terpisah serta konsisten.

---




# 30. Addendum — Import Katalog Produk Game dari Workbook Owner

**Tanggal:** 23 November 2026  
**Sumber data:** `Katalog_Produk_Game_Unofficial.xlsx` yang diberikan Owner.  
**Ruang lingkup:** 16 listing katalog, rentang harga IDR, metode penyerahan, spesifikasi, ketentuan pembeli, kategori, dan SOP transaksi.

## 30.1 Data yang diimpor

Sebanyak 16 listing telah dimasukkan ke database produksi:

- Mobile Legends: 4 listing (`ML-001` sampai `ML-004`).
- Roblox: 4 listing (`RBX-001` sampai `RBX-004`).
- Free Fire: 4 listing (`FF-001` sampai `FF-004`).
- Genshin Impact: 4 listing (`GI-001` sampai `GI-004`).

Rincian nama, deskripsi, subkategori sumber, metode penyerahan, rentang harga minimum/maksimum IDR, serta ketentuan pembeli mengikuti workbook. SOP lima tahap transaksi juga disimpan pada panduan kategori.

## 30.2 Tanggung jawab Owner

Owner menyatakan bahwa pemeriksaan sumber produk, ketepatan penawaran, kewenangan vendor, hak distribusi/transfer, ketentuan penerbit, wilayah, dan metode pemenuhan merupakan tanggung jawab Owner. VAULT CORE mencatat keputusan internal Owner, menyediakan validasi, kontrol transaksi, dan jejak audit.

Pernyataan tanggung jawab Owner tidak dengan sendirinya menjadi bukti kepemilikan atau otorisasi pihak penerbit. Dasar hak dan bukti eksternal yang diwajibkan CR-05 tetap dicatat secara jujur sesuai keadaan tiap SKU. Sistem tidak boleh menandai bukti yang belum diberikan sebagai sudah diverifikasi.

## 30.3 Harga dan status transaksi

- Rentang harga pada workbook adalah IDR dan ditampilkan sebagai rentang indikatif.
- Workbook tidak memberikan harga checkout Telegram Stars (XTR) final per SKU.
- Nilai teknis `sale_price_xtr=1` pada 16 record adalah placeholder database, bukan harga jual, tidak ditampilkan sebagai harga komersial, dan tidak membuat SKU dapat dibeli.
- Seluruh 16 listing tetap `PENDING_REVIEW`, tidak memiliki stok komersial, dan tidak dapat di-checkout atau dikirim.
- Harga checkout XTR, modal, sumber/vendor, hak, masa berlaku review, dan stok komersial harus ditetapkan Owner sebelum aktivasi.

## 30.4 Kategori Mobile Legends

Navigasi MLBB menyediakan empat tab: Akun, Skin, Gift Hero, dan Gift Item. Workbook memuat listing Akun dan Gift Skin; tidak ada produk yang secara eksplisit masuk Gift Hero atau Gift Item. Kategori tanpa produk tetap ditampilkan sebagai kategori kosong. Listing Squad Verified tetap dicatat sebagai Asset Transfer sesuai istilah sumber dan tidak dipaksakan menjadi Gift Hero/Gift Item.

## 30.5 Uji transaksi

Uji checkout tetap memakai empat fixture internal `TEST ONLY`, terpisah dari 16 listing komersial. Fixture memakai payload non-redeemable dan hanya satu fixture dapat diaktifkan pada satu waktu. Invoice uji bernilai 1 XTR dan merupakan pembayaran Telegram Stars sungguhan bila diselesaikan. Tidak ada transaksi uji yang dijalankan sebagai bagian dari import ini.

## 30.6 Kriteria penerimaan

- 16 listing tersimpan dan terbaca melalui endpoint katalog publik sebagai pratinjau.
- Produk pratinjau dapat dibuka untuk melihat detail, tetapi tombol pembelian/keranjang terkunci.
- Harga rentang IDR ditampilkan tanpa menganggapnya sebagai harga checkout XTR.
- Semua listing tetap `PENDING_REVIEW` dengan stok komersial nol.
- Fixture uji tetap terpisah dari listing komersial.


# 31. Addendum CR-09 — Harga XTR, modal Owner, dan checkout komersial

**Tanggal:** 23 November 2026  
**Dasar instruksi:** Owner secara eksplisit menetapkan modal 0 XTR, menyatakan persyaratan sumber/hak distribusi/transfer terpenuhi, dan menegaskan tanggung jawab sumber serta hak distribusi berada pada Owner.  
**Implementasi:** 16 SKU komersial pada daftar katalog produksi.

## 31.1 Persetujuan internal Owner

- Keenam belas SKU memiliki catatan pemeriksaan CR-05 `APPROVED`, `owner_attested=true`, reviewer Owner ID Telegram yang terdaftar, timestamp server, masa review sampai 23 November 2027, dan event append-only.
- Referensi deklarasi Owner: `VC-OWNER-ATTESTATION-20261123-01`.
- Catatan menyatakan dokumen sumber/otorisasi pendukung berada dalam arsip Owner dan tidak diserahkan pada sesi implementasi. Dengan demikian status adalah persetujuan internal berbasis attestation Owner, bukan verifikasi independen atau sertifikat dari penerbit.
- Referensi Terms resmi penerbit dicatat per platform. Ketentuan penerbit tetap berlaku dan tidak diubah oleh persetujuan internal Owner.

## 31.2 Modal dan harga checkout

- Modal `cost_price_xtr` untuk seluruh 16 SKU ditetapkan Owner sebesar **0 XTR**.
- Harga jual `sale_price_xtr` ditetapkan dari harga pasar IDR dalam workbook menggunakan referensi **Rp375 per XTR**, dibulatkan ke atas ke bilangan XTR bulat.
- Jumlah referensi katalog: Rp38.359.090 atau 102.297 XTR untuk 16 listing.
- Referensi konversi hanya untuk penetapan harga katalog; harga konsumen aktual Telegram dapat berubah menurut platform, wilayah, pajak, atau penyedia pembayaran.

## 31.3 Checkout dan persediaan

- Seluruh 16 SKU berstatus `ACTIVE` dengan tepat satu unit stok tersedia per SKU dan referensi sumber yang terhubung ke pemeriksaan hak saat ini.
- Slot `OWNER_MANUAL_FULFILLMENT` adalah kapasitas pemenuhan yang disediakan Owner, bukan kode redeem atau kredensial dummy.
- Setelah Telegram mengonfirmasi pembayaran XTR, aplikasi mengirimkan acknowledgement dan menahan delivery pada `REVIEW_REQUIRED`.
- Owner menyerahkan produk aktual melalui metode yang tercantum untuk SKU, kemudian mengonfirmasi status `DELIVERED` di Owner Console. Setelah rekonsiliasi, inventaris menjadi `SOLD` dan order menjadi `FULFILLED`.
- Jika produk tidak dapat diserahkan, Owner menggunakan alur refund Stars yang tersedia atau menahan order untuk rekonsiliasi.
- Dashboard komersial mengecualikan fixture TEST sehingga metrik persediaan/penjualan komersial tidak tercampur dengan empat stok uji.

## 31.4 Status penerimaan

- 16 SKU aktif dan dapat membuat invoice Telegram Stars XTR.
- 16/16 slot stok tersedia, satu per SKU.
- Modal 0 XTR pada seluruh SKU.
- 17 kategori marketplace aktif.
- Pada saat addendum ini dicatat, belum ada order, transaksi, atau delivery pelanggan produksi; uji pembayaran pelanggan dan pengiriman manual aktual masih perlu dilakukan.



# 32. Addendum CR-10 — Kanal Transaksi Tunggal Telegram Mini App

**Tanggal:** 23 November 2026  
**Keputusan Owner:** Seluruh transaksi VAULT CORE wajib dilakukan melalui VAULT CORE Telegram Mini App dengan pembayaran Telegram Stars (`XTR`). Website publik hanya berfungsi sebagai katalog dan halaman detail penawaran.

## 32.1 Batas fungsi website publik

- Website publik boleh menampilkan kategori, produk, spesifikasi, ketentuan, harga dalam XTR, dan panduan pembelian.
- Website publik bukan kanal pembuatan pesanan, checkout, pembayaran, penerimaan dana, atau konfirmasi transaksi.
- Customer diarahkan membuka VAULT CORE melalui bot Telegram untuk melanjutkan pembelian.

## 32.2 Kanal transaksi resmi

- Customer membuat pesanan hanya di VAULT CORE Telegram Mini App dengan identitas Telegram yang tervalidasi.
- Backend membuat invoice resmi Telegram Stars Bot API dengan mata uang `XTR`.
- `successful_payment` yang tervalidasi server adalah satu-satunya bukti pembayaran yang mengubah pesanan menjadi PAID.
- Harga, jumlah, ketersediaan stok, dan total akhir diperiksa ulang oleh backend ketika pesanan dibuat dan sebelum pre-checkout disetujui.
- Status, riwayat pesanan, dan informasi pemenuhan ditampilkan melalui Mini App.

## 32.3 Metode yang tidak diterima

VAULT CORE tidak menyediakan atau mengakui pembayaran melalui Rekber/Escrow pihak ketiga, transfer bank, transfer langsung ke Owner/penjual, pembayaran ke rekening pribadi, alamat wallet XTR manual, atau metode pembayaran di luar invoice resmi Telegram Stars. Instruksi pembayaran di luar Mini App tidak dapat dianggap sebagai transaksi VAULT CORE.

## 32.4 Alur pembelian dan pemenuhan

1. Customer membaca spesifikasi dan ketentuan pada katalog.
2. Customer membuka Mini App melalui bot Telegram, memilih produk, dan membuat pesanan.
3. Backend memvalidasi harga dan stok, lalu mengeluarkan invoice Telegram Stars XTR.
4. Telegram mengirimkan successful_payment; backend memvalidasi dan mencatat pembayaran secara idempoten.
5. Customer memantau status di menu Pesanan. Pemenuhan dilakukan sesuai metode produk setelah pembayaran terverifikasi; status akhir dicatat oleh sistem.
6. Kendala pembayaran diarahkan ke jalur bantuan pembayaran Telegram (`/paysupport`).

## 32.5 Panduan pembelian katalog

Panduan kategori tidak boleh memuat instruksi Rekber, transfer bank, direct transfer, pencairan dana penjual, takeover akun, atau metode transaksi pihak ketiga. Seluruh kategori menggunakan instruksi yang konsisten: pemeriksaan detail produk, checkout di Telegram Mini App, pembayaran invoice XTR, dan pemantauan status/pemenuhan melalui Mini App. Customer tidak boleh diminta membagikan password, OTP, kode pemulihan, atau kredensial autentikasi.

## 32.6 Kriteria penerimaan

- Katalog web hanya menampilkan produk dan detail; seluruh transaksi dilakukan di Telegram Mini App.
- Tidak ada panduan Rekber/Escrow atau transfer di seluruh kategori aktif.
- Invoice pembayaran menggunakan mata uang XTR resmi Telegram.
- Order hanya berubah menjadi PAID setelah successful_payment terverifikasi server.
- Riwayat dan status transaksi customer tersedia melalui Mini App.
- UI, panduan kategori, README, dan kontrak menyampaikan aturan yang sama.

---

# 33. Addendum CR-11 — Penyelarasan Dukungan Kredensial Akun Game

**Tanggal:** 27 November 2026  
**Status:** Disetujui melalui instruksi tertulis Owner pada percakapan proyek.  
**Mengubah:** Bagian 3.3 dan 7.6 serta ketentuan payload pada Bagian 28.3. Jika terdapat pertentangan mengenai dukungan teknis kredensial akun, CR-11 berlaku bersama CR-04 dan CR-05.

## 33.1 Keputusan

VAULT CORE secara eksplisit mendukung inventaris dan pemenuhan akun game pihak ketiga yang disediakan oleh Owner/vendor, termasuk penyimpanan dan pengiriman kredensial akses akun yang diperlukan untuk penyerahan akun kepada pembeli. Dengan demikian, tidak ada lagi larangan kontraktual menyeluruh yang mengecualikan kredensial akun game hanya karena formatnya berupa Email:Password.

## 33.2 Kewenangan dan tanggung jawab Owner

Owner bertanggung jawab memastikan sumber akun, kepemilikan atau kewenangan vendor, hak untuk menjual/menyerahkan, wilayah, metode transfer, dan informasi yang disampaikan kepada pembeli. Owner mencatat deklarasi dan referensi sumber per SKU/unit inventaris. Persetujuan internal Owner tidak menciptakan hak yang tidak dimiliki dan tidak membatalkan larangan eksplisit penerbit, hukum, atau hak pihak ketiga.

## 33.3 Pengamanan kredensial

- Kredensial akun yang diperlukan untuk penyerahan disimpan terenkripsi; tidak boleh muncul pada log, analytics, error trace, katalog publik, ekspor laporan umum, atau daftar inventaris biasa.
- Akses dibatasi pada Owner/layanan delivery yang berwenang dan hanya untuk tujuan pemenuhan order yang sah.
- Setiap akses, perubahan, dan pengiriman dicatat dalam audit log tanpa merekam nilai rahasia kredensial.
- Password email pribadi, cookie, session token, OTP, recovery code, dan backup code tidak menjadi bagian payload secara otomatis. Pemrosesan pengecualian memerlukan alasan operasional terdokumentasi, kewenangan yang jelas, dan kontrol keamanan khusus.
- Kredensial tidak boleh digunakan untuk takeover tanpa izin, bypass autentikasi, atau akses di luar proses transfer yang dinyatakan.

## 33.4 Status implementasi

CR-11 mengubah persyaratan kontrak dan menjadi dasar implementasi. Persetujuan kontrak ini tidak dengan sendirinya membuktikan bahwa seluruh API, database, Owner Console, enkripsi, delivery, dan audit log produksi telah mendukung penyimpanan/pengiriman kredensial. Kesiapan teknis harus diverifikasi dan diselesaikan sebelum kredensial akun nyata dimasukkan ke inventaris komersial.

## 33.5 Kriteria penerimaan

- Bagian 3.3 tidak lagi melarang seluruh format kredensial akun game.
- Bagian 7.6 mengizinkan payload akun terenkripsi sesuai CR-04/CR-11.
- Ketentuan 28.3 konsisten dengan pemrosesan kredensial yang diperlukan.
- Kredensial tidak bocor ke katalog, log, analytics, error trace, atau ekspor umum.
- Owner memiliki kontrol akses dan audit untuk akses serta delivery.
- Pembayaran tetap Telegram Stars (`XTR`) dan delivery tetap mensyaratkan pembayaran valid.

---

**Akhir dokumen — VAULT CORE Project Contract v1.6 (CR-11).**
