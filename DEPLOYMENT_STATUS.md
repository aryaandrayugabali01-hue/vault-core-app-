# VAULT CORE — Deployment Status

**Updated:** 2026-11-21 (production deployment and post-deploy audit)

## Connected infrastructure

| Service | Resource | Verified status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Connected; 10 application tables and 5 migration records verified, including 004 and 005 |
| GitHub | `aryaandrayugabali01-hue/vault-core-app-` / `main` | Source published; repository read/write operations verified |
| Cloudflare | Primary account | `vault-core-gateway`, `vault-core-api`, and `vault-core-web` deployed; gateway origins installed; root/www/api custom domains attached and public DNS/TLS checks passed in production run `44891173631` attempt 2 |
| Telegram | Bot API | Production bot identity passed `getMe`; webhook was set to `https://api.vaultcore.biz.id/api/telegram/webhook` and read-back passed in production run `44891173631` attempt 2 |

## Repository state

- Default branch: `main`.
- Latest deployed source commit: `1a415717e3155a4ca026c5a7f4fe6108cc53f9e8` (Cloudflare Node HTTP handler adapter and Worker execution-context fix). Earlier business-logic baseline includes pre-checkout single-payment guard and migration 005.
- Cloudflare gateway source commit: `e88739e82119f287db4215a570b3ab0f64eede23`.
- Source extraction commit: `15780b23e816cd4c8b3647d6359f949b53c4b2ea`.
- 40 project source files are now present at repository root; original `vault-core-app-v1.3-github-ready.zip` retained as an archive.
- Main source areas: `backend/`, `frontend/`, `bot/`, `database/migrations/`, `tests/`, and `.github/workflows/`.

## CI validation

GitHub Actions validation results:

- `VAULT CORE CI`, run `44885310611` on commit `f682001ee694937d9ba2da77b70867dfdc56f6e3`: **SUCCESS** (backend/core tests, Mini App build, Wrangler API Worker dry-run).
- `VAULT CORE Cloudflare frontend preparation`, run `44885310642` on the same commit: **SUCCESS** (Vinext compatibility scan, native Cloudflare initialization, Cloudflare Worker build and output verification).
- Production run [`44891173631`](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44891173631), attempt 2: **SUCCESS**. Passed secrets/Cloudflare/Hyperdrive/Telegram preflight, backend/core tests, frontend build, API and frontend Worker deploy, API + Neon health check, gateway upstream setup, root/www/api custom-domain and DNS/TLS checks, Telegram webhook set and `getWebhookInfo` read-back.
- Database adapter tests verify one Hyperdrive `pg.Client` per concurrent request, shared context across transactions within each request, and correct failure propagation.
- Previous passing checks: CI `44852531855` and frontend build `44852531853`.



Latest run completed after rate-limit routing was adjusted so Telegram's payment webhook is not throttled by customer API limits.

## Database verification

Connected Neon database `vault_core` was inspected read-only:

- Tables present: `admin_audit_logs`, `customers`, `deliveries`, `inventory_items`, `operating_expenses`, `order_items`, `orders`, `products`, `schema_migrations`, `transactions`.
- Migration registry contains `001` through `005`, verified by read-back.
- Migration 004 adds reservation ownership, `REVIEW_REQUIRED` delivery state, and a uniqueness guard for active delivery per inventory item.
- Migration 005 adds a unique pre-checkout query ID per order to prevent a second distinct checkout query from claiming the same order.
- Post-deploy read-only content audit (21 Nov 2026): `products=0`, `inventory_items=0`, `orders=0`, `transactions=0`. Database connectivity is healthy, but catalog, stock, and real transaction acceptance have not yet been established.

## Security and code review notes

- Telegram Mini App `initData` HMAC and age validation are implemented.
- Owner authorization uses the server-side Telegram ID allowlist.
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
- Gateway secrets `WEB_ORIGIN` and `API_ORIGIN` are installed. Public verification in run `44891173631` passed root, www, api, TLS, and gateway-origin checks. `/_gateway/health` alone remains a gateway-only check, not application readiness.
- The gateway source is stored at `cloudflare/vault-core-gateway.js` in this repository.

