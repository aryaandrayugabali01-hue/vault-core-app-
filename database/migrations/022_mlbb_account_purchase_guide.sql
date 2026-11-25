-- 022: Align MLBB account buying instructions with the approved mobile detail reference.
-- Only the active MLBB account category guide is changed; product, stock, rights and pricing data are untouched.
UPDATE marketplace_categories
SET purchase_guide = '[
  {
    "title": "Selesaikan pembayaran melalui VAULT CORE",
    "content": "Buka pesanan melalui VAULT CORE dan selesaikan pembayaran menggunakan invoice resmi Telegram Stars (XTR)."
  },
  {
    "title": "Tunggu verifikasi pembayaran",
    "content": "Tunggu sampai pembayaran Telegram Stars terverifikasi dan status pesanan diperbarui oleh VAULT CORE."
  },
  {
    "title": "Terima data akun melalui halaman pesanan",
    "content": "Setelah pembayaran terverifikasi, VAULT CORE mengirimkan data akun melalui halaman pesanan resmi."
  },
  {
    "title": "Login dan amankan akun",
    "content": "Login menggunakan data yang diberikan VAULT CORE, periksa kesesuaian akun, lalu segera amankan akses dan metode pemulihannya."
  }
]'::jsonb,
updated_at=NOW()
WHERE slug='mlbb-akun' AND is_active=TRUE;
