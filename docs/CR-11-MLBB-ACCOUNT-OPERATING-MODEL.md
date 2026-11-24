# CR-11 — Model Operasional Kategori MLBB · Akun

Tanggal: 25 November 2026  
Sumber produk: frontend/src/app/catalog/ML.zip  
Status implementasi: branch CR-11; belum diterapkan ke produksi.

## Data produk yang diperiksa

Berkas detail.md memuat win rate 49%, 79 hero, 130 skin, rank Mythic, hero utama Miya, akun Moonton, tautan Google Play/Facebook/TikTok, email paket, dukungan Android/iOS, emblem ALL MAX, dan informasi unbind setelah 30 hari. Rank dapat berubah pada awal season. Arsip menyertakan empat screenshot akun/skin dan satu gambar emblem MAX.

Berkas detail.md.bak tidak memuat harga Rp150.000; nilai harga dipakai dari detail.md terbaru. Tidak ada login/password, data pemulihan, atau dokumen izin transfer di dalam ZIP.

## Aturan komersial internal

| Area | Ketetapan |
|---|---|
| Penjual kepada pembeli | VAULT CORE |
| Layanan pelanggan | VAULT CORE |
| Penyerahan informasi produk | VAULT CORE |
| Pemasok | Proses internal VAULT CORE |
| Harga referensi | Rp150.000 |
| Harga katalog XTR | 400 XTR |
| Kurs referensi internal | Rp375 per XTR |
| Tampilan jumlah stok | Disembunyikan |
| Model stok | CATALOG_ON_DEMAND; listing aktif yang lolos pemeriksaan hak tampil Tersedia tanpa angka jumlah. Checkout membuat reservasi pemenuhan internal per order dan Owner mengelola pengadaan/pemenuhan aktual. |
| Label ketersediaan | Tersedia selama listing komersial aktif; pratinjau/PAUSED tidak dapat dibeli |
| Garansi Anti Hackback | 14 hari kalender sejak pembeli menekan Selesai |
| Refund klaim valid | 100% nilai transaksi |
| SLA | Maksimal 48 jam setelah bukti lengkap diterima |

## Alur pembeli

1. Pilih MLBB → Akun dan periksa spesifikasi, gambar, harga, dan ketentuan.
2. Checkout melalui VAULT CORE Telegram Mini App.
3. Bayar invoice resmi Telegram Stars XTR. Backend menandai PAID hanya setelah successful_payment tervalidasi.
4. VAULT CORE mengelola sumber pasokan dan mengirim informasi pemenuhan melalui jalur pesanan terverifikasi.
5. Pembeli memeriksa detail dan melakukan pengamanan akun/email sesuai panduan.
6. Pembeli menekan Selesai setelah menerima dan memeriksa produk. Server mencatat waktu konfirmasi dan memulai masa garansi 14 hari.
7. Bila ada indikasi hackback, pembeli mengirim kronologi dan URL bukti melalui form klaim. VAULT CORE membuat nomor klaim dan batas SLA 48 jam.

## Penanganan klaim

Status klaim: SUBMITTED → REVIEWING → APPROVED atau REJECTED. Setelah APPROVED, Owner menjalankan refund Telegram Stars dari panel transaksi. Saat Telegram mengonfirmasi refund, klaim otomatis menjadi REFUNDED. Setiap perubahan status dicatat di audit log.

Bukti dikirim sebagai URL HTTPS (maksimal delapan tautan); unggahan file belum diaktifkan karena object storage belum tersedia dalam konfigurasi proyek.

## Aset katalog dari ML.zip

CI mengekstrak file berikut ke frontend/public/assets/products/mlbb-account:

- account-overview-79-hero-130-skin.jpg
- skin-catalog-01.jpg
- skin-catalog-02.jpg
- skin-catalog-03.jpg
- emblem-all-max.webp

Galeri gambar adalah bukti visual yang diberikan di arsip. Gambar tidak membuktikan pemilikan, asal akun, atau otorisasi transfer.

## Pembatas publikasi

Terms of Service Moonton yang tercantum sebagai Official Policy dan diperbarui 23 Oktober 2026 melarang penjualan atau pengalihan akun game dan kredensial login. Karena itu, listing MLBB Akun dalam implementasi CR-11 berstatus PAUSED + public_preview. Harga dan spesifikasi terlihat sebagai pratinjau, sedangkan keranjang, checkout, dan invoice dikunci. Pembukaan transaksi menunggu izin tertulis yang benar-benar mengizinkan transfer akun atau perubahan SKU ke produk/layanan resmi yang diperbolehkan.

Persetujuan internal Owner tidak mengubah Terms of Service penerbit.

## Model stok on-demand

- Listing komersial aktif dan lolos pemeriksaan hak ditampilkan **Tersedia** selama status katalog aktif, tanpa menampilkan angka stok.
- Checkout membuat slot reservasi internal unik untuk setiap unit pesanan, bukan meminjam satu placeholder inventory yang sama untuk banyak order.
- Setelah pembayaran XTR terverifikasi, VAULT CORE mengirim acknowledgement dan menempatkan order di antrean pemenuhan Owner. Proses pengadaan dari pemasok tetap internal.
- Slot on-demand yang berasal dari invoice gagal, order tidak dibayar, atau refund ditandai UNAVAILABLE dan tidak dihitung sebagai stok.
- Status pratinjau MLBB Akun tetap tidak dapat checkout sampai persyaratan hak eksternal terpenuhi.
