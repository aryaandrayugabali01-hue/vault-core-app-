-- CR-11 follow-up: publish MLBB account listing while preserving a strict publisher-transfer checkout gate.
-- Public catalog visibility is separate from sale authorization. This SKU remains non-purchasable
-- until Owner records explicit written authorization from Moonton in an approved rights review.

CREATE OR REPLACE FUNCTION vault_core_enforce_product_rights_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  review product_rights_reviews%ROWTYPE;
BEGIN
  IF NEW.status <> 'ACTIVE' OR COALESCE(NEW.is_test, FALSE) = TRUE THEN
    RETURN NEW;
  END IF;

  -- Public informational listing: visible on the storefront, but deliberately not purchasable.
  IF COALESCE(NEW.attributes->>'public_preview', 'false') = 'true'
     AND COALESCE(NEW.attributes->>'sales_enabled', 'false') <> 'true' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO review
  FROM product_rights_reviews
  WHERE id = NEW.current_rights_review_id
    AND product_id = NEW.id;

  IF NOT FOUND
     OR review.review_status <> 'APPROVED'
     OR review.valid_until <= NOW()
     OR review.owner_attested IS NOT TRUE
     OR length(btrim(review.chain_of_title)) < 3
     OR length(btrim(review.transfer_method)) < 3
     OR length(btrim(review.region)) < 2
     OR length(btrim(review.publisher_platform)) < 2 THEN
    RAISE EXCEPTION 'PRODUCT_RIGHTS_REVIEW_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_current_rights_review';
  END IF;

  IF (review.rights_basis NOT IN ('OWNER_CREATED','OWNER_OWNED','SERVICE')
      OR upper(review.publisher_platform) <> 'INTERNAL_OWNER')
     AND (review.authorization_evidence_reference IS NULL
          OR length(btrim(review.authorization_evidence_reference)) < 3) THEN
    RAISE EXCEPTION 'PRODUCT_RIGHTS_AUTHORIZATION_REFERENCE_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_authorization_reference';
  END IF;

  IF upper(review.publisher_platform) <> 'INTERNAL_OWNER'
     AND (review.official_terms_url IS NULL OR review.official_terms_url !~* '^https://') THEN
    RAISE EXCEPTION 'PRODUCT_OFFICIAL_TERMS_URL_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_official_terms_url';
  END IF;

  -- MLBB account transfers require explicit publisher authorization, not only Owner attestation.
  IF NEW.game_category = 'MLBB'
     AND NEW.fulfillment_type = 'GAME_ACCOUNT_TRANSFER'
     AND (
       review.rights_basis <> 'OFFICIAL_DISTRIBUTION'
       OR upper(review.publisher_platform) NOT LIKE '%MOONTON%'
       OR review.authorization_evidence_reference IS NULL
       OR review.authorization_evidence_reference !~* '^https://'
       OR review.official_terms_url IS NULL
       OR review.official_terms_url !~* '^https://'
     ) THEN
    RAISE EXCEPTION 'MLBB_ACCOUNT_TRANSFER_PUBLISHER_AUTHORIZATION_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'mlbb_account_requires_publisher_authorization';
  END IF;

  IF NEW.fulfillment_type IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_FULFILLMENT_TYPE_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'products_active_requires_fulfillment_type';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_rights_activation ON products;
CREATE TRIGGER trg_products_rights_activation
BEFORE INSERT OR UPDATE OF status, current_rights_review_id, fulfillment_type, is_test, attributes
ON products
FOR EACH ROW
EXECUTE FUNCTION vault_core_enforce_product_rights_activation();

UPDATE products p
SET status = 'ACTIVE',
    sale_price_xtr = CASE WHEN p.sku = 'ML-001' THEN 400 ELSE p.sale_price_xtr END,
    display_stock_mode = 'HIDE_COUNT',
    display_stock_override = NULL,
    attributes = (
      COALESCE(p.attributes, '{}'::jsonb)
      - 'cost_price_note'
      - 'cost_price_status'
      - 'fulfillment_mode'
      - 'owner_attestation_ref'
      - 'authorization_evidence_status'
    ) || jsonb_build_object(
      'public_preview', true,
      'sales_enabled', false,
      'stock_model', 'CATALOG_ON_DEMAND',
      'publisher_transfer_authorization_status', 'NOT_GRANTED'
    ),
    updated_at = NOW()
