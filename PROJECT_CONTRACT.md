# VAULT CORE
## Kontrak Spesifikasi Produk, Teknis, dan Pelaksanaan Proyek

| Informasi | Nilai |
|---|---|
| Nama proyek | VAULT CORE |
| Jenis dokumen | Kontrak spesifikasi dan acuan pelaksanaan proyek |
| Versi | 2.3 — CR-18 Green Visual System and Dashboard Promo Board |
| Tanggal dokumen | 28 November 2026 |
| Status | CR-18 menetapkan sistem visual hijau dan papan promo Dashboard; CR-17 menghapus filter penerbit dari aktivasi/penjualan internal; CR-15 tetap mengatur QRIS website dan XTR Telegram Mini App |
| Model usaha | Single-Vendor Store |
| Kanal utama | Website, Telegram Bot, dan Telegram Mini App |
| Domain rencana | `vaultcore.biz.id` (belum dikonfirmasi kepemilikannya dan konfigurasi DNS-nya) |

> **Kedudukan dokumen.** Dokumen ini menjadi acuan ruang lingkup, arsitektur, perilaku sistem, dan kriteria penerimaan VAULT CORE. Dokumen ini bukan pendapat hukum atau pengganti kontrak jasa profesional yang ditandatangani para pihak. Perubahan terhadap ruang lingkup atau perilaku yang telah disetujui harus dicatat sebagai revisi dokumen atau change request.
>
 > **Rekaman persetujuan pemilik:** Status v1.2 CR-02 ditetapkan DISETUJUI berdasarkan instruksi tertulis pemilik proyek. Addendum CR-03 pada Bagian 27 disetujui pada 21 November 2026, CR-04 pada 22 November 2026, dan CR-05 pada 23 November 2026 melalui instruksi tertulis pemilik di percakapan proyek. Rekaman ini menetapkan keputusan operasional internal Owner, bukan sertifikasi hukum atau pengesampingan hak pihak ketiga. Nama legal dan sertifikat tanda tangan elektronik formal tidak tercantum dalam rekaman percakapan.
>
> **Riwayat revisi:** v1.1 menilai CR-01; v1.2 mencatat CR-02; v1.3 menetapkan akuntansi aplikasi XTR-only dan fixture uji melalui CR-03; v1.4 menetapkan dukungan bersyarat transfer akun melalui CR-04; v1.5 melalui CR-05 menetapkan Owner sebagai otoritas internal untuk pencatatan, penilaian internal, persetujuan, rincian katalog, stok, metode pemenuhan, dan pengiriman. v1.6 melalui CR-11 menyelaraskan dukungan akun dengan CR-04. v1.7 melalui CR-12 menetapkan pemenuhan akun manual maksimal 1 jam tanpa penyimpanan kredensial. v1.8 melalui CR-13 menetapkan kebijakan keterlambatan/refund, struktur varian, dan prosedur import massal. v1.9 melalui CR-14 menandai keputusan lama yang telah digantikan sebagai historis, menyelaraskan SLA READY/INDENT dan kriteria penerimaan; v2.0 melalui CR-15 menetapkan QRIS statis sementara untuk website, mempertahankan XTR di Telegram Mini App, serta mengunci satu identitas, sumber data, dan standar visual bersama. v2.1 melalui CR-16 menetapkan form produk terpadu satu halaman, penyimpanan dan publikasi satu aksi, serta standar visual Dashboard/Katalog/Detail Produk. v2.2 melalui CR-17 menghapus gerbang penerbit dari aktivasi dan penjualan SKU akun.

---

# 1. Tujuan Proyek

VAULT CORE adalah toko digital **Single-Vendor** yang diakses melalui website, Telegram Bot, dan Telegram Mini App. Seluruh katalog, persediaan, harga jual, harga modal, pemrosesan pesanan, pembayaran, pemenuhan pesanan, layanan pelanggan, dan laporan usaha dikelola oleh satu pemilik toko.

Tujuan pengembangan:

1. Menyediakan katalog digital yang mudah digunakan melalui Telegram.
2. Memisahkan kategori game dan tingkatan produk agar katalog tidak menjadi satu daftar panjang.
3. Mengelola stok secara terpusat dan mencegah penjualan melebihi stok tersedia.
4. Memproses pembayaran website melalui QRIS statis IDR untuk sementara, dan pembayaran di Telegram Mini App melalui Telegram Stars (XTR) sesuai ketentuan Telegram.
5. Memenuhi pesanan setelah pembayaran terverifikasi, dengan pencatatan transaksi yang dapat diaudit.
6. Menyediakan dashboard pemilik untuk mengelola produk, persediaan, pesanan, modal, harga jual, margin, keuntungan, refund, dan laporan.
7. Menargetkan pengalaman penggunaan yang cepat, responsif, aman, dan nyaman di perangkat Android.

# 2. Prinsip dan Keputusan yang Dikunci

| Area | Keputusan proyek |
|---|---|
| Model toko | Single-Vendor; tidak ada pendaftaran penjual lain |
| Pemilik stok | Pemilik VAULT CORE |
| Kanal penjualan | Website, Telegram Bot, dan Telegram Mini App |
| Frontend | Next.js / React |
| Backend | Node.js + Express |
| Bot | Telegraf / Telegram Bot API |
| Database | PostgreSQL |
| Pembayaran website | QRIS statis merchant, mata uang `IDR`, sementara dan tunduk pada CR-15 |
| Pembayaran Telegram Mini App | Telegram Stars, mata uang `XTR` |
| Hak akses | Customer dan Owner/Admin |
| Pengelolaan katalog | Owner/Admin |
| Pengelolaan modal | Owner/Admin; nilai historis transaksi tidak berubah ketika modal produk diperbarui |
| Pengiriman | Produk non-akun mengikuti metode delivery SKU; akun game diserahkan manual oleh Owner maksimal 1 jam setelah pembayaran sukses tanpa penyimpanan kredensial di sistem |
| Tampilan stok | Jumlah publik harus bersumber dari stok tersedia aktual; mode tampilan dapat menyembunyikan angka rinci tanpa memalsukan jumlah |
| Pembayaran | Website: QRIS statis IDR sementara; Telegram Mini App: invoice Telegram Stars XTR. Tidak ada alamat wallet XTR manual |
| Laporan | Penjualan, biaya/modal, margin, profit, refund, dan rekonsiliasi dipisahkan berdasarkan mata uang IDR atau XTR |
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

Struktur katalog ditentukan oleh kombinasi game, kategori produk, tipe produk, dan varian. Untuk produk akun, varian dapat berupa `POLOS`, `LOW`, `MID`, `HIGH`, atau `SULTAN` sesuai karakteristik game dan definisi SKU. Status kesiapan akun menggunakan `READY` (unit tersedia dan dapat dipenuhi) atau `INDENT` (pesanan dengan tenggat pemenuhan yang diumumkan sebelum checkout). Label pemasaran seperti entry-level, premium, atau pilihan Owner boleh digunakan sebagai atribut tampilan, bukan struktur varian wajib.

Ketersediaan suatu jenis produk untuk dijual tetap melewati pemeriksaan ketentuan penerbit game, hak sumber, aturan platform, dan hukum yang berlaku.

## 3.2 Jenis produk yang dapat didukung

Sistem katalog fleksibel pada tingkat tipe data dan metode pemenuhan, tetapi setiap SKU tetap harus memiliki dasar hak penjualan/pemenuhan yang dapat dibuktikan. Tipe produk yang dapat didukung meliputi:

- Kode redeem, voucher, lisensi, gift code, atau kode digital yang sah untuk dialihkan.
- Top-up atau pembelian item melalui jalur resmi/berwenang.
- Layanan digital seperti coaching, pelatihan, jasa push-rank yang tidak meminta kredensial utama, atau layanan lain yang telah diperiksa dan diperbolehkan.
- File, akses, atau konten digital milik toko yang memiliki hak distribusi.
- Instruksi pemenuhan atau kode klaim yang memang diterbitkan untuk dapat dipindahtangankan.

Sistem boleh menyimpan dan mengirim payload digital terenkripsi untuk tipe produk yang disetujui, misalnya kode redeem atau lisensi. Fleksibilitas format data tidak berarti seluruh jenis kredensial atau aset pihak ketiga otomatis layak dijual.

## 3.3 Dukungan akun game, kredensial, dan pemeriksaan SKU

VAULT CORE mendukung katalog dan pemenuhan akun game pihak ketiga sepanjang Owner mencatat dasar sumber/kewenangan serta metode transfer. Sistem tidak menerima atau menyimpan kredensial akun; setelah pembayaran sukses, Owner menyerahkan informasi akses secara manual melalui kanal privat di luar aplikasi. Ketentuan ini harus dibaca bersama CR-04, CR-12, dan CR-13.

Ketentuan operasional:

- Kredensial akun tidak disimpan dalam database, inventaris, backend, cache, log, analytics, atau penyimpanan aplikasi VAULT CORE. Setelah pembayaran sukses, Owner menyerahkan kredensial secara manual melalui kanal privat.
- VAULT CORE tidak meminta, menerima, memproses, atau menyimpan cookie, session token, OTP, recovery code, backup code, atau password email pribadi. Informasi akses yang diperlukan untuk penyerahan akun disampaikan Owner secara manual melalui kanal privat di luar sistem.
- Sistem dilarang menggunakan kredensial untuk mengambil alih akun tanpa kewenangan, melewati autentikasi, menghindari kontrol keamanan penerbit, atau mengakses akun di luar tujuan pemenuhan yang disetujui.
- Produk, item virtual, atau aset lain yang diperoleh melalui cara yang dilarang penerbit/platform tetap tidak dapat dijual.
- Penggunaan merek, gambar, logo, dan materi berhak cipta tetap harus memiliki dasar penggunaan yang sesuai.
- Customer tidak boleh diminta memberikan password utama atau kode autentikasi akun pribadinya kepada operator untuk menerima layanan.

