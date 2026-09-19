import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { getAccountState } from '@/lib/account-state';
import AccountMenu from '@/components/AccountMenu';
import CartBag from '@/components/CartBag';
import HeaderLogo from '@/components/HeaderLogo';
import Footer from '@/components/Footer';
import CartView from '@/components/CartView';

export const metadata = { title: 'Your Requirement — YOYO GEMS' };

// The requirement draft lives in the browser (localStorage), so there is
// nothing here for the server to render from -- CartView reads it after mount.
// This page only supplies the chrome and whether the visitor is signed in.
export default async function CartPage() {
  const [settings, account] = await Promise.all([getSettings(), getAccountState()]);

  return (
    <>
      <div className="topbar">
        <Link href="/"><HeaderLogo height={28} /></Link>
        <div className="topbar-actions">
          <CartBag />
          <AccountMenu loggedIn={account.loggedIn} customerName={account.customerName} />
        </div>
      </div>
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <Link href="/" className="back-link">&larr; Continue browsing</Link>
        <h1 style={{ fontSize: 28, color: 'var(--ink)', margin: '10px 0 18px' }}>Your Requirement</h1>
        <CartView loggedIn={account.loggedIn} whatsappNumber={settings.whatsapp_number} />
      </div>
      <Footer settings={settings} />
    </>
  );
}
