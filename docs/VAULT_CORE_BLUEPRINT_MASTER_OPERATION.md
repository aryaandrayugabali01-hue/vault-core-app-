# VAULT CORE
# Blueprint Proyek dan Master Operation (MO)

| Metadata | Nilai |
|---|---|
| Nama proyek | VAULT CORE |
| Dokumen | Blueprint Teknis, Produk, Operasional, QA, dan Deployment |
| Versi dokumen | 1.0 |
| Tanggal baseline | 21 November 2026 |
| Repository | aryaandrayugabali01-hue/vault-core-app- |
| Branch | main |
| Commit baseline yang diperiksa | 155bbc6bb4b64475dd10fec048614e53011f84cb |
| Kontrak acuan | PROJECT_CONTRACT.md v1.2 — Addendum CR-02 |
| Status kontrak | DISETUJUI PEMILIK — v1.2 CR-02; persetujuan tertulis tercatat 21 November 2026 pada PROJECT_CONTRACT.md Bagian 26.6 |
| Status produksi | DEPLOYED — NOT READY FOR GENERAL SALES (product setup and release acceptance pending) |
| Tujuan dokumen | Menjadi satu acuan kerja operasional sampai sistem lulus UAT dan rilis produksi |

> **Kedudukan dokumen.** Dokumen ini adalah blueprint pelaksanaan yang menjabarkan kontrak v1.2 CR-02 yang telah disetujui pemilik, sumber kode, konfigurasi, dan status deployment yang tercatat pada repository. Blueprint ini tidak menggantikan kontrak atau change request. Bila ada konflik, gunakan keputusan kontrak/change request yang telah disetujui pemilik sebagai dasar final. Perubahan terhadap baseline harus dicatat di bagian Decision Log dan dilakukan melalui pull request atau commit yang dapat ditelusuri.

---

## 0. Cara membaca dokumen dan status pekerjaan

Gunakan label berikut pada seluruh laporan, issue, dan checklist:

| Label | Arti | Bukti yang diperlukan |
|---|---|---|
| VERIFIED | Telah diperiksa langsung pada sumber atau layanan | Path/file, hasil query, log, atau URL pemeriksaan |
| IMPLEMENTED | Kode untuk kemampuan tersebut sudah ada | File sumber dan tes yang relevan |
| CI PASS | Pemeriksaan otomatis berhasil | URL run GitHub Actions dan commit SHA |
| CONFIGURED | Resource/secret/setting sudah diatur | Hasil baca balik dari layanan |
| DEPLOYED | Versi aplikasi sudah berjalan pada target | Deployment ID/version dan URL |
| LIVE TEST PASS | Alur berhasil diuji pada layanan produksi | Waktu uji, order/test ID, hasil, dan bukti audit |
| PENDING | Belum dilakukan atau menunggu akses/keputusan | Owner dan tindakan berikutnya |
| UNKNOWN | Sumber yang tersedia belum memberikan jawabannya | Pertanyaan yang harus dijawab pemilik atau penyedia layanan |
| BLOCKED | Pekerjaan tertahan oleh dependensi tertentu | Penyebab, pihak penanggung jawab, dan syarat pembuka |

**Aturan pelaporan:** jangan menyebut pekerjaan DEPLOYED hanya karena build berhasil. Jangan menyebut pembayaran LIVE PASS berdasarkan simulasi atau hasil unit test. Jangan menyebut akun atau izin terverifikasi tanpa hasil baca balik dari akun yang benar.

## 1. Ringkasan eksekutif

VAULT CORE adalah toko digital single-vendor yang beroperasi melalui Telegram Bot dan Telegram Mini App. Satu pemilik mengelola katalog, produk, harga, modal, inventaris, pesanan, pembayaran Telegram Stars, pengiriman digital, refund, biaya operasional, dan laporan usaha.

Sasaran penyelesaian:

1. Customer dapat membuka Mini App dari Telegram, melihat katalog, membuat pesanan, membayar dalam XTR, dan menerima produk digital yang sah setelah pembayaran tervalidasi.
2. Owner dapat mengelola produk, memeriksa referensi hak distribusi, mengisi stok terenkripsi, memantau order, melakukan retry delivery/refund, mencatat biaya, dan membaca ringkasan usaha.
3. Seluruh perubahan penting mempunyai jejak audit; transaksi dan pengiriman memiliki kontrol idempotensi.
4. Aplikasi berjalan melalui arsitektur Cloudflare Workers yang telah dipilih, dengan Neon PostgreSQL dipertahankan melalui Hyperdrive.
5. Proyek lulus pengujian fungsional, keamanan, pemulihan, performa, UAT, dan pengujian live yang disyaratkan sebelum status produksi berubah menjadi READY.

### Hasil teknis yang telah terverifikasi pada baseline dan live recheck 21 November 2026

- Latest verified source on `main`: `f682001ee694937d9ba2da77b70867dfdc56f6e3`.
- GitHub Actions CI run `44885310611`: SUCCESS on the same commit (backend/core tests, Mini App build, API Worker dry-run).
- Cloudflare frontend preparation run `44885310642`: SUCCESS on the same commit (Vinext compatibility, Cloudflare integration, Worker build/output verification).
- Neon database `vault_core` contains 10 application tables and five registered migrations (`001`–`005`).
- Source includes Telegram authentication, catalog, order reservation with owner binding, single pre-checkout claim per order, Stars invoice/payment idempotency, encrypted inventory, ambiguous delivery reconciliation, two-phase Stars refund recovery, Owner API and gateway source.
- Production deployment run `44902626165` attempt 1 completed SUCCESS: `vault-core-api`, `vault-core-web`, and the existing gateway are live; gateway origins, three custom domains, public DNS/TLS checks, API+Neon health, and Telegram webhook read-back all passed.
- The latest production application deployment uses source commit `eafd57dca29404729d2dad7587810e7b025a8cdf` and passed the full deployment workflow on attempt 1. All required secrets, Cloudflare token, Hyperdrive and Telegram bot identity preflight checks passed.
- Telegram production webhook configuration and `getWebhookInfo` read-back passed. The database has 4 TEST-only products in DRAFT, 0 inventory items, 0 orders and 0 transactions. Live customer XTR payment/refund/delivery, IDOR, backup/restore and Owner UAT remain pending.

## 2. Prinsip dan ruang lingkup yang dikunci

### 2.1 Keputusan produk

| Area | Baseline |
|---|---|
| Model usaha | Single-vendor store |
| Pemilik barang dan inventaris | Pemilik VAULT CORE |
| Kanal | Telegram Bot dan Telegram Mini App |
| Customer | Membeli dan melihat pesanan miliknya |
| Owner/Admin | Mengelola seluruh fungsi toko sesuai allowlist server-side |
| Katalog awal | MLBB, Roblox, Free Fire, Genshin Impact, dan kategori tambahan hanya melalui persetujuan |
| Tier | Silver, Gold, Platinum; SERVICE tersedia pada enum database |
| Pembayaran digital di Telegram | Invoice Telegram Stars dengan currency XTR |
| Pemenuhan | Payload/kode digital yang sah, terenkripsi, dan dikirim setelah pembayaran tervalidasi |
| Database | PostgreSQL yang sudah digunakan proyek |
| Hosting target | Cloudflare Workers |
| Domain target | vaultcore.biz.id |
| Satuan nilai uang | XTR untuk harga, modal, biaya, laporan, dan transaksi |

### 2.2 Tipe payload yang diizinkan oleh baseline kontrak dan kode

- REDEEM_CODE
- VOUCHER_CODE
- LICENSE_KEY
- GIFT_CODE
- DIGITAL_FILE
- SERVICE_INSTRUCTIONS

Setiap SKU wajib memiliki dasar hak jual/pemenuhan yang dapat diperiksa. Produk dimulai dari DRAFT atau PENDING_REVIEW dan baru boleh ACTIVE setelah referensi pemeriksaan hak produk tercatat.

### 2.3 Batasan operasional yang wajib dijaga

- Sistem tidak mengelola atau mengirim paket kredensial akun game, password email, session cookie/token, OTP, backup/recovery code, atau informasi yang memberi kendali atas akun pihak ketiga.
- Digital goods/services di dalam Telegram dibayar melalui invoice Telegram Stars. VAULT CORE tidak menyediakan alamat wallet XTR manual sebagai checkout Mini App.
- Bukti tangkapan layar atau klaim customer tidak dapat mengubah order menjadi PAID.
- successful_payment yang valid adalah dasar pencatatan pembayaran.
- Display stock tidak pernah boleh melebihi stok yang benar-benar dapat dijual. Override hanya menjadi display cap, dan checkout selalu memakai angka stok aktual.
- Harga, modal, dan biaya harus disimpan sebagai snapshot untuk menjaga laporan historis.
- Rahasia produksi tidak boleh dimasukkan ke repository, dokumen publik, issue, screenshot, atau percakapan.
- Perubahan arsitektur besar, provider, metode pembayaran, kategori barang, atau model usaha memerlukan change request.

### 2.4 Di luar ruang lingkup baseline

- Marketplace multi-vendor.
- Pendaftaran penjual pihak ketiga.
- Pengiriman kredensial akun game atau data autentikasi.
- Pembayaran XTR melalui alamat wallet manual.
- Stok publik palsu yang melebihi stok tersedia aktual.
- Aplikasi native Android/iOS yang terpisah dari Telegram Mini App.
- Sistem referral, membership, subscription, loyalty, atau provider pembayaran tambahan sebelum ada change request dan tinjauan kebijakan.

