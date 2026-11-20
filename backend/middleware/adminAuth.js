export function requireOwner(req, res, next) {
  const allowed = new Set(
    String(process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  );
  const id = String(req.telegramUser?.id ?? '');
  if (!id || !allowed.has(id)) {
    return res.status(403).json({ error: 'ADMIN_ACCESS_REQUIRED' });
  }
  next();
}
