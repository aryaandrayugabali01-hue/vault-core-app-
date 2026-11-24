import { pool } from '../db/pool.js';

// Expired unpaid orders must not strand stock until another checkout happens.
// This single statement keeps order, delivery, and inventory state changes atomic.
export async function releaseExpiredPendingOrders(db = pool) {
  const { rows } = await db.query(
    `WITH expired_orders AS (
       UPDATE orders
       SET status='CANCELLED'
       WHERE status='PENDING_PAYMENT'
         AND created_at < NOW() - INTERVAL '15 minutes'
       RETURNING id
     ),
     revoked_deliveries AS (
       UPDATE deliveries
       SET status='REVOKED',
           last_error='Payment window expired; reservation released.'
       WHERE order_id IN (SELECT id FROM expired_orders)
         AND status IN ('PENDING','READY','FAILED','REVIEW_REQUIRED')
       RETURNING id
     ),
     released_inventory AS (
       UPDATE inventory_items
       SET status=CASE
             WHEN source_reference LIKE 'VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:ON_DEMAND_ORDER:%'
               THEN 'UNAVAILABLE'
             ELSE 'AVAILABLE'
           END,
           reserved_order_id=NULL,
           reserved_until=NULL
       WHERE status='RESERVED'
         AND reserved_order_id IN (SELECT id FROM expired_orders)
       RETURNING id
     )
     SELECT
       (SELECT COUNT(*) FROM expired_orders)::int AS expired_orders,
       (SELECT COUNT(*) FROM revoked_deliveries)::int AS revoked_deliveries,
       (SELECT COUNT(*) FROM released_inventory)::int AS released_inventory`
  );
  return rows[0] ?? { expired_orders: 0, revoked_deliveries: 0, released_inventory: 0 };
}
