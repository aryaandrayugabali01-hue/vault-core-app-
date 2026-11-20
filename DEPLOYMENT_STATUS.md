# VAULT CORE — Deployment Status

**Updated:** 2026-11-21

## Connected infrastructure

| Service | Resource | Verified status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Connected; 10 application tables and 3 migration registry records confirmed |
| GitHub | `aryaandrayugabali01-hue/vault-core-app-` / `main` | Source published; repository read/write operations verified |
| Cloudflare | Primary account | `vault-core-gateway` deployed; `workers.dev` enabled; `vaultcore.web.id` is not present as a zone; app upstreams and custom domain remain unconfigured |
| Telegram | Bot API | No production bot identity/token or webhook configuration has been supplied to the deployment environment |

## Repository state

- Default branch: `main`.
- Last verified code commit: `89f6d7912070712b07d370acaba9a266ffba1c0e`.
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

## Cloudflare gateway

- Worker: `vault-core-gateway`.
- Deployment ID: `2b5db563f86e4f77a73b3b0482fcbd48`.
- Account Workers subdomain: `premiumdigital-id.workers.dev`.
- Worker URL: `https://vault-core-gateway.premiumdigital-id.workers.dev`.
- `workers.dev` was enabled and Worker settings were read back successfully; observability logs and traces are enabled.
- Gateway routes `/api/*` to `API_ORIGIN` and other paths to `WEB_ORIGIN`.
- `API_ORIGIN` and `WEB_ORIGIN` are intentionally unset. `/_gateway/health` reports gateway readiness only, not application readiness. Unconfigured upstream requests return HTTP 503.
- No custom domain is attached because `vaultcore.web.id` is not present as an active zone in the connected Cloudflare account.
- The gateway source is stored at `cloudflare/vault-core-gateway.js` in this repository.

## Deployment blockers

1. `vaultcore.web.id` is not present among the zones visible in the connected Cloudflare account. The only visible active zone is `nexustrade.web.id`, which belongs to another project and will not be reused. Domain registration/ownership remains unverified.
2. The Next.js frontend and Express API have not yet been adapted and deployed as Cloudflare-compatible application origins. The gateway Worker exists, but does not replace those application runtimes.
3. Production secrets and bindings are not set: Neon runtime connection/Hyperdrive, Telegram bot token, webhook secret, encryption key, frontend origin, and owner Telegram ID allowlist.
4. Telegram bot username/ownership and production webhook target are not known.
5. Live XTR payment, refund, and fulfillment tests have not been completed.
6. Contract v1.2 (CR-02) still has unsigned owner approval fields in Section 26.6.

## Production readiness

**NOT READY FOR PRODUCTION.** Source is published and CI passes, and the database schema is verified. Hosting, runtime secrets, domain routing, Telegram webhook, production owner allowlist, end-to-end payment/delivery tests, and critical acceptance testing remain incomplete.
