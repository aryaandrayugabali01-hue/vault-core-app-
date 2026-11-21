# VAULT CORE — Deployment Status

**Updated:** 2026-11-21 (live recheck after source fixes)

## Connected infrastructure

| Service | Resource | Verified status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Connected; 10 application tables and 5 migration records verified, including 004 and 005 |
| GitHub | `aryaandrayugabali01-hue/vault-core-app-` / `main` | Source published; repository read/write operations verified |
| Cloudflare | Primary account | `vault-core-gateway` deployed; zone `vaultcore.biz.id` active; assigned nameservers are recorded below; a separate `vaultcore.web.id` zone is pending and is not the selected production domain |
| Telegram | Bot API | Production bot username/token and webhook are not configured in GitHub Actions; deployment preflight confirms the required secret values are empty |

## Repository state

- Default branch: `main`.
- Latest verified source commit: `f682001ee694937d9ba2da77b70867dfdc56f6e3` (pre-checkout single-payment guard and migration 005). Previous source hardening commit: `209a02ea63b93dba8785d6ae354638af0950921c` (delivery ambiguity and two-phase Stars refund recovery).
- Cloudflare gateway source commit: `e88739e82119f287db4215a570b3ab0f64eede23`.
- Source extraction commit: `15780b23e816cd4c8b3647d6359f949b53c4b2ea`.
- 40 project source files are now present at repository root; original `vault-core-app-v1.3-github-ready.zip` retained as an archive.
- Main source areas: `backend/`, `frontend/`, `bot/`, `database/migrations/`, `tests/`, and `.github/workflows/`.

## CI validation

GitHub Actions validation results:

- `VAULT CORE CI`, run `44885310611` on commit `f682001ee694937d9ba2da77b70867dfdc56f6e3`: **SUCCESS** (backend/core tests, Mini App build, Wrangler API Worker dry-run).
- `VAULT CORE Cloudflare frontend preparation`, run `44885310642` on the same commit: **SUCCESS** (Vinext compatibility scan, native Cloudflare initialization, Cloudflare Worker build and output verification).
- Production deploy preflight run `44884767909` stopped safely before deployment because `CLOUDFLARE_API_TOKEN` was missing; the run log shows all five required production secrets were empty.
- Database adapter tests verify one Hyperdrive `pg.Client` per concurrent request, shared context across transactions within each request, and correct failure propagation.
- Previous passing checks: CI `44852531855` and frontend build `44852531853`.



Latest run completed after rate-limit routing was adjusted so Telegram's payment webhook is not throttled by customer API limits.

## Database verification

Connected Neon database `vault_core` was inspected read-only:

- Tables present: `admin_audit_logs`, `customers`, `deliveries`, `inventory_items`, `operating_expenses`, `order_items`, `orders`, `products`, `schema_migrations`, `transactions`.
- Migration registry contains `001` through `005`, verified by read-back.
- Migration 004 adds reservation ownership, `REVIEW_REQUIRED` delivery state, and a uniqueness guard for active delivery per inventory item.
- Migration 005 adds a unique pre-checkout query ID per order to prevent a second distinct checkout query from claiming the same order.

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
- Assigned nameservers: `marty.ns.cloudflare.com` and `sharon.ns.cloudflare.com`. They are already active at the registrar.
- Live read-back on 2026-11-21: Worker Custom Domains list for the active zone is empty and the zone DNS record list is empty. Root, www and api domains are not attached.
- Gateway `WEB_ORIGIN` and `API_ORIGIN` remain unset; `/_gateway/health` is gateway-only health, not application readiness.
- The gateway source is stored at `cloudflare/vault-core-gateway.js` in this repository.

## Deployment blockers

1. Cloudflare Worker listing contains `vault-core-gateway`, `nexus`, and `premiumdigital-store`; `vault-core-web` and `vault-core-api` do not exist in the target account. Build/dry-run success is not deployment.
2. Neon runtime role `vault_core_runtime` has been created and verified with CONNECT, schema USAGE, and table DML privileges. Cloudflare Hyperdrive `vault-core-neon` is created and verified; SQL response caching is disabled. Hyperdrive ID: `97e2993f7733422abd08bfbf699ce4e4`.
3. Zone `vaultcore.biz.id` is active. Cloudflare zone ID `74092a358232c7bf501da8d822fabb47` for `vaultcore.biz.id` is active; IDWebHost is the registrar and assigned nameservers are active. A separate `vaultcore.web.id` zone (ID `14098744832c82ae7b61bc46f695e186`) is pending and is not used by this deployment.
4. Native Vinext/Cloudflare configuration is committed in `frontend/cloudflare.config.ts` and `frontend/vite.config.ts`. `wrangler.api.jsonc` declares Hyperdrive, `DATABASE_CONNECTION_MODE=request`, and production frontend origins. Both Worker build paths and the Hyperdrive request-scoped DB adapter are validated in CI.
5. The Hyperdrive binding ID is declared in `wrangler.api.jsonc`; it becomes active only after the API Worker is deployed. `FRONTEND_ORIGIN` includes root and www. Production preflight `44884767909` proved that all five required GitHub Actions secrets resolve empty: `CLOUDFLARE_API_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, and `APP_ENCRYPTION_KEY`.
6. Telegram production bot identity/ownership remains unverified. Deployment is now `workflow_dispatch` only and must be run manually after the five repository secrets are populated; production webhook has not been configured.
7. Live XTR payment, refund, fulfillment, IDOR, backup/restore, production rate-limit, and Owner UAT tests have not been completed.

## Owner contract approval

- Contract `PROJECT_CONTRACT.md` v1.2 (CR-02) is **APPROVED BY OWNER** through the explicit written instruction recorded in the project conversation on 2026-11-21.
- The four Section 26.6 approval statements are recorded as accepted; this authorizes the v1.2 scope baseline and commencement of the Phase 1 technical foundation.
- The owner's legal name and formal e-signature certificate are not included in the conversation record.
- Contract approval is separate from UAT approval and production go-live authorization; production remains blocked by deployment, secrets, Telegram, and live acceptance requirements.

## Latest source and deployment proof

- Latest source baseline: `f682001ee694937d9ba2da77b70867dfdc56f6e3`.
- CI: [run 44885310611](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44885310611) SUCCESS.
- Frontend: [run 44885310642](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44885310642) SUCCESS.
- Production preflight: [run 44884767909](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44884767909) FAILED at the missing `CLOUDFLARE_API_TOKEN`; every later deployment step was skipped.
- Cloudflare connector identity matches `aryaandrayugabali01@gmail.com`. Token verification via the connector returned HTTP 401 `Invalid API Token`; this is separate from the missing GitHub Actions secret and does not verify a future replacement token.
- Live Cloudflare state: zone `vaultcore.biz.id` ACTIVE; `vault-core-gateway` exists; application Workers `vault-core-api` and `vault-core-web` are absent; gateway origins unset; custom domains empty; DNS record list empty.

## Production readiness

**NOT READY FOR PRODUCTION.** Source changes for reservation ownership, one pre-checkout per order, ambiguous delivery reconciliation, and two-phase Stars refunds are committed and CI-validated. Five Neon migrations are registered. Application Workers have not been deployed. GitHub Actions production secrets are absent, Cloudflare API-token scope has not passed the workflow preflight, Telegram production bot identity/token is unconfigured, domains/gateway origins are not attached, and no live XTR/refund/delivery or Owner UAT acceptance exists.
