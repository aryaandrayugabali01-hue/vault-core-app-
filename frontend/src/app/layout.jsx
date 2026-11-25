import './globals.css';
import Script from 'next/script';
import { StoreFooter } from '../components/store-navigation.jsx';

export const metadata = {
  title: 'VAULT CORE | Lebih Yakin Bersama Vault Core',
  description: 'Lebih Yakin Bersama Vault Core. Marketplace akun game: Mobile Legends, Free Fire, Roblox, dan Genshin Impact. Transaksi melalui Telegram Stars (XTR).',
  icons: {
    icon: '/assets/01-brand/favicon.svg',
    shortcut: '/assets/01-brand/favicon.png',
    apple: '/assets/01-brand/pwa-icon-192.png'
  },
  openGraph: {
    title: 'VAULT CORE | Lebih Yakin Bersama Vault Core',
    description: 'Lebih Yakin Bersama Vault Core. Katalog akun game dengan transaksi resmi Telegram Stars (XTR).',
    images: [{ url: '/assets/09-social/og-cover-1200x630.jpg', width: 1200, height: 630, alt: 'VAULT CORE' }]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
        <StoreFooter />
      </body>
    </html>
  );
}
