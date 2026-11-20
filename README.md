# VAULT CORE

Single-vendor Telegram Mini App store for transferable digital products, vouchers, codes, licenses, and supported service instructions.

## Source of truth

Read `PROJECT_CONTRACT.md` before changing product, payment, stock, or delivery behavior. Current contract draft: **v1.2 (CR-02)**.

## Technology

- Frontend: Next.js App Router / React
- API: Node.js / Express
- Database: PostgreSQL (Neon)
- Bot: Telegram Bot API webhook
- Payments: official Telegram Stars invoice (`XTR`) for digital goods/services inside Telegram
- Digital inventory: AES-256-GCM encrypted payloads

## Connected database

A dedicated PostgreSQL project was created for VAULT CORE:

- Provider: Neon
- Project: `VAULT CORE`
- Project ID: `soft-morning-26299268`
- Region: `aws-ap-southeast-1` (Singapore)
- PostgreSQL: 16
- Database: `vault_core`
- Default branch: `main`

The schema and migration registry were applied and verified. The database contains: `customers`, `products`, `inventory_items`, `orders`, `order_items`, `transactions`, `deliveries`, `admin_audit_logs`, `operating_expenses`, and `schema_migrations`.

## Local setup

1. Install Node.js 20 or later and PostgreSQL-compatible access.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` from the Neon console.
3. Generate an encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. Set `APP_ENCRYPTION_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_TELEGRAM_IDS`.
5. Run `npm install` from the repository root.
6. Run `npm run migrate` to register/apply the versioned SQL migrations.
7. Run `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
8. Check `http://localhost:3000/health` and open `http://localhost:3001`.

## Bot webhook

Set `TELEGRAM_WEBHOOK_URL` to the public API route, then run `npm run setup:webhook`. Telegram bot updates are received at `/api/telegram/webhook`.

## Owner access

Set `ADMIN_TELEGRAM_IDS` to the comma-separated numeric Telegram user IDs permitted to use `/admin`. Customer and owner API requests must include the Telegram Mini App `initData`; the backend validates its HMAC and timestamp.

## Operational rules

- A product is created as `DRAFT`. Only activate a product after the SKU review reference is recorded.
- Inventory payloads are encrypted before storage. Supported payloads are redeem codes, voucher codes, license keys, gift codes, digital files, and service instructions.
- Account takeover credentials, email/password bundles, session tokens, OTP seeds, recovery codes, or third-party account credentials are not supported as fulfillment assets.
- Public display stock is calculated from real sellable inventory. `display_stock_override` is a display cap and can never raise displayed stock above actual availability.
- Telegram digital goods/services are paid through official Telegram Stars invoices. No manual XTR wallet-address payment flow is implemented.
- `successful_payment` is the only event that marks an order paid. Screenshot claims or client-side callbacks never mark an order paid.
- `/paysupport` provides a buyer-facing support path. Owner refund requests use Telegram's `refundStarPayment` method and are recorded in the transaction/order status.
- Delivery claims record attempt count/time and failure reason; stale `READY` claims can be retried after the recovery interval. Telegram send operations are externally processed, so an ambiguous network failure may require owner reconciliation before retry.
- Price and cost are snapshotted at order creation. Reports show gross sales, cost, operating expenses, gross profit, and net profit in IDR, alongside received XTR.

## Current implementation status

Implemented in the source tree: Telegram `initData` authentication, catalog API, order reservation, Stars invoice link generation, webhook payment verification, encrypted inventory writes, automated delivery with retry tracking, `/paysupport`, owner-triggered Stars refunds, owner product/inventory/order routes, profit dashboard, customer Mini App, and Owner Console.

Not yet deployed: public frontend/API hosting, GitHub repository publication, Cloudflare domain/Worker routing, Telegram webhook registration with the production bot token, admin allowlist, production environment secrets, and end-to-end live payment/refund tests. Package installation and a full Next.js production build remain unverified because this execution environment could not resolve `registry.npmjs.org`.

## Continuous integration

`.github/workflows/ci.yml` runs workspace installation, the automated tests, and the Next.js production build on pushes to `main`/`develop` and pull requests to `main`.
