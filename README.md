# VAULT CORE

Single-vendor Telegram Mini App store for transferable digital products, vouchers, codes, licenses, and supported service instructions.

## Source of truth

Read `PROJECT_CONTRACT.md` before changing product, payment, stock, or delivery behavior. Current baseline: **Project Contract v1.5 (CR-05), supplemented by Addendum CR-09**. See Section 29 for Owner authority over the internal product lifecycle, structured rights-review records, inventory sourcing, and fulfillment. Section 28's external rights and platform constraints remain applicable. Owner approval was recorded in writing through the project conversation on 21 November 2026; see Section 26.6. Formal legal name/e-signature certificate details are not recorded.

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

## Visual asset source of truth

- The authoritative visual asset package is `frontend/VAULT_CORE_ASSET_LIBRARY_v1.0.zip`; CI and production build extract it into `frontend/public/assets/`.
- The dashboard, catalog header/footer, and Owner login/dashboard all use the same supplied brand file: `/assets/01-brand/vaultcore-horizontal.svg`.
- The four primary game logos use the exact image URLs referenced by the supplied Itemku ZIPs: Mobile Legends, Roblox, Garena Free Fire, and Genshin Impact. Product-specific `image_url` takes precedence over the game-logo fallback.
- Those logo URLs are hosted by Itemku's CloudFront image domain because the downloaded ZIPs contain the page HTML/URL references, not local binary copies of those remote image files. CI and production deployment check that all four image URLs return HTTP 200.
- Logo-style category fallbacks render with `object-fit: contain`; seller-provided/product-specific photographs keep `object-fit: cover`.
- The dashboard trust strip uses the package's `icon-wallet.svg`, `icon-shield.svg`, and `icon-orders.svg`. Game glyph overlays and fabricated text wordmarks have been removed.
- CI checks asset references in the dashboard, catalog, Owner page, layout, and global CSS, and verifies the brand logo, category art, trust icons, favicon, PWA icon, hero image, and social cover exist in the extracted package.

Latest production visual update: source commit `a5fc2b925e66e70a7742d9f40248308670d94ec0`; Cloudflare Worker `vault-core-web` deployment `6aa5dd9f-5adc-4797-871e-00378a209d9f`, version `909566df-0a56-4c3c-b2ac-8701b64eb068`, serving 100% traffic.

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
- **Single transaction channel (CR-10):** the public website is catalog/detail-only. Order creation, checkout, official XTR invoice payment, order status, and transaction history are available only inside the VAULT CORE Telegram Mini App opened through the existing bot. No Rekber/escrow, bank transfer, direct seller transfer, manual wallet payment, or off-platform payment is accepted.
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

Latest production application source: `8876ea58a945d21b82b0ef00a3cae419d2f2b216`; CI run [45199182726](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45199182726) and production deployment [45199182854](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45199182854) completed SUCCESS.

Implemented and deployed: Telegram Mini App authentication, public catalog, Telegram Stars XTR invoice creation, stock reservation, pre-checkout validation, successful-payment verification and idempotency, encrypted digital inventory, Owner manual fulfillment queue, delivery recovery/reconciliation, two-phase Stars refund recovery, Owner product/inventory/order routes, expense/profit reporting, customer Mini App, and Owner Console. CR-05 review enforcement remains active across catalog, activation, inventory insertion, order creation, pre-checkout, and delivery.

Latest production data snapshot (23 November 2026, 14:57 UTC):

| Entity | Production state |
|---|---:|
| Commercial products | 16 |
| Commercial products ACTIVE | 16 |
| Current CR-05 Owner-attested APPROVED reviews | 16 |
| Available commercial manual-fulfillment slots | 16 (1 per SKU) |
| Reserved commercial slots | 0 |
| TEST-only inventory | 4 |
| Active marketplace categories | 17 |
| Modal (cost price) | 0 XTR per SKU |
| Orders | 1 CANCELLED (expired unpaid Owner test checkout) |
| Transactions | 0 |
| Deliveries | 1 REVOKED (expired unpaid checkout) |

All 16 commercial SKUs have a current Owner-attested review, one source-bound manual-fulfillment slot, and a positive XTR sale price. The review record cites Owner attestation reference `VC-OWNER-ATTESTATION-20261123-01`. Owner confirmed that source, distribution, and transfer requirements are met and retains supporting records. Those underlying documents were not uploaded to this task and were not independently reviewed; database status represents the Owner's internal approval, not independent legal verification or a publisher certificate.

Manual-fulfillment slots do not contain dummy redeem codes or customer credentials. After Telegram confirms payment, the customer receives a payment acknowledgement and the order enters `FULFILLING / REVIEW_REQUIRED`. Owner must deliver the actual product through the SKU's stated fulfillment method, then reconcile delivery as `DELIVERED` in Owner Console. Inventory is marked sold and the order fulfilled only after reconciliation. An undelivered order remains open for Owner action or refund.

Sale price is stored in XTR and modal is set to 0 XTR per Owner instruction. Reference conversion used for the 16 current prices: Rp375 per XTR, with each IDR price rounded up to a whole XTR. Aggregate reference price is Rp38,359,090 / 102,297 XTR. This is a pricing reference, not a guaranteed fixed cash-out rate; Telegram's store/provider pricing can vary by region and platform.

Telegram XTR invoice creation and pre-checkout protections are enabled in production. One unpaid checkout initiated from the Owner account for FF-001 was left pending without a pre-checkout query or payment transaction; after its 15-minute window expired, it was cancelled, its delivery was revoked, and its inventory reservation was released. Current production read-back shows 0 payment transactions and all 16 commercial stock slots available. Paid customer UAT, manual delivery UAT, refund acceptance, IDOR/admin authorization review, backup/restore, and production rate-limit review remain outstanding. A material product change or an expired rights review still requires Owner re-review before the next sale.

Production audit fixes deployed on 23 November 2026:
- Removed the stale Owner Console effect that referenced deleted form variables and could throw a runtime error.
- Added atomic expiry cleanup for unpaid orders after the existing 15-minute window. Cleanup now runs when the catalog, customer order history, Owner dashboard/product/order lists, or checkout is accessed; expired deliveries are revoked and their reservations are released.
- Removed the customer-facing “VAULT CORE Store” / Owner attribution block and all stock-count labels from product cards, product details, and cart rows.
- Customer specifications now omit internal cost, Owner-attestation, and XTR conversion metadata. The production attributes `xtr_conversion_reference_date` and `xtr_conversion_rate_idr_per_star` were deleted from all 16 commercial SKUs; XTR sale prices remain unchanged.
- Regression coverage includes Owner page stale references, reservation expiry, and customer metadata visibility.