Setiap SKU akun dimulai sebagai `DRAFT` atau `PENDING_REVIEW`. Sebelum aktivasi, Owner wajib mencatat dasar kepemilikan/kewenangan sumber, ketentuan penerbit yang relevan, metode transfer, wilayah, dan hasil pemeriksaan per game/SKU sesuai CR-04 dan CR-05. Deklarasi Owner mengesahkan keputusan internal, tetapi tidak menghapus ketentuan penerbit, hukum, atau hak pihak ketiga. Jika ketentuan penerbit secara eksplisit melarang penjualan atau transfer, atau Owner tidak memiliki dasar kewenangan sumber yang layak, SKU wajib ditahan dan tidak boleh dijual. Jika ketentuan resmi tidak secara tegas membahas penjualan akun, Owner mencatat kondisi tersebut dan risiko yang diketahui dalam review; surat izin penerbit tidak menjadi syarat universal kecuali diwajibkan oleh ketentuan yang berlaku atau dasar hak yang diklaim.

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

1. Customer memilih game/kategori.
2. Sistem menampilkan tipe produk dan varian yang tersedia, termasuk status READY atau INDENT untuk produk akun.
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

- Pemenuhan hanya dimulai setelah pembayaran valid (`successful_payment`) tercatat.
- Produk non-akun mengikuti metode delivery yang ditetapkan pada SKU.
- Untuk produk akun game, delivery dilakukan secara manual oleh Owner, bukan otomatis oleh backend/bot.
- Untuk akun `READY`, batas penyerahan manual maksimal 1 (satu) jam sejak timestamp `successful_payment` terverifikasi.
- Untuk akun `INDENT`, batas penyerahan adalah tenggat maksimum dalam hari kalender yang ditampilkan sebelum checkout dan disimpan sebagai snapshot `fulfillment_due_at`; SLA satu jam tidak berlaku pada pesanan INDENT.
- Sistem membuat tugas pemenuhan manual, memberi notifikasi kepada Owner, dan menampilkan status kepada customer.
- Status minimum: `PAID_PENDING_MANUAL_DELIVERY`, `PROCESSING`, `DELIVERED`, `OVERDUE`, dan `REVIEW_REQUIRED`.
- Sistem mencatat order ID, referensi customer, waktu pembayaran, tenggat, waktu penyerahan, status, dan aktor Owner.
- Isi kredensial tidak disimpan pada database, inventaris, backend, cache, log, analytics, error trace, backup, atau ekspor.
- Owner memeriksa kecocokan penerima dengan order lalu menyampaikan kredensial secara manual melalui kanal privat.
- Jika tenggat yang berlaku terlewati (satu jam untuk READY atau `fulfillment_due_at` untuk INDENT), sistem menandai `OVERDUE` dan memberi notifikasi eskalasi kepada Owner. Penanganan/refund mengikuti Bagian 36.3.
- Status `DELIVERED` hanya dapat dicatat setelah Owner mengonfirmasi penyerahan manual.

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
- `secret_payload_encrypted` hanya untuk kode redeem, lisensi, atau voucher sah non-akun yang memang harus dirahasiakan
- `created_at`, `updated_at`, `sold_at`

Tidak ada kolom, form admin, API, atau mekanisme delivery untuk menerima atau menyimpan kredensial akun game maupun data autentikasi terkait. Untuk akun, sistem hanya menyimpan metadata order dan status pemenuhan manual. Penyimpanan payload rahasia hanya berlaku bagi kode redeem/lisensi/voucher non-akun yang sah.

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
- [ ] Game, tipe produk, varian, dan status READY/INDENT tampil sesuai konfigurasi katalog.
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
- [ ] Sistem tidak menerima, memproses, menyimpan, atau mengirim kredensial akun. Owner menyerahkan akses akun secara manual di luar aplikasi setelah pembayaran sukses, sesuai SLA READY/INDENT pada Bagian 7.6 dan 36.3.
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

**Keputusan historis CR-01 (telah digantikan CR-04, CR-12, CR-13, dan CR-14):** pada saat itu dukungan akun game ditolak. Keputusan tersebut tidak lagi menjadi larangan menyeluruh atas katalog akun. Ketentuan yang berlaku sekarang: VAULT CORE dapat mencatat dan menjual SKU akun yang lolos review sumber/hak sesuai Bagian 28 dan 36.2; sistem tidak menerima atau menyimpan kredensial; Owner menyerahkan akses secara manual di luar aplikasi. SKU yang secara eksplisit dilarang penerbit atau tidak memiliki dasar sumber/kewenangan yang layak tetap tidak boleh dijual.

**Catatan historis:** alternatif payload non-akun (kode redeem, voucher, lisensi, gift code, file milik toko, dan instruksi layanan) tetap didukung sesuai haknya. Bukti izin distributor diwajibkan hanya jika disyaratkan penerbit atau dasar hak yang diklaim, bukan sebagai syarat universal.

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

**Keputusan implementasi historis CR-02 (ketentuan akun telah digantikan CR-12/CR-13/CR-14):** layanan digital fulfillment tetap dapat menyimpan dan mengirim payload teks/kode non-akun yang sah, seperti redeem code, voucher, license key, gift code, kode aktivasi, dan instruksi layanan. Payload non-akun disimpan terenkripsi dan dikirim hanya setelah pembayaran tervalidasi.

Larangan CR-02 atas katalog/penyerahan akun sebagai kategori menyeluruh telah digantikan. Ketentuan akun yang berlaku adalah: SKU akun dapat dicatat dan dijual setelah review sumber/hak internal sesuai Bagian 28 dan 36.2; aplikasi tidak menerima atau menyimpan kredensial; Owner menyerahkan informasi akses manual melalui kanal privat di luar aplikasi setelah pembayaran sukses. Password email pribadi, cookie, session token, OTP, recovery code, dan backup code tidak boleh dimasukkan ke sistem atau workbook.

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

**Status saat ini:** Pernyataan XTR-only pada bagian ini telah diubah oleh CR-15 untuk transaksi website. Ketentuan XTR tetap berlaku untuk Telegram Mini App; pembukuan website menggunakan IDR secara terpisah.

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

VAULT CORE dapat mendukung katalog dan pemenuhan akun game pihak ketiga berdasarkan penilaian internal Owner atas sumber, rantai perolehan, kewenangan penjualan/penyerahan, ketentuan penerbit/platform, wilayah, dan metode transfer. Ketentuan ini tidak mensyaratkan surat izin penerbit secara universal. Apabila ketentuan resmi secara eksplisit melarang penjualan atau transfer, SKU tersebut tidak boleh diaktifkan. Apabila ketentuan tidak jelas atau tidak secara khusus membahas penjualan akun, Owner wajib mencatat ketentuan yang ditemukan, dasar kewenangan sumber, dan risiko sebelum menetapkan keputusan internal. Keputusan internal Owner tidak mengubah atau mengesampingkan ketentuan eksternal maupun hukum.

Dengan ketentuan tersebut, format kredensial akun tidak menjadi objek penyimpanan sistem. Kelayakan SKU ditentukan oleh dasar sumber, kewenangan Owner, dan ketentuan penerbit/platform. Pernyataan vendor seperti “Internal Vendor Verified” saja tidak membuktikan izin penerbit atau hak transfer.

## 28.2 Syarat wajib sebelum SKU akun diaktifkan

Setiap SKU dan sumber stok wajib memiliki catatan pemeriksaan yang memuat:

1. Game, penerbit, wilayah, dan jenis akun yang akan dialihkan.
2. Tautan ketentuan resmi penerbit/platform yang berlaku pada tanggal pemeriksaan.
3. Bukti izin tertulis penerbit/program resmi bila diwajibkan oleh ketentuan penerbit atau diperlukan oleh dasar hak yang diklaim. Jika tidak diwajibkan/tersedia, catat ketentuan publik dan dasar kewenangan sumber tanpa mengklaim ada izin penerbit.
4. Bukti rantai kepemilikan dan kewenangan vendor untuk menjual serta mengalihkan setiap akun.
5. Prosedur transfer resmi, batasan wilayah, dan kewajiban pengungkapan kepada pembeli.
6. Tanggal pemeriksaan, identitas pemeriksa, hasil, serta masa berlaku bukti.

Jika ketentuan penerbit secara eksplisit melarang jual-beli atau pengalihan akun, atau dasar kewenangan sumber tidak dapat dinyatakan secara layak, SKU tetap PENDING_REVIEW/PAUSED. Jika ketentuan publik tidak jelas, Owner mencatat ketidakjelasan dan risiko untuk keputusan internal; APPROVED internal bukan izin penerbit. Persetujuan pemilik toko tidak mengesampingkan ketentuan penerbit, hukum, atau aturan platform.

## 28.3 Tipe pemenuhan dan perlindungan data

Untuk SKU akun yang lolos pemeriksaan Bagian 28.2, gunakan tipe pemenuhan OWNER_MANUAL_ACCOUNT_DELIVERY dengan aturan berikut:

