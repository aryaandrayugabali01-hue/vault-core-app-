const apiBase = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function telegramCall(method, body) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  const response = await fetch(`${apiBase()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram API ${method} failed.`);
  return data.result;
}

export async function sendStarsInvoice({ orderNumber, title, description, amount }) {
  return telegramCall('createInvoiceLink', {
    title: title.slice(0, 32),
    description: description.slice(0, 255),
    payload: orderNumber,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: title.slice(0, 32), amount }],
    photo_url: undefined
  });
}

export async function refundStarPayment({ userId, telegramPaymentChargeId }) {
  return telegramCall('refundStarPayment', {
    user_id: Number(userId),
    telegram_payment_charge_id: telegramPaymentChargeId
  });
}