## 3. Peta arsitektur target

### 3.1 Komponen

| Komponen | Nama/resource | Peran | Status tercatat pada baseline |
|---|---|---|---|
| Source repository | aryaandrayugabali01-hue/vault-core-app- | Source of truth | Source terbit di main |
| Frontend | Next.js 15 / React 19 + Vinext | Telegram Mini App dan Owner Console | PRODUCTION DEPLOYED; public root/www checks passed |
| API | Express 5 melalui Cloudflare node httpServerHandler | API katalog, order, admin, webhook | PRODUCTION DEPLOYED; `/health` and Neon connection PASS |
| Gateway | vault-core-gateway | Routing host/path ke frontend dan API | Tercatat deployed |
| Frontend Worker target | vault-core-web | Menjalankan frontend | DEPLOYED and public root/www checks PASS |
| API Worker target | vault-core-api | Menjalankan API | DEPLOYED; Hyperdrive and runtime secrets attached |
| Database | Neon PostgreSQL, project VAULT CORE | Persistensi data transaksi | Tercatat tersedia dan terhubung |
| Database edge connector | Hyperdrive vault-core-neon | Koneksi Worker ke Neon | Tercatat dibuat dan dikonfigurasi |
| Telegram Bot API | Bot production milik owner | Invoice, webhook, notifikasi, delivery, refund | Bot identity verified; production webhook set and `getWebhookInfo` read-back PASS |
| Domain | vaultcore.biz.id | URL Mini App | Root/www/api domains attached to existing gateway; public DNS/TLS workflow checks PASS |

### 3.2 Aliran request

    Customer di Telegram Android
            |
            | membuka Mini App
            v
    https://vaultcore.biz.id
            |
            v
    Cloudflare Worker: vault-core-gateway
            |
            +---- WEB_ORIGIN ----> vault-core-web (Vinext / Next.js)
            |
            +---- API_ORIGIN ----> vault-core-api (Express 5)
                                      |
                                      +---- HYPERDRIVE ----> Neon PostgreSQL
                                      |
                                      +---- Telegram Bot API

    Telegram Bot API
            |
            | POST webhook + X-Telegram-Bot-Api-Secret-Token
            v
    https://api.vaultcore.biz.id/api/telegram/webhook
            |
            v
    vault-core-gateway -> vault-core-api -> Neon + Telegram Bot API

### 3.3 Keputusan runtime database

- Node.js local development/migration menggunakan pg.Pool.
- API Worker menggunakan satu pg.Client baru untuk setiap request melalui AsyncLocalStorage.
- Semua query dan transaksi database dalam request yang sama memakai client request tersebut.
- Hyperdrive mengelola koneksi origin ke Neon dan membersihkan client pada akhir invocation.
- Jangan mengubah kembali Worker runtime menjadi global pg.Pool tanpa evaluasi lifecycle dan tes konkurensi.

### 3.4 Sumber konfigurasi penting

- API Worker config: wrangler.api.jsonc.
- API Worker entrypoint: cloudflare/vault-core-api.js.
- Gateway source: cloudflare/vault-core-gateway.js.
- Frontend Cloudflare config: frontend/cloudflare.config.ts.
- Frontend Vite config: frontend/vite.config.ts.
- Production workflow: .github/workflows/deploy-production.yml.
- CI workflow: .github/workflows/ci.yml.
- Frontend preparation workflow: .github/workflows/prepare-vinext.yml.
- Runbook deployment: PRODUCTION_DEPLOYMENT_RUNBOOK.md.
- Kontrak proyek: PROJECT_CONTRACT.md.
- Status deployment: DEPLOYMENT_STATUS.md.

### 3.5 Larangan perubahan arsitektur tanpa change request

Pekerjaan lanjutan harus menggunakan repository, database, gateway, dan target Worker yang telah dipilih. Tidak membuat repository, database, bot, gateway, atau arsitektur pengganti hanya untuk menghindari pekerjaan integrasi yang belum selesai. Perubahan yang diperlukan dicatat sebagai issue dan dinilai terhadap source saat ini.

## 4. Struktur modul dan tanggung jawab

| Modul | Tanggung jawab utama | Sumber terkait |
|---|---|---|
| Telegram Authentication | Validasi initData dan sinkronisasi customer | backend/utils/telegram.js, backend/middleware/telegramAuth.js |
| Catalog | Menampilkan SKU ACTIVE dan informasi stok tampilan | backend/routes/catalog.js, backend/services/catalogService.js |
| Orders | Membuat nomor order, snapshot harga/modal, dan reservasi stok | backend/controllers/orderController.js |
| Payments | Invoice XTR, pre-checkout, successful payment, charge ID | backend/controllers/paymentController.js, backend/services/telegramApi.js |
| Telegram Webhook | Memvalidasi secret header dan merutekan event Telegram | backend/routes/telegramWebhook.js |
| Inventory | Menambah payload digital dan mengenkripsinya | backend/routes/admin.js, backend/utils/encryption.js |
| Delivery | Mengambil payload terenkripsi dan mengirim ke customer | backend/services/deliveryService.js |
| Owner/Admin API | Dashboard, produk, stok, order, expense, refund, retry | backend/routes/admin.js |
| Database | Tabel, constraint, migration, transaction | database/migrations |
| Frontend Customer | Mini App, katalog, checkout, order history | frontend/src/app |
| Frontend Owner | Console pemilik toko | frontend/src/app/admin |
| Deployment | Build, Worker deploy, secrets, health check | .github/workflows |
| Gateway | Proxy API dan frontend ke origin Worker | cloudflare/vault-core-gateway.js |

## 5. Peta fitur: implemented versus target

Status pada tabel ini mengikuti file sumber yang diperiksa, bukan penilaian visual atau klaim yang belum diuji pada produksi.

| Fitur | Kondisi sumber | Status kerja |
|---|---|---|
| Validasi Telegram Mini App initData | Middleware validasi dan upsert customer tersedia | IMPLEMENTED; perlu tes live |
| Role Owner | ADMIN_TELEGRAM_IDS diperiksa pada backend | IMPLEMENTED; konfigurasi owner production PENDING |
| Katalog produk aktif | GET /api/catalog tersedia | IMPLEMENTED; perlu UAT |
| Detail produk per ID | Route khusus GET /api/products/:id tidak ditemukan pada route yang diperiksa | PENDING |
| Order baru | POST /api/orders tersedia | IMPLEMENTED; perlu concurrency test pada staging |
| Riwayat order customer | GET /api/orders/mine tersedia | IMPLEMENTED |
| Detail order customer | Endpoint detail single order tidak ditemukan pada route yang diperiksa | PENDING |
| Reservasi stok | Row locking/SKIP LOCKED, `reserved_order_id`, dan owner constraint tersedia | IMPLEMENTED; CI PASS; concurrency/staging test pending |
| Pembayaran XTR | Invoice Telegram Stars tersedia | IMPLEMENTED; belum live tested |
| Pre-checkout | User, status, currency, amount, reservation ownership, expiry, and unique pre-checkout query ID per order are validated | IMPLEMENTED; CI PASS; Telegram live test pending |
| Successful payment | Charge ID unique, same-order idempotency, and pre-checkout claim required | IMPLEMENTED; CI PASS; Telegram replay/live test pending |
| Enkripsi inventory | Payload encryption saat ditambahkan; ciphertext/nonce/tag disimpan | IMPLEMENTED; perlu key rotation/recovery drill |
| Delivery otomatis | Protected content; inventory order-owner check; stale/ambiguous sends go to REVIEW_REQUIRED | IMPLEMENTED; CI PASS; Telegram fail/retry/duplicate test pending |
| Retry delivery Owner | Retry only for definitive Telegram rejection; ambiguous outcomes use Owner reconciliation endpoint | IMPLEMENTED; CI PASS; live acceptance pending |
| Refund Stars Owner | Two-phase REFUND_PENDING; Telegram already-refunded charge can be reconciled against getStarTransactions before final status | IMPLEMENTED; CI PASS; live Stars refund test pending |
| Dashboard Owner | Ringkasan penjualan, stok, order, biaya, profit tersedia | IMPLEMENTED; perlu rekonsiliasi angka |
| CRUD produk | Create dan patch tersedia; detail route/soft deletion perlu diuji | PARTIAL |
| Inventory add | Endpoint menambah satu/banyak payload ada | IMPLEMENTED |
| Inventory edit/status | Endpoint perubahan status item tidak terlihat pada sumber route yang diperiksa | PENDING |
| Operating expenses | POST expense tersedia | IMPLEMENTED; perlu filter/edit/audit review |
| Order list Owner | Daftar maksimum 200 order tersedia | IMPLEMENTED; pagination/filter belum dibuktikan |
| Audit log query | Write audit helper ada; endpoint baca/ekspor belum ditemukan | PENDING |
| Reporting filter/export | Dashboard agregat ada; endpoint laporan filter/ekspor belum ditemukan | PENDING |
| Telegram /start, /help, /paysupport | Handler webhook tersedia | IMPLEMENTED; webhook configured; customer/Owner end-to-end tests pending |
| Webhook bot setup | bot/bot.js mengatur webhook Telegram | CONFIGURED; webhook read-back PASS in production run |
| Bot process polling | Tidak tampak sebagai proses polling terpisah; webhook ditangani API | Bukan komponen target pada arsitektur saat ini |
| API Worker live | API and Neon health checked through production workflow | DEPLOYED / HEALTH PASS |
| Frontend Worker live | Public root/www HTTPS checks passed | DEPLOYED / HEALTH PASS |
| Gateway origins/domains | Gateway secrets, custom domains and public DNS/TLS checked by production workflow | CONFIGURED / VERIFIED |
| Backup/restore test | Belum ada bukti uji | PENDING |
| IDOR/security acceptance | Belum ada bukti hasil uji | PENDING |
| Live payment/refund/delivery | Belum ada bukti | PENDING |
| UAT owner | Belum ada bukti persetujuan UAT | PENDING |

