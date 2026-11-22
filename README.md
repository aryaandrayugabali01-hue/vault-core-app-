# VAULT CORE

Single-vendor Telegram Mini App store for transferable digital products, vouchers, codes, licenses, and supported service instructions.

## Source of truth

Read `PROJECT_CONTRACT.md` before changing product, payment, stock, or delivery behavior. Current contract revision: **v1.5 (CR-05)**. See Section 29 for Owner authority over the internal product lifecycle, structured rights-review records, inventory sourcing, and fulfillment. Section 28's external rights and platform constraints remain applicable. Owner approval was recorded in writing through the project conversation on 21 November 2026; see Section 26.6. Formal legal name/e-signature certificate details are not recorded.

## Project documents

- [Blueprint and Master Operation (MO)](docs/VAULT_CORE_BLUEPRINT_MASTER_OPERATION.md) — complete execution blueprint, operating procedures, QA, deployment, risk register, and go-live gates.
- [Project Contract](PROJECT_CONTRACT.md) — current project contract v1.5 CR-05; see Section 29 for Owner product authority and Section 27 for the XTR-only model.
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

The connected schema was checked with the existing application tables and migrations 001–010 registered. Migration 011 adds structured Owner rights reviews, append-only review events, source-bound inventory, and database guards for product activation/inventory insertion. Migration 011 is applied to production only after the CR-05 release checks pass.

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

Owner authorization accepts either the existing `ADMIN_TELEGRAM_IDS` server-side allowlist or an active record in `owner_accounts`. Protected Owner API routes accept a validated Telegram Mini App `initData` session or a signed, HttpOnly browser session created after Telegram Login Widget verification. Owner status is checked server-side on every protected request.

**Web browser login:** open `https://vaultcore.biz.id/admin` and choose **Log in with Telegram**. Telegram verifies the identity; VAULT CORE then checks the Telegram numeric ID against the Owner allowlist. The browser session is signed by the API and stored in a Secure, HttpOnly, SameSite cookie shared only across the VAULT CORE subdomains. No email/password login is used.

**One-time Telegram setup:** in `@BotFather`, run `/setdomain` and select the existing VAULT CORE bot, then register `vaultcore.biz.id`. This authorizes Telegram's Login Widget for the website domain. The bot token already used by the API is also used for server-side signature verification. If the widget is not displayed or Telegram rejects the domain, complete this BotFather step first.

**Mini App login:** users can continue to open VAULT CORE from the Telegram bot. The existing `initData` validation remains supported. In the Mini App, open **Profile → Buka Dashboard Owner** to enter the Owner Console at `/admin`.


## Operational rules

- A product is created as `DRAFT`. Only Owner may approve the structured CR-05 internal rights review and activate a commercial SKU. The approval must be current, complete, attested, and unexpired; a free-form `rights_review_reference` is not sufficient.
- Inventory payloads are encrypted before storage. Each commercial inventory unit is bound to the current Owner-approved rights review and a source/vendor or internal-origin reference. Supported payloads are redeem codes, voucher codes, license keys, gift codes, digital files, and service instructions.
- Each reserved inventory item stores its owning order ID. Release and delivery operations verify ownership; one inventory unit cannot be linked to multiple active deliveries.
- Each order can claim only one unique Telegram pre-checkout query ID. A valid successful-payment event is recorded once using the Telegram charge ID.
- Owner is the internal decision-maker for product detail, source records, approval, inventory, and fulfillment. Internal approval does not create third-party ownership/license or override publisher/platform terms or applicable law. Account takeover credentials, email/password bundles, session tokens, OTP seeds, recovery codes, or third-party account credentials remain unsupported as fulfillment assets.
- Public display stock is calculated from real sellable inventory. `display_stock_override` is a display cap and can never raise displayed stock above actual availability.
- Telegram digital goods/services are paid through official Telegram Stars invoices. No manual XTR wallet-address payment flow is implemented.
- `successful_payment` is the only event that marks an order paid. Screenshot claims or client-side callbacks never mark an order paid.
- `/paysupport` provides a buyer-facing support path. Owner refund requests use Telegram's `refundStarPayment` method and are recorded in the transaction/order status.
- Payment audit snapshots retain payment identifiers and required order metadata only; buyer profile/chat fields are excluded.
- API endpoints have IP-based rate limits. The built-in store is process-local; use a shared store or edge-level controls before scaling to multiple API instances.
- Delivery claims record attempt count/time and failure reason. Definitive Telegram API rejection can be retried; stale or ambiguous send outcomes enter `REVIEW_REQUIRED` and must be reconciled by Owner before retry.
- Stars refunds use a two-phase `REFUND_PENDING` state. If Telegram reports an already-refunded charge, the service checks the Stars transaction ledger before finalizing the internal status.
- Sale price, cost, expenses, order snapshots, reports, refunds, and profit are recorded and displayed in XTR only.