- VAULT CORE tidak menyimpan kredensial akun dalam database, inventaris, backend, cache, log, analytics, error trace, backup, atau ekspor.
- Setelah pembayaran Telegram Stars sukses terverifikasi, Owner menyerahkan kredensial secara manual melalui kanal privat paling lambat 1 (satu) jam sejak timestamp pembayaran sukses.
- Sistem hanya menyimpan metadata order, status pemenuhan, timestamp pembayaran, timestamp penyerahan, dan aktor Owner; isi kredensial tidak boleh direkam.
- Owner memastikan penerima sesuai dengan customer/order yang telah dibayar.
- Jika penyerahan melewati tenggat, order ditandai terlambat dan dieskalasikan kepada Owner untuk penyelesaian atau refund sesuai kebijakan.
- VAULT CORE tidak meminta atau menyimpan email pribadi vendor, cookie, session token, OTP, recovery code, atau backup code. Tidak ada pengecualian pemrosesan data tersebut di dalam sistem.

Sistem tidak boleh mengambil alih akun, melewati autentikasi, mengubah kepemilikan tanpa prosedur resmi, atau membantu menghindari mekanisme keamanan penerbit. Bila transfer resmi tidak membutuhkan pengiriman password, sistem wajib menggunakan metode transfer resmi tersebut.

## 28.4 Status produk dan inventaris

- SKU baru bertipe akun dimulai sebagai DRAFT atau PENDING_REVIEW.
- Produk hanya dapat menjadi ACTIVE setelah bukti pada Bagian 28.2 diverifikasi Owner dan pemeriksaan teknis selesai.
- Setiap unit inventaris harus memiliki referensi sumber/vendor dan status pemeriksaan yang dapat diaudit.
- Stok yang bukti hak transfernya kedaluwarsa, dicabut, atau diperselisihkan otomatis tidak dapat dijual sampai pemeriksaan ulang selesai.
- Pengujian menggunakan data dummy yang jelas tidak dapat digunakan untuk login atau mengambil alih akun. Kredensial akun sungguhan tidak boleh dipakai sebagai fixture UAT.

## 28.5 Penerapan terhadap katalog yang diajukan

Daftar MLBB, Roblox/Blox Fruit, Free Fire, dan Genshin Impact yang diajukan pemilik dapat dicatat sebagai kandidat katalog, bukan otomatis disetujui untuk penjualan. Status kelayakan masing-masing game/SKU saat Addendum ini dibuat adalah belum diketahui dan wajib diverifikasi berdasarkan bukti penerbit yang berlaku.

Referensi vendor internal saja tidak membuktikan bahwa penerbit mengizinkan penjualan atau transfer akun. Jika suatu penerbit secara eksplisit melarang penjualan atau transfer akun, SKU yang bersangkutan tidak dapat diaktifkan di VAULT CORE. Penilaian dilakukan per SKU/game/wilayah, bukan dengan asumsi seluruh kategori otomatis dilarang atau otomatis diizinkan.

## 28.6 Pekerjaan implementasi lanjutan

Persetujuan perubahan kontrak ini tidak berarti kode produksi sudah mendukung tipe baru. Sebelum transaksi komersial, implementasi harus melalui:
1. Pencatatan review sumber dan ketentuan per game/SKU.
2. Status READY/INDENT, antrean tugas pemenuhan manual, notifikasi Owner, SLA, dan audit metadata tanpa kredensial.
3. Uji pembayaran, notifikasi, status, tenggat, dan konfirmasi manual menggunakan fixture non-login, lalu UAT Owner.

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

**Status saat ini:** Bagian ini menjadi rekaman historis sejauh membatasi website hanya sebagai katalog atau melarang QRIS website. Ketentuan tersebut telah diubah oleh CR-15 pada Bagian 37. Persyaratan XTR untuk Telegram Mini App tetap berlaku.

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

# 33. Addendum CR-11 — Riwayat Perubahan Dukungan Kredensial Akun Game (DIUBAH OLEH CR-12/CR-13)

**Tanggal:** 27 November 2026  
**Status:** Disetujui melalui instruksi tertulis Owner pada percakapan proyek.  
**Status:** riwayat historis, telah digantikan CR-12 dan CR-13. Jika terdapat pertentangan, ketentuan CR-12/CR-13/CR-14 yang lebih baru berlaku bersama CR-04/CR-05 sejauh menyangkut review hak dan keputusan internal Owner.

## 33.1 Keputusan

[RIWAYAT HISTORIS, TIDAK BERLAKU UNTUK IMPLEMENTASI SETELAH CR-12/CR-13] Pada saat CR-11 dibuat, dukungan akun pihak ketiga dimasukkan ke ruang lingkup. Setiap kalimat pada CR-11 yang mengizinkan penyimpanan atau pemrosesan kredensial dicabut oleh CR-12 dan CR-13. Aturan yang berlaku adalah penyerahan manual Owner dan larangan pemrosesan/penyimpanan kredensial di sistem.

## 33.2 Kewenangan dan tanggung jawab Owner

Owner bertanggung jawab memastikan sumber akun, kepemilikan atau kewenangan vendor, hak untuk menjual/menyerahkan, wilayah, metode transfer, dan informasi yang disampaikan kepada pembeli. Owner mencatat deklarasi dan referensi sumber per SKU/unit inventaris. Persetujuan internal Owner tidak menciptakan hak yang tidak dimiliki dan tidak membatalkan larangan eksplisit penerbit, hukum, atau hak pihak ketiga.

## 33.3 Pengamanan kredensial

- Kredensial akun tidak boleh dimasukkan atau disimpan pada sistem VAULT CORE, termasuk database, inventaris, backend, cache, log, analytics, error trace, backup, ekspor laporan, atau katalog publik.
- Penyerahan dilakukan langsung oleh Owner secara manual melalui kanal privat kepada customer yang terkait dengan order yang telah dibayar.
- Audit log hanya mencatat order ID, referensi customer, waktu pembayaran sukses, tenggat, waktu penyerahan, status, dan aktor Owner; nilai kredensial tidak boleh dicatat.
- Tidak ada pengecualian: VAULT CORE tidak menerima atau memproses password email pribadi, cookie, session token, OTP, recovery code, atau backup code.
- Kredensial tidak boleh digunakan untuk takeover tanpa izin, bypass autentikasi, atau akses di luar proses transfer yang dinyatakan.

## 33.4 Status implementasi

CR-12 menggantikan seluruh bagian CR-11 yang pernah mengizinkan penyimpanan atau pemrosesan kredensial akun. CR-11 dipertahankan sebagai riwayat historis dan bukan persyaratan implementasi. Sistem menyediakan notifikasi Owner, antrean pemenuhan manual, tenggat satu jam, status pemenuhan, dan audit metadata tanpa isi kredensial.

## 33.5 Kriteria penerimaan

- Bagian 3.3 mendukung penyerahan akun manual oleh Owner tanpa penyimpanan/pemrosesan kredensial oleh sistem.
- Bagian 7.6 dan 28.3 konsisten dengan SLA satu jam dan audit metadata saja.
- Tidak ada kredensial akun yang disimpan di database, inventaris, backend, cache, log, analytics, error trace, backup, atau ekspor umum.
- Owner menerima notifikasi dan menyelesaikan penyerahan manual; sistem mencatat status serta waktu tanpa menyimpan kredensial.
- Pembayaran tetap Telegram Stars (`XTR`) dan delivery tetap mensyaratkan pembayaran valid.

---

# 34. Addendum CR-12 — Penyerahan Kredensial Akun Secara Manual Maksimal 1 Jam

**Tanggal:** 27 November 2026  
**Status:** Disetujui melalui instruksi tertulis Owner pada percakapan proyek.  
**Mengubah dan mengesampingkan:** Ketentuan CR-11 Bagian 33.1, 33.3, dan 33.4 sejauh mewajibkan atau mengizinkan penyimpanan kredensial akun di sistem, serta ketentuan yang bertentangan pada Bagian 2, 3.3, 7.6, dan 28.3. CR-04 tetap menjadi dasar pemeriksaan hak dan transfer akun.

## 34.1 Keputusan final alur akun

Setelah pembayaran Telegram Stars (`XTR`) dinyatakan sukses dan terverifikasi melalui `successful_payment`, kredensial akun diserahkan kepada customer secara manual oleh Owner dalam waktu maksimal **1 (satu) jam**. Penyerahan tidak dilakukan otomatis oleh backend, bot, atau sistem delivery.

## 34.2 Tidak ada penyimpanan kredensial

VAULT CORE tidak memerlukan dan tidak boleh menyimpan kredensial akun. Kredensial tidak boleh dimasukkan ke database, tabel inventaris, backend, cache, log, analytics, error trace, backup, ekspor, atau payload sistem. Sistem hanya mengelola data produk non-rahasia dan metadata status pemenuhan.

## 34.3 Alur transaksi dan pemenuhan

