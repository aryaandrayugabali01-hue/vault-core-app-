'use client';

export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function getInitData() {
  return getTelegramWebApp()?.initData ?? '';
}

export function openInvoice(url, orderNumber = null) {
  const webApp = getTelegramWebApp();
  if (webApp?.openInvoice) {
    webApp.openInvoice(url, (status) => {
      if (status === 'paid') window.dispatchEvent(new CustomEvent('vault:payment-paid', { detail: { orderNumber } }));
    });
    return;
  }
  window.location.assign(url);
}
