# VAULT CORE — Deployment Status

**Updated:** 2026-11-21

## Connected infrastructure

| Service | Resource | Verified status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Connected; 10 application tables and 3 migration registry records confirmed |
| GitHub | `aryaandrayugabali01-hue/vault-core-app-` / `main` | Source published; repository read/write operations verified |
| Cloudflare | Primary account | `vault-core-gateway` deployed; zone `vaultcore.biz.id` active; assigned nameservers are recorded below; a separate `vaultcore.web.id` zone is pending and is not the selected production domain |
| Telegram | Bot API | No production bot identity/token or webhook configuration has been supplied to the deployment environment |

## Repository state

- Default branch: `main`.
- Latest source commit: `02c5a7728d502eca77190c3454574bba8d79f3b8` (production deployment workflow and runbook added).
- Cloudflare gateway source commit: `e88739e82119f287db4215a570b3ab0f64eede23`.
- Source extraction commit: `15780b23e816cd4c8b3647d6359f949b53c4b2ea`.
- 40 project source files are now present at repository root; original `vault-core-app-v1.3-github-ready.zip` retained as an archive.
- Main source areas: `backend/`, `frontend/`, `bot/`, `database/migrations/`, `tests/`, and `.github/workflows/`.

## CI validation

GitHub Actions validation results:

- `VAULT CORE CI`, run `44852531855`: **SUCCESS** (backend/core tests, Next.js build, Wrangler API Worker dry-run).
- `VAULT CORE Cloudflare frontend preparation`, run `44852531853`: **SUCCESS** (Vinext compatibility scan, native Cloudflare initialization, Cloudflare Worker build and output verification).

The previous passing deployment-source validation runs are `44852481475` (CI) and `44852481447` (frontend Worker build).



Latest run completed after rate-limit routing was adjusted so Telegram's payment webhook is not throttled by customer API limits.

## Database verification

Connected Neon database `vault_core` was inspected read-only:

- Tables present: `admin_audit_logs`, `customers`, `deliveries`, `inventory_items`, `operating_expenses`, `order_items`, `orders`, `products`, `schema_migrations`, `transactions`.
- Migration registry has records for `001_initial_schema.sql`, `002_finance_and_order_snapshots.sql`, and `003_delivery_recovery.sql`.
- No schema change was required during this verification.

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
- IDOR, backup/restore, production rate-limit behavior, and live payment/delivery checks remain pending.

## Cloudflare hosting target (selected)

- Hosting platform: Cloudflare Workers for both application runtimes.
- Frontend: existing Next.js 15 / React 19 app, migrated non-destructively to vinext and deployed as Worker `vault-core-web`.
- API: existing Express 5 app deployed as Worker `vault-core-api` using Cloudflare's `cloudflare:node` `httpServerHandler` adapter.
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
- Assigned nameservers: `marty.ns.cloudflare.com` and `sharon.ns.cloudflare.com`. They are already active at the registrar.
- Worker Custom Domains are not attached yet. Once the application origins are deployed, attach `vaultcore.biz.id`, `www.vaultcore.biz.id`, and `api.vaultcore.biz.id` to this Worker; Cloudflare will provision their DNS records and TLS certificates.
- The gateway source is stored at `cloudflare/vault-core-gateway.js` in this repository.

## Deployment blockers

1. Cloudflare application Workers `vault-core-web` and `vault-core-api` are not yet deployed. Native Vinext Worker build and Wrangler API Worker dry-run both pass CI. The existing gateway alone does not host either runtime.
2. Neon runtime role `vault_core_runtime` has been created and verified with CONNECT, schema USAGE, and table DML privileges. Cloudflare Hyperdrive `vault-core-neon` is created and verified; SQL response caching is disabled. Hyperdrive ID: `97e2993f7733422abd08bfbf699ce4e4`.
3. Zone `vaultcore.biz.id` is active. Cloudflare zone ID `74092a358232c7bf501da8d822fabb47` for `vaultcore.biz.id` is active; IDWebHost is the registrar and assigned nameservers are active. A separate `vaultcore.web.id` zone (ID `14098744832c82ae7b61bc46f695e186`) is pending and is not used by this deployment.
4. Native Vinext/Cloudflare configuration is committed in `frontend/cloudflare.config.ts` and `frontend/vite.config.ts`. `wrangler.api.jsonc` declares Hyperdrive and production frontend origins. Both Worker build paths are validated: frontend native Cloudflare build and API Wrangler dry-run.
5. The Hyperdrive binding ID is declared in `wrangler.api.jsonc`; it becomes active only after the API Worker is deployed. `FRONTEND_ORIGIN` and `TELEGRAM_MINI_APP_URL` are set to `https://vaultcore.biz.id`. Production secrets remain unset: `CLOUDFLARE_API_TOKEN`, Telegram bot token, webhook secret, `APP_ENCRYPTION_KEY`, and owner Telegram ID allowlist.
6. Telegram bot username/ownership and production webhook target are not known. The manual production workflow and `PRODUCTION_DEPLOYMENT_RUNBOOK.md` are committed; it requires the five repository secrets listed in the runbook.
7. Live XTR payment, refund, and fulfillment tests have not been completed.
8. Contract v1.2 (CR-02) still has unsigned owner approval fields in Section 26.6.

## Production readiness

**NOT READY FOR PRODUCTION.** Source is published; standard CI, native frontend Worker build, and API Worker dry-run all pass. The guarded production deployment workflow is committed. Application Workers are not yet deployed because Cloudflare and Telegram production secrets have not been installed; gateway domains, Telegram webhook, production owner allowlist, live payment/delivery tests, and critical acceptance testing remain incomplete.