1. Customer menyelesaikan pembayaran melalui invoice Telegram Stars XTR.
2. Backend memverifikasi `successful_payment` dan menetapkan waktu pembayaran sukses.
3. Sistem membuat tugas `PAID_PENDING_MANUAL_DELIVERY`, mencatat `paid_at`, lalu menghitung tenggat sesuai tipe ketersediaan: satu jam untuk READY atau `fulfillment_due_at` yang disetujui customer untuk INDENT. Sistem segera memberi notifikasi kepada Owner.
4. Owner memeriksa order serta identitas penerima, lalu mengirimkan kredensial secara manual melalui kanal privat.
5. Owner mencatat penyelesaian. Sistem menyimpan status, waktu penyerahan, dan aktor Owner tanpa menyimpan isi kredensial.
6. Jika tenggat yang berlaku terlewati (satu jam untuk READY atau `fulfillment_due_at` untuk INDENT), status berubah menjadi `OVERDUE` dan sistem segera memberi eskalasi kepada Owner.
7. Owner segera menghubungi customer. Jika customer tidak menyetujui tenggat pengganti secara tertulis, Owner memproses refund penuh melalui `refundStarPayment` paling lambat 24 jam setelah status `OVERDUE`.
8. Jika customer menyetujui satu tenggat pengganti, persetujuan dan tenggat dicatat. Perpanjangan hanya satu kali; jika tenggat pengganti terlewati, refund penuh diproses paling lambat 24 jam setelah tenggat tersebut.

## 34.4 Audit dan batas data

Audit log hanya menyimpan referensi order/customer yang diperlukan, timestamp pembayaran, tenggat, timestamp penyerahan, status, dan aktor Owner. Audit log tidak boleh memuat kredensial, tangkapan layar yang memperlihatkan kredensial, atau salinan pesan rahasia.

## 34.5 Kriteria penerimaan

- Tidak ada fitur penerimaan, penyimpanan, atau pengiriman otomatis kredensial akun.
- Tidak ada kolom/payload kredensial akun di inventaris atau database aplikasi.
- Notifikasi Owner dibuat setelah pembayaran sukses terverifikasi.
- Untuk READY, tenggat dihitung dari timestamp `successful_payment` dan maksimum 1 jam.
- Untuk INDENT, tenggat dihitung berdasarkan maksimum hari kalender yang ditampilkan dan disetujui customer sebelum checkout.
- Customer dapat melihat status menunggu penyerahan manual, diproses, selesai, atau terlambat.
- Owner dapat mencatat penyelesaian manual.
- Status `DELIVERED` hanya ditetapkan setelah Owner mengonfirmasi penyerahan.
- Audit log menyimpan metadata pemenuhan saja, tanpa isi kredensial.
- Produk non-akun, pembayaran XTR, dan pemeriksaan hak produk tetap mengikuti ketentuan masing-masing.

---

# 35. Addendum CR-13 — Konsistensi Kontrak, SLA Akun, Refund, Varian, dan Import Massal

**Tanggal:** 27 November 2026  
**Status:** Disetujui melalui instruksi tertulis Owner dalam percakapan proyek.  
**Berlaku:** Mengubah dan menyelaraskan Bagian 3.1, 3.3, 5.1, 7.6, 9.3, 11, 28, 29, 33, dan 34. Jika terdapat pertentangan mengenai akun, CR-12 dan CR-13 berlaku; CR-11 dipertahankan sebagai riwayat historis dan bukan persyaratan implementasi.

## 35.1 Satu aturan kredensial yang berlaku

VAULT CORE tidak menerima, meminta, memproses, menyimpan, atau mengirim kredensial akun melalui aplikasi. Tidak ada pengecualian untuk password email, cookie, session token, OTP, recovery code, atau backup code. Setelah pembayaran sukses, Owner menyerahkan informasi akses akun secara manual melalui kanal privat di luar VAULT CORE. Sistem hanya menyimpan metadata order dan pemenuhan.

Aturan ini berlaku untuk seluruh database, tabel, inventaris, API, backend, cache, log, analytics, error trace, backup, ekspor, dashboard, dan payload aplikasi. Payload terenkripsi tetap boleh digunakan hanya untuk kode redeem, lisensi, dan voucher non-akun yang sah.

## 35.2 Pemeriksaan SKU akun yang proporsional

Owner wajib mencatat per SKU: game/penerbit, wilayah, sumber dan rantai perolehan, dasar kewenangan menjual/menyerahkan, tautan ketentuan resmi yang relevan, metode transfer, tanggal review, reviewer, masa review, status, dan catatan risiko.

- Jika ketentuan resmi secara eksplisit melarang penjualan atau transfer akun, SKU wajib `PAUSED`/`REJECTED` dan tidak boleh dijual.
- Jika ketentuan resmi secara eksplisit mengizinkan atau menyediakan mekanisme transfer, Owner mencatat referensi ketentuan/metode tersebut.
- Jika ketentuan resmi tidak membahas secara jelas penjualan akun, Owner mencatat kondisi tersebut, dasar sumber dan kewenangan yang dimiliki, serta risiko yang diketahui sebelum mengambil keputusan internal.
- Bukti tertulis penerbit wajib hanya jika memang disyaratkan ketentuan penerbit atau diperlukan oleh dasar hak yang diklaim. Tidak ada kewajiban universal untuk memperoleh surat izin penerbit pada setiap SKU.
- `APPROVED` adalah keputusan internal Owner, bukan sertifikasi atau izin penerbit. Owner tetap bertanggung jawab atas kebenaran deklarasi, hak sumber, ketentuan eksternal, dan hukum.

Sistem memvalidasi kelengkapan catatan dan status review. Sistem tidak meminta dokumen yang tidak diwajibkan sebagai syarat universal, tidak mengarang bukti, dan tidak mengubah keputusan internal Owner menjadi klaim persetujuan pihak ketiga.

## 35.3 Pemenuhan akun dan tenggat

Setelah `successful_payment` XTR terverifikasi, sistem membuat tugas `PAID_PENDING_MANUAL_DELIVERY`, mencatat `paid_at`, serta segera memberi notifikasi kepada Owner. Untuk READY, sistem menetapkan `fulfillment_due_at = paid_at + 1 hour`. Untuk INDENT, sistem menggunakan tenggat maksimum yang telah ditampilkan dan disetujui customer sebelum checkout sebagai snapshot `fulfillment_due_at`. Owner menyerahkan akun secara manual melalui kanal privat dan mencatat status serta waktu penyerahan. Sistem tidak menyimpan isi kredensial.

Jika tenggat pemenuhan yang berlaku terlewati, status menjadi `OVERDUE` dan eskalasi dikirim kepada Owner. Untuk READY, tenggatnya satu jam sejak `successful_payment`; untuk INDENT, tenggatnya `fulfillment_due_at` yang disetujui customer saat checkout. Owner segera menghubungi customer:

1. Jika customer menyetujui satu tenggat pengganti secara eksplisit, persetujuan dan tenggat dicatat. Perpanjangan hanya satu kali.
2. Jika customer tidak menyetujui tenggat pengganti, Owner memproses refund penuh melalui `refundStarPayment` paling lambat 24 jam setelah status `OVERDUE`.
3. Jika tenggat pengganti terlewati, Owner memproses refund penuh melalui `refundStarPayment` paling lambat 24 jam setelah tenggat pengganti.
4. Refund dinyatakan selesai hanya setelah Telegram mengonfirmasi refund; sistem mencatat referensi refund dan mengubah order menjadi `REFUNDED`.
5. Stok akun yang belum diserahkan hanya dikembalikan ke `AVAILABLE` setelah Owner memeriksa dan mengonfirmasi bahwa unit masih valid serta dapat dijual.

Tidak ada pengiriman kredensial otomatis. Status `DELIVERED` hanya ditetapkan setelah Owner mengonfirmasi penyerahan manual.

## 35.4 Struktur katalog dan varian

Struktur katalog menggunakan `game_category` → `product_type` → `variant` → SKU. Tier Silver/Gold/Platinum bukan field wajib dan tidak boleh menjadi penghalang import produk. Label pemasaran boleh digunakan sebagai teks tampilan.

Untuk akun game, varian dapat berupa `POLOS`, `LOW`, `MID`, `HIGH`, atau `SULTAN` sesuai definisi game/SKU. Status ketersediaan akun adalah:

- `READY`: unit akun tersedia dan siap diserahkan setelah pembayaran.
- `INDENT`: produk dipesan terlebih dahulu; batas maksimum pemenuhan dalam hari kalender wajib ditampilkan sebelum checkout dan disimpan sebagai snapshot order.

Produk `INDENT` tidak boleh diperlakukan sebagai stok `READY`. Order INDENT memiliki `fulfillment_due_at` sesuai tenggat yang ditampilkan dan disetujui customer saat checkout. Untuk INDENT, aturan keterlambatan dan refund pada Bagian 35.3 berlaku berdasarkan tenggat yang telah disetujui, bukan otomatis satu jam.

## 35.5 Import produk massal

Import massal dilakukan melalui template workbook resmi dengan sheet terpisah untuk data produk dan unit stok. Satu baris pada sheet Produk mewakili satu SKU; satu baris pada sheet Stok mewakili satu unit stok non-rahasia yang terhubung melalui SKU.

- Kolom wajib dan format data mengikuti data model kontrak serta template resmi.
- Harga jual dan modal komersial dicatat dalam XTR. Nilai IDR hanya boleh menjadi catatan referensi dan tidak menjadi harga checkout.
- Kredensial akun, password, OTP, token, recovery code, dan rahasia autentikasi dilarang dimasukkan ke workbook.
- Import awal membuat/memperbarui SKU sebagai `DRAFT` atau `PENDING_REVIEW`; import tidak otomatis mengaktifkan produk, menyetujui rights review, atau mengubah stok menjadi siap jual.
- Aktivasi dilakukan Owner setelah validasi data, review sumber/hak, harga XTR, metode pemenuhan, gambar, dan stok selesai.
- Baris dengan SKU duplikat, referensi varian tidak dikenal, harga tidak valid, atau data wajib kosong ditolak dengan laporan kesalahan per baris. Import harus idempotent dan tidak boleh menggandakan SKU/unit stok saat file yang sama diunggah ulang.

