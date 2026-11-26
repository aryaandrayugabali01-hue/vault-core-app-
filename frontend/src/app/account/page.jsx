'use client';

import { useCallback, useEffect, useState } from 'react';
import { getInitData } from '../../lib/telegram';
import './page.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

function safeAccountReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '';
  try {
    const target = new URL(value, 'https://vaultcore.biz.id');
    const allowed = target.pathname === '/account' || target.pathname.startsWith('/account/')
      || target.pathname === '/catalog' || target.pathname.startsWith('/catalog/');
    return target.origin === 'https://vaultcore.biz.id' && allowed
      ? target.pathname + target.search + target.hash
      : '';
  } catch {
    return '';
  }
}

export default function CustomerAccountPage() {
  const [customer, setCustomer] = useState(null);
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState('');

  const loadSession = useCallback(async () => {
    setStatus('checking');
    try {
      const initData = getInitData();
      const response = await fetch(API + '/api/customer-auth/session', {
        credentials: 'include',
        cache: 'no-store',
        headers: initData ? { 'x-telegram-init-data': initData } : {}
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          setCustomer(null);
          setStatus('signed-out');
          return null;
        }
        throw new Error(data.message || 'Sesi akun belum dapat diperiksa. Coba kembali.');
      }
      setCustomer(data.user || null);
      setStatus('signed-in');
      return data.user || null;
    } catch {
      setCustomer(null);
      setStatus('unavailable');
      setMessage(error.message || 'Sesi akun belum dapat diperiksa. Periksa koneksi lalu coba kembali.');
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next) setNextPath(safeAccountReturnPath(next));
    if (params.get('login') === 'success') setMessage('Telegram berhasil diverifikasi. Akun pelanggan VAULT CORE sudah terhubung.');
    if (params.get('login_error')) setMessage('Login Telegram belum berhasil. Silakan coba kembali.');
    loadSession();
  }, [loadSession]);

  const logout = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(API + '/api/customer-auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Logout tidak berhasil.');
      setCustomer(null);
      setStatus('signed-out');
      setMessage('Anda sudah keluar dari akun web VAULT CORE.');
    } catch (error) {
      setMessage(error.message || 'Logout tidak berhasil.');
    } finally {
      setBusy(false);
    }
  };

  const name = customer?.first_name || customer?.username || 'Pelanggan Telegram';
  const destination = nextPath || '/catalog';
  const loginUrl = API + '/api/customer-auth/oidc/start' + (nextPath ? '?next=' + encodeURIComponent(nextPath) : '');

  return (
    <main className="customer-account-page">
      <section className="customer-account-card">
        <a className="customer-account-brand" href="/" aria-label="VAULT CORE Beranda">
          <img src="/assets/01-brand/vaultcore-horizontal.svg" alt="VAULT CORE"/>
        </a>
        <span className="customer-account-kicker">AKUN PELANGGAN</span>
        <h1>Akun VAULT CORE</h1>
        <p className="customer-account-intro">Gunakan satu akun Telegram untuk mengakses profil yang sama di website dan Mini App. Pesanan, pembayaran, dan riwayat transaksi dikelola melalui Telegram Mini App.</p>

        {status === 'checking' && <div className="customer-account-status">Memeriksa sesi akun…</div>}

        {status === 'signed-in' && customer && <>
          <div className="customer-account-identity">
            <span className="customer-account-avatar">{String(name).slice(0,1).toUpperCase()}</span>
            <span>
              <strong>{name}</strong>
              <small>{customer.username ? '@' + customer.username : 'Pengguna Telegram'}</small>
              <small>ID Telegram: {customer.id}</small>
            </span>
          </div>
          <div className="customer-account-status is-success">Akun Telegram terverifikasi</div>
          {customer.isOwner && <a className="customer-account-secondary" href="/admin">Buka Dashboard Owner</a>}
          <a className="customer-account-primary" href={destination}>Lanjutkan</a>
          <button className="customer-account-logout" type="button" onClick={logout} disabled={busy}>{busy ? 'Memproses…' : 'Keluar dari akun web'}</button>
        </>}

        {status === 'signed-out' && <>
          <div className="customer-account-status">Anda belum masuk ke akun pelanggan.</div>
          <a className="customer-account-primary" href={loginUrl}>Masuk dengan Telegram</a>
          <small className="customer-account-note">Telegram akan meminta persetujuan untuk membagikan nama dan username. VAULT CORE tidak meminta kata sandi Telegram atau kode OTP.</small>
          <a className="customer-account-secondary" href="/catalog">Lanjut melihat katalog</a>
        </>}

        {status === 'unavailable' && <button className="customer-account-primary" type="button" onClick={loadSession}>Coba periksa kembali</button>}
        {message && <p className="customer-account-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
