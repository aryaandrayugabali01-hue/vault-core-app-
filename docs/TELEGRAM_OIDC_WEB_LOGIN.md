# VAULT CORE Telegram OIDC Web Login

## Purpose

Website customers authenticate through Telegram OpenID Connect. Telegram Mini App users continue using signed Telegram `initData`. Both identities resolve to the same numeric Telegram user ID in `customers.telegram_user_id`.

Both channels use the existing `orders`, `order_items`, inventory reservation, delivery, and payment code. All SKU prices remain in XTR through `products.sale_price_xtr`. Website checkout opens the same official Telegram Stars invoice link used by Mini App checkout.

## BotFather configuration

1. Open the official Telegram Login setup for the existing VAULT CORE bot in @BotFather. Register the website origin `https://vaultcore.biz.id` and the exact callback URL `https://api.vaultcore.biz.id/api/auth/telegram/callback` in Allowed URLs.
2. Copy the OIDC Client ID and Client Secret shown by BotFather. Keep the signing algorithm at the default `RS256`; this implementation validates RS256 signatures against Telegram's published JWKS.
3. In the existing GitHub repository settings, add these Actions secrets:
   - `TELEGRAM_OIDC_CLIENT_ID`
   - `TELEGRAM_OIDC_CLIENT_SECRET`

The existing production workflow publishes these as secrets to the existing `vault-core-api` Worker. It does not create another Worker, bot, repository, or database. When both values are absent, the storefront remains browseable but web login returns an unavailable status.

## OIDC flow

- Authorization Code Flow with PKCE S256.
- Requested scopes: `openid profile`.
- State, nonce, and PKCE verifier are stored in a short-lived signed HttpOnly cookie.
- The callback exchanges the authorization code server-side and verifies the JWT signature, issuer, audience, expiry, issued-at time, nonce, and numeric Telegram `id` claim.
- The server creates a signed HttpOnly customer session cookie and upserts the Telegram identity in the existing customers table.
- Session cookie scope is `.vaultcore.biz.id`, allowing the website and API subdomain to use the same customer session.

## Payment and stock rules

- Website and Mini App submit cart items to the same `POST /api/orders` endpoint.
- The backend calculates price from database SKU values, locks the product, reserves available inventory, creates one order, and issues a Telegram Stars invoice.
- Telegram pre-checkout and successful-payment webhook validations continue to verify the same Telegram user ID, order amount, currency XTR, and inventory reservation.
- No IDR price, QRIS, bank transfer, Midtrans, or separate order ledger is introduced in this phase.