## 35.6 Status historis dan urutan keberlakuan

CR-11 tetap berada dalam dokumen sebagai riwayat historis. Setiap izin penyimpanan/pemrosesan kredensial yang pernah tertulis di CR-11 telah dicabut oleh CR-12 dan CR-13. Ketentuan aktif dan urutan keberlakuan final ditetapkan pada Bagian 36 (CR-14). Jika terdapat pertentangan redaksional dengan Bagian 36, Bagian 36 yang berlaku.

---
# 36. Addendum CR-14 — Final Harmonization dan Urutan Ketentuan Aktif

**Tanggal:** 27 November 2026  
**Status:** Disetujui melalui instruksi tertulis Owner dalam percakapan proyek.  
**Tujuan:** Menuntaskan konflik redaksional yang tersisa setelah CR-13 dan menetapkan satu rujukan operasional untuk implementasi.

## 36.1 Hierarki ketentuan

1. CR-14 berlaku untuk harmonisasi akhir dan penetapan ketentuan aktif.
2. CR-13 berlaku untuk struktur katalog, READY/INDENT, refund, dan import massal sepanjang tidak diubah CR-14.
3. CR-12 berlaku untuk penyerahan manual akun dan larangan aplikasi menerima/menyimpan kredensial.
4. CR-04 dan CR-05 tetap berlaku untuk pencatatan sumber/hak, review SKU, dan keputusan internal Owner sepanjang tidak bertentangan dengan CR-12/CR-13/CR-14.
5. CR-01, CR-02, dan CR-11 tetap disimpan sebagai jejak keputusan historis. Setiap kalimatnya yang bertentangan dengan CR-04, CR-12, CR-13, atau CR-14 bukan persyaratan aktif dan tidak boleh digunakan untuk menolak atau mengubah implementasi yang telah disetujui.

## 36.2 Aturan aktif untuk akun game

VAULT CORE dapat mencatat dan menjual SKU akun game pihak ketiga yang lolos review sumber/kewenangan Owner dan pemeriksaan ketentuan penerbit/platform sesuai Bagian 28. Review dilakukan per SKU, game, dan wilayah. Larangan eksplisit penerbit atau ketiadaan dasar kewenangan sumber yang layak menyebabkan SKU ditahan. Surat izin penerbit bukan persyaratan universal; bukti tertulis hanya diwajibkan jika ketentuan penerbit atau dasar hak yang diklaim mensyaratkannya.

Aplikasi VAULT CORE tidak menerima, meminta, memproses, menyimpan, atau mengirim kredensial akun. Tidak ada field kredensial pada katalog, inventaris, workbook, API, order, log, atau dashboard. Setelah pembayaran sukses, Owner menyerahkan informasi akses secara manual kepada customer melalui kanal privat di luar aplikasi. Sistem hanya mencatat metadata order, status, waktu, dan aktor pemenuhan.

## 36.3 Aturan SLA READY dan INDENT

- `READY`: unit tersedia; setelah `successful_payment` XTR terverifikasi, Owner wajib menyerahkan akun secara manual maksimal satu jam. Sistem membuat tugas, notifikasi, `paid_at`, dan `fulfillment_due_at = paid_at + 1 hour`.
- `INDENT`: unit belum tersedia sebagai stok READY. Batas pemenuhan maksimum dalam hari kalender wajib ditentukan Owner, ditampilkan kepada customer sebelum checkout, disetujui saat checkout, dan disimpan sebagai snapshot order. Tenggat INDENT tidak menggunakan SLA satu jam.
- Jika tenggat yang berlaku terlewati, status menjadi `OVERDUE` dan Owner menerima eskalasi. Refund penuh diproses melalui `refundStarPayment` paling lambat 24 jam setelah status OVERDUE, kecuali customer menyetujui secara eksplisit satu tenggat pengganti. Jika tenggat pengganti terlewati, refund penuh diproses paling lambat 24 jam setelah tenggat tersebut.
- Refund baru dianggap selesai setelah Telegram mengonfirmasi refund. Stok hanya dikembalikan ke AVAILABLE setelah Owner memeriksa dan mengonfirmasi unit masih valid serta dapat dijual.

## 36.4 Penggantian checklist dan acceptance criteria

Setiap checklist atau acceptance criteria yang masih menyatakan bahwa sistem tidak mendukung katalog akun atau tidak mengelola pemenuhan akun dianggap telah diganti dengan kriteria berikut:

1. SKU akun melewati review sumber/hak per SKU dan tidak melanggar larangan eksplisit penerbit/platform.
2. Aplikasi tidak menerima atau menyimpan kredensial akun dalam bentuk apa pun.
3. Penyerahan akses akun dilakukan manual oleh Owner di luar aplikasi setelah pembayaran XTR sukses.
4. READY menggunakan SLA satu jam; INDENT menggunakan tenggat kalender yang disetujui customer sebelum checkout.
5. Status, notifikasi, timestamp, eskalasi, dan refund tercatat tanpa isi kredensial.
6. Produk non-akun tetap menggunakan metode fulfillment SKU yang sah, termasuk encrypted payload non-akun jika sesuai.

## 36.5 Status dokumen

Bagian 25.1 dan 26.1 serta checklist Bagian 24 dan 16 harus dibaca sebagai catatan historis sejauh berisi larangan menyeluruh atas penjualan/penyerahan akun. Bagian 28, 34, 35, dan 36 adalah ketentuan aktif untuk akun, SLA, refund, dan import. Bagian 7.6 mengikuti pembedaan READY/INDENT pada Bagian 36.3.

---



# 37. Addendum CR-15 — QRIS Statis Sementara untuk Website dan Pemisahan Kanal Pembayaran

**Tanggal:** 27 November 2026  
**Status:** Disetujui melalui instruksi tertulis Owner pada percakapan proyek.  
**Berlaku:** Mengubah ketentuan CR-10 pada Bagian 32 serta ketentuan pembayaran/akuntansi sebelumnya sejauh bertentangan dengan addendum ini. CR-10 tetap berlaku untuk Telegram Mini App pada hal-hal yang tidak diubah CR-15.

## 37.1 Keputusan kanal pembayaran

1. **Website (browser di luar Telegram Mini App):** VAULT CORE boleh memproses pesanan dengan QRIS statis merchant dalam mata uang Rupiah (IDR) sebagai metode sementara.
2. **Telegram Mini App:** tetap menggunakan invoice resmi Telegram Stars dengan mata uang `XTR`. Tidak ada QRIS pada Mini App dan tidak ada perubahan pada Bot API invoice, pre-checkout, webhook `successful_payment`, maupun refund Stars.
3. Kedua kanal tetap menggunakan satu katalog, sumber harga dan stok backend, identitas pelanggan, sistem order, inventaris, pemenuhan, serta riwayat transaksi VAULT CORE.
4. QRIS statis hanya berlaku pada checkout website sampai Owner menyetujui pengganti melalui change request berikutnya. Metode pembayaran lain tidak otomatis diizinkan.

## 37.2 Alur QRIS statis website

1. Customer masuk ke website melalui autentikasi Telegram OIDC yang tervalidasi dan terhubung ke record pelanggan yang sama di tabel `customers`.
2. Website meminta backend membuat order berdasarkan produk, harga IDR yang disetujui Owner, stok aktual, dan kelayakan SKU. Nominal serta mata uang IDR disimpan sebagai snapshot transaksi agar perubahan harga setelahnya tidak mengubah order yang sudah dibuat.
3. Website menampilkan QRIS merchant VAULT CORE yang sah, nama merchant, nomor order, nominal IDR yang harus dibayar, dan batas waktu pembayaran yang dikonfigurasi.
4. Customer dapat mengirim bukti pembayaran sebagai informasi pendukung apabila fitur tersebut diimplementasikan. Bukti gambar, callback browser, atau klaim customer tidak pernah menjadi bukti final pembayaran.
5. Order QRIS hanya berubah menjadi `PAID` setelah Owner/Admin yang berwenang memverifikasi transaksi pada mutasi/portal settlement merchant QRIS yang sebenarnya, lalu mencatat nominal diterima, referensi transaksi eksternal, waktu verifikasi, dan aktor verifikator di backend.
6. Pemenuhan baru dimulai setelah verifikasi server-side tersebut berhasil dan status order berubah secara atomik menjadi `PAID`. Order kedaluwarsa atau reservasi stok yang telah dilepas wajib diperiksa ulang; pembayaran terlambat tidak boleh menghidupkan kembali order atau stok secara otomatis.
7. Refund QRIS diproses melalui mekanisme merchant/acquirer yang berlaku dan dicatat dengan referensi refund. Mekanisme `refundStarPayment` tetap khusus untuk pembayaran XTR.

## 37.3 Aturan Telegram Mini App yang tidak berubah

- Mini App membuat order melalui identitas Telegram `initData` yang diverifikasi server.
- Backend membuat invoice resmi Telegram Stars dengan currency `XTR`.
- `pre_checkout_query` divalidasi terhadap customer, order, payload, jumlah, mata uang, masa berlaku, dan reservasi stok.
- Hanya webhook `successful_payment` yang tervalidasi dan diproses secara idempoten yang dapat menetapkan pembayaran XTR menjadi `PAID`.
- Mini App tetap menampilkan harga, invoice, status, riwayat, dan refund dalam XTR. Tidak ada nominal IDR atau QRIS pada jalur ini.
- Perubahan CR-15 tidak mengubah tampilan maupun interaksi pembayaran Mini App yang telah disetujui.

