const apiBase = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function telegramCall(method, body) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  let response;
  try {
    response = await fetch(`${apiBase()}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    error.deliveryOutcomeUnknown = true;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    error.deliveryOutcomeUnknown = true;
    throw error;
  }
  if (!data.ok) {
    const error = new Error(data.description || `Telegram API ${method} failed.`);
    error.telegramRejected = true;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Telegram API ${method} returned HTTP ${response.status} with an ambiguous success payload.`);
    error.deliveryOutcomeUnknown = true;
    throw error;
  }
  return data.result;
}

export async function sendStarsInvoice({ orderNumber, title, description, amount }) {
  return telegramCall('createInvoiceLink', {
    title: title.slice(0, 32),
    description: description.slice(0, 255),
    payload: orderNumber,
    currency: 'XTR',
    prices: [{ label: title.slice(0, 32), amount }]
  });
}

export async function refundStarPayment({ userId, telegramPaymentChargeId }) {
  return telegramCall('refundStarPayment', {
    user_id: Number(userId),
    telegram_payment_charge_id: telegramPaymentChargeId
  });
}