- The customer Profile exposes one owner-only action to create/activate four TEST-only sample products and encrypted dummy delivery payloads. This action is idempotent and seeds one available dummy inventory item per sample product. The samples appear in the customer catalog after successful setup.

## CR-05 structured rights workflow

- Owner Console records rights basis, publisher/platform, official terms URL, authorization reference where applicable, chain of title, transfer method, region, validity, notes, and Owner attestation.
- Reviewer identity and review time are set server-side. Review revisions and status transitions are retained in an append-only event history.
- Catalog, activation, inventory insertion, order creation, Telegram pre-checkout, and delivery recheck the current review and its expiry.
- Every commercial stock unit stores its source reference and the exact review ID that approved it. Expired or superseded review records block new sales and delivery.
- File uploads are not enabled because the existing Cloudflare account has R2 disabled. The current workflow stores evidence URLs/document references; it does not claim binary attachments are uploaded.

## Current implementation status

Production infrastructure was deployed successfully in run `44902626165`. The latest owner onboarding and one-tap test setup changes are tracked by subsequent CI/production workflow runs; consult GitHub Actions for the current head SHA and deployment result. It passed secret and Cloudflare preflight, backend/core tests, frontend build, both Worker deployments, API health with Neon database connection, gateway upstream configuration, custom-domain/DNS/TLS checks for root/www/api, and Telegram webhook read-back.

Implemented in source and CI-validated: Telegram `initData` authentication, catalog API, order creation/reservation with owning order IDs, single pre-checkout claim per order, Stars invoice generation, successful-payment verification/idempotency, encrypted inventory, ambiguous-delivery review/reconciliation, two-phase Stars refund recovery, `/paysupport`, owner product/inventory/order routes, expense/profit reporting, customer Mini App, and Owner Console.

Live production infrastructure is deployed, but sales readiness is still gated by actual catalog setup and acceptance tests. A Neon audit after migration 006 found **4 TEST-only products in DRAFT, 0 inventory items, 0 orders, and 0 transactions**. Migration 007 adds database-backed owner provisioning so the verified owner can run the one-tap setup from Profile. The four samples remain DRAFT until that action is successfully run. No commercial SKU has been approved or activated. Live XTR payment, refund, fulfilment, IDOR, backup/restore, production rate-limit, and Owner UAT tests remain pending.

## Production deployment

- Frontend Worker: `vault-core-web`.
- API Worker: `vault-core-api`, connected to Neon through Hyperdrive `vault-core-neon`.
- Existing gateway: `vault-core-gateway`; `WEB_ORIGIN` and `API_ORIGIN` secrets are installed.
- Custom domains are attached to the existing gateway: `vaultcore.biz.id`, `www.vaultcore.biz.id`, and `api.vaultcore.biz.id`.
- Cloudflare DNS records for all three hosts are configured and proxied.
- Production Telegram webhook: `https://api.vaultcore.biz.id/api/telegram/webhook`; configuration and `getWebhookInfo` read-back passed in the production workflow.
- Production run: [44902626165](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44902626165), attempt 1, **SUCCESS**.

## Remaining launch gates

1. Create and review the first sellable SKUs, record each rights-review reference, set sale and cost amounts in XTR, then add encrypted sellable inventory.
2. Run end-to-end Owner and customer acceptance: Mini App authentication, catalog, order, XTR invoice, pre-checkout validation, successful payment, exactly-once delivery, refund/recovery, and support.
3. Complete IDOR/admin authorization review, backup/restore test, production rate-limit review, and record Owner UAT plus explicit release approval.

## Continuous integration

`.github/workflows/ci.yml` runs workspace installation, automated tests, and the Next.js production build on pushes to `main`/`develop` and pull requests to `main`.
