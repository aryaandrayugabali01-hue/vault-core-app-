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
          text: 'Pembayaran VAULT CORE untuk ' + message.successful_payment.invoice_payload + ' telah terverifikasi. Pesanan memerlukan rekonsiliasi stok oleh Owner. Status pembayaran Anda tercatat dan tindak lanjut akan diproses melalui dukungan.'
        });
      }
      return res.sendStatus(200);
    }
    if (message?.text?.startsWith('/start')) {
      const appUrl = process.env.TELEGRAM_MINI_APP_URL;
      await telegramCall('sendMessage', {
        chat_id: message.chat.id,
        text: 'Selamat datang di VAULT CORE. Pilih katalog digital dan layanan game yang tersedia.',
        reply_markup: { inline_keyboard: [[{ text: 'Buka VAULT CORE Store', web_app: { url: appUrl } }]] }
      });
      return res.sendStatus(200);
    }
    if (message?.text?.startsWith('/help')) {
      await telegramCall('sendMessage', {
        chat_id: message.chat.id,
        text: 'Gunakan tombol Buka VAULT CORE Store untuk melihat katalog. Untuk masalah pembayaran, gunakan /paysupport.'
      });
      return res.sendStatus(200);
    }
    if (message?.text?.startsWith('/paysupport')) {
      const contact = process.env.SUPPORT_CONTACT;
      await telegramCall('sendMessage', {
        chat_id: message.chat.id,
        text: contact
          ? `Dukungan pembayaran VAULT CORE\n\nKirim nomor pesanan dan uraian kendala ke ${contact}. Jangan kirim password, OTP, atau kode pemulihan.`
          : 'Dukungan pembayaran VAULT CORE\n\nKirim nomor pesanan dan uraian kendala kepada admin toko melalui kanal bantuan yang diberikan saat pembelian. Jangan kirim password, OTP, atau kode pemulihan.'
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