FROM marketplace_categories c
WHERE p.marketplace_category_id = c.id
  AND c.slug = 'mlbb-akun'
  AND p.game_category = 'MLBB'
  AND p.fulfillment_type = 'GAME_ACCOUNT_TRANSFER'
  AND COALESCE(p.is_test, FALSE) = FALSE;

UPDATE products
SET name = 'Akun MLBB · 79 Hero · 130 Skin · Mythic',
    description = 'Akun Mobile Legends dengan win rate 49%, 130 skin, 79 hero, rank Mythic, hero utama Miya, dan emblem ALL MAX. Penawaran menyebut akun terhubung ke Moonton serta masih tertaut ke Google Play, Facebook, dan TikTok. Paket Gmail disertakan. Email Moonton dan tautan platform sosial disebut dapat dilepas setelah 30 hari. Rank dapat turun saat reset season baru.',
    sale_price_xtr = 400,
    image_url = '/assets/products/mlbb-account/account-overview-79-hero-130-skin.jpg',
    image_gallery = '[
      "/assets/products/mlbb-account/account-overview-79-hero-130-skin.jpg",
      "/assets/products/mlbb-account/skin-catalog-01.jpg",
      "/assets/products/mlbb-account/skin-catalog-02.jpg",
      "/assets/products/mlbb-account/skin-catalog-03.jpg",
      "/assets/products/mlbb-account/emblem-all-max.webp"
    ]'::jsonb,
    attributes = (
      COALESCE(attributes, '{}'::jsonb)
      - 'cost_price_note'
      - 'cost_price_status'
      - 'fulfillment_mode'
      - 'owner_attestation_ref'
      - 'authorization_evidence_status'
    ) || jsonb_build_object(
      'price_reference_idr', '150000',
      'price_currency', 'IDR',
      'win_rate', '49%',
      'total_skins', '130',
      'total_heroes', '79',
      'rank_current', 'Mythic',
      'main_hero', 'Miya',
      'linked_account', 'Moonton',
      'linked_platforms', 'Google Play, Facebook, TikTok',
      'email_bundle', 'Gmail disertakan',
      'unbind_terms', 'Email Moonton dan akun sosial dinyatakan dapat di-unbind setelah 30 hari',
      'platform_support', 'Android dan iOS',
      'emblem_status', 'ALL MAX',
      'season_note', 'Rank dapat turun saat reset season',
      'public_preview', true,
      'sales_enabled', false,
      'stock_model', 'CATALOG_ON_DEMAND',
      'publisher_transfer_authorization_status', 'NOT_GRANTED'
    ),
    customer_terms = 'INFORMASI PENAWARAN\nSpesifikasi akun mengikuti data dan gambar yang ditampilkan pada katalog. Paket penawaran mencakup Gmail. Akun masih terhubung dengan Moonton, Google Play, Facebook, dan TikTok. Keterangan penawaran menyebut email Moonton dan platform sosial dapat dilepas setelah 30 hari. Rank Mythic dapat berubah saat reset season.\n\nKeterangan “100% No Minus” merupakan klaim pada materi penawaran; pembeli tetap perlu memeriksa ID, nickname, server, spesifikasi, akses Gmail, dan tautan akun ketika penyerahan dilakukan.\n\nGARANSI ANTI HACKBACK VAULT CORE\nGaransi berlaku otomatis selama 14 hari kalender sejak pembeli mengonfirmasi pesanan Selesai setelah menerima dan memeriksa produk. Apabila ada indikasi akun diambil alih kembali selama masa garansi, pembeli menghubungi VAULT CORE melalui kanal dukungan resmi dengan nomor pesanan, kronologi, dan bukti pendukung. VAULT CORE memeriksa laporan, riwayat transaksi, dan bukti. Klaim yang terbukti valid mendapat pengembalian dana 100% dari nilai transaksi. Waktu pemrosesan maksimal 48 jam sejak kronologi dan bukti lengkap diterima. Klaim harus diajukan selama masa garansi masih aktif.',
    fulfillment_eta = 'Listing katalog publik. Pemesanan belum dibuka sampai persyaratan otorisasi publisher terpenuhi.',
    display_stock_mode = 'HIDE_COUNT',
    display_stock_override = NULL,
    updated_at = NOW()
