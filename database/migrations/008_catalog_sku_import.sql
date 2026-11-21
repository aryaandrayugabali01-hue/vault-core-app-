-- Import the approved SKU/pricing sheet without activating unreviewed products.
-- Fulfillment method and product descriptions were not supplied; keep them unset/empty
-- and require a fulfillment method before any product can become ACTIVE.
ALTER TABLE products ALTER COLUMN fulfillment_type DROP NOT NULL;

ALTER TABLE products
  ADD CONSTRAINT products_active_requires_fulfillment_type
  CHECK (status <> 'ACTIVE' OR fulfillment_type IS NOT NULL);

INSERT INTO products (
  sku, game_category, tier, name, description, fulfillment_type,
  sale_price_xtr, cost_price_xtr, status, is_test
)
VALUES
  ('MLBB-SLV-001', 'MLBB', 'SILVER', 'MLBB-SLV-001', '', NULL, 380, 0, 'PENDING_REVIEW', FALSE),
  ('RBLX-SLV-002', 'ROBLOX', 'SILVER', 'RBLX-SLV-002', '', NULL, 570, 0, 'PENDING_REVIEW', FALSE),
  ('FFIR-SLV-003', 'FREE_FIRE', 'SILVER', 'FFIR-SLV-003', '', NULL, 380, 0, 'PENDING_REVIEW', FALSE),
  ('GNSH-SLV-004', 'GENSHIN', 'SILVER', 'GNSH-SLV-004', '', NULL, 570, 0, 'PENDING_REVIEW', FALSE),
  ('MLBB-GLD-005', 'MLBB', 'GOLD', 'MLBB-GLD-005', '', NULL, 1890, 0, 'PENDING_REVIEW', FALSE),
  ('RBLX-GLD-006', 'ROBLOX', 'GOLD', 'RBLX-GLD-006', '', NULL, 1890, 0, 'PENDING_REVIEW', FALSE),
  ('FFIR-GLD-007', 'FREE_FIRE', 'GOLD', 'FFIR-GLD-007', '', NULL, 1890, 0, 'PENDING_REVIEW', FALSE),
  ('GNSH-GLD-008', 'GENSHIN', 'GOLD', 'GNSH-GLD-008', '', NULL, 1890, 0, 'PENDING_REVIEW', FALSE),
  ('MLBB-PLT-009', 'MLBB', 'PLATINUM', 'MLBB-PLT-009', '', NULL, 5660, 0, 'PENDING_REVIEW', FALSE),
  ('RBLX-PLT-010', 'ROBLOX', 'PLATINUM', 'RBLX-PLT-010', '', NULL, 7550, 0, 'PENDING_REVIEW', FALSE),
  ('FFIR-PLT-011', 'FREE_FIRE', 'PLATINUM', 'FFIR-PLT-011', '', NULL, 4530, 0, 'PENDING_REVIEW', FALSE),
  ('GNSH-PLT-012', 'GENSHIN', 'PLATINUM', 'GNSH-PLT-012', '', NULL, 9435, 0, 'PENDING_REVIEW', FALSE)
ON CONFLICT (sku) DO NOTHING;
