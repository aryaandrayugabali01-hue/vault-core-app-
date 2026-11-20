CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  game_category TEXT NOT NULL CHECK (game_category IN ('MLBB','ROBLOX','FREE_FIRE','GENSHIN','OTHER')),
  tier TEXT NOT NULL CHECK (tier IN ('SILVER','GOLD','PLATINUM','SERVICE')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('REDEEM_CODE','VOUCHER_CODE','LICENSE_KEY','GIFT_CODE','DIGITAL_FILE','SERVICE_INSTRUCTIONS')),
  sale_price_xtr INTEGER NOT NULL CHECK (sale_price_xtr > 0),
  sale_price_idr BIGINT CHECK (sale_price_idr >= 0),
  cost_price_idr BIGINT NOT NULL DEFAULT 0 CHECK (cost_price_idr >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 2 CHECK (low_stock_threshold >= 0),
  display_stock_mode TEXT NOT NULL DEFAULT 'EXACT_COUNT' CHECK (display_stock_mode IN ('EXACT_COUNT','IN_STOCK_ONLY','HIDE_COUNT')),
  display_stock_override INTEGER CHECK (display_stock_override >= 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','ACTIVE','PAUSED','ARCHIVED')),
  rights_review_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  payload_ciphertext TEXT NOT NULL,
  payload_nonce TEXT NOT NULL,
  payload_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','RESERVED','SOLD','UNAVAILABLE')),
  reserved_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_inventory_product_status ON inventory_items(product_id, status);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT','PAID','FULFILLING','FULFILLED','CANCELLED','REFUND_PENDING','REFUNDED','FAILED')),
  total_xtr INTEGER NOT NULL CHECK (total_xtr > 0),
  total_cost_idr BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_sale_xtr INTEGER NOT NULL CHECK (unit_sale_xtr > 0),
  unit_cost_idr BIGINT NOT NULL CHECK (unit_cost_idr >= 0),
  product_name_snapshot TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL CHECK (provider IN ('TELEGRAM_STARS')),
  currency TEXT NOT NULL CHECK (currency = 'XTR'),
  amount_xtr INTEGER NOT NULL CHECK (amount_xtr > 0),
  telegram_payment_charge_id TEXT UNIQUE,
  provider_payment_charge_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','PAID','REFUND_PENDING','REFUNDED','FAILED')),
  raw_update JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deliveries (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  inventory_item_id BIGINT REFERENCES inventory_items(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','READY','DELIVERED','FAILED','REVOKED')),
  telegram_message_id BIGINT,
  idempotency_key TEXT UNIQUE NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_telegram_user_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