## 6. Alur operasional customer

### 6.1 Mulai dan autentikasi

1. Customer membuka bot dan mengirim /start.
2. Bot mengirim tombol Web App menuju domain Mini App.
3. Frontend membaca konteks Telegram Web App.
4. API memverifikasi raw initData di server menggunakan bot token, HMAC, dan batas umur auth_date.
5. API membuat atau memperbarui customer berdasarkan Telegram user ID.
6. Semua data order customer dibatasi pada customer ID yang terautentikasi.

Identitas dari initDataUnsafe di frontend bukan sumber otoritatif untuk authorization.

### 6.2 Pilih dan checkout produk

1. Customer memilih kategori game.
2. Customer memilih tier atau SKU.
3. Detail menampilkan nama, deskripsi, harga XTR, ketersediaan, dan ketentuan layanan.
4. Customer memilih kuantitas sesuai limit API.
5. Backend mengunci produk dan unit stok dalam transaksi.
6. Backend membuat order dengan order number unik dan snapshot produk, harga, modal, dan total.
7. Backend mereservasi unit stok dan membuat delivery record.
8. Backend membuat invoice Telegram Stars.
9. Jika invoice gagal dibuat, order ditandai FAILED dan reservasi dilepas sesuai transaksi pemulihan.

### 6.3 Payment lifecycle

    PENDING_PAYMENT
          |
          | Telegram pre_checkout_query
          v
    Validasi order + owner + payload + XTR + amount + stok reserved
          |
          +---- gagal ----> Tolak pre-checkout
          |
          v
    Telegram successful_payment
          |
          v
    Validasi charge ID + order lock + customer + currency + amount
          |
          v
    Simpan transaction PAID dan order PAID secara atomik
          |
          v
    Mulai delivery
          |
          +---- sukses ---> Order FULFILLED
          |
          +---- gagal ----> Order FULFILLING, delivery FAILED/REVIEW

Telegram webhook harus menerima header X-Telegram-Bot-Api-Secret-Token yang cocok dengan secret konfigurasi. Event yang sama harus aman untuk dikirim ulang.

### 6.4 Delivery lifecycle

1. Hanya order dengan pembayaran valid dan status yang memenuhi syarat yang dapat dikirim.
2. Delivery record diklaim secara atomik sebelum pemrosesan.
3. Payload dibuka dari ciphertext di sisi service delivery.
4. Bot mengirim isi produk kepada Telegram user ID order.
5. Delivery menyimpan message ID, status, delivered_at, attempt_count, dan failure information.
6. Item inventaris berubah menjadi SOLD setelah pengiriman berhasil tercatat.
7. Kegagalan terlihat oleh Owner dan hanya dapat diulang melalui mekanisme retry yang tercatat.
8. Kegagalan jaringan yang hasil pengiriman Telegram-nya ambigu harus masuk pemeriksaan manual sebelum pengiriman ulang.

### 6.5 Riwayat customer

Customer hanya dapat melihat order miliknya. Riwayat harus memperlihatkan order number, produk, jumlah, total XTR, waktu, status bayar, status fulfilment, dan cara meminta bantuan. Endpoint detail order dan delivery receipt yang belum ada harus ditambahkan setelah keputusan UI/API dicatat di backlog.

## 7. Alur kerja Owner/Admin

### 7.1 Aktivasi produk

1. Owner membuat produk dengan SKU, kategori, tier, tipe fulfillment, deskripsi, harga jual XTR, modal XTR, dan referensi pemeriksaan hak.
2. Produk tersimpan sebagai DRAFT.
3. Owner menyertakan referensi pemeriksaan hak distribusi/pemenuhan per SKU.
4. Reviewer memeriksa ketentuan penerbit/platform, bukti hak, konten, dan cara pengiriman.
5. Produk hanya dapat diaktifkan setelah review reference ada dan pemeriksaan manual dinyatakan selesai.
6. Produk yang berubah kebijakan atau sumbernya tidak lagi valid segera di-pause.

Pada kode saat ini, syarat ACTIVE memeriksa keberadaan rights_review_reference. Keberadaan teks referensi bukan pengganti review substantif. Proses bukti, reviewer, tanggal review, dan masa berlaku harus diselesaikan di SOP/admin workflow.

### 7.2 Input stok

1. Pilih SKU yang sudah disetujui.
2. Input payload dalam jumlah terbatas per batch.
3. Backend memvalidasi tipe payload yang diizinkan.
4. Payload dienkripsi sebelum disimpan.
5. Owner melihat jumlah item masuk dan stok aktual.
6. Owner melakukan sample check melalui order internal/test yang aman.
7. Setiap penambahan stok dicatat sebagai aktivitas audit.

Jangan masukkan kredensial login, password, OTP, cookie, session token, atau recovery codes ke inventory.

### 7.3 Pengelolaan harga dan modal

- Sale price XTR adalah jumlah Stars untuk invoice.
- Sale price XTR adalah harga jual yang digunakan pada invoice.
- Cost price XTR adalah nilai modal internal yang ditetapkan Owner.
- Perubahan harga berlaku untuk order baru.
- Order lama tetap menggunakan snapshot saat dibuat.
- Kurs, komisi, pencairan, dan penerimaan bersih tidak boleh disamakan dengan nilai nominal XTR tanpa data aktual.

### 7.4 Pemantauan order

Owner memantau:
- Pending payment.
- Paid/fulfilling.
- Fulfilled.
- Failed/cancelled.
- Refund pending/refunded.
- Delivery failed/review required.

Untuk kegagalan:
1. Buka order dan periksa payment charge ID.
2. Periksa delivery record, inventory item, attempt_count, dan last_error.
3. Tentukan apakah Telegram sudah mengirim pesan sebelumnya.
4. Retry hanya setelah dipastikan tidak terjadi pengiriman ganda.
5. Catat alasan dan hasil tindakan ke audit log.

### 7.5 Refund

1. Cocokkan nomor order, customer, transaction, jumlah, dan Telegram payment charge ID.
2. Periksa eligibility dan alasan refund sesuai policy.
3. Jalankan refund resmi melalui Telegram Stars.
4. Pastikan API Telegram mengembalikan sukses sebelum status internal dipromosikan ke REFUNDED.
5. Catat aktor, alasan, referensi charge, dan waktu.
6. Tinjau apakah delivery/inventory harus direvoke atau tetap SOLD sesuai status pemakaian.
7. Cocokkan hasil refund dengan laporan transaksi.

Refund dilakukan melalui Telegram API; bukan transfer manual dengan cara lain. Operasi eksternal dan transaksi database perlu diuji terhadap timeout serta respons ambigu.

### 7.6 Biaya dan laporan

Owner mencatat biaya operasional langsung dalam XTR dengan kategori, deskripsi, tanggal kejadian, dan aktor. Laporan menggunakan satuan yang konsisten:
- Gross sales XTR.
- Cost of goods XTR.
- Operating expenses XTR.
- Gross profit XTR.
- Net profit XTR.
- Refund XTR.

Formula:
- Penjualan bersih = gross sales − refund.
- Profit kotor = penjualan bersih − modal barang.
- Profit bersih = profit kotor − biaya operasional.
- Margin kotor (%) = profit kotor ÷ penjualan bersih × 100.

Harga dan modal disimpan sebagai snapshot XTR pada saat order dibuat. Aplikasi tidak melakukan konversi atau menampilkan nilai mata uang lain.

## 8. Status data dan konsistensi workflow

### 8.1 Status yang ada di migration saat ini

Order:
- PENDING_PAYMENT
- PAID
- FULFILLING
- FULFILLED
- CANCELLED
- REFUND_PENDING
- REFUNDED
- FAILED

Inventory:
- AVAILABLE
- RESERVED
- SOLD
- UNAVAILABLE

Product:
- DRAFT
- PENDING_REVIEW
- ACTIVE
- PAUSED
- ARCHIVED

Delivery:
- PENDING
- READY
- DELIVERED
- FAILED
- REVOKED

Transaction:
- PENDING
- PAID
- REFUND_PENDING
- REFUNDED
- FAILED

### 8.2 Selisih terhadap kontrak

PROJECT_CONTRACT.md Bagian 11 mendefinisikan status bisnis yang lebih rinci, termasuk PAYMENT_PROCESSING, FULFILLMENT_PENDING, FULFILLMENT_PROCESSING, PAYMENT_EXPIRED, FULFILLMENT_FAILED, dan MANUAL_REVIEW. Enum database saat ini menggunakan status yang lebih ringkas. Sebelum menambah migration status, owner dan implementor harus menyetujui mapping dan UI label. Jangan mengubah enum database hanya dengan mengganti label frontend.

### 8.3 Invariant wajib

