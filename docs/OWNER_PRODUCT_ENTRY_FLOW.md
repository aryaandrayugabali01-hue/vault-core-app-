# VAULT CORE — Panduan Input Produk Owner

## Alur kerja

1. Buka Dashboard Owner → **Form Produk Terpadu**.
2. Pilih salah satu dari 12 varian master. Field spesifikasi yang aman akan muncul sesuai kategori.
3. Isi identitas SKU, listing, harga XTR, stok/slot, data input pembeli bila diperlukan, serta review sumber/hak.
4. Tekan **Simpan Produk** satu kali. Backend menyimpan produk, jawaban spesifikasi, review hak, slot stok, konfigurasi input pembeli, dan audit log dalam satu transaksi.
5. SKU tampil di katalog dan siap menerima order jika review hak APPROVED, attestation Owner benar, masa review berlaku, dan stok/kapasitas aktual tersedia. Jika belum, SKU tersimpan dengan status PAUSED.

## Struktur SKU

| Data | Fungsi |
|---|---|
| Game | MLBB, Free Fire, Roblox, Genshin Impact |
| Kategori | Akun, Jasa Joki, Item In-Game |
| Varian master | Salah satu dari 12 varian katalog resmi |
| SKU internal | ID unik Owner, misalnya ML-AKUN-001 |
| Nama / subtipe | Nama penawaran dan label kualitas/paket |
| Listing | Deskripsi, 1–8 foto, spesifikasi aman, ketentuan/garansi |
| Harga | Harga jual Mini App XTR dan modal internal XTR |
| Stok / kapasitas | Unit akun atau slot layanan yang benar-benar dapat dipenuhi |
| Sumber / review | Referensi stok, dasar hak, bukti, region, metode serah terima, masa review, attestation |

## Form Akun Game

- Game, kategori Akun, varian master, SKU, nama, subtipe.
- Spesifikasi listing sesuai game/varian: status bind yang aman untuk ditampilkan, rank/level, skin/karakter/item, server, dan screenshot aktual sesuai pertanyaan varian.
- Harga XTR, deskripsi, foto, ketentuan, garansi.
- Ketersediaan **READY** atau **INDENT**.
- READY: unit benar-benar tersedia; serah terima manual Owner maksimal satu jam setelah pembayaran.
- INDENT: Owner mengisi tenggat dalam hari kalender; tenggat disimpan sebagai snapshot pada order.
- Stok unit, referensi sumber, review hak dan attestation.
- Tidak ada field data login akun/email, password, OTP, cookie, session, recovery/backup code, atau kredensial lain. Owner menyerahkan akses manual melalui kanal privat di luar aplikasi setelah pembayaran.

## Form Jasa Joki

- Game, kategori Jasa Joki, varian master, SKU, nama paket, subtipe.
- Jenis layanan, target/rank/map/quest sesuai varian, durasi, jadwal layanan, estimasi pengerjaan.
- Harga XTR, deskripsi, foto, ketentuan dan garansi.
- Kapasitas slot yang benar-benar dapat dikerjakan dan referensi sumber kapasitas.
- Field pembeli dikonfigurasi per SKU, misalnya Player/User ID, Server, pilihan item, target rank, map, atau parameter pekerjaan.
- Field pembeli tidak boleh meminta password, email login, OTP, cookie, session, token, recovery/backup code atau rahasia autentikasi.
- Joki menggunakan slot kapasitas manual; READY/INDENT adalah mode ketersediaan akun, bukan status Joki.

## Penyimpanan dan keamanan

- Satu tombol **Simpan Produk**.
- SKU unik; SKU yang sudah ada dipilih dari daftar untuk diedit, bukan dibuat ulang.
- Pengubahan SKU ditolak saat unit sedang direservasi order.
- Stok aktual tersimpan sebagai inventory unit/slot dan memakai satu referensi sumber.
- Data pembeli yang dikonfigurasi pada SKU hanya berupa identitas game dan parameter pekerjaan.
- Review hak yang PENDING/REJECTED/kedaluwarsa atau stok nol membuat SKU PAUSED dan tidak dapat dibeli.
- Katalog, order, inventory dan identitas pelanggan tetap menggunakan backend/database VAULT CORE yang sama.
