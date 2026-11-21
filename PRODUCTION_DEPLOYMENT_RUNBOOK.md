# VAULT CORE — Production deployment runbook

**Production domain:** `https://vaultcore.biz.id`  
**Cloudflare account:** `67d2069a9ae076d3ce63a9aca629ea8b`  
**Deployment workflow:** `.github/workflows/deploy-production.yml`

## Deployment state

- Frontend native Vinext/Cloudflare Worker configuration: generated and committed.
- Frontend Cloudflare Worker build: CI passed.
- API Worker bundle: Wrangler dry-run passed; Hyperdrive binding resolved.
- GitHub tests and Next.js build: passed.
- API Worker `vault-core-api`: deployed successfully in run `44890576521`; runtime `/health` currently returns HTTP 500.
- Frontend Worker `vault-core-web`: deployed successfully in run `44890576521`.
- The production preflight passed all required secrets, Cloudflare token verification, Hyperdrive read-back, and Telegram bot identity checks.
- API health failed because Cloudflare observability logged `handler is not a function` for requests to the API Worker. The root source is `cloudflare/vault-core-api.js`, which calls the object returned by `httpServerHandler` as though it were a function.
- Gateway origins, custom domains, DNS and Telegram webhook remain unconfigured; their workflow steps were skipped after the API health check failed.
- The production deployment workflow supports a manual `workflow_dispatch` and a restricted `main` push trigger for changes to the API Worker entrypoint or deployment workflow. Keep the five required repository secrets current.

## Repository secrets required

Add the following secrets to the GitHub repository under **Settings → Secrets and variables → Actions → New repository secret**. Do not commit them to the repository or send them in chat.

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token scoped to account `67d2069a9ae076d3ce63a9aca629ea8b` with **Workers Scripts: Edit** and **Hyperdrive: Read**; it must also allow attaching Worker Custom Domains in the active zone |
| `TELEGRAM_BOT_TOKEN` | Production bot token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret token to authenticate Telegram webhook requests |
| `ADMIN_TELEGRAM_IDS` | Comma-separated numeric Telegram user IDs authorized as admins/owner |
| `APP_ENCRYPTION_KEY` | Standard Base64 encoding of exactly 32 random bytes, used for AES-256-GCM inventory encryption |

Generate it with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy only the generated output into the secret. The deployment preflight ignores line breaks/whitespace around or within the Base64 value and reports only its character and decoded-byte counts; it never prints the key.

Optional:
- `SUPPORT_CONTACT`: the support contact displayed by the payment-support bot command.

The deployment workflow validates the key length and numeric Telegram IDs before deploying. The latest production run passed these checks. The deployed API adapter fix is being applied to the existing source and the workflow is configured to redeploy when that API entrypoint or the deployment workflow changes on `main`.

## Database connection model

The API Worker uses one fresh `pg.Client` per incoming request through `AsyncLocalStorage`. Controller calls to `pool.query()` and `pool.connect()` within that request share the same client, so order/payment transactions remain on one connection. Hyperdrive manages the underlying origin connection pool and automatically cleans up each Worker-side client when the invocation ends. Local Node.js development and migrations continue using the normal `pg.Pool`.

Reference: [Cloudflare Hyperdrive connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/).

## Run deployment

1. Open the repository's **Actions** tab.
2. Select **VAULT CORE production deployment**.
3. Select **Run workflow** on branch `main`.

The workflow installs the committed lockfile, validates the five required secrets and Cloudflare token, runs backend tests/build, deploys `vault-core-api` and `vault-core-web`, installs API secrets, configures gateway origins, attaches the three custom domains, configures the Telegram webhook, and reads each public endpoint back.

## Production routing after Worker deployment

The public gateway is already deployed as `vault-core-gateway`. After both app Workers pass their health checks, its upstreams must be set to:

- `WEB_ORIGIN=https://vault-core-web.premiumdigital-id.workers.dev`
- `API_ORIGIN=https://vault-core-api.premiumdigital-id.workers.dev`

The deployment workflow attaches these custom domains to the gateway Worker in the active Cloudflare zone `vaultcore.biz.id` (zone ID `74092a358232c7bf501da8d822fabb47`):

- `vaultcore.biz.id`
- `www.vaultcore.biz.id`
- `api.vaultcore.biz.id`

Only then test the Mini App through `https://vaultcore.biz.id`. The API route `/health` must return `status: ok` and `database: connected`.

## Telegram webhook and payment acceptance

After the public domain is active, set the Telegram bot webhook to:

`https://api.vaultcore.biz.id/api/telegram/webhook`

The deployment workflow uses the exact `TELEGRAM_WEBHOOK_SECRET` stored in GitHub/Worker secrets and reads back `getWebhookInfo` after configuring Telegram's webhook. Then validate:
- bot /start opens `https://vaultcore.biz.id`;
- Telegram Mini App authentication succeeds;
- catalog is readable and only sellable inventory is shown;
- XTR invoice is created with the expected total;
- pre-checkout rejects mismatched user/order/amount;
- one successful payment is recorded once;
- delivery runs once and stores the expected audit data;
- refund and recovery flows behave correctly.

Production must remain marked **NOT READY** until these live checks pass.
