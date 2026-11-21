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

async function confirmRefundFromStarLedger(userId, telegramPaymentChargeId) {
  for (let offset = 0; offset < 10000; offset += 100) {
    const result = await telegramCall('getStarTransactions', { offset, limit: 100 });
    const transactions = result?.transactions ?? [];
    const confirmed = transactions.some((transaction) =>
      transaction.id === telegramPaymentChargeId
      && transaction.receiver?.type === 'user'
      && String(transaction.receiver.user?.id) === String(userId)
    );
    if (confirmed) return true;
    if (transactions.length < 100) return false;
  }
  return false;
}

export async function refundStarPayment({ userId, telegramPaymentChargeId }) {
  try {
    return await telegramCall('refundStarPayment', {
      user_id: Number(userId),
      telegram_payment_charge_id: telegramPaymentChargeId
    });
  } catch (error) {
    if (!error.telegramRejected || !String(error.message).includes('CHARGE_ALREADY_REFUNDED')) {
      throw error;
    }
    const confirmed = await confirmRefundFromStarLedger(userId, telegramPaymentChargeId);
    if (confirmed) return true;
    throw new Error('Telegram reports CHARGE_ALREADY_REFUNDED, but the matching outgoing Stars transaction was not confirmed by getStarTransactions. Manual reconciliation is required.');
  }
}
