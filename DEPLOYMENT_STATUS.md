# VAULT CORE — Deployment Status

**Updated:** 2026-11-21

## Connected infrastructure

| Service | Resource | Status |
|---|---|---|
| Neon PostgreSQL | `VAULT CORE` / `soft-morning-26299268` / Singapore | Created; 10 public tables and 3 migration registry entries verified |
| GitHub | `aryaandrayugabali01-hue/vault-core-app-` / `main` | Repository confirmed public; owner account has Admin and Push permissions. Source upload is blocked because the connected GitHub integration returns HTTP 403 `Resource not accessible by integration` for write APIs. |
| Cloudflare | Primary connected account | Account was accessible in prior inspection; `vaultcore.web.id` was not present among visible zones. No deployment or DNS changes made. |

## Repository state at last check

- Default branch: `main`.
- Current head: `c7a40dade94190e383aab29e028a231c84e00661`.
- The branch contains only the initial `README.md` file.
- The local source package is prepared in this archive but has not been published to GitHub.

## Local implementation included in this package

- Node.js / Express API with health, catalog, customer orders, admin products, inventory and finance endpoints.
- HMAC validation of Telegram Mini App `initData` with an age limit.
- AES-256-GCM encryption for digital inventory payloads.
- Telegram Stars invoice generation, pre-checkout validation, successful-payment verification, delivery tracking and Telegram DM delivery.
- `/paysupport` support command and owner-triggered Stars refund route.
- Next.js customer Mini App and Owner Console.
- SQL migrations and migration runner.
- Delivery retry tracking, operating expense recording, transaction snapshots, and owner profit reporting.
- Automated tests and GitHub Actions CI workflow.

## Validation performed

- Core unit tests: **9/9 PASS**.
- Backend, bot and test JavaScript syntax checks: **PASS**.
- Package JSON parsing: **PASS**.
- SQL migration files present: **3**.
- Environment template reviewed: no live credentials are included.
- Archive integrity: verified after packaging.
- Full Next.js production build: **not verified** because package installation/build was not completed in the earlier environment (`EAI_AGAIN` resolving the npm registry).

## Remaining execution steps

1. Publish the contents of this package to the existing `main` branch after GitHub integration write access is enabled.
2. Recheck Cloudflare zone ownership and configure hosting/secrets only after the target domain/account is confirmed.
3. Register the production Telegram webhook, then run end-to-end XTR payment, refund, stock reservation and delivery tests before enabling sales.

## Production readiness

**Not production-ready yet.** The database schema exists and the source package passes the tests listed above, but the source has not been published, the frontend build is unverified, production secrets/webhook are not configured, and no live payment/delivery test has been completed.
