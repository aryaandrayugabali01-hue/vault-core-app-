# VAULT CORE — Production deployment runbook

**Production domain:** `https://vaultcore.biz.id`  
**Cloudflare account:** `67d2069a9ae076d3ce63a9aca629ea8b`  
**Deployment workflow:** `.github/workflows/deploy-production.yml`

## Deployment state

- Frontend native Vinext/Cloudflare Worker configuration: generated and committed.
- Frontend Cloudflare Worker build: CI passed.
- API Worker bundle: Wrangler dry-run passed; Hyperdrive binding resolved.
- GitHub tests and Next.js build: passed.
- Production application Workers: not deployed yet.
- Gateway custom domains and upstream origins: not configured yet.
- Telegram webhook and live Stars payment/fulfillment: not verified yet.

## Repository secrets required

Add the following secrets to the GitHub repository under **Settings → Secrets and variables → Actions → New repository secret**. Do not commit them to the repository or send them in chat.

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with **Workers Scripts: Edit** and **Hyperdrive: Read** permissions for the connected account |
| `TELEGRAM_BOT_TOKEN` | Production bot token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret token to authenticate Telegram webhook requests |
| `ADMIN_TELEGRAM_IDS` | Comma-separated numeric Telegram user IDs authorized as admins/owner |
| `APP_ENCRYPTION_KEY` | Base64-encoded 32-byte key used for AES-256-GCM inventory encryption |

Optional:
- `SUPPORT_CONTACT`: the support contact displayed by the payment-support bot command.

The deployment workflow validates the key length and numeric Telegram IDs before deploying. A malformed/missing required secret stops the deployment before runtime promotion.

## Database connection model

The API Worker uses one fresh `pg.Client` per incoming request through `AsyncLocalStorage`. Controller calls to `pool.query()` and `pool.connect()` within that request share the same client, so order/payment transactions remain on one connection. Hyperdrive manages the underlying origin connection pool and automatically cleans up each Worker-side client when the invocation ends. Local Node.js development and migrations continue using the normal `pg.Pool`.

Reference: [Cloudflare Hyperdrive connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/).

## Run deployment

1. Open the repository's **Actions** tab.
2. Select **VAULT CORE production deployment**.
3. Select **Run workflow** on branch `main`.

The workflow installs the committed lockfile, runs backend tests, deploys `vault-core-api`, applies its secrets, deploys `vault-core-web`, then checks the API health route and frontend response.

## Production routing after Worker deployment

The public gateway is already deployed as `vault-core-gateway`. After both app Workers pass their health checks, its upstreams must be set to:

- `WEB_ORIGIN=https://vault-core-web.premiumdigital-id.workers.dev`
- `API_ORIGIN=https://vault-core-api.premiumdigital-id.workers.dev`

Then attach these custom domains to the gateway Worker in the active Cloudflare zone `vaultcore.biz.id` (zone ID `74092a358232c7bf501da8d822fabb47`):

- `vaultcore.biz.id`
- `www.vaultcore.biz.id`
- `api.vaultcore.biz.id`

Only then test the Mini App through `https://vaultcore.biz.id`. The API route `/health` must return `status: ok` and `database: connected`.

## Telegram webhook and payment acceptance

After the public domain is active, set the Telegram bot webhook to:

`https://api.vaultcore.biz.id/api/telegram/webhook`

Use the exact `TELEGRAM_WEBHOOK_SECRET` stored in GitHub/Worker secrets when configuring Telegram's webhook secret token. Validate:
- bot /start opens `https://vaultcore.biz.id`;
- Telegram Mini App authentication succeeds;
- catalog is readable and only sellable inventory is shown;
- XTR invoice is created with the expected total;
- pre-checkout rejects mismatched user/order/amount;
- one successful payment is recorded once;
- delivery runs once and stores the expected audit data;
- refund and recovery flows behave correctly.

Production must remain marked **NOT READY** until these live checks pass.