- Satu Telegram charge ID hanya boleh terkait dengan satu order.
- Order hanya menjadi PAID setelah successful_payment diverifikasi server.
- User yang membayar harus sama dengan owner order.
- Currency harus XTR dan amount harus sama persis.
- Customer hanya membaca order miliknya sendiri.
- Satu inventory item tidak boleh direservasi atau dijual untuk dua order berbeda.
- Display stock tidak boleh lebih tinggi dari sellable stock.
- Payload inventory disimpan encrypted.
- Perubahan produk, harga, stok, biaya, refund, dan tindakan owner penting harus tercatat.
- Pengiriman tidak dijalankan sebelum pembayaran.
- Pengiriman ulang harus terkendali dan mempunyai rekam attempt.
- Refund tidak menghapus histori pembayaran/audit.

## 9. Peta database dan integritas data

Migration yang tercatat:
- database/migrations/001_initial_schema.sql
- database/migrations/002_finance_and_order_snapshots.sql
- database/migrations/003_delivery_recovery.sql
- database/migrations/004_reservation_ownership_and_delivery_review.sql
- database/migrations/005_pre_checkout_single_payment_guard.sql

Migration 004 menambahkan `inventory_items.reserved_order_id`, constraint owner reservation, delivery status `REVIEW_REQUIRED`, dan partial unique index untuk active delivery per inventory item. Migration 005 menambahkan `orders.pre_checkout_query_id` dengan partial unique index agar satu order hanya dapat memiliki satu checkout claim unik. Kedua migration tercatat applied di Neon dengan checksum yang cocok dengan source file.

Tabel yang tercatat pada database deployment status:
- customers
- products
- inventory_items
- orders
- order_items
- transactions
- deliveries
- operating_expenses
- admin_audit_logs
- schema_migrations

### 9.1 Relasi konseptual

    customers 1----N orders
    orders    1----N order_items
    products  1----N order_items
    products  1----N inventory_items
    orders    1----N transactions
    orders    1----N deliveries
    admin actions 1----N admin_audit_logs

### 9.2 Data sensitif

- Inventory payload plaintext hanya berada selama proses enkripsi/dekripsi yang diperlukan.
- Ciphertext, nonce, dan authentication tag disimpan.
- Bot token, webhook secret, encryption key, database credential, dan API token tidak boleh disimpan dalam tabel aplikasi atau log.
- Raw Telegram payment metadata harus disanitasi sebelum penyimpanan.
- Data customer dibatasi pada identitas/atribut yang diperlukan untuk transaksi dan dukungan.
- Retention period belum diputuskan; owner harus menetapkan masa retensi dan tata cara penghapusan/anonimisasi.

### 9.3 Pemeriksaan database sebelum rilis

- Pastikan semua migrations telah tercatat sebagai applied.
- Periksa constraint unique untuk SKU, order number, charge ID, dan delivery idempotency key.
- Periksa index untuk query katalog, order status, transaction, inventory dan retry.
- Uji reservasi stok paralel.
- Uji rollback ketika invoice gagal.
- Uji kegagalan koneksi database dan pemulihan.
- Uji backup/restore terhadap salinan database non-produksi.
- Pastikan role runtime hanya memiliki hak yang diperlukan.

## 10. Keamanan dan privasi

### 10.1 Autentikasi dan otorisasi

- Telegram initData diverifikasi server-side melalui HMAC dan batas waktu auth_date.
- Telegram user ID dari data valid menjadi identitas customer.
- Owner allowlist diambil dari ADMIN_TELEGRAM_IDS pada environment.
- Endpoint admin memakai middleware autentikasi Telegram dan pemeriksaan allowlist.
- Semua endpoint customer wajib memiliki ownership check pada data order.
- UI hiding bukan kontrol otorisasi.

### 10.2 Webhook

- Secret token diverifikasi melalui X-Telegram-Bot-Api-Secret-Token.
- Bandingkan secret secara timing-safe.
- Tolak request tanpa secret yang valid.
- Jangan tulis raw webhook body ke log.
- Pastikan event duplicate aman dan payment charge ID konsisten.

### 10.3 Proteksi aplikasi

- Helmet dan CORS origin allowlist.
- JSON body size limit.
- Schema validation dan sanitasi input.
- Parameterized SQL.
- IP/user rate limiting.
- Proteksi terhadap IDOR, replay, XSS, SQL injection, CSRF bila relevan, dan abuse checkout.
- Rate limiter yang process-local tidak cukup untuk multi-instance scale. Gunakan kontrol edge/shared state yang disetujui sebelum peningkatan skala.
- Jangan membuka endpoint owner melalui public token atau parameter yang dikendalikan frontend.

### 10.4 Secret management

Secret produksi disimpan melalui GitHub Repository Actions Secrets dan/atau Cloudflare Worker Secrets sesuai kebutuhan runtime. Nilai secret tidak ditulis pada dokumen ini.

Nama secret workflow saat ini:
- CLOUDFLARE_API_TOKEN
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- ADMIN_TELEGRAM_IDS
- APP_ENCRYPTION_KEY
- SUPPORT_CONTACT (optional)

Format dan tujuan:
- CLOUDFLARE_API_TOKEN: token Cloudflare untuk deployment Worker dan pembacaan Hyperdrive sesuai permission minimal yang disyaratkan runbook.
- TELEGRAM_BOT_TOKEN: token bot produksi dari BotFather.
- TELEGRAM_WEBHOOK_SECRET: secret untuk header webhook Telegram.
- ADMIN_TELEGRAM_IDS: ID numerik Telegram owner/admin, dipisahkan koma.
- APP_ENCRYPTION_KEY: base64 yang setelah decode tepat 32 byte untuk AES-256-GCM.
- SUPPORT_CONTACT: alamat/username bantuan, opsional.

**Jangan menempelkan nilai secret ke file sumber, commit, issue, chat, atau log.** Rotasi token harus diikuti pembaruan secret, deploy, tes, lalu pencabutan token lama.

### 10.5 Privasi dan legal

- Minimalkan data pelanggan dan payment metadata.
- Tetapkan privacy notice, terms, refund policy, SLA support, dan masa retensi.
- Owner perlu memeriksa kewajiban usaha, PSE, NIB/KBLI, perlindungan data pribadi, dan aturan platform dengan pihak kompeten sebelum operasional publik.
- Bukti hak distribusi produk disimpan sebagai referensi dan dapat ditelusuri.

## 11. Performa, monitoring, backup, dan pemulihan

### 11.1 Target dasar

- Mini App target loading awal maksimal 3 detik pada perangkat/jaringan uji yang disepakati dan dicatat.
- Katalog memakai pagination/lazy loading saat ukuran data menuntut.
- Tidak ada data rahasia pada response/list umum.
- Webhook dan payment processing tidak bergantung pada Mini App tetap terbuka.
- Semua error penting mempunyai log dan indikator yang dapat diperiksa.
- Gateway health, API health, database connectivity, dan frontend response diperiksa secara terpisah.

### 11.2 Monitoring minimum

- Worker runtime exceptions dan error rate.
- Gateway 502/503.
- API /health dengan database connected.
- Telegram webhook response errors.
- Pre-checkout rejection rate.
- Successful payment count dan duplicate event count.
- Delivery FAILED/READY lama dan jumlah retry.
- Refund failure.
- DB connection errors.
- Inventory/order mismatch.
- Rate-limit rejection.

### 11.3 Backup dan restore

SOP minimum:
1. Tentukan frekuensi backup dan retention.
2. Simpan backup terenkripsi terpisah dari runtime credential.
3. Simpan versi migration yang cocok dengan backup.
4. Uji restore ke database non-produksi.
5. Validasi count tabel, relasi, transaksi, inventory status, dan audit log.
6. Catat waktu recovery, kehilangan data yang mungkin, serta pemilik persetujuan restore.
7. Jalankan restore produksi hanya dengan persetujuan owner dan incident record.

Frekuensi backup, RPO, dan RTO belum ditetapkan di dokumen kontrak; statusnya UNKNOWN sampai owner menyetujuinya.

## 12. Deployment Blueprint dan prosedur rilis

### 12.1 Infra yang tercatat pada baseline

| Resource | Nilai tercatat |
|---|---|
| Cloudflare Account ID | 67d2069a9ae076d3ce63a9aca629ea8b |
| Active zone | vaultcore.biz.id |
| Zone ID | 74092a358232c7bf501da8d822fabb47 |
| Gateway Worker | vault-core-gateway |
| Gateway URL | https://vault-core-gateway.premiumdigital-id.workers.dev |
| Gateway deployment ID | 2b5db563f86e4f77a73b3b0482fcbd48 |
| Hyperdrive | vault-core-neon |
| Hyperdrive ID | 97e2993f7733422abd08bfbf699ce4e4 |
| Neon Project | soft-morning-26299268 |
| Neon DB | vault_core |
| Neon region | aws-ap-southeast-1 (Singapore) |
| API Worker target | vault-core-api |
| Frontend Worker target | vault-core-web |
| Domain target | vaultcore.biz.id |
| Telegram webhook target | https://api.vaultcore.biz.id/api/telegram/webhook |

Nilai di atas adalah catatan pada Deployment Status/runbook yang dibaca dari repository; status resource live harus dibaca ulang pada dashboard/connector saat deployment.

### 12.2 GitHub Actions secrets

Lokasi konfigurasi:
Repository → Settings → Secrets and variables → Actions → New repository secret.

