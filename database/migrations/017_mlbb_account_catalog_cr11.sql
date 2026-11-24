-- CR-11: Owner-facing business model and customer preview for MLBB Account.
-- ML.zip contains product specs and artwork, not login credentials or publisher transfer authorization.
-- Account SKUs remain PAUSED / preview-only until the external rights gate is satisfied.

UPDATE products
SET name='Akun MLBB · 79 Hero · 130 Skin · Mythic',
    description='Akun Mobile Legends dengan win rate 49%, 79 hero, 130 skin, rank Mythic, hero utama Miya, dan emblem MAX. Akun terhubung ke Moonton serta masih tertaut ke Google Play, Facebook, dan TikTok. Penawaran menyebut paket email disertakan dan unbind email Moonton/platform sosial dapat dilakukan setelah 30 hari. Rank dapat berubah saat season baru dimulai.',
    sale_price_xtr=400,
    fulfillment_type='GAME_ACCOUNT_TRANSFER',
    image_url='/assets/products/mlbb-account/account-overview-79-hero-130-skin.jpg',
    image_gallery='[
      "/assets/products/mlbb-account/account-overview-79-hero-130-skin.jpg",
      "/assets/products/mlbb-account/skin-catalog-01.jpg",
      "/assets/products/mlbb-account/skin-catalog-02.jpg",
      "/assets/products/mlbb-account/skin-catalog-03.jpg",
      "/assets/products/mlbb-account/emblem-all-max.webp"
    ]'::jsonb,
    attributes=jsonb_build_object(
      'kode_produk','ML-001',
      'subkategori','Akun MLBB',
      'price_reference_idr','150000',
      'price_currency','IDR',
      'cost_price_note','Modal ditetapkan Owner sebesar 0 XTR melalui instruksi 2026-11-23.',
      'cost_price_status','OWNER_SET_ZERO',
      'fulfillment_mode','OWNER_MANUAL',
      'metode_penyerahan','Penyerahan informasi produk oleh VAULT CORE setelah pemeriksaan order',
      'owner_attestation_ref','VC-OWNER-ATTESTATION-20261123-01',
      'authorization_evidence_status','OWNER_HELD_NOT_UPLOADED',
      'win_rate','49%',
      'total_skins','130',
      'total_heroes','79',
      'rank_current','Mythic',
      'main_hero','Miya',
      'linked_account','Moonton',
      'linked_platforms','Google Play, Facebook, TikTok',
      'email_bundle','Termasuk email',
      'unbind_terms','Email Moonton dan akun sosial dinyatakan dapat di-unbind setelah 30 hari',
      'platform_support','Android dan iOS',
      'emblem_status','ALL MAX',
      'season_note','Rank dapat turun saat reset season',
      'public_preview',true
    ),
    customer_terms='Penawaran akun dengan spesifikasi sebagaimana tercantum pada katalog. Jika kelak diaktifkan untuk transaksi yang diizinkan, seluruh komunikasi dan penyerahan kepada pembeli dilakukan oleh VAULT CORE. Garansi Anti Hackback ditetapkan 14 hari kalender sejak pembeli mengonfirmasi Selesai setelah penerimaan. Klaim valid mendapat pengembalian 100% dari nilai transaksi; SLA maksimal 48 jam sejak bukti lengkap diterima. Informasi unbind setelah 30 hari dan perubahan rank saat reset season merupakan ketentuan khusus penawaran.',
    fulfillment_eta='Pratinjau katalog. Estimasi pemenuhan ditetapkan VAULT CORE saat SKU memenuhi persyaratan aktivasi.',
    display_stock_mode='HIDE_COUNT',
    display_stock_override=NULL,
    status='PAUSED',
    updated_at=NOW()
WHERE sku='ML-001'
  AND game_category='MLBB'
  AND COALESCE(is_test,FALSE)=FALSE;

-- Keep all MLBB account transfer offers preview-only; no checkout until external permission is established.
UPDATE products p
SET status='PAUSED',
    display_stock_mode='HIDE_COUNT',
    display_stock_override=NULL,
    attributes=COALESCE(p.attributes,'{}'::jsonb) || jsonb_build_object('public_preview',true),
    updated_at=NOW()
FROM marketplace_categories c
WHERE p.marketplace_category_id=c.id
  AND c.slug='mlbb-akun'
  AND p.game_category='MLBB'
  AND COALESCE(p.is_test,FALSE)=FALSE;

UPDATE marketplace_categories
SET purchase_guide='[
  {"title":"Periksa detail penawaran","content":"Periksa spesifikasi akun, galeri gambar, region/server jika tersedia, harga referensi XTR, ketentuan email tertaut, masa unbind 30 hari, dan perubahan rank saat reset season. Saat ini halaman akun ditampilkan sebagai pratinjau katalog."},
  {"title":"Lanjutkan melalui VAULT CORE","content":"Jika SKU telah diaktifkan setelah pemeriksaan hak yang diperlukan, pembeli membuat pesanan hanya melalui VAULT CORE Telegram Mini App. VAULT CORE menjadi satu-satunya pihak yang melayani pembeli; proses pemasok dikelola secara internal."},
  {"title":"Bayar invoice resmi Telegram Stars","content":"Pembayaran produk digital dilakukan dengan invoice resmi Telegram Stars (XTR). Order hanya dianggap dibayar setelah backend menerima dan memverifikasi successful_payment dari Telegram."},
  {"title":"Terima dan periksa penyerahan dari VAULT CORE","content":"VAULT CORE menyampaikan informasi pemenuhan melalui kanal pesanan yang terverifikasi. Pembeli memeriksa ID, nickname, server, spesifikasi dan kecocokan produk sebelum menyatakan pesanan selesai."},
  {"title":"Konfirmasi Selesai dan mulai garansi","content":"Setelah produk benar-benar diterima dan diperiksa, pembeli menekan Selesai pada riwayat pesanan. Waktu konfirmasi ini menjadi awal garansi Anti Hackback 14 hari kalender."},
  {"title":"Ajukan klaim kepada VAULT CORE","content":"Jika ada indikasi hackback selama masa garansi, hubungi VAULT CORE melalui kanal dukungan resmi. Sertakan nomor order, kronologi, waktu kejadian, dan bukti. Klaim valid mendapat refund 100%; SLA maksimal 48 jam sejak bukti lengkap diterima."}
]'::jsonb,
    updated_at=NOW()
WHERE slug='mlbb-akun';

