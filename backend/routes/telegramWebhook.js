import { Router } from 'express';
import crypto from 'node:crypto';
import { telegramCall } from '../services/telegramApi.js';
import { answerPreCheckout, recordSuccessfulPayment } from '../controllers/paymentController.js';
const router = Router();

router.post('/', async (req, res) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const suppliedSecret = req.get('x-telegram-bot-api-secret-token');
  if (!expectedSecret || !suppliedSecret) return res.sendStatus(401);
  const expected = Buffer.from(expectedSecret, 'utf8');
  const supplied = Buffer.from(suppliedSecret, 'utf8');
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    return res.sendStatus(401);
  }
  try {
    const update = req.body;
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      const result = await answerPreCheckout(query);
      await telegramCall('answerPreCheckoutQuery', {
        pre_checkout_query_id: query.id,
        ok: result.ok,
        ...(result.error_message ? { error_message: result.error_message } : {})
      });
      return res.sendStatus(200);
    }
    const message = update.message;
    if (message?.successful_payment) {
      const result = await recordSuccessfulPayment(message);
      if (result.refundRequired && !result.alreadyProcessed) {
        await telegramCall('sendMessage', {
          chat_id: message.chat.id,
          text: 'Pembayaran untuk pesanan ' + message.successful_payment.invoice_payload + ' telah tercatat. Pesanan sedang ditinjau oleh pengelola karena reservasi stok perlu diperiksa. Status pengiriman belum selesai.'
        });
      }
      return res.sendStatus(200);
    }
    if (message?.text?.startsWith('/start')) {
      const appUrl = process.env.TELEGRAM_MINI_APP_URL;
      await telegramCall('sendMessage', {
        chat_id: message.chat.id,
        text: 'Selamat datang di VAULT CORE. Jelajahi katalog produk digital, voucher, lisensi, dan layanan gaming yang tersedia.',
        reply_markup: { inline_keyboard: [[{ text: 'Buka toko VAULT CORE', web_app: { url: appUrl } }]] }
      });
      return res.sendStatus(200);
    }
    if (message?.text?.startsWith('/help')) {
      await telegramCall('sendMessage', {
        chat_id: message.chat.id,
        text: 'Pilih tombol Buka toko VAULT CORE untuk melihat katalog dan membuat pesanan. Untuk kendala pembayaran, gunakan /paysupport.'
      });
      return res.sendStatus(200);
    }
    if (message?.text?.startsWith('/paysupport')) {
      const contact = process.env.SUPPORT_CONTACT;
      await telegramCall('sendMessage', {
        chat_id: message.chat.id,
        text: contact
          ? `Bantuan pembayaran VAULT CORE\n\nKirim nomor pesanan dan jelaskan kendala Anda ke ${contact}. Jangan kirim kata sandi, OTP, atau kode pemulihan.`
          : 'Bantuan pembayaran VAULT CORE\n\nKanal bantuan pembayaran belum tersedia. Simpan nomor pesanan dan uraian kendala Anda untuk disampaikan kepada pengelola toko. Jangan kirim kata sandi, OTP, atau kode pemulihan.'
      });
      return res.sendStatus(200);
    }
    return res.sendStatus(200);
  } catch (error) {
    // Webhook bodies may contain payment metadata. Do not log the raw update or digital payload.
    console.error('[telegram-webhook]', error.message);
    if (!res.headersSent) return res.sendStatus(500);
  }
});
export default router;