Tambahkan kelima secret wajib yang terdaftar pada Section 10.4. Tambahkan SUPPORT_CONTACT bila sudah diputuskan. Validasi workflow menghentikan proses sebelum deployment apabila secret wajib hilang, APP_ENCRYPTION_KEY bukan base64 32-byte valid, atau ADMIN_TELEGRAM_IDS bukan daftar ID numerik.

### 12.3 Release preflight

Sebelum menjalankan workflow:
- Pemilik mengonfirmasi bot produksi dan token yang benar.
- Owner Telegram ID telah diperiksa langsung dari akun yang benar.
- CLOUDFLARE_API_TOKEN dibuat di akun Cloudflare yang memiliki resource project.
- API token memiliki permission sesuai runbook dan resource account/zone yang tepat.
- Secret webhook dibuat dan disimpan.
- Encryption key 32 byte dibuat dan disimpan.
- .env atau secret lokal tidak pernah di-commit.
- Database migrations dan runtime role telah diverifikasi.
- Main commit sudah lulus CI dan frontend preparation.
- Owner memberi persetujuan deployment berdasarkan kontrak/change request yang disepakati.

### 12.4 Urutan deployment yang ada pada workflow

Workflow: .github/workflows/deploy-production.yml

1. Checkout main.
2. Setup Node.js 22.
3. Install dependency menggunakan npm ci dan lockfile.
4. Validasi secret, panjang APP_ENCRYPTION_KEY, dan format ADMIN_TELEGRAM_IDS.
5. Jalankan npm test.
6. Deploy API Worker menggunakan wrangler.api.jsonc.
7. Pasang TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ADMIN_TELEGRAM_IDS, APP_ENCRYPTION_KEY sebagai Worker secrets.
8. Pasang SUPPORT_CONTACT jika tersedia.
9. Deploy frontend Worker melalui script deploy:vinext.
10. Verifikasi URL API Worker /health dan frontend Worker workers.dev.

Run workflow hanya setelah preflight disetujui. Simpan run ID, commit SHA, log ringkas, deployment version, dan endpoint response.

### 12.5 Gateway routing dan domain

