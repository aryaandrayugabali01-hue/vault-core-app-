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

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message', 'pre_checkout_query'],
    drop_pending_updates: false
  })
});
const result = await response.json();
if (!response.ok || !result.ok) {
  console.error(result.description || 'Telegram webhook setup failed.');
  process.exit(1);
}
console.log(`Telegram webhook configured: ${webhookUrl}`);
