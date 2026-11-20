import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'VAULT CORE | Digital Gaming Store',
  description: 'Katalog digital dan layanan gaming VAULT CORE.'
};

export default function RootLayout({ children }) {
  return <html lang="id"><body><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />{children}</body></html>;
}