Sesudah dua application Worker berhasil:
- Set WEB_ORIGIN pada vault-core-gateway ke https://vault-core-web.premiumdigital-id.workers.dev.
- Set API_ORIGIN pada vault-core-gateway ke https://vault-core-api.premiumdigital-id.workers.dev.
- Attach vaultcore.biz.id ke gateway.
- Attach www.vaultcore.biz.id ke gateway.
- Attach api.vaultcore.biz.id ke gateway.
- Periksa DNS/TLS dan path routing.
- Pastikan /api/* dan host api.* diarahkan ke API Worker; path lainnya diarahkan ke frontend Worker.
- Gateway endpoint /_gateway/health hanya memeriksa konfigurasi gateway. Itu bukan bukti aplikasi siap.
- API /health harus menunjukkan status ok dan database connected.

### 12.6 Telegram webhook

Setelah API dan custom domain sehat:
- URL webhook: https://api.vaultcore.biz.id/api/telegram/webhook.
- Secret token harus sama dengan TELEGRAM_WEBHOOK_SECRET pada Worker.
- Allowed updates minimum untuk alur kode saat ini: message dan pre_checkout_query.
- Setup script existing: bot/bot.js.
- Setelah setWebhook, baca balik webhook status melalui Telegram Bot API dan kirim /start uji.
- Pastikan tidak ada dua webhook endpoint aktif yang bertabrakan.
- Uji /start, /help, /paysupport, pre_checkout_query, successful_payment, dan delivery.

### 12.7 Verifikasi setelah deployment

- GET API Worker /health menghasilkan status ok dan database connected.
- Frontend Worker workers.dev mengembalikan response berhasil.
- Gateway /_gateway/health menunjukkan API/frontend origin configured.
- Domain root memuat Mini App.
- www redirect/route sesuai konfigurasi yang disetujui.
- api domain mencapai API.
- CORS mengizinkan hanya frontend domain produksi.
- Worker logs dan traces tidak memuat token atau payload rahasia.
- Telegram webhook status aktif dan response webhook sehat.

## 13. Master Operation (MO) — SOP harian

### 13.1 Checklist pembukaan operasional

- Periksa gateway, frontend, API, dan database health.
- Periksa Telegram webhook dan bot token readiness.
- Periksa antrean delivery yang FAILED/READY terlalu lama.
- Periksa order PENDING_PAYMENT yang melewati masa reservasi.
- Periksa stok aktual dan SKU yang masih ACTIVE.
- Periksa apakah ada produk yang perlu PAUSE karena bukti hak atau sumber produk kedaluwarsa.
- Periksa notifikasi refund, keluhan, dan payment support.
- Catat gangguan dan waktu mulai pada incident log.

### 13.2 Prosedur publikasi SKU

1. Buat produk dalam status DRAFT.
2. Lengkapi identitas SKU, kategori, tier, deskripsi, tipe payload, harga jual XTR, modal XTR, refund policy, lead time, dan rights review reference.
3. Lampirkan/arsipkan bukti hak distribusi di penyimpanan dokumen internal yang dikuasai Owner.
4. Reviewer memberi keputusan: APPROVED, REJECTED, atau NEEDS_INFO di catatan review.
5. Aktifkan hanya setelah APPROVED; bila belum ada bukti atau aturan platform tidak jelas, status tetap DRAFT/PENDING_REVIEW.
6. Lakukan order uji dan periksa hasil tampilan, invoice, dan delivery sebelum promosi.

### 13.3 Prosedur stok masuk

1. Pilih SKU yang ACTIVE dan memiliki review valid.
2. Periksa format dan kualitas payload.
3. Tambahkan payload lewat fungsi Owner.
4. Verifikasi jumlah item bertambah dan semuanya status AVAILABLE.
5. Jalankan pemeriksaan sampel yang tidak menghabiskan stok pelanggan tanpa izin.
6. Rekam sumber stok, jumlah, biaya, tanggal, dan penanggung jawab dalam catatan inventory/finance internal.
7. Pastikan payload tidak muncul di list, log, atau laporan.

### 13.4 Prosedur order normal

1. Customer memilih SKU dan jumlah.
2. Sistem mengunci stok dan membuat order.
3. Telegram invoice dikirim.
4. Customer membayar invoice XTR.
5. Pre-checkout dan successful_payment diverifikasi server.
6. Transaction dan order diperbarui dalam transaksi database.
7. Delivery dikirim.
8. Sistem menyimpan status dan bukti message ID.
9. Owner melakukan pemeriksaan exception saja; order normal tidak perlu diedit manual.

### 13.5 Prosedur kegagalan delivery

1. Identifikasi order number dan delivery ID.
2. Periksa charge ID dan status order.
3. Baca status delivery, last_attempt_at, attempt_count, dan last_error.
4. Periksa Telegram message history atau bukti pesan terkirim.
5. Bila tidak terkirim dan tidak ada hasil ambigu, gunakan retry delivery.
6. Bila hasil API ambigu, tandai REVIEW_REQUIRED secara operasional dan lakukan rekonsiliasi terlebih dahulu.
7. Dokumentasikan tindakan, admin, waktu, dan hasil.
8. Pastikan order tidak dianggap fulfilled sampai semua item yang diwajibkan terkirim.

### 13.6 Prosedur refund

- Validasi customer dan order.
- Cocokkan transaksi, amount, charge ID, dan alasan.
- Periksa bukti serta policy refund.
- Eksekusi refund melalui Telegram.
- Verifikasi hasil API.
- Cocokkan status transaksi dan order.
- Evaluasi inventory/delivery sesuai apakah payload sudah terkirim/terpakai.
- Simpan audit record dan update customer.
- Rekonsiliasi laporan keuangan.

### 13.7 Prosedur akhir hari

- Rekap order baru, paid, fulfilled, failed, cancelled, refunded.
- Rekap XTR diterima dan charge ID.
- Rekap penjualan, modal, expenses, refund, dan profit dalam XTR.
- Rekonsiliasi order yang statusnya tidak sinkron.
- Periksa delivery FAILED/READY lama.
- Periksa produk dengan stok rendah.
- Simpan laporan harian dan catatan masalah.
- Pastikan tidak ada secret atau payload inventory dalam laporan.

## 14. Incident response / runbook gangguan

| Gejala | Pemeriksaan awal | Tindakan | Syarat pemulihan |
|---|---|---|---|
| Gateway 503 UPSTREAM_NOT_CONFIGURED | WEB_ORIGIN/API_ORIGIN | Periksa variable gateway dan status Worker origin | Kedua origin valid HTTPS |
| Gateway 502 UPSTREAM_UNAVAILABLE | Worker origin logs/availability | Periksa deployment, runtime log, binding, dan health | Origin merespons normal |
| API /health 503 | HYPERDRIVE binding, Neon, role, connection error | Periksa Hyperdrive binding dan DB role | status ok + database connected |
| Telegram webhook 401 | Secret header dan Worker secret | Samakan secret Telegram dan Worker dengan rotasi bila perlu | Webhook valid |
| /start tidak membalas | getWebhookInfo, webhook URL, API logs | Periksa DNS, custom domain, upstream dan handler | /start mendapat balasan |
| Invoice gagal | Bot token, Telegram API error, order state | Periksa token, payload, amount, Telegram status | Invoice uji berhasil |
| Pre-checkout ditolak | User ID, amount, currency, reserved count, order status | Cocokkan order/invoice | Order valid, reservation tersedia |
| Pembayaran ada tetapi order tidak PAID | Charge ID dan transaction row | Tahan delivery; rekonsiliasi event/update | Status DB cocok dengan payment resmi |
| Delivery FAILED | attempt_count, error, Telegram send response | Identifikasi apakah pesan sebenarnya sudah terkirim | Retry aman dan tidak ganda |
| Stok negatif/tidak cocok | inventory rows, reserved orders, deliveries | Hentikan SKU terkait, rekonsiliasi satu per satu | Sellable stock konsisten |
| Refund gagal/timeout | Telegram refund API result dan transaction | Jangan ubah status manual menjadi refunded | Hasil resmi terverifikasi |
| Secret bocor | scope, access log, Worker logs | Cabut/rotate segera, deploy nilai baru, audit pemakaian | Credential lama invalid |
| Database rusak/tidak tersedia | Backup, Neon status, migration state | Aktifkan incident plan dan restore sesuai persetujuan | Integrity check lulus |

**Aturan incident:** jangan menghapus histori, mengedit transaksi secara langsung, atau mengirim ulang produk pada situasi ambigu. Pertahankan bukti dan lakukan rekonsiliasi.

## 15. QA dan Master Acceptance Test

Setiap hasil tes harus mencantumkan Test ID, environment, commit SHA, langkah, expected result, actual result, bukti, status, dan reviewer.

### 15.1 Customer dan Mini App

- [ ] VC-CUS-001: /start membuka Mini App.
- [ ] VC-CUS-002: Mini App tampil pada Telegram Android.
- [ ] VC-CUS-003: initData valid diterima.
- [ ] VC-CUS-004: initData invalid/expired ditolak.
- [ ] VC-CUS-005: Kategori dan SKU aktif terbaca.
- [ ] VC-CUS-006: Produk DRAFT/PAUSED/ARCHIVED tidak tampil untuk customer.
- [ ] VC-CUS-007: Harga dan total checkout hanya menggunakan XTR.
- [ ] VC-CUS-008: Display stock sesuai sellable stock.
- [ ] VC-CUS-009: Customer tidak dapat membaca harga modal/profit.
- [ ] VC-CUS-010: Customer A tidak dapat membaca order Customer B.
- [ ] VC-CUS-011: Order history memperlihatkan status dan item yang benar.

### 15.2 Product dan inventory

- [ ] VC-INV-001: Owner dapat membuat produk DRAFT.
- [ ] VC-INV-002: SKU duplicate ditolak.
- [ ] VC-INV-003: Produk tidak dapat ACTIVE tanpa review reference.
- [ ] VC-INV-004: SKU tanpa hak distribusi tetap nonaktif.
- [ ] VC-INV-005: Payload yang diizinkan dapat dienkripsi dan disimpan.
- [ ] VC-INV-006: Payload tidak terlihat plaintext pada database, log, list, dan dashboard.
- [ ] VC-INV-007: Payload credential/authentication material ditolak.
- [ ] VC-INV-008: Batch input dengan jumlah valid berhasil.
- [ ] VC-INV-009: Batch invalid tidak meninggalkan stok parsial.
- [ ] VC-INV-010: Mode EXACT_COUNT menampilkan angka yang dibatasi stok aktual.
- [ ] VC-INV-011: Mode IN_STOCK_ONLY menunjukkan tersedia/habis sesuai stok.
- [ ] VC-INV-012: Mode HIDE_COUNT menyembunyikan angka, tetapi checkout mengikuti stok aktual.
- [ ] VC-INV-013: Override di atas actual stock tidak dapat menaikkan angka publik.
- [ ] VC-INV-014: Reserved/SOLD/UNAVAILABLE tidak dihitung sebagai AVAILABLE.
- [ ] VC-INV-015: Perubahan produk/stok menghasilkan audit log.

### 15.3 Order dan payment

- [ ] VC-PAY-001: Order number unik.
- [ ] VC-PAY-002: Quantity di luar batas ditolak.
- [ ] VC-PAY-003: Order snapshot menyimpan sale, cost, dan nama produk.
- [ ] VC-PAY-004: Dua customer berebut unit terakhir tidak menerima unit yang sama.
- [ ] VC-PAY-005: Order gagal membuat invoice melepaskan reservation dengan benar.
- [ ] VC-PAY-006: Invoice currency XTR.
- [ ] VC-PAY-007: Tidak ada wallet XTR manual.
- [ ] VC-PAY-008: Pre-checkout menolak user berbeda.
- [ ] VC-PAY-009: Pre-checkout menolak jumlah berbeda.
- [ ] VC-PAY-010: Pre-checkout menolak currency selain XTR.
- [ ] VC-PAY-011: Pre-checkout menolak order expired/cancelled/invalid.
- [ ] VC-PAY-012: Successful payment valid menyimpan charge ID.
- [ ] VC-PAY-013: Successful payment duplicate tidak menggandakan transaksi.
- [ ] VC-PAY-014: Charge ID yang sama untuk order berbeda ditolak.
- [ ] VC-PAY-015: Screenshot atau callback frontend tidak dapat mengubah order menjadi PAID.
- [ ] VC-PAY-016: Refund test tertaut ke transaksi asal.
- [ ] VC-PAY-017: Refund failure tidak memalsukan status REFUNDED.

### 15.4 Delivery dan recovery

- [ ] VC-DEL-001: Delivery tidak dimulai sebelum payment valid.
- [ ] VC-DEL-002: Setiap item inventory punya delivery identity/idempotency key yang sesuai.
- [ ] VC-DEL-003: Customer menerima payload yang benar.
- [ ] VC-DEL-004: Telegram protected content digunakan.
- [ ] VC-DEL-005: Item inventory menjadi SOLD setelah delivery tercatat sukses.
- [ ] VC-DEL-006: Delivery gagal tercatat beserta attempt dan failure reason.
- [ ] VC-DEL-007: Retry tidak menggandakan pengiriman yang telah terkonfirmasi.
- [ ] VC-DEL-008: READY stale diproses sesuai recovery window.
- [ ] VC-DEL-009: Order baru FULFILLED setelah seluruh delivery selesai.
- [ ] VC-DEL-010: Customer menerima informasi bantuan saat delivery bermasalah.

### 15.5 Owner, finance, audit

- [ ] VC-OWN-001: Owner ID di allowlist dapat masuk.
- [ ] VC-OWN-002: Telegram ID di luar allowlist mendapat 403.
- [ ] VC-OWN-003: Dashboard aggregate cocok dengan query database.
- [ ] VC-OWN-004: Order list menampilkan status, produk, jumlah, harga dan waktu benar.
- [ ] VC-OWN-005: Owner dapat menambah expense.
- [ ] VC-OWN-006: Harga/modal baru tidak mengubah snapshot order sebelumnya.
- [ ] VC-OWN-007: Gross profit dan net profit cocok dengan dataset yang disepakati.
- [ ] VC-OWN-008: Harga, modal, biaya, refund, dan laba dicatat konsisten dalam XTR.
- [ ] VC-OWN-009: Refund memengaruhi laporan menurut aturan yang disepakati.
- [ ] VC-OWN-010: Aktivitas owner yang kritis masuk audit log.
- [ ] VC-OWN-011: Audit log dapat ditelusuri oleh owner.
- [ ] VC-OWN-012: Filter periode dan ekspor laporan tervalidasi jika ditambahkan.

### 15.6 API, security, runtime

- [ ] VC-SEC-001: Endpoint admin tanpa initData ditolak.
- [ ] VC-SEC-002: Endpoint admin dengan Telegram ID non-owner ditolak.
- [ ] VC-SEC-003: IDOR test untuk order/customer lulus.
- [ ] VC-SEC-004: SQL injection test lulus.
- [ ] VC-SEC-005: XSS/input sanitization test lulus.
- [ ] VC-SEC-006: Rate limit berlaku pada endpoint customer/checkout/owner.
- [ ] VC-SEC-007: Webhook secret invalid ditolak.
- [ ] VC-SEC-008: Credential tidak ditemukan pada repository/git history.
- [ ] VC-SEC-009: Payload digital tidak bocor ke log.
- [ ] VC-SEC-010: Worker request-scoped database client isolation lulus.
- [ ] VC-SEC-011: Koneksi database gagal ditangani sebagai degraded/503.
- [ ] VC-SEC-012: Backup dan restore teruji.
- [ ] VC-SEC-013: Worker logs/traces bebas secret.
- [ ] VC-SEC-014: Domain, TLS, CORS, dan headers sesuai target.

### 15.7 Deployment dan live operations

- [ ] VC-DEP-001: Main commit lulus CI.
- [ ] VC-DEP-002: Frontend Worker build output valid.
- [ ] VC-DEP-003: API Worker dry-run valid.
- [ ] VC-DEP-004: Application Workers deployed dengan deployment ID tercatat.
- [ ] VC-DEP-005: Gateway WEB_ORIGIN dan API_ORIGIN benar.
- [ ] VC-DEP-006: Custom domains root, www, api terpasang.
- [ ] VC-DEP-007: API /health database connected.
- [ ] VC-DEP-008: Mini App root dapat dibuka via domain produksi.
- [ ] VC-DEP-009: Telegram webhook aktif pada URL yang benar.
- [ ] VC-DEP-010: /start dan /paysupport live test lulus.
- [ ] VC-DEP-011: Test Stars transaction, delivery, dan refund memenuhi environment test Telegram yang berlaku.
- [ ] VC-DEP-012: Owner menyetujui hasil UAT.
- [ ] VC-DEP-013: Production release approval tercatat.

**Kriteria kelulusan:** semua tes kritis PASS; bug Critical/High ditutup atau mempunyai pengecualian tertulis yang disetujui; bukti uji disimpan; dan owner menyetujui UAT. Test yang belum dijalankan tetap PENDING, bukan PASS.

## 16. Backlog penyelesaian berurutan

### P0 — Blocker sebelum deployment produksi

| ID | Pekerjaan | Alasan/hasil yang diharapkan | Status baseline |
|---|---|---|---|
| P0-01 | Konfirmasi dan persetujuan PROJECT_CONTRACT v1.2 Bagian 26.6 | Scope punya persetujuan owner | DONE — persetujuan tertulis pemilik tercatat 2026-11-21 |
| P0-02 | Verifikasi akun Cloudflare yang benar, token scope, dan akses resource | Deployment tidak memakai akun yang salah | PASS — token verification and Hyperdrive read-back passed in production run 44902626165 attempt 1 |
| P0-03 | Siapkan lima repository secrets wajib | Workflow lolos preflight | PASS — all five required repository secrets passed validation in production run 44902626165 attempt 1 |
| P0-04 | Konfirmasi BotFather identity dan token produksi | Identitas bot final | PASS — Telegram Bot API `getMe` and production webhook `getWebhookInfo` read-back passed |
| P0-05 | Verifikasi ADMIN_TELEGRAM_IDS | Owner/admin server-side benar | PARTIAL — secret presence and numeric format validated; owner identity/access still requires Owner UAT |
| P0-06 | Pastikan migrations/runtime DB role/Hyperdrive konsisten | API mampu query DB | PASS — 10 tables, 5 migrations, Hyperdrive binding attached, API `/health` returned database connected |
| P0-07 | Audit dan tutup bug kritis payment/order/delivery | Tidak ada transaksi ganda atau kehilangan stok | SOURCE FIXES IMPLEMENTED + CI PASS; live/staging acceptance pending |
| P0-08 | Deployment API Worker | API berjalan pada Cloudflare | PASS — deployed and API health passed |
| P0-09 | Deployment frontend Worker | Mini App berjalan pada Cloudflare | PASS — deployed and public root/www checks passed |
| P0-10 | Konfigurasi gateway upstream dan custom domains | Domain publik mengarah ke aplikasi | PASS — `WEB_ORIGIN`, `API_ORIGIN`, root/www/api custom domains, public DNS/TLS and gateway health verified |
| P0-11 | Setup webhook Telegram production | Bot menerima update pada API | PASS — webhook set and `getWebhookInfo` read-back verified |
| P0-12 | Live health check dan payment/delivery acceptance | Jalur live terbukti | PARTIAL — production health, DNS/TLS and webhook PASS; live catalog/order/XTR/payment/delivery/refund acceptance pending because products and stock are empty |
| P0-13 | Owner UAT dan release approval | Keputusan launch tercatat | PENDING |

### P1 — Kelengkapan operasional sebelum skala transaksi

| ID | Pekerjaan | Hasil yang diharapkan |
|---|---|---|
| P1-01 | Endpoint detail produk/customer order | UX tidak bergantung pada list endpoint saja |
| P1-02 | Inventory status management/void | Stok rusak atau tidak berlaku dapat dikelola |
| P1-03 | Owner audit log query | Perubahan dapat diperiksa dari console |
| P1-04 | Filter/pagination order dan report | Owner dapat mengelola volume data |
| P1-05 | Rekonsiliasi refund dan revenue | Finance dashboard cocok dengan ledger |
| P1-06 | SKU approval evidence workflow | Referensi hak produk dapat diperiksa |
| P1-07 | Delivery ambiguous-result reconciliation | Mencegah pengiriman ganda saat timeout | IMPLEMENTED: REVIEW_REQUIRED + owner reconciliation; live acceptance pending |
| P1-08 | Backup/restore drill | Database dapat dipulihkan |
| P1-09 | IDOR/security review | Kepemilikan data customer teruji |
| P1-10 | Rate-limit multi-instance strategy | Proteksi tetap konsisten saat skala naik |
| P1-11 | Retention/privacy policy dan terms | Customer notice dan tata kelola data lengkap |
| P1-12 | Uji performance Mini App | Angka performa berbukti |

### P2 — Peningkatan setelah stabil

- UI polish berdasarkan UAT dan penggunaan perangkat Android nyata.
- Dashboard keuangan dengan filter dan ekspor.
- Laporan rekonsiliasi transaksi dan saldo XTR.
- Monitoring alert yang mengurangi pemeriksaan manual.
- Peningkatan aksesibilitas, loading states, dan pengalaman error.
- Improvement observability sesuai kebutuhan operasi.

P2 tidak boleh menunda perbaikan keamanan, integritas transaksi, atau kontrol stok.

## 17. Governance dan cara eksekusi perubahan

### 17.1 Peran

| Peran | Tanggung jawab |
|---|---|
| Owner | Persetujuan scope, akun, kebijakan produk, secret, refund, UAT, dan go-live |
| Implementor | Memeriksa source, membuat perubahan, tes, dokumentasi, dan deployment sesuai izin |
| Reviewer | Review kode, keamanan, database migration, dan bukti QA |
| Operator toko | Mengelola SKU, stok, order exception, dukungan customer, dan rekap |
| Customer | Menggunakan Mini App dan mengikuti ketentuan produk/pembayaran |

Satu orang dapat menjalankan lebih dari satu peran, tetapi tindakan kritis tetap harus memiliki jejak dan persetujuan yang dapat ditelusuri.

### 17.2 Aturan perubahan source

1. Periksa kontrak, source, issue, dan status deployment sebelum mengubah file.
2. Ubah sesedikit mungkin dan pertahankan implementasi yang sudah benar.
3. Setiap perubahan harus disertai tes yang relevan.
4. Jangan menyimpan secret dalam source atau commit.
5. Jalankan CI sebelum deployment.
6. Catat commit SHA, file yang berubah, alasan, tes, dan hasil.
7. Setelah deploy, verifikasi response live.
8. Perbarui dokumen ini hanya jika ada perubahan nyata pada scope, resource, status, atau SOP.

### 17.3 Format issue pekerjaan

Setiap issue minimal berisi:
- ID pekerjaan.
- Masalah atau kebutuhan.
- Fakta sumber yang mendasari.
- Expected behavior.
- Affected path/API/database/Worker.
- Acceptance criteria.
- Test evidence.
- Risiko dan rollback.
- Owner/reviewer.
- Status dan commit SHA.

### 17.4 Aturan change request

Change request harus mencakup kebutuhan, use case, alasan, dampak ke UI/API/database/security/ops, risiko, estimasi, dan persetujuan owner. Pesan informal tidak dianggap mengubah kontrak sampai dimasukkan ke dokumen/issue yang disetujui.

## 18. Risiko dan dependensi utama

| Risiko | Dampak | Mitigasi / owner action |
|---|---|---|
| Secret atau token bocor | Pengambilalihan API/bot | Rotation, revoke, audit, redeploy |
| Cloudflare token dibuat pada akun yang salah | Deployment gagal atau salah resource | Verifikasi email/account ID dan baca balik scope |
| Token bot belum dikonfirmasi | Webhook dan invoice tidak dapat live | Owner menyediakan token lewat GitHub Secrets |
| Produk tidak memiliki hak jual | Risiko suspend, refund, sengketa | SKU review sebelum ACTIVE |
| Perubahan kebijakan game/platform | Produk harus di-pause | Review berkala dan bukti per SKU |
| Webhook duplicate/late | Status order tidak konsisten | Charge ID unique, idempotency, reconciliation |
| Delivery timeout ambigu | Customer dapat menerima payload dua kali | Manual review sebelum retry |
| Stok ganda | Over-selling | Transaction lock dan concurrency test |
| DB outage | Checkout/order gagal | Monitoring, backup, restore plan |
| Rate limit process-local | Limit tidak konsisten pada multi-instance | Shared state/edge rate limit sebelum scale |
| Refund atau biaya tidak tersinkron | Laporan XTR meleset | Rekonsiliasi dari charge ID dan audit log |
| Refund tanpa rekonsiliasi | Ledger dan payment tidak cocok | Refund runbook dan charge ID |
| Perubahan scope di luar baseline | Perilaku sistem menyimpang dari kontrak | Change request dan persetujuan owner | Setiap perubahan dilacak melalui dokumen/issue yang disetujui |
| Legal/privacy belum ditetapkan | Risiko operasional/kepatuhan | Owner review dan dokumentasi sebelum publik |

## 19. Hal yang belum diketahui atau belum dibuktikan

Hal berikut tidak boleh diisi berdasarkan tebakan:

1. Telegram Bot API production identity check (`getMe`) passed and the webhook URL was read back successfully. Owner access to the deployed Mini App still needs UAT.
2. Production workflow run `44902626165` attempt 1 passed all deployment stages, including API/Neon health, public domains, and Telegram webhook read-back.
3. The `ADMIN_TELEGRAM_IDS` secret passed numeric-format validation, but the exact owner identity and Owner Console access have not yet been proven by UAT.
4. Cloudflare API token verification, Hyperdrive connection health, gateway routing and Worker deployment passed. The corrected API adapter now returns HTTP 200 for its health route.
5. Neon content audit found 4 TEST-only product records in DRAFT, 0 inventory items, 0 orders and 0 transactions. The customer catalog remains empty until Owner explicitly activates test fixtures or creates approved commercial SKUs.
6. The three production domains are attached to the existing gateway and their public DNS/TLS checks passed in the completed deployment workflow.
7. Telegram production webhook is configured and `getWebhookInfo` read-back passed; an actual Telegram `/start` and Owner access acceptance test is pending.
8. Harga XTR final seluruh SKU.
9. Dasar penetapan harga modal dan biaya operasional dalam XTR.
10. Refund policy final per tipe barang.
11. Daftar SKU yang sudah lolos pemeriksaan hak distribusi.
12. SLA support dan fulfillment.
13. Retention policy, RPO, dan RTO.
14. Target concurrency dan volume transaksi.
15. Nama legal dan sertifikat tanda tangan elektronik formal pemilik belum tercantum pada rekaman persetujuan tertulis v1.2 CR-02; persetujuan scope tertulis sendiri telah dicatat di Bagian 26.6 kontrak.
16. Hasil live payment/refund/delivery, IDOR, backup/restore, dan UAT.
17. Status pendaftaran usaha/PSE dan dokumen legal yang relevan.

Pemilik harus mengisi keputusan ini sebelum pekerjaan yang bergantung padanya dinyatakan selesai.

## 20. Release gate dan keputusan go/no-go

### GO hanya jika semua kondisi berikut benar

- Scope kontrak disetujui Owner.
- Semua P0 selesai.
- Secret wajib tersedia dan lulus validasi workflow.
- Main commit lulus CI dan frontend preparation.
- API Worker dan frontend Worker deployed.
- Gateway origins dan custom domains benar.
- API health menunjukkan database connected.
- Telegram webhook aktif pada URL dan secret yang benar.
- Customer auth, owner auth, katalog, order, payment, dan delivery diuji end-to-end.
- Refund test dan recovery flow diuji sesuai environment yang disetujui.
- IDOR, keamanan endpoint admin, backup/restore, dan concurrency test lulus.
- Tidak ada bug Critical/High terbuka tanpa pengecualian tertulis.
- Owner menandatangani UAT dan release approval.

### NO-GO

Satu saja blocker kritis pada keamanan, payment integrity, stock integrity, secret, database, atau delivery berarti rilis ditunda. CI PASS saja bukan syarat yang cukup untuk GO.

### Current production status — 21 November 2026

**DEPLOYED — NOT READY FOR GENERAL SALES.**

Alasan utama yang tercatat:
- Deployment produksi berhasil pada run `44902626165` attempt 1: API/frontend Workers, API+Neon health, gateway origins, root/www/api DNS+TLS, dan Telegram webhook read-back PASS.
- Database saat ini kosong: 0 produk dan 0 inventory. SKU, rights-review reference, harga/modal, serta stok terenkripsi yang dapat dijual belum dimasukkan.
- Live customer/Owner authentication, XTR invoice/pre-checkout/payment, exactly-once delivery, refund/recovery, backup/restore, IDOR, production rate-limit, dan Owner UAT/release approval masih pending.
- Persetujuan kontrak v1.2 CR-02 telah tercatat; UAT dan go-live tetap menunggu release gate tersendiri.

Status ini harus diperbarui hanya setelah bukti terbaru tersedia.

## 21. Decision Log

| ID | Keputusan | Status | Sumber/bukti |
|---|---|---|---|
| DEC-001 | Model toko Single-Vendor | Baseline kontrak | PROJECT_CONTRACT.md |
| DEC-002 | Kanal Telegram Bot dan Mini App | Baseline kontrak | PROJECT_CONTRACT.md |
| DEC-003 | Digital goods di Telegram memakai Telegram Stars XTR invoice | Baseline kontrak | PROJECT_CONTRACT.md, Telegram payment flow |
| DEC-004 | Tidak menggunakan manual XTR wallet address pada Mini App | Baseline kontrak/CR-02 | PROJECT_CONTRACT.md Bagian 26.2 |
| DEC-005 | Payload digital yang diizinkan disimpan encrypted | Baseline kontrak/kode | PROJECT_CONTRACT.md Bagian 26.1, inventory code |
| DEC-006 | Kredensial akun game/authentication material tidak didukung | Baseline kontrak/validasi | PROJECT_CONTRACT.md Bagian 3 dan 26.1 |
| DEC-007 | Display stock dibatasi stok aktual | Baseline kontrak/kode | PROJECT_CONTRACT.md Bagian 26.3, catalogService |
| DEC-008 | Neon dipertahankan, koneksi Worker memakai Hyperdrive | Deployment architecture | DEPLOYMENT_STATUS.md, wrangler.api.jsonc |
| DEC-009 | API Worker memakai request-scoped pg.Client | Implemented and CI validated | backend/db/pool.js, tests/core.test.js |
| DEC-010 | Production go-live | Belum disetujui | Pending release gate |
| DEC-011 | Owner approval kontrak v1.2 CR-02 | APPROVED — persetujuan tertulis 2026-11-21 | PROJECT_CONTRACT.md Bagian 26.6 |
| DEC-012 | Inventory reservation binds to owning order; ambiguous delivery enters manual review | IMPLEMENTED + CI PASS | Migrations 004, backend/services/deliveryService.js, tests/core.test.js |
| DEC-013 | One unique pre-checkout claim per order | IMPLEMENTED + CI PASS | Migration 005, backend/controllers/paymentController.js |

## 22. Referensi sumber dan dokumentasi

### Sumber internal repository yang menjadi dasar dokumen

- README.md
- PROJECT_CONTRACT.md
- DEPLOYMENT_STATUS.md
- PRODUCTION_DEPLOYMENT_RUNBOOK.md
- wrangler.api.jsonc
- cloudflare/vault-core-api.js
- cloudflare/vault-core-gateway.js
- frontend/cloudflare.config.ts
- frontend/vite.config.ts
- backend/app.js
- backend/db/pool.js
- backend/routes/catalog.js
- backend/routes/orders.js
- backend/routes/admin.js
- backend/routes/telegramWebhook.js
- backend/controllers/orderController.js
- backend/controllers/paymentController.js
- backend/services/catalogService.js
- backend/services/deliveryService.js
- backend/middleware/telegramAuth.js
- backend/middleware/adminAuth.js
- database/migrations/001_initial_schema.sql
- database/migrations/002_finance_and_order_snapshots.sql
- database/migrations/003_delivery_recovery.sql
- tests/core.test.js
- .github/workflows/ci.yml
- .github/workflows/prepare-vinext.yml
- .github/workflows/deploy-production.yml

### Referensi resmi eksternal

- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Stars for digital goods/services: https://core.telegram.org/bots/payments-stars
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- Telegram Stars Terms: https://telegram.org/tos/stars
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare Hyperdrive connection lifecycle: https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Neon documentation: https://neon.tech/docs
- UU Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022

Ketentuan eksternal, versi layanan, harga, izin, dan kebijakan platform harus diperiksa ulang ketika implementasi atau operasi dilakukan.

## 23. Template laporan progres mingguan / per milestone

    VAULT CORE — EXECUTION REPORT

    Tanggal:
    Milestone:
    Commit SHA:
    Environment:

    1. Selesai:
    - [ID] pekerjaan — bukti/link

    2. Gagal:
    - [ID] pekerjaan — penyebab — log

    3. Sedang berjalan:
    - [ID] pekerjaan — owner — blocker

    4. Temuan baru:
    - Fakta:
    - Risiko:
    - Dampak:
    - Rekomendasi:

    5. Pengujian:
    - Test ID:
    - PASS/FAIL/PENDING:
    - Bukti:

    6. Deployment:
    - Worker:
    - Version/Deployment ID:
    - URL:
    - Health result:

    7. Keputusan Owner yang dibutuhkan:
    - Keputusan:
    - Batas waktu:
    - Dampak bila belum diputuskan:

    8. Status keseluruhan:
    - NOT READY / READY FOR UAT / READY FOR PRODUCTION

## 24. Checklist serah terima akhir

- [ ] Source code dan seluruh migration berada di repository Owner.
- [ ] README instalasi dan konfigurasi sudah benar.
- [ ] PROJECT_CONTRACT versi final telah disetujui.
- [ ] Blueprint dan MO ini diperbarui sesuai sistem yang benar-benar deployed.
- [ ] Seluruh secret dikelola Owner melalui kanal aman.
- [ ] Daftar Cloudflare resource dan deployment version diserahkan.
- [ ] Telegram Bot ownership dan webhook setup diserahkan.
- [ ] Database schema, backup, dan restore instructions diserahkan.
- [ ] Runbook operasional customer, inventory, payment, delivery, refund, dan incident diserahkan.
- [ ] Test report dan bukti UAT dilampirkan.
- [ ] Daftar bug/known limitations diserahkan.
- [ ] Owner menyetujui go-live dan menerima status sistem secara tertulis.

---

**Dokumen ini adalah acuan kerja hidup (living document).** Setiap perubahan status harus disertai bukti. Isi dokumen tidak membuktikan bahwa langkah deployment, pengujian live, ataupun persetujuan Owner telah dilakukan.
