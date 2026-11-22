-- Enforce the CR-03 rule at the database boundary, including concurrent writes.
-- At most one internal test fixture may be ACTIVE at any time.
CREATE UNIQUE INDEX IF NOT EXISTS products_single_active_test_fixture_idx
  ON products (is_test)
  WHERE is_test IS TRUE AND status = 'ACTIVE';
