# VAULT CORE — Deployment Status

**Updated:** 2026-11-26 (VAULT CORE v5 mobile storefront rebuilt; CSS cleanup; XTR Mini App flow retained)

## Current production snapshot — 26 November 2026

- Latest production source commit: `75fd4695b5d5eb57d83e2477603098d0256623e0`.
- CI: [run 45780201632](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45780201632), **SUCCESS**. Backend/core tests, static Mini App files and JavaScript syntax, frontend build, asset verification, and API Worker dry-run passed.
- Production deployment: [run 45780201631](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45780201631), **SUCCESS**. API/frontend Workers, database health, gateway upstreams, root/www/API domains, artwork, five Mini App static file smoke checks, Telegram webhook configuration/read-back, and Owner TEST fixture checks passed.
- Cloudflare live versions: `vault-core-web` **v161** (100% traffic), `vault-core-api` **v841** (100%), and `vault-core-gateway` **v320** (100%).
- Customer storefront entry point: `https://vaultcore.biz.id/miniapp/index.html`; the root route redirects to this mobile-only Mini App. The existing Telegram `/start` button opens the same URL.
- Customer flow: Home, four game categories, 12 master variants, product detail, Telegram XTR invoice checkout, order status/history, and profile. Product, price, stock, and purchase eligibility continue to come from the existing API.
- CSS cleanup: `globals.css` 152,465 → 66,125 bytes; `mobile-app.css` 26,903 → 6,546 bytes; `catalog/page.css` 26,196 → 23,865 bytes. Repeated declarations inside active rules were eliminated; old storefront selectors and the unused Dashboard style block were removed.
- The API continues to use Telegram `initData` for checkout/history. Website browser view is catalog/detail only; Telegram Stars (XTR) remains the only checkout/payment path.
- Direct Android screenshot comparison and manual interaction UAT are **NOT TESTED** in this deployment. The CI and production smoke checks confirm builds, assets, routing configuration and Worker health, not the visual rendering on a user's particular phone.

**The detailed sections below are retained as historical deployment evidence. The snapshot above is authoritative for the 26 November 2026 release.**

## Connected infrastructure

| Service | Resource | Verified status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Connected; migrations 001–016 registered; CR-08 JSONB product attributes and GIN index verified |
| GitHub | `aryaandrayugabali01-hue/vault-core-app-` / `main` | Source published; repository read/write operations verified |
| Cloudflare | Primary account | Existing `vault-core-gateway`, `vault-core-api`, and `vault-core-web` deployed; gateway origins installed; root/www/api domain, TLS, public artwork, and health checks passed in production run `45183635248` |
| Telegram | Bot API | Production webhook `https://api.vaultcore.biz.id/api/telegram/webhook` configured and read-back verified in production run `45183635248` |

## Repository state

- Default branch: `main`.
- Latest deployed application source commit: `3495d5cc20f7ae525a7222be3d7739ef3fa686fc`, deployed successfully in production run `45183635248`. PR #14 includes Telegram Mini App startup recovery, data-driven marketplace navigation, Owner product attributes, and CR-05 attribute re-review.
- Cloudflare gateway source commit: `e88739e82119f287db4215a570b3ab0f64eede23`.
- Source extraction commit: `15780b23e816cd4c8b3647d6359f949b53c4b2ea`.
- 40 project source files are now present at repository root; original `vault-core-app-v1.3-github-ready.zip` retained as an archive.
- Main source areas: `backend/`, `frontend/`, `bot/`, `database/migrations/`, `tests/`, and `.github/workflows/`.

## CI validation

GitHub Actions validation results:

- `VAULT CORE CI`, run `44885310611` on commit `f682001ee694937d9ba2da77b70867dfdc56f6e3`: **SUCCESS** (backend/core tests, Mini App build, Wrangler API Worker dry-run).
- `VAULT CORE Cloudflare frontend preparation`, run `44885310642` on the same commit: **SUCCESS** (Vinext compatibility scan, native Cloudflare initialization, Cloudflare Worker build and output verification).
- Production run [`44902626165`](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44902626165), attempt 1: **SUCCESS**. Passed secrets/Cloudflare/Hyperdrive/Telegram preflight, backend/core tests, frontend build, API and frontend Worker deploy, API + Neon health check, gateway upstream setup, root/www/api custom-domain and DNS/TLS checks, Telegram webhook set and `getWebhookInfo` read-back.
- Database adapter tests verify one Hyperdrive `pg.Client` per concurrent request, shared context across transactions within each request, and correct failure propagation.
- Previous passing checks: CI `44852531855` and frontend build `44852531853`.



