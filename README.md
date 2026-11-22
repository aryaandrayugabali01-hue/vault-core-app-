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

The production database has migrations 001–012 registered. Migration 011 (CR-05) adds structured Owner rights reviews, append-only review events, source-bound inventory, and database guards. Migration 012 (CR-06) adds Owner-managed product image URL, customer terms, and fulfillment ETA fields. Both are applied to Neon production.

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

- Four TEST-only fixtures are maintained separately from commercial SKUs. The current production snapshot contains four fixture inventory items; these are dummy test payloads, not sellable commercial inventory. Completing a fixture invoice charges 1 real Telegram Star if the Owner actually pays it.

## CR-05 structured rights workflow

- Owner Console records rights basis, publisher/platform, official terms URL, authorization reference where applicable, chain of title, transfer method, region, validity, notes, and Owner attestation.
- Reviewer identity and review time are set server-side. Review revisions and status transitions are retained in an append-only event history.
- Catalog, activation, inventory insertion, order creation, Telegram pre-checkout, and delivery recheck the current review and its expiry.
- Every commercial stock unit stores its source reference and the exact review ID that approved it. Expired or superseded review records block new sales and delivery.
- File uploads are not enabled because the existing Cloudflare account has R2 disabled. The workflow stores evidence URLs/document references. CR-06 product images use a validated public HTTPS URL or an existing local /assets/ path; binary image uploads are not enabled.

## Current implementation status

Production infrastructure is deployed from commit e315e2f4c28b37583b87b4dd0cdb68881c196385 in run 45056388433, which completed successfully. That production version includes CR-05. The CR-06 application changes are tracked in PR #6; CI passed, but the CR-06 UI/API changes are not live until the PR is merged and the existing production workflow succeeds.

Implemented in the deployed application: Telegram initData authentication, catalog API, order reservation, Telegram Stars invoice generation, successful-payment verification/idempotency, encrypted inventory, delivery recovery/reconciliation, two-phase Stars refund recovery, /paysupport, Owner product/inventory/order routes, expense/profit reporting, customer Mini App, and Owner Console. CR-05 review enforcement is active across catalog, activation, inventory insertion, order creation, Telegram pre-checkout, and delivery.

Latest production data snapshot (23 November 2026):

| Entity | Production state |
|---|---:|
| Total products | 16 |
| Commercial products | 12, all PENDING_REVIEW |
| Commercial products active | 0 |
| Owner rights reviews recorded | 0 |
| TEST-only fixtures | 4 |
| Inventory items | 4, TEST-only dummy units |
| Orders | 0 |
| Transactions | 0 |

No commercial SKU has an approved current rights review, no commercial inventory has been sourced or added, and no live order or transaction exists. Accordingly, the public commercial catalog has no sellable SKU until Owner completes the relevant product details, records a valid CR-05 review, approves the SKU, and adds source-bound inventory.

CR-06 adds full Owner editing of product identity/details, price and cost, fulfillment method, product image reference, customer terms, and estimated fulfillment time. The storefront reads the Owner-authored image/terms/ETA. Changing fulfillment method pauses the SKU, clears the current review pointer, and makes prior available stock unavailable pending a new review. The change is covered by tests and frontend/API build validation in PR #6.

Live customer XTR payment/refund/fulfillment acceptance, IDOR/admin authorization review, backup/restore, production rate-limit verification, and Owner UAT/release approval are still pending.
## Production deployment

- Frontend Worker: vault-core-web.
- API Worker: vault-core-api, connected to Neon through Hyperdrive vault-core-neon.
- Existing gateway: vault-core-gateway; WEB_ORIGIN and API_ORIGIN secrets are installed.
- Custom domains: vaultcore.biz.id, www.vaultcore.biz.id, and api.vaultcore.biz.id.
- Production Telegram webhook: https://api.vaultcore.biz.id/api/telegram/webhook; configuration and getWebhookInfo read-back passed in deployment run 45056388433.
- Latest confirmed production source: e315e2f4c28b37583b87b4dd0cdb68881c196385; run 45056388433, SUCCESS.
- Neon migrations 001–012 are registered. Migration 012 is additive and does not alter existing SKU prices, statuses, or inventory.
## Remaining launch gates

1. Owner completes accurate details for each intended commercial SKU, records the actual source/authorization basis and official terms where applicable, attests the review, and adds encrypted inventory with a valid source reference. No product is activated automatically.
2. Run a controlled end-to-end acceptance with Owner/customer accounts: Mini App authentication, catalog, order, Telegram XTR invoice, pre-checkout validation, successful-payment verification, exactly-once delivery, refund/recovery, and support.
3. Complete IDOR/admin authorization review, backup/restore test, production rate-limit review, and record Owner UAT plus explicit release approval.

Binary evidence/image uploads remain unavailable while R2 is disabled; use valid document references and public HTTPS or existing /assets/ image paths.
## Continuous integration

`.github/workflows/ci.yml` runs workspace installation, automated tests, and the Next.js production build on pushes to `main`/`develop` and pull requests to `main`.