## 37.4 Satu identitas dan sumber data bersama

- Website dan Mini App harus memakai backend API, database Neon `vault_core`, tabel pelanggan `customers`, katalog, inventaris, reservasi, order, dan pemenuhan yang sama. Dilarang membuat database pelanggan, order, katalog, atau stok kedua.
- Identitas web berasal dari sesi Telegram OIDC bertanda tangan/HttpOnly yang divalidasi backend; identitas Mini App berasal dari Telegram `initData` yang divalidasi backend. Keduanya dipetakan ke `customers.telegram_user_id` yang sama.
- Seluruh validasi produk, hak SKU, harga, jumlah, stok, reservasi, serta snapshot order dilakukan server-side. Browser tidak boleh menetapkan nominal final atau status pembayaran sendiri.
- Nilai transaksi dipisahkan berdasarkan mata uang: order web menyimpan nilai IDR dan referensi QRIS; order Mini App menyimpan nilai XTR dan ID Telegram. Laporan tidak boleh menjumlahkan IDR dan XTR sebagai satu mata uang. Konversi hanya boleh dilakukan bila Owner menyetujui sumber kurs, waktu kurs, dan metode pembukuannya melalui keputusan terpisah.

## 37.5 Standar visual Website dan Mini App

- Website dan Telegram Mini App mempertahankan satu sistem visual VAULT CORE: kanvas mobile maksimum 430px, warna navy gelap, aksen violet/gold, tipografi, radius, kartu produk, hierarki informasi, ikon, artwork, dan pola navigasi yang sama.
- Urutan pengalaman customer dibuat konsisten: katalog → detail produk → keranjang/ringkasan → pembayaran → status order → riwayat → profil.
- Posisi, ukuran, dan gaya komponen checkout harus sama. Satu-satunya perbedaan fungsional di tahap pembayaran adalah metode dan satuan: QRIS/IDR pada website, Telegram Stars/XTR pada Mini App.
- Data produk, deskripsi, gambar, stok, dan ketentuan harus tetap berasal dari sumber backend yang sama. Tidak boleh ada daftar produk atau harga hard-coded khusus salah satu kanal.

## 37.6 Batas metode pembayaran

QRIS yang diakui hanya QRIS merchant resmi VAULT CORE untuk checkout website. Pembayaran ke rekening pribadi, transfer langsung ke Owner/penjual, e-wallet, PayLater, Rekber/Escrow pihak ketiga, alamat wallet XTR manual, dan metode lain di luar dua jalur yang ditetapkan CR-15 tidak diterima sebagai pembayaran VAULT CORE.

Tangkapan layar atau bukti unggahan hanya bahan bantu pemeriksaan. Status `PAID` selalu ditetapkan oleh backend berdasarkan sinyal pembayaran yang sah: webhook `successful_payment` untuk XTR atau verifikasi settlement merchant oleh Owner/Admin berwenang untuk QRIS statis.

## 37.7 Syarat kesiapan implementasi QRIS website

Keputusan kebijakan QRIS statis telah disetujui, tetapi detail berikut **BELUM TERSEDIA / BELUM DIKETAHUI dari dokumentasi repository saat CR-15 dicatat**:

- File/payload QRIS merchant aktif, nama merchant yang harus tampil, dan identitas merchant/acquirer.
- Harga jual IDR yang disetujui Owner untuk setiap SKU serta aturan pembulatan/nominal checkout.
- Akses dan prosedur pencocokan transaksi dengan mutasi atau portal settlement merchant.
- Penanggung jawab verifikasi, otorisasi Owner/Admin, dan prosedur refund QRIS.
- Batas waktu QRIS serta aturan kedaluwarsa order dan pelepasan/pemeriksaan ulang reservasi stok.

Karena itu, QRIS website belum boleh dinyatakan aktif di produksi hanya berdasarkan perubahan dokumen ini. Implementasi membutuhkan konfigurasi merchant dan harga IDR yang nyata, perubahan backend/database/API dan UI website, kontrol verifikasi Owner, pengujian keamanan/idempotensi/kedaluwarsa/refund, serta UAT transaksi website. Sampai implementasi tersebut lulus, jalur produksi yang tersedia tetap mengikuti kode yang sedang terpasang.

## 37.8 Kriteria penerimaan

- Website dapat membuat order IDR dari harga backend, menampilkan QRIS merchant resmi, dan mempertahankan order sebagai menunggu pembayaran sampai settlement diverifikasi Owner/Admin.
- Screenshot atau callback klien tidak dapat mengubah order QRIS menjadi `PAID`.
- Verifikasi QRIS mencatat nominal diterima, referensi eksternal, waktu, dan aktor verifikator; pemenuhan berjalan satu kali setelah status PAID.
- Telegram Mini App tetap menggunakan XTR invoice dan webhook `successful_payment`, tanpa QRIS.
- Website dan Mini App memakai identitas pelanggan, katalog, stok, order, dan data fulfillment yang sama.
- Komponen visual serta alur non-pembayaran konsisten; hanya metode dan mata uang pembayaran yang berbeda.
- Tidak ada Worker, API, bot, atau database pelanggan baru yang dibuat untuk perubahan ini.

---

**Akhir dokumen — VAULT CORE Project Contract v2.0 (CR-15, 27 November 2026).**

---

# 38. Addendum CR-16 — Form Produk Terpadu dan Standar UI

**Tanggal:** 27 November 2026  
**Dasar:** Instruksi tertulis Owner pada percakapan proyek 27 November 2026.  
**Status:** Aturan kerja tambahan untuk implementasi VAULT CORE.  
**Tujuan:** Owner cukup mengisi satu form produk yang mudah digunakan melalui Android; sistem memvalidasi, menyimpan ke database yang sudah ada, menayangkan listing, dan menyiapkan jalur order pada kanal yang memang sudah siap.

**Mengubah dan melengkapi:** Bagian 4.2, 5, 7.2, 7.3, 16, 17, 23, 30, 35.5, dan 37.5 sejauh mengatur pengisian produk, import, alur aktivasi, kriteria selesai, dan visual. CR-16 tidak mengubah Single-Vendor, pemeriksaan sumber/hak SKU, keamanan data, ketentuan READY/INDENT dan penyerahan akun manual pada CR-12/CR-14, atau pemisahan kanal pembayaran CR-15.

## 38.1 Alur kerja Owner yang berlaku

Jalur utama pengelolaan produk adalah satu halaman form pada Owner Dashboard dengan pola input marketplace yang sederhana seperti Itemku, disesuaikan dengan identitas VAULT CORE dan nyaman dipakai pada Android.

Alur Owner:
1. Mengisi satu form produk.
2. Menekan satu tombol **Simpan Produk**.
3. Data tersimpan di database dan tampil pada katalog.

Owner tidak diwajibkan menggunakan workbook untuk setiap SKU, menjalani wizard beberapa halaman, mengisi ulang data pada beberapa modul, atau menjalankan perintah database secara manual. Workbook import massal tetap tersedia sebagai jalur opsional bila Owner memasukkan banyak SKU sekaligus. Ketentuan validasi dan idempotensi import pada Bagian 35.5 tetap berlaku untuk jalur opsional tersebut.

Form menggunakan data yang diisi Owner dan menyimpannya ke database VAULT CORE yang sudah ada. Setelah tersimpan, informasi produk ditampilkan pada katalog.

## 38.2 Isi form produk tunggal

Form berada pada satu halaman responsif. Bagian dapat dikelompokkan, dilipat, atau ditampilkan dinamis berdasarkan jenis produk, tetapi bukan rangkaian halaman Next/Previous atau beberapa aksi publikasi.

Data yang ditampilkan sesuai produk:

- **Kategori:** game (MLBB, Free Fire, Roblox, Genshin Impact), jenis produk, dan varian master dari katalog resmi.
- **Informasi listing:** nama/judul, deskripsi, foto/media, spesifikasi yang terlihat customer, dan ketentuan pembeli.
- **Pertanyaan wajib varian:** form mengambil pertanyaan yang relevan dari master 12 varian dan 47 pertanyaan wajib. Hanya pertanyaan untuk varian yang dipilih yang ditampilkan; pertanyaan varian lain tidak diminta.
- **Harga per kanal:** harga jual website dalam IDR apabila checkout website telah diaktifkan sesuai CR-15; harga jual Telegram Mini App dalam XTR. Harga modal/biaya internal hanya terlihat oleh Owner.
- **Stok dan kapasitas:** stok unit aktual untuk produk berbasis unit atau kapasitas/slot yang benar-benar dapat dipenuhi untuk layanan.
- **Ketersediaan akun:** pilihan READY atau INDENT. READY berarti unit tersedia. INDENT wajib memiliki tenggat maksimum dalam hari kalender yang ditampilkan sebelum checkout dan disimpan sebagai snapshot order.
- **Pemenuhan:** metode, estimasi waktu, garansi yang benar-benar disediakan, syarat klaim, dan kebijakan produk.
- **Sumber dan review hak SKU:** game/penerbit, wilayah, sumber/rantai perolehan, dasar kewenangan Owner, ketentuan resmi yang relevan, metode transfer/pemenuhan, tanggal review, status, masa review bila digunakan, referensi bukti bila memang diwajibkan, dan attestation Owner sesuai CR-05/CR-14.
- **Data yang diminta dari customer:** hanya field yang diperlukan produk, misalnya Player/User ID, Server, pilihan item, atau target layanan. Field harus spesifik per SKU, dengan label yang jelas.

