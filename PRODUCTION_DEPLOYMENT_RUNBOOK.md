# VAULT CORE — Production deployment runbook

**Production domain:** `https://vaultcore.biz.id`  
**Cloudflare account:** `67d2069a9ae076d3ce63a9aca629ea8b`  
**Deployment workflow:** `.github/workflows/deploy-production.yml`

## Deployment state

- Production deployment run [`44891173631`](https://github.com/aryaandrayugabali01-hue/vault-core-app-/actions/runs/44891173631), attempt 2, completed **SUCCESS**.
- Production preflight passed all five required secrets, Cloudflare API-token verification, Hyperdrive read-back, and Telegram Bot API identity.
- Backend/core tests and frontend build passed.
- API Worker `vault-core-api` and frontend Worker `vault-core-web` are deployed; API `/health` returned `status: ok` and `database: connected`.
- Gateway `WEB_ORIGIN` and `API_ORIGIN` secrets are installed.
- Custom domains `vaultcore.biz.id`, `www.vaultcore.biz.id`, and `api.vaultcore.biz.id` are attached to the existing `vault-core-gateway`; public DNS/TLS, API health, and gateway-origin checks passed.
- Telegram webhook was configured to `https://api.vaultcore.biz.id/api/telegram/webhook`; `getWebhookInfo` read-back passed.
- Neon production read-back (25 November 2026): all 16 commercial SKUs across MLBB, Roblox, Free Fire, and Genshin Impact are `ACTIVE`, each has an unexpired Owner-attested `APPROVED` CR-05 review, a commercial XTR price above 1 XTR, and one available source-bound manual-fulfillment inventory slot. All 17 marketplace categories are active. The 16 SKUs meet the backend catalog and checkout eligibility checks; paid customer UAT and delivery/refund acceptance remain separate release gates. Four TEST-only fixtures remain isolated from the public catalog (`is_test=true`).
- The production deployment workflow supports manual `workflow_dispatch` and a restricted `main` push trigger for changes to the API Worker entrypoint or deployment workflow. Keep the five repository secrets current.

## Repository secrets required

Add the following secrets to the GitHub repository under **Settings → Secrets and variables → Actions → New repository secret**. Do not commit them to the repository or send them in chat.

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token scoped to account `67d2069a9ae076d3ce63a9aca629ea8b` with **Workers Scripts: Edit** and **Hyperdrive: Read**; it must also allow attaching Worker Custom Domains in the active zone |
| `TELEGRAM_BOT_TOKEN` | Production bot token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret token to authenticate Telegram webhook requests |
| `TELEGRAM_OIDC_CLIENT_SECRET` | Client Secret issued by BotFather → Login Widget for the existing VAULT CORE bot |
| `ADMIN_TELEGRAM_IDS` | Comma-separated numeric Telegram user IDs authorized as admins/owner |
| `APP_ENCRYPTION_KEY` | Standard Base64 encoding of exactly 32 random bytes, used for AES-256-GCM inventory encryption |

Generate it with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy only the generated output into the secret. The deployment preflight ignores line breaks/whitespace around or within the Base64 value and reports only its character and decoded-byte counts; it never prints the key.

Telegram Login OIDC:
- BotFather Allowed Origin: `https://vaultcore.biz.id`
- BotFather Redirect URI: `https://api.vaultcore.biz.id/api/owner-auth/oidc/callback`
- Store the Client Secret as GitHub Actions secret `TELEGRAM_OIDC_CLIENT_SECRET`; never commit or expose it.

Optional:
- `SUPPORT_CONTACT`: the support contact displayed by the payment-support bot command.

The deployment workflow validates the encryption key and provisions `TELEGRAM_OIDC_CLIENT_SECRET` to the existing `vault-core-api` Worker. Owner authorization is read only from active `owner_accounts` records in Neon. `TELEGRAM_OIDC_CLIENT_ID` and `TELEGRAM_OIDC_REDIRECT_URI` are public configuration values in `wrangler.api.jsonc`. The latest production run passed these checks. The deployed API adapter fix is being applied to the existing source and the workflow is configured to redeploy when that API entrypoint or the deployment workflow changes on `main`.

## Database connection model

The API Worker uses one fresh `pg.Client` per incoming request through `AsyncLocalStorage`. Controller calls to `pool.query()` and `pool.connect()` within that request share the same client, so order/payment transactions remain on one connection. Hyperdrive manages the underlying origin connection pool and automatically cleans up each Worker-side client when the invocation ends. Local Node.js development and migrations continue using the normal `pg.Pool`.

Reference: [Cloudflare Hyperdrive connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/).

## Run deployment

1. Open the repository's **Actions** tab.
2. Select **VAULT CORE production deployment**.
3. Select **Run workflow** on branch `main`.

The workflow installs the committed lockfile, validates secrets and account access, runs tests/build, deploys both application Workers, installs API secrets, configures gateway origins, attaches the three custom domains, verifies public DNS/TLS/API health, configures the Telegram webhook, and verifies `getWebhookInfo`. The latest full run passed. New runs are triggered by an API entrypoint/workflow change on `main` or manually.

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

Production catalog state is ready for transaction testing: all 16 commercial SKUs are active, meet backend checkout eligibility, and have available source-bound inventory. General-sales release approval remains separate until live order/XTR payment, pre-checkout, fulfillment, refund, Owner UAT, IDOR, and backup/restore checks pass.