## Remaining production release gates

1. Runtime deployment is complete: `vault-core-api`, `vault-core-web`, and `vault-core-gateway` are present. API health and Neon database connectivity passed in production run `44891173631` attempt 2.
2. Neon runtime role `vault_core_runtime` has been created and verified with CONNECT, schema USAGE, and table DML privileges. Cloudflare Hyperdrive `vault-core-neon` is created and verified; SQL response caching is disabled. Hyperdrive ID: `97e2993f7733422abd08bfbf699ce4e4`.
3. Zone `vaultcore.biz.id` is active. Cloudflare zone ID `74092a358232c7bf501da8d822fabb47` for `vaultcore.biz.id` is active; IDWebHost is the registrar and assigned nameservers are active. A separate `vaultcore.web.id` zone (ID `14098744832c82ae7b61bc46f695e186`) is pending and is not used by this deployment.
4. Native Vinext/Cloudflare configuration is committed in `frontend/cloudflare.config.ts` and `frontend/vite.config.ts`. `wrangler.api.jsonc` declares Hyperdrive, `DATABASE_CONNECTION_MODE=request`, and production frontend origins. Both Worker build paths and the Hyperdrive request-scoped DB adapter are validated in CI.
5. Hyperdrive `vault-core-neon` and all four API Worker secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `APP_ENCRYPTION_KEY`) are attached and verified by successful production preflight/health checks.
6. Telegram Bot API identity and production webhook configuration/read-back passed. Actual customer `/start`, Owner access, successful XTR payment, refund, and delivery still require end-to-end acceptance.
7. Catalog readiness is currently empty: the read-only database audit found 0 products and 0 inventory items. Create rights-reviewed SKUs, prices/cost snapshots, and encrypted sellable stock before real customer orders can be accepted.
8. Live XTR payment/refund/fulfillment, IDOR, backup/restore, production rate-limit, and Owner UAT/release approval remain pending.

## Owner contract approval

- Contract `PROJECT_CONTRACT.md` v1.2 (CR-02) is **APPROVED BY OWNER** through the explicit written instruction recorded in the project conversation on 2026-11-21.
- The four Section 26.6 approval statements are recorded as accepted; this authorizes the v1.2 scope baseline and commencement of the Phase 1 technical foundation.
- The owner's legal name and formal e-signature certificate are not included in the conversation record.
- Contract approval is separate from UAT approval and production go-live authorization; production remains blocked by deployment, secrets, Telegram, and live acceptance requirements.

## Latest source and deployment proof

- Latest source baseline: `f682001ee694937d9ba2da77b70867dfdc56f6e3`.
- CI: [run 44885310611](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44885310611) SUCCESS.
- Frontend: [run 44885310642](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44885310642) SUCCESS.
- Production deployment: [run 44891173631](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44891173631), attempt 2, SUCCESS; all 16 production steps passed through Telegram webhook read-back.
- Cloudflare live state: all three Workers exist; API Hyperdrive and secrets are attached; gateway upstream secrets exist; three custom domains and three proxied DNS records are configured.
- The GitHub Actions deployment runner verified root, www, API, TLS, and gateway origins. Cloudflare Observability recent audit returned no error-level events for API and gateway during the checked post-deployment window.

## Production readiness

**DEPLOYED — NOT YET READY FOR GENERAL SALES.** Production infrastructure deployment is complete: API/frontend/gateway Workers, Neon/Hyperdrive health, gateway origins, root/www/api custom domains, public DNS/TLS checks, and Telegram webhook read-back all passed in run `44891173631` attempt 2. The remaining blockers are operational/product acceptance: the database has 0 products and 0 inventory items; no live XTR payment/refund/delivery acceptance, IDOR/backup-restore review, or Owner UAT/release approval has been recorded.