Form tidak menyediakan field untuk password akun, password email pribadi, cookie, session token, OTP, recovery code, backup code, atau rahasia autentikasi. Kredensial akun game tidak boleh dimasukkan ke form, workbook, database, API, log, cache, analytics, error trace, backup, atau ekspor. Untuk SKU akun, penyerahan akses tetap dilakukan Owner secara manual melalui kanal privat di luar aplikasi setelah pembayaran, sesuai CR-14. Untuk Jasa Joki, aplikasi hanya mengumpulkan identitas game dan parameter pengerjaan yang diperlukan; aplikasi tidak meminta password atau kode autentikasi customer.

## 38.3 Simpan data produk

Ketika Owner menekan **Simpan Produk**, sistem menyimpan data dari form ke database VAULT CORE yang sudah ada:

- membuat atau memperbarui SKU pada database VAULT CORE yang sudah digunakan;
- menyimpan relasi game, jenis produk, dan varian;
- menyimpan jawaban pertanyaan wajib yang relevan;
- menyimpan media, deskripsi, spesifikasi, ketentuan, dan waktu pemenuhan;
- menyimpan harga per kanal dan biaya/modal internal;
- menyimpan review sumber/hak dan attestation Owner;
- mencatat stok unit atau slot kapasitas beserta referensi sumber;
- menyimpan konfigurasi data yang diminta kepada customer;
- membuat audit log perubahan.

Data yang disimpan digunakan untuk memperbarui informasi produk pada katalog. Satu form dan satu tombol simpan menjadi alur pengelolaan produk yang digunakan Owner.

## 38.4 Aturan status, stok, dan pemeriksaan hak

- Stok publik tetap berasal dari stok/kapasitas aktual dan dapat dijual. Mode tampilan pada Bagian 7.3 tetap berlaku; angka stok publik tidak boleh melebihi ketersediaan sebenarnya.
- **READY** dan **INDENT** adalah status ketersediaan produk akun sesuai CR-14. Kartu INDENT wajib menyampaikan tenggat pemenuhan sebelum customer checkout.
- Label visual **Ready** atau **Pending** adalah indikator kecil ketersediaan. Label Pending pada kartu customer hanya boleh berarti status INDENT/pemesanan dengan tenggat yang jelas, bukan SKU internal yang belum lolos review.
- Status ketersediaan READY atau INDENT ditampilkan sesuai kondisi produk yang dimasukkan Owner.
- Review sumber/hak dilakukan per SKU. Larangan eksplisit penerbit/platform atau tidak adanya dasar kewenangan sumber yang layak menyebabkan SKU ditahan. Attestation Owner adalah keputusan internal, bukan izin penerbit atau verifikasi independen.
- Aturan penyerahan akun manual, larangan penyimpanan kredensial, SLA READY satu jam, tenggat INDENT, eskalasi OVERDUE, dan refund tetap mengikuti CR-14.

## 38.5 Harga, pembayaran, dan kesiapan per kanal

Satu SKU, katalog, stok, customer, order, dan fulfillment tetap menggunakan backend/database VAULT CORE yang sama. Harga disimpan terpisah per kanal dan mata uangnya.

- **Website:** harga dalam IDR. Checkout hanya menggunakan QRIS statis merchant VAULT CORE sesuai CR-15, setelah konfigurasi merchant, harga IDR, prosedur verifikasi settlement, refund, batas waktu, implementasi, dan UAT tersedia serta lulus.
- **Telegram Mini App:** harga dalam XTR melalui invoice resmi Telegram Stars. Validasi pre-checkout dan webhook successful_payment tetap berlaku.
- Tripay, transfer bank, e-wallet, PayLater, Rekber/Escrow, transfer langsung ke Owner, dan alamat wallet XTR manual yang terlihat pada gambar detail sebagai contoh lama bukan metode pembayaran VAULT CORE yang berlaku. Opsi tersebut harus diganti dengan QRIS/IDR pada website atau Telegram Stars/XTR pada Mini App.
- Tidak ada metode pembayaran ketiga yang ditambahkan melalui form.
- Bila QRIS website belum siap, website boleh menampilkan katalog/detail sesuai konfigurasi, tetapi tidak boleh mengaku menerima pembayaran QRIS atau menampilkan checkout yang belum berfungsi. Mini App tetap dapat menerima transaksi XTR jika jalur Mini App dan SKU terkait sudah lolos uji.
- Website dan Mini App memakai sumber produk, gambar, spesifikasi, harga per kanal, stok, order, dan fulfillment yang sama. Perbedaan pada checkout hanya metode serta mata uang yang ditetapkan CR-15.

## 38.6 Standar UI berdasarkan gambar referensi Owner

Empat gambar referensi yang diberikan pada 27 November 2026 menjadi acuan visual Dashboard, Katalog, Detail Produk, dan komposisi keseluruhan. Gambar tersebut adalah referensi tampilan, bukan sumber data harga, stok, rating, diskon, hak produk, atau metode pembayaran.

**A. Kerangka visual**
- Acuan portrait 390 × 844 px, responsif untuk Android, dengan lebar konten maksimum sekitar 430 px.
- Background utama hitam #000000; area header/input gelap #121212; kartu elevated #1E1E1E.
- Aksen utama violet sekitar #835CFF; aksen status READY hijau lembut sekitar #A3E635; status sekunder abu-abu #9CA3AF; teks utama putih #FFFFFF.
- Padding konten sekitar 16 px, jarak antarbagian sekitar 20 px, radius kartu sekitar 16 px, header sekitar 56 px, search sekitar 44 px, dan bottom navigation sekitar 64 px.
- Grid katalog dua kolom dengan jarak sekitar 12 px. Ukuran kartu referensi sekitar 173 × 180 px pada layar 390 px dan harus menyesuaikan lebar perangkat.
- Bottom navigation berisi Home, Categories, My Orders, dan Profile.

**B. Dashboard**
- Header VAULT CORE, ikon keamanan, notifikasi, dan avatar.
- Search bar dengan placeholder “Cari akun game…”.
- Banner promosi, empat kartu game, filter varian yang tersedia, dua kartu Best Seller, ringkasan tiga transaksi terakhir, daftar produk akun, kartu Joki 2 × 2, kartu keunggulan, dan bottom navigation.
- Kartu kategori hanya menampilkan empat game katalog resmi. Filter varian hanya menampilkan pilihan yang memiliki produk.
- Nama customer dan informasi transaksi pada ringkasan publik harus disamarkan.
- Best Seller, jumlah terjual, rating, transaksi terbaru, stok, dan aktivitas live harus bersumber dari data backend aktual. Data contoh tidak boleh ditampilkan sebagai data produksi.
- Klaim diskon, harga coret, atau “Diskon hingga 50%” hanya boleh tampil bila harga pembanding, periode, dan diskon benar-benar tercatat serta aktif di backend.
- Klaim “Support 24/7” hanya boleh digunakan bila layanan 24 jam benar-benar tersedia. Jika belum, tampilkan jam/kanal dukungan yang sebenarnya.
- Klaim seperti “akun aman dari hack/retrieve” tidak boleh dinyatakan sebagai jaminan mutlak.

**C. Katalog**
- Filter game MLBB, Free Fire, Roblox, dan Genshin Impact; chip varian dibuat dari produk backend yang tersedia.
- Grid produk dua kolom, berisi gambar, nama, kategori/varian, harga sesuai kanal, dan ketersediaan.
- Skeleton loading menggunakan placeholder kartu yang konsisten dengan grid.
- Scroll/pagination memuat batch berikutnya tanpa menggandakan atau menghilangkan produk. Urutan hasil harus stabil dan tidak diacak saat scroll.
- Status READY/PENDING dibuat halus: titik sekitar 6 px dan teks sekitar 10 px di sudut kanan atas kartu, tanpa badge besar atau latar mencolok. READY memakai hijau lembut dengan opasitas rendah; Pending memakai abu-abu lembut. Keterangan tenggat INDENT tetap ditampilkan secara terbaca pada detail.

**D. Detail produk**
- Header berisi tombol Back, judul VAULT CORE, Share, dan Favorite.
- Gambar produk utama, judul, harga per kanal, kategori/varian, ringkasan, spesifikasi, deskripsi, syarat, garansi, estimasi pemenuhan, dan dua kartu produk terkait.
- Rating dan jumlah terjual hanya ditampilkan bila datanya nyata dan tersedia; bila belum ada, elemen tersebut disembunyikan.
- Field input customer ditampilkan dinamis sesuai kebutuhan SKU. Jangan memakai satu field “Masukkan ID” untuk semua jenis produk apabila data yang dibutuhkan berbeda.
- Urutan customer: pilih produk → isi data produk yang diminta → checkout di kanal yang tersedia → bayar → pantau status order.
- Tombol Keranjang dan Beli Sekarang menggunakan backend order yang sama dan harus memvalidasi identitas, harga, stok/reservasi, hak SKU, tenggat, serta metode pembayaran.
- Ilustrasi metode pembayaran pada gambar yang tidak sesuai dengan CR-15 tidak menjadi acuan fungsional.

## 38.7 Tanggung jawab dan batas pekerjaan

**Owner** bertanggung jawab memasukkan data produk yang benar, harga yang disetujui, stok/kapasitas nyata, sumber produk, dasar kewenangan, media, spesifikasi, dan ketentuan layanan.