WHERE sku = 'ML-001'
  AND game_category = 'MLBB'
  AND COALESCE(is_test, FALSE) = FALSE;

UPDATE marketplace_categories
SET purchase_guide = '[
  {"title":"Periksa detail penawaran","content":"Periksa gambar dan spesifikasi akun: win rate 49%, 130 skin, 79 hero, rank Mythic, hero utama Miya, emblem ALL MAX, platform Android/iOS, Gmail yang disertakan, serta keterangan akun tertaut. Nilai katalog ditampilkan sebesar 400 XTR."},
  {"title":"Penyerahan informasi oleh VAULT CORE","content":"Apabila pemesanan telah dibuka setelah seluruh persyaratan publisher terpenuhi, VAULT CORE akan memberikan informasi akun dan paket Gmail kepada pembeli melalui kanal pesanan resmi. Pembeli bertransaksi dan mendapatkan layanan langsung dari VAULT CORE."},
  {"title":"Login dan periksa akun","content":"Buka Mobile Legends, masuk ke Profile → Account → Switch Account, lalu login menggunakan informasi yang diserahkan VAULT CORE. Periksa ID, nickname, server, dan spesifikasi akun agar sesuai dengan penawaran."},
  {"title":"Amankan Gmail","content":"Ganti password Gmail, perbarui email dan nomor pemulihan, aktifkan verifikasi dua langkah (2FA), lalu buka https://myaccount.google.com → Security → Your Devices untuk memeriksa dan mengeluarkan perangkat yang bukan milik Anda."},
  {"title":"Bind dan amankan akun Mobile Legends","content":"Buka Profile → Account dan hubungkan metode Moonton, Facebook, Google, atau VK milik pribadi jika tersedia. Periksa Account Center → Device Management dan gunakan Log Out All bila tersedia untuk mengakhiri sesi perangkat lain."},
  {"title":"Kelola tautan setelah 30 hari","content":"Materi penawaran menyebut email Moonton dan platform media sosial dapat di-unbind setelah 30 hari. Setelah periode tersebut, gunakan menu Disconnect 3rd Party Account/Account Center jika tersedia dan ikuti verifikasi resmi di dalam game."},
  {"title":"Periksa lalu konfirmasi pesanan","content":"Pastikan akses akun dan Gmail berada dalam kendali Anda, detail sesuai penawaran, dan perangkat lama tidak lagi memiliki akses. Setelah seluruh pemeriksaan selesai, buka Riwayat Pembelian VAULT CORE lalu tekan Selesai. Tindakan ini memulai garansi Anti Hackback 14 hari kalender."},
  {"title":"Garansi Anti Hackback 14 hari","content":"Jika muncul indikasi hackback selama masa garansi, hubungi VAULT CORE melalui kanal dukungan resmi. Sertakan nomor pesanan, kronologi, dan bukti pendukung. Klaim valid mendapat refund 100% dari nilai transaksi; pemrosesan maksimal 48 jam sejak bukti lengkap diterima. Klaim harus diajukan sebelum masa garansi berakhir."}
]'::jsonb,
    updated_at = NOW()
WHERE slug = 'mlbb-akun';

UPDATE inventory_items
SET status = 'UNAVAILABLE', reserved_order_id = NULL, reserved_until = NULL
WHERE status = 'AVAILABLE'
  AND product_id IN (
    SELECT p.id
    FROM products p
    JOIN marketplace_categories c ON c.id = p.marketplace_category_id
    WHERE c.slug = 'mlbb-akun'
      AND p.game_category = 'MLBB'
      AND p.fulfillment_type = 'GAME_ACCOUNT_TRANSFER'
      AND COALESCE(p.is_test, FALSE) = FALSE
  );
