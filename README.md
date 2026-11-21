# VAULT CORE

Single-vendor Telegram Mini App store for transferable digital products, vouchers, codes, licenses, and supported service instructions.

## Source of truth

Read `PROJECT_CONTRACT.md` before changing product, payment, stock, or delivery behavior. Current approved contract baseline: **v1.2 (CR-02)**. Owner approval was recorded in writing through the project conversation on 21 November 2026; see Section 26.6. Formal legal name/e-signature certificate details are not recorded.

## Project documents

- [Blueprint and Master Operation (MO)](docs/VAULT_CORE_BLUEPRINT_MASTER_OPERATION.md) — complete execution blueprint, operating procedures, QA, deployment, risk register, and go-live gates.
- [Project Contract](PROJECT_CONTRACT.md) — approved product and technical baseline v1.2 CR-02; see Section 26.6 for the owner approval record.
- [Deployment Status](DEPLOYMENT_STATUS.md) — infrastructure and production readiness record.
- [Production Deployment Runbook](PRODUCTION_DEPLOYMENT_RUNBOOK.md) — secrets, workflow, routing, and Telegram webhook procedure.

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

The connected schema was checked: 10 application tables are present and all 5 migrations (001–005) are registered. Migrations 004 and 005 add reservation ownership/delivery review and a single pre-checkout claim per order.

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
- Each reserved inventory item stores its owning order ID. Release and delivery operations verify ownership; one inventory unit cannot be linked to multiple active deliveries.
- Each order can claim only one unique Telegram pre-checkout query ID. A valid successful-payment event is recorded once using the Telegram charge ID.
- Account takeover credentials, email/password bundles, session tokens, OTP seeds, recovery codes, or third-party account credentials are not supported as fulfillment assets.
- Public display stock is calculated from real sellable inventory. `display_stock_override` is a display cap and can never raise displayed stock above actual availability.
- Telegram digital goods/services are paid through official Telegram Stars invoices. No manual XTR wallet-address payment flow is implemented.
- `successful_payment` is the only event that marks an order paid. Screenshot claims or client-side callbacks never mark an order paid.
- `/paysupport` provides a buyer-facing support path. Owner refund requests use Telegram's `refundStarPayment` method and are recorded in the transaction/order status.
- Payment audit snapshots retain payment identifiers and required order metadata only; buyer profile/chat fields are excluded.
- API endpoints have IP-based rate limits. The built-in store is process-local; use a shared store or edge-level controls before scaling to multiple API instances.
- Delivery claims record attempt count/time and failure reason. Definitive Telegram API rejection can be retried; stale or ambiguous send outcomes enter `REVIEW_REQUIRED` and must be reconciled by Owner before retry.
- Stars refunds use a two-phase `REFUND_PENDING` state. If Telegram reports an already-refunded charge, the service checks the Stars transaction ledger before finalizing the internal status.
- Price and cost are snapshotted at order creation. Reports show gross sales, cost, operating expenses, gross profit, and net profit in IDR, alongside received XTR.

## Current implementation status

Latest validated source on `main`: `f682001ee694937d9ba2da77b70867dfdc56f6e3`. CI run `44885310611` and Cloudflare frontend preparation run `44885310642` both completed successfully on that commit. The production deployment preflight run `44884767909` stopped before deployment because all five required GitHub Actions secrets were empty. The original v1.3 ZIP is retained in the repository.

Implemented and CI-validated in source: Telegram `initData` authentication, catalog API, order creation/reservation with owning order IDs, single pre-checkout claim per order, Stars invoice generation, successful-payment verification/idempotency, encrypted inventory, ambiguous-delivery review/reconciliation, two-phase Stars refund recovery, `/paysupport`, owner product/inventory/order routes, expense/profit reporting, customer Mini App, and Owner Console. Live payment, refund, delivery, IDOR, backup/restore and Owner UAT tests remain pending.

## Not yet deployed

- Existing `vault-core-gateway` is deployed, but Workers `vault-core-api` and `vault-core-web` are absent from the target account.
- Cloudflare zone `vaultcore.biz.id` is ACTIVE; gateway origins are unset, Custom Domains list is empty, and zone DNS records are empty.
- GitHub Actions production workflow run `44884767909` confirmed the five required secrets (`CLOUDFLARE_API_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `APP_ENCRYPTION_KEY`) resolve empty in the workflow environment. Deployment stopped before any resource changes.
- Production Telegram bot identity/token, webhook registration, and owner Telegram ID allowlist are not configured.
- No live XTR payment, refund, and fulfillment test has been run.
- No live XTR payment, refund, and fulfillment test has been run.
- Backup/restore, IDOR, and live rate-limit behavior still require staging validation before launch.

## Continuous integration

`.github/workflows/ci.yml` runs workspace installation, automated tests, and the Next.js production build on pushes to `main`/`develop` and pull requests to `main`.
