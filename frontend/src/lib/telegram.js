'use client';

export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function getInitData() {
  return getTelegramWebApp()?.initData ?? '';
}

export function openInvoice(url) {
  const webApp = getTelegramWebApp();
  if (webApp?.openInvoice) {
    webApp.openInvoice(url, (status) => {
      if (status === 'paid') window.dispatchEvent(new CustomEvent('vault:payment-paid'));
    });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
