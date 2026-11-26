import { redirect } from 'next/navigation';

// /catalog is a public alias for the canonical customer catalog.
// Keep one customer experience across direct links and in-app navigation.
export default function CatalogPage() {
  redirect('/miniapp/index.html#/catalog');
}
