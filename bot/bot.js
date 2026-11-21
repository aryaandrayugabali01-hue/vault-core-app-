import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !webhookUrl || !secret) {
  console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_URL, and TELEGRAM_WEBHOOK_SECRET first.');
  process.exit(1);
}
if (!webhookUrl.startsWith('https://')) {
  console.error('TELEGRAM_WEBHOOK_URL must use HTTPS.');
  process.exit(1);
}

let result;
let lastError;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'pre_checkout_query'],
        drop_pending_updates: false
      }),
      signal: AbortSignal.timeout(15_000)
    });
    result = await response.json();
    if (response.ok && result.ok) break;
    throw new Error(result.description || 'Telegram webhook setup failed.');
  } catch (error) {
    lastError = error;
    if (attempt === 5) break;
    const delay = Math.min(1_000 * (2 ** (attempt - 1)), 8_000);
    console.warn(`Telegram webhook attempt ${attempt} failed; retrying in ${delay}ms.`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
if (!result?.ok) {
  console.error(lastError?.message || result?.description || 'Telegram webhook setup failed after retries.');
  process.exit(1);
}
console.log(`Telegram webhook configured: ${webhookUrl}`);
