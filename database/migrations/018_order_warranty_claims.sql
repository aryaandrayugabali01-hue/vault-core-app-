-- CR-11: Buyer completion timestamp and Anti Hackback warranty claims.
-- Warranty starts only when the customer confirms actual receipt after delivery.

ALTER TABLE orders
  ADD COLUMN buyer_completed_at TIMESTAMPTZ,
  ADD COLUMN warranty_started_at TIMESTAMPTZ,
  ADD COLUMN warranty_expires_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD CONSTRAINT orders_warranty_window_check CHECK (
    (buyer_completed_at IS NULL AND warranty_started_at IS NULL AND warranty_expires_at IS NULL)
    OR (
      buyer_completed_at IS NOT NULL
      AND warranty_started_at = buyer_completed_at
      AND warranty_expires_at > warranty_started_at
    )
  );

CREATE TABLE order_warranty_claims (
  id BIGSERIAL PRIMARY KEY,
  claim_number TEXT NOT NULL UNIQUE,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 3000),
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status = ANY (ARRAY['SUBMITTED','REVIEWING','APPROVED','REJECTED','REFUNDED']::text[])),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_due_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_telegram_user_id BIGINT,
  resolution_notes TEXT NOT NULL DEFAULT '',
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_warranty_claim_evidence_check CHECK (
    jsonb_typeof(evidence_urls) = 'array' AND jsonb_array_length(evidence_urls) <= 8
  )
);

CREATE INDEX idx_order_warranty_claims_status_submitted
  ON order_warranty_claims(status, submitted_at DESC);

CREATE INDEX idx_order_warranty_claims_customer
  ON order_warranty_claims(customer_id, submitted_at DESC);

COMMENT ON COLUMN orders.warranty_started_at IS
  'Set to buyer_completed_at only when the customer confirms receipt of a fulfilled order.';
COMMENT ON COLUMN orders.warranty_expires_at IS
  'Anti Hackback warranty expiry; 14 calendar days after buyer completion.';
COMMENT ON TABLE order_warranty_claims IS
  'Customer-submitted Anti Hackback claims with evidence references and a 48-hour review SLA.';