Latest run completed after rate-limit routing was adjusted so Telegram's payment webhook is not throttled by customer API limits.

## Database verification

Connected Neon database `vault_core` was inspected read-only:

- Tables present: `admin_audit_logs`, `customers`, `deliveries`, `inventory_items`, `operating_expenses`, `order_items`, `orders`, `products`, `schema_migrations`, `transactions`.
- Migration registry contains `001` through `007`, verified by read-back.
- Migration 007 adds `owner_accounts` for database-backed owner provisioning.
- Migration 004 adds reservation ownership, `REVIEW_REQUIRED` delivery state, and a uniqueness guard for active delivery per inventory item.
- Migration 005 adds a unique pre-checkout query ID per order to prevent a second distinct checkout query from claiming the same order.
- Post-migration audit (21 Nov 2026): `products=4` TEST-only DRAFT products, `inventory_items=0`, `orders=0`, `transactions=0`. Database connectivity is healthy. The owner has not yet completed one-tap fixture activation.

## Security and code review notes

- Telegram Mini App `initData` HMAC and age validation are implemented.
- Owner authorization uses the server-side Telegram ID allowlist plus an active database-backed `owner_accounts` allowlist. The Profile endpoint returns only the authenticated user's own numeric Telegram ID and owner status.
- Previous Profile UI silently hid the test setup button on owner-auth failures. The revised UI surfaces verification state and the verified Telegram ID so the owner can be provisioned without manual deployment-secret edits.
- The test fixture setup action is consolidated to one customer Profile entry point; the duplicate Owner Console seed button was removed.
- Telegram webhook validates its secret token using a timing-safe comparison.
- Stock reservation uses database row locks and `SKIP LOCKED`.
- Digital inventory payloads are encrypted; unsupported account credentials/authentication material are rejected.
- Public display stock cannot exceed actual sellable inventory.
- API rate limiting is active on catalog, order, and owner APIs; Telegram's authenticated webhook route is kept separate. Its default in-memory store is suitable for a single instance. A shared store or edge-level rate limits are required before multi-instance scaling.
- Payment audit snapshots now retain required payment/order identifiers only, excluding buyer profile and chat fields.
- Duplicate Telegram charge IDs are checked against the order they were first linked to.
- Inventory reservations store `reserved_order_id`; fulfilment and release validate the owning order.
- Stale or ambiguous delivery attempts become `REVIEW_REQUIRED` and are not automatically resent.
- Stars refunds use a two-phase `REFUND_PENDING` workflow; if Telegram reports an already-refunded charge, the service checks the Stars transaction ledger before finalizing internal status.
- Each order can claim one `pre_checkout_query_id`; successful-payment handling requires a recorded pre-checkout claim.
- IDOR, backup/restore, production rate-limit behavior, and live payment/delivery checks remain pending.

## Cloudflare hosting target (selected)

- Hosting platform: Cloudflare Workers for both application runtimes.
- Frontend: existing Next.js 15 / React 19 app, migrated non-destructively to vinext and deployed as Worker `vault-core-web`.
- API: existing Express 5 app deployed as Worker `vault-core-api` using Cloudflare's `cloudflare:node` `httpServerHandler` adapter. Hyperdrive uses a fresh `pg.Client` per Express request via `AsyncLocalStorage`; the Node.js local/migration environment retains its normal `pg.Pool`.
- Database: existing Neon PostgreSQL retained; Cloudflare Hyperdrive `vault-core-neon` is created and configured to provide the PostgreSQL connection to the API Worker.
- Public entrypoint: existing `vault-core-gateway` Worker, with `vaultcore.biz.id` and `www.vaultcore.biz.id` for frontend traffic and `api.vaultcore.biz.id` for API traffic.
- This deployment requires no replacement database and no new repository. The two application Workers are runtime targets for the existing frontend and backend source directories.

## Cloudflare gateway

