# VAULT CORE — Deployment Status

**Updated:** 2026-11-23 (16 commercial SKUs activated, XTR pricing, Owner manual fulfillment)

## Current production snapshot — 23 November 2026

- Latest production source: `af6516c71e7ee8d0a7745fc9e6ac4567756f3526`.
- Production deployment: [run 45193828313](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45193828313), **SUCCESS**. API/frontend Workers, Neon health, gateway upstreams, root/www/API domains, storefront artwork, Telegram webhook read-back, and TEST fixture checks passed.
- Latest CI: [run 45193828516](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/45193828516), **SUCCESS**. Backend/core tests, frontend build, asset verification, and API Worker dry-run passed.
- Neon production read-back: 16 commercial products, all 16 ACTIVE; 16 current Owner-attested APPROVED CR-05 reviews; 16 available commercial inventory slots (exactly one per SKU); 4 TEST-only inventory rows; 17 active marketplace categories; 0 orders; 0 transactions; 0 deliveries.
- All 16 commercial prices are saved in XTR. Cost price is 0 XTR per SKU per Owner instruction. Reference conversion is Rp375 per XTR with whole-XTR ceiling; total reference is Rp38,359,090 / 102,297 XTR.
- Each commercial inventory slot uses the explicit `VAULTCORE_OWNER_MANUAL_FULFILLMENT_V1:` source marker and stores no customer-facing code or credentials. The API detects this marker, sends a payment acknowledgement after successful Stars payment, and holds delivery at `REVIEW_REQUIRED` for Owner manual fulfillment. Owner must deliver the actual product through the SKU's listed method and then reconcile `DELIVERED`; only then is inventory marked SOLD and the order FULFILLED.
- Owner's 23 November 2026 declaration is recorded under `VC-OWNER-ATTESTATION-20261123-01`. Owner declared that source, distribution, and transfer requirements are fulfilled and accepts responsibility; supporting records remain in Owner custody and were not uploaded to this task or independently inspected. The database status is internal Owner attestation, not independent verification or a publisher certificate.
- Dashboard commercial KPIs exclude TEST fixtures, so four TEST inventory rows do not inflate commercial stock or sales.
- Customer catalog and Owner dashboard both display XTR sale prices; IDR market data is shown as reference. Owner dashboard displays 0 XTR modal rather than “Belum diisi”.
- Production checkout is enabled for all 16 commercial SKUs at the catalog/order API level. No customer order/payment has yet been recorded; actual paid customer UAT, Owner manual delivery, refund acceptance, IDOR/admin authorization review, backup/restore, and production rate-limit verification remain outstanding.
- Application remains deployed on the existing `vault-core-web`, `vault-core-api`, and `vault-core-gateway` Workers. No replacement project, repository, Worker, bot, or database was created.

**The detailed sections below are retained as historical deployment evidence. Where older numbers or run IDs conflict with this snapshot, this snapshot is authoritative.**
## Connected infrastructure

| Service | Resource | Verified status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Connected; migrations 001–014 registered; CR-08 JSONB product attributes and GIN index verified |
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

**DEPLOYED — NOT YET READY FOR GENERAL SALES.** The latest application and marketplace changes are deployed. Commercial sales remain blocked by verified database state: 0 marketplace categories, 0 active commercial SKUs, 0 sellable commercial inventory, and 12 commercial SKUs pending CR-05 review. The database has 4 TEST inventory rows, 0 orders, 0 transactions, and 0 deliveries. Manual Telegram Android UAT, live XTR payment/refund/delivery acceptance, IDOR/backup-restore checks, and Owner release approval remain pending.
