import Link from 'next/link';
import HeaderLogo from '@/components/HeaderLogo';
import QuickOrderButton from '@/components/QuickOrderButton';
import ActingBanner from '@/components/ActingBanner';
import HomeButton from '@/components/HomeButton';
import { getAccountState } from '@/lib/account-state';

export default async function AccountHeader() {
  const account = await getAccountState();
  return (
    <>
    {account.actingAs && <ActingBanner customerName={account.customerName} selfName={account.actingAs.selfName} />}
    <div className="topbar">
      <Link href="/po"><HeaderLogo height={28} /></Link>
      <div className="account-header-actions">
        <HomeButton />
        <QuickOrderButton />
        <Link href="/po/account/orders" style={{ fontSize: 13, color: '#fff' }}>My Orders</Link>
        <Link href="/po/account/profile" style={{ fontSize: 13, color: '#fff' }}>My Info</Link>
        <form action="/api/account/logout" method="post">
          <button type="submit" style={{ background: 'none', border: 'none', color: '#cbd3e0', fontSize: 13, cursor: 'pointer' }}>
            Log out
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
