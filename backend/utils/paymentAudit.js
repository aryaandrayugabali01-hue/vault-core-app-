export function sanitizeSuccessfulPaymentUpdate(message) {
  const payment = message?.successful_payment;
  if (!payment || !message?.from?.id) {
    throw new TypeError('A valid successful_payment update is required.');
  }

  return {
    message_id: Number.isSafeInteger(message.message_id) ? message.message_id : null,
    date: Number.isSafeInteger(message.date) ? message.date : null,
    telegram_user_id: String(message.from.id),
    successful_payment: {
      currency: String(payment.currency ?? ''),
      total_amount: Number(payment.total_amount),
      invoice_payload: String(payment.invoice_payload ?? ''),
      telegram_payment_charge_id: String(payment.telegram_payment_charge_id ?? ''),
      provider_payment_charge_id: payment.provider_payment_charge_id == null
        ? null
        : String(payment.provider_payment_charge_id)
    }
  };
}
