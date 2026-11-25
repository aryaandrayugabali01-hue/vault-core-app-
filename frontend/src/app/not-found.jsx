import { StoreBottomNav } from '../components/store-navigation.jsx';

export default function NotFound() {
  return <>
    <main className="not-found">Halaman yang Anda cari tidak tersedia.</main>
    <StoreBottomNav active="dashboard"/>
  </>;
}
