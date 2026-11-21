# VAULT CORE — Deployment Status

**Updated:** 2026-11-21

## Connected infrastructure

| Service | Resource | Verified status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Connected; 10 application tables and 3 migration registry records confirmed |
| GitHub | `aryaandrayugabali01-hue/vault-core-app-` / `main` | Source published; repository read/write operations verified |
| Cloudflare | Primary account | `vault-core-gateway` deployed; zone `vaultcore.biz.id` active; assigned nameservers are recorded below; app upstreams and custom domains remain unconfigured |
| Telegram | Bot API | No production bot identity/token or webhook configuration has been supplied to the deployment environment |

## Repository state

- Default branch: `main`.
- Last verified application code commit: `89f6d7912070712b07d370acaba9a266ffba1c0e`.
- Cloudflare gateway source commit: `e88739e82119f287db4215a570b3ab0f64eede23`.
- Source extraction commit: `15780b23e816cd4c8b3647d6359f949b53c4b2ea`.
- 40 project source files are now present at repository root; original `vault-core-app-v1.3-github-ready.zip` retained as an archive.
- Main source areas: `backend/`, `frontend/`, `bot/`, `database/migrations/`, `tests/`, and `.github/workflows/`.

## CI validation

GitHub Actions workflow `VAULT CORE CI`, code hardening run ID `44833016477`:

- Workspace dependency installation: **PASS**
- Backend/core automated tests: **PASS**
- Next.js production build: **PASS**
- Overall workflow conclusion: **SUCCESS**
- Documentation-sync workflows `44833158677` and `44833203368`: **SUCCESS**

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
- Database: existing Neon PostgreSQL retained; Cloudflare Hyperdrive will provide the PostgreSQL connection to the API Worker.
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
- Cloudflare zone `vaultcore.biz.id` has been created as a full zone, active.
- Assigned nameservers: `marty.ns.cloudflare.com` and `sharon.ns.cloudflare.com`. They are already active at the registrar.
- Worker Custom Domains are not attached yet. Once the application origins are deployed, attach `vaultcore.biz.id`, `www.vaultcore.biz.id`, and `api.vaultcore.biz.id` to this Worker; Cloudflare will provision their DNS records and TLS certificates.
- The gateway source is stored at `cloudflare/vault-core-gateway.js` in this repository.

## Deployment blockers

1. Cloudflare application Workers `vault-core-web` and `vault-core-api` still need to be built and deployed; the existing gateway alone does not host either runtime.
2. Neon runtime role `vault_core_runtime` has been created and verified with CONNECT, schema USAGE, and table DML privileges. Its password has been set using a database-generated secret; Cloudflare Hyperdrive configuration remains pending.
3. Zone `vaultcore.biz.id` is active. Cloudflare reports IDWebHost as the original registrar and the assigned nameservers are active.
4. The Next.js frontend and Express API have not yet been adapted and deployed as Cloudflare-compatible application origins.
5. Production secrets and bindings are not set: Hyperdrive binding, Telegram bot token, webhook secret, encryption key, frontend origin, and owner Telegram ID allowlist.
6. Telegram bot username/ownership and production webhook target are not known.
7. Live XTR payment, refund, and fulfillment tests have not been completed.
8. Contract v1.2 (CR-02) still has unsigned owner approval fields in Section 26.6.

## Production readiness

**NOT READY FOR PRODUCTION.** Source is published and CI passes, and the database schema is verified. Hosting, runtime secrets, domain routing, Telegram webhook, production owner allowlist, end-to-end payment/delivery tests, and critical acceptance testing remain incomplete.
