import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'VAULT CORE | Toko Digital Gaming',
  description: 'Katalog produk digital, voucher, lisensi, dan layanan gaming VAULT CORE.'
};

export default function RootLayout({ children }) {
  return <html lang="id"><body><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />{children}</body></html>;
}
