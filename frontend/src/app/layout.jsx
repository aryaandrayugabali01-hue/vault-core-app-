import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'VAULT CORE | Toko Digital Gaming',
  description: 'Marketplace akun game VAULT CORE: Mobile Legends, Free Fire, Roblox, dan Genshin Impact.',
  icons: {
    icon: '/assets/01-brand/favicon.svg',
    shortcut: '/assets/01-brand/favicon.png',
    apple: '/assets/01-brand/pwa-icon-192.png'
  },
  openGraph: {
    title: 'VAULT CORE | Toko Digital Gaming',
    description: 'Marketplace akun game melalui Telegram Stars (XTR).',
    images: [{ url: '/assets/09-social/og-cover-1200x630.jpg', width: 1200, height: 630, alt: 'VAULT CORE' }]
  }
};

export default function RootLayout({ children }) {
  return <html lang="id"><body><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />{children}</body></html>;
}