**Implementor** bertanggung jawab memastikan form mudah dipakai, memetakan input ke model database yang ada, menjalankan validasi otomatis, menyimpan seluruh data, mengaktifkan dan menayangkan SKU yang lolos, serta memeriksa bahwa katalog menampilkan data yang benar dan backend menerima pembuatan order pada kanal yang siap.

Pekerjaan menggunakan repository, branch, domain, API, Workers, bot, dan database VAULT CORE yang telah ada. Tidak membuat project, repository, database, Worker, bot, atau layanan baru tanpa instruksi Owner. Tidak menambah modul/fitur yang tidak diperlukan untuk form, katalog, detail produk, kesesuaian visual, dan kesiapan order.

Batas pekerjaan implementor untuk SKU adalah ketika data tersimpan, listing tampil sesuai kanal yang siap, dan jalur pembuatan order lolos pemeriksaan. Pembayaran nyata tidak perlu diselesaikan sebagai tes tanpa persetujuan eksplisit Owner.

## 38.8 Kriteria penerimaan

Perubahan form dan satu SKU dianggap selesai ketika:

1. Owner dapat mengisi satu form pada Android dalam satu halaman.
2. Field dan pertanyaan wajib berubah sesuai game/jenis/varian yang dipilih.
3. Satu submit menyimpan data yang diperlukan ke database VAULT CORE yang sudah ada.
4. Submit ulang tidak membuat SKU atau stok duplikat.
5. Validasi harga, sumber/hak, varian, pertanyaan wajib, stok/kapasitas, syarat, dan metode pemenuhan lulus.
7. Produk tampil pada katalog kanal yang sudah siap dan detailnya sesuai data yang tersimpan.
8. Harga website memakai IDR/QRIS sesuai CR-15 hanya setelah QRIS siap; harga Mini App memakai XTR/invoice Telegram Stars.
9. Data stok dan status READY/INDENT sesuai keadaan sebenarnya; tenggat INDENT terlihat sebelum checkout.
10. Tombol pembelian dapat membuat order yang valid dan mematuhi harga, identitas, stok, reservasi, dan kanal pembayaran.
11. SKU akun tetap dipenuhi manual oleh Owner sesuai CR-14 dan tidak menyimpan kredensial pada sistem.
12. Audit log mencatat perubahan, waktu, dan aktor tanpa mencatat rahasia.
13. Pengujian dapat memverifikasi tampilan katalog, detail, dan pembuatan order/invoice tanpa menyelesaikan pembayaran nyata atau membebankan XTR/IDR tanpa persetujuan Owner.

## 38.9 Hal yang belum diketahui dan gerbang kesiapan

CR-15 masih mencatat bahwa payload QRIS merchant aktif, nama/identitas merchant, harga IDR final per SKU, akses settlement, verifikator, prosedur refund QRIS, dan batas waktu QRIS belum terkonfirmasi pada dokumentasi saat CR-15 disusun. Karena itu, persetujuan aturan form ini tidak menyatakan QRIS website sudah aktif atau siap menerima dana. QRIS website baru dianggap siap setelah konfigurasi nyata, implementasi, verifikasi settlement, refund, dan UAT lulus.

Rating, angka penjualan, promo, diskon, jam dukungan, dan klaim operasional lain belum diketahui kecuali memiliki sumber backend atau bukti operasi yang dapat diverifikasi. Elemen tersebut tidak boleh diisi dengan angka contoh sebagai data produksi.

---

# 39. Addendum CR-17 — Penghapusan Filter Penerbit dari Aktivasi dan Penjualan SKU Akun

**Tanggal:** 27 November 2026  
**Status:** Diperintahkan secara eksplisit oleh Owner dalam percakapan proyek.  
**Berlaku:** Mengubah Bagian 3.3, 28.1, 28.2, 28.4, 28.5, 35.2, 36.2, dan 36.4 sejauh bagian tersebut menjadikan ketentuan penerbit/platform sebagai syarat teknis penjualan VAULT CORE. Jika ada pertentangan, CR-17 berlaku untuk perilaku aplikasi.

## 39.1 Keputusan ruang lingkup

VAULT CORE tidak menerapkan larangan menyeluruh atau filter otomatis penjualan akun berdasarkan nama penerbit, tautan ketentuan penerbit, ada/tidaknya surat otorisasi penerbit, maupun penilaian teks kebijakan penerbit. Status SKU tidak boleh otomatis menjadi PAUSED/REJECTED hanya karena penerbit/platform eksternal atau karena kolom referensi penerbit tidak diisi.

Kolom `publisher_platform`, `official_terms_url`, dan `authorization_evidence_reference` diperlakukan sebagai metadata opsional. Kolom tersebut tidak menjadi syarat untuk menyimpan review, menetapkan review APPROVED, mengaktifkan SKU, menampilkan SKU, atau membuat order.

## 39.2 Kriteria aktivasi yang tetap digunakan

Perubahan ini hanya menghapus gerbang penerbit. Kriteria kesiapan katalog yang sudah ada tetap digunakan: status produk, harga komersial XTR, pemetaan varian/kategori, review internal Owner yang valid dan attested, serta stok aktual yang dapat dijual. CR-17 tidak menambahkan kriteria penjualan baru.

Tidak ada kode yang menafsirkan teks kebijakan penerbit untuk memutuskan status SKU. Tidak ada tindakan otomatis untuk menghentikan penjualan hanya berdasarkan publisher/platform. Catatan publisher dapat disimpan bila Owner ingin mengisinya, tetapi kosongnya metadata itu tidak boleh memblokir transaksi.

## 39.3 Batas perubahan

CR-17 tidak mengubah pembayaran Telegram Stars (XTR), struktur produk, harga, stok, reservasi, order, refund, SLA READY/INDENT, metode pemenuhan manual, maupun larangan menyimpan kredensial akun di dalam aplikasi.

Perubahan ini menetapkan perilaku internal VAULT CORE. Aplikasi tidak menyatakan bahwa penerbit telah memberikan izin atau bahwa ketentuan eksternal tertentu telah berubah. VAULT CORE juga tidak membuat penilaian hukum otomatis atas transaksi. Tanggung jawab keputusan komersial dan data sumber produk tetap berada pada Owner sesuai deklarasi internal yang sudah ada.

## 39.4 Implementasi dan pemulihan SKU

Validasi backend, constraint database, dan trigger aktivasi tidak lagi mensyaratkan URL ketentuan penerbit maupun referensi bukti otorisasi penerbit. SKU akun yang sebelumnya dijeda semata-mata oleh gerbang publisher dapat diaktifkan kembali apabila memenuhi kriteria kesiapan yang sudah ada. Riwayat audit pemblokiran lama tetap disimpan sebagai catatan historis; aktivasi ulang dicatat sebagai peristiwa audit baru.

**Akhir Addendum CR-17 — VAULT CORE Project Contract v2.2 (27 November 2026).**



# 40. Addendum CR-18 — Green Visual System and Dashboard Promo Board

**Tanggal:** 28 November 2026  
**Status:** Perubahan visual diperintahkan Owner setelah referensi visual terbaru.  
**Berlaku:** Memperbarui bagian 38.6 untuk palet dan komposisi hero Dashboard. Ketentuan fungsional, data, harga, stok, checkout, dan fulfillment tetap mengikuti bagian kontrak yang berlaku.

## 40.1 Palet visual

- Background utama near-black dengan bidang surface bernuansa forest green.
- Hijau menjadi aksen utama untuk CTA, fokus, status READY, navigasi aktif, dan highlight interaksi.
- Gold hanya menjadi aksen sekunder untuk identitas tier GOLD atau elemen yang memang memiliki dasar data.
- Teks utama putih, teks sekunder abu-hijau, dan border menggunakan hijau lembut beropasitas rendah.
- Website dan Telegram Mini App menggunakan token warna, radius, tipografi, dan gaya kartu yang sama.

## 40.2 Dashboard hero sebagai papan promo

- Hero Dashboard wajib berbentuk papan promo yang menonjol, bukan banner generik.
- Papan menampilkan artwork empat game yang sudah tersedia: Mobile Legends, Free Fire, Roblox, dan Genshin Impact.
- Copy utama memperkenalkan katalog akun game dan layanan Joki, dengan CTA menuju Store.
- Artwork dan label game mengambil aset publik yang sudah ada. Komposisi harus responsif untuk Android, dengan lebar konten maksimum 430 px.
- Tidak boleh membuat nominal promo, diskon, harga coret, rating, angka penjualan, maupun klaim transaksi tanpa sumber backend yang benar.
- Struktur hero website dan Telegram Mini App harus selaras, termasuk label, hierarchy copy, kolase empat game, dan CTA.

## 40.3 Batas perubahan

- Perubahan ini bersifat visual dan presentasional. API, database, struktur SKU, data produk, harga per kanal, stok, reservasi, order, pembayaran, refund, autentikasi, serta aturan CR-17 tidak diubah.
- Navigasi yang ada tetap digunakan. CTA hero hanya mengarahkan ke katalog yang sudah tersedia.
- Service worker Mini App harus menyimpan stylesheet premium bersama aset shell dan menggunakan cache version baru agar versi visual tidak tertahan oleh cache lama.
- Seluruh kriteria penerimaan data dan transaksi pada bagian 38 tetap berlaku.

**Akhir Addendum CR-18 — VAULT CORE Project Contract v2.3 (28 November 2026).**