- Worker: `vault-core-gateway`.
- Deployment ID: `2b5db563f86e4f77a73b3b0482fcbd48`.
- Account Workers subdomain: `premiumdigital-id.workers.dev`.
- Worker URL: `https://vault-core-gateway.premiumdigital-id.workers.dev`.
- `workers.dev` was enabled and Worker settings were read back successfully; observability logs and traces are enabled.
- Gateway routes `/api/*` and `api.*` host traffic to `API_ORIGIN`; other paths route to `WEB_ORIGIN`.
- `API_ORIGIN` and `WEB_ORIGIN` are intentionally unset until `vault-core-api` and `vault-core-web` are deployed. `/_gateway/health` reports gateway readiness only, not application readiness. Unconfigured upstream requests return HTTP 503.
- Cloudflare zone `vaultcore.biz.id` is active. Verified zone ID: `74092a358232c7bf501da8d822fabb47`.
- Assigned Cloudflare nameservers: `marty.ns.cloudflare.com` and `sharon.ns.cloudflare.com`; Cloudflare zone status is ACTIVE.
- Live read-back after deployment: `vaultcore.biz.id`, `www.vaultcore.biz.id`, and `api.vaultcore.biz.id` are attached to `vault-core-gateway`; three proxied DNS AAAA records are present.
- Gateway secrets `WEB_ORIGIN` and `API_ORIGIN` are installed. Public verification in run `44902626165` passed root, www, api, TLS, and gateway-origin checks. `/_gateway/health` alone remains a gateway-only check, not application readiness.
- The gateway source is stored at `cloudflare/vault-core-gateway.js` in this repository.

## Remaining production release gates

1. Runtime deployment is complete: `vault-core-api`, `vault-core-web`, and `vault-core-gateway` are present. API health and Neon database connectivity passed in production run `44902626165` attempt 1.
2. Neon runtime role `vault_core_runtime` has been created and verified with CONNECT, schema USAGE, and table DML privileges. Cloudflare Hyperdrive `vault-core-neon` is created and verified; SQL response caching is disabled. Hyperdrive ID: `97e2993f7733422abd08bfbf699ce4e4`.
3. Zone `vaultcore.biz.id` is active. Cloudflare zone ID `74092a358232c7bf501da8d822fabb47` for `vaultcore.biz.id` is active; IDWebHost is the registrar and assigned nameservers are active. A separate `vaultcore.web.id` zone (ID `14098744832c82ae7b61bc46f695e186`) is pending and is not used by this deployment.
4. Native Vinext/Cloudflare configuration is committed in `frontend/cloudflare.config.ts` and `frontend/vite.config.ts`. `wrangler.api.jsonc` declares Hyperdrive, `DATABASE_CONNECTION_MODE=request`, and production frontend origins. Both Worker build paths and the Hyperdrive request-scoped DB adapter are validated in CI.
5. Hyperdrive `vault-core-neon` and all four API Worker secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `APP_ENCRYPTION_KEY`) are attached and verified by successful production preflight/health checks.
6. Telegram Bot API identity and production webhook configuration/read-back passed. Actual customer `/start`, Owner access, successful XTR payment, refund, and delivery still require end-to-end acceptance.
7. Catalog contains 4 internal TEST-only products in DRAFT, with 0 inventory items. They are hidden from the customer catalog. Owner Console can add encrypted non-redeemable dummy stock; commercial SKUs still require separate rights review and approval.
8. Live XTR payment/refund/fulfillment, IDOR, backup/restore, production rate-limit, and Owner UAT/release approval remain pending.

## Owner contract approval

- Contract `PROJECT_CONTRACT.md` v1.2 (CR-02) and Addendum v1.3 (CR-03) are **APPROVED BY OWNER** through explicit written instructions recorded in the project conversation on 2026-11-21.
- The four Section 26.6 approval statements and the XTR-only/test-fixture instruction in Section 27 are recorded as accepted.
- The owner's legal name and formal e-signature certificate are not included in the conversation record.
- Contract approval is separate from UAT approval and production go-live authorization. Infrastructure deployment is complete; general sales remain gated by catalog/inventory setup, live payment/delivery acceptance, security recovery checks, and Owner UAT.

## Latest source and deployment proof

- Latest deployed application source: `3495d5cc20f7ae525a7222be3d7739ef3fa686fc`; PR #14 merged to `main`.
- CI: [run 45183023193](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45183023193) SUCCESS (backend/core tests, Mini App build, asset validation, API Worker dry-run).
- Production deployment: [run 45183635248](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45183635248) SUCCESS; all deployment steps passed through Telegram webhook read-back and TEST fixture verification.
- Cloudflare live state: existing API/frontend/gateway Workers, Hyperdrive, upstream secrets, three custom domains, public TLS, and public asset checks passed in the latest deployment run.
- Neon read-back confirms migrations 001–014, JSONB attributes for all 16 current products, and unchanged product/order/transaction/delivery counts.

## Production deployment and sales readiness

**DEPLOYED — CATALOG READY FOR TRANSACTION TESTING; GENERAL-SALES UAT PENDING.** Neon read-back confirms 16 ACTIVE commercial SKUs, 16 current Owner-attested APPROVED reviews, 16 available source-bound inventory units, and 17 active marketplace categories. TEST fixtures remain isolated. Actual customer payment/delivery/refund acceptance, IDOR, backup/restore, and Owner release approval remain pending.
