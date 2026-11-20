# VAULT CORE

Single-vendor Telegram Mini App store for transferable digital products, vouchers, codes, licenses, and supported service instructions.

## Source of truth

Read `PROJECT_CONTRACT.md` before changing product, payment, stock, or delivery behavior. Current contract draft: **v1.2 (CR-02)**. The approval fields in Section 26.6 are still unsigned in the repository copy.

## Technology

- Frontend: Next.js App Router / React
- API: Node.js / Express
- Database: PostgreSQL (Neon)
- Bot: Telegram Bot API webhook
- Payments: official Telegram Stars invoice (`XTR`) for digital goods/services inside Telegram
- Digital inventory: AES-256-GCM encrypted payloads

## Connected database

- Provider: Neon
- Project: `VAULT CORE`
- Project ID: `soft-morning-26299268`
- Region: `aws-ap-southeast-1` (Singapore)
- PostgreSQL: 16
- Database: `vault_core`
- Default branch: `main`

The connected schema was checked: 10 tables are present and all 3 migration records are registered.

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

Set `ADMIN_TELEGRAM_IDS` to the comma-separated numeric Telegram user IDs permitted to use the owner console. Customer and owner API requests must include Telegram Mini App `initData`; the backend validates its HMAC and timestamp.

## Operational rules

- A product is created as `DRAFT`. Only activate a product after the SKU review reference is recorded.
- Inventory payloads are encrypted before storage. Supported payloads are redeem codes, voucher codes, license keys, gift codes, digital files, and service instructions.
- Account takeover credentials, email/password bundles, session tokens, OTP seeds, recovery codes, or third-party account credentials are not supported as fulfillment assets.
- Public display stock is calculated from real sellable inventory. `display_stock_override` is a display cap and can never raise displayed stock above actual availability.
- Telegram digital goods/services are paid through official Telegram Stars invoices. No manual XTR wallet-address payment flow is implemented.
- `successful_payment` is the only event that marks an order paid. Screenshot claims or client-side callbacks never mark an order paid.
- `/paysupport` provides a buyer-facing support path. Owner refund requests use Telegram's `refundStarPayment` method and are recorded in the transaction/order status.
- Payment audit snapshots retain payment identifiers and required order metadata only; buyer profile/chat fields are excluded.
- API endpoints have IP-based rate limits. The built-in store is process-local; use a shared store or edge-level controls before scaling to multiple API instances.
- Delivery claims record attempt count/time and failure reason; stale `READY` claims can be retried after the recovery interval. Telegram send operations are externally processed, so an ambiguous network failure may require owner reconciliation before retry.
- Price and cost are snapshotted at order creation. Reports show gross sales, cost, operating expenses, gross profit, and net profit in IDR, alongside received XTR.

## Current implementation status

Source is published in the existing GitHub repository; the last verified code commit is `89f6d7912070712b07d370acaba9a266ffba1c0e` (40 project source files; original v1.3 ZIP retained). GitHub Actions run `44833016477` completed successfully: dependency install, backend/core tests, and Next.js production build all passed.

Implemented in the source tree: Telegram `initData` authentication, catalog API, order reservation, Stars invoice generation, webhook payment verification, encrypted inventory writes, automated delivery with retry tracking, `/paysupport`, owner-triggered Stars refunds, owner product/inventory/order routes, expense and profit reporting, customer Mini App, and Owner Console.

## Not yet deployed

- VAULT CORE gateway Worker `vault-core-gateway` is deployed; production frontend and API application origins are not yet deployed or configured.
- Cloudflare zone `vaultcore.biz.id` is active in the connected account. Worker `vault-core-gateway` is deployed; frontend/API origins and custom-domain bindings remain to be configured.
- Production environment secrets, Telegram bot identity/token, webhook registration, and owner Telegram ID allowlist are not configured in the connected deployment.
- No live XTR payment, refund, and fulfillment test has been run.
- Backup/restore, IDOR, and live rate-limit behavior still require staging validation before launch.

## Continuous integration

`.github/workflows/ci.yml` runs workspace installation, automated tests, and the Next.js production build on pushes to `main`/`develop` and pull requests to `main`.
