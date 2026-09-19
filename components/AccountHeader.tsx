import Link from 'next/link';
import HeaderLogo from '@/components/HeaderLogo';
import QuickOrderButton from '@/components/QuickOrderButton';

export default function AccountHeader() {
  return (
    <div className="topbar">
      <Link href="/"><HeaderLogo height={28} /></Link>
      <div className="account-header-actions">
        <QuickOrderButton />
        <Link href="/account/orders" style={{ fontSize: 13, color: '#fff' }}>My Orders</Link>
        <Link href="/account/profile" style={{ fontSize: 13, color: '#fff' }}>My Info</Link>
        <form action="/api/account/logout" method="post">
          <button type="submit" style={{ background: 'none', border: 'none', color: '#cbd3e0', fontSize: 13, cursor: 'pointer' }}>
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
