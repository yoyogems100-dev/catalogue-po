import Link from 'next/link';
import HeaderLogo from '@/components/HeaderLogo';

export default function AccountHeader() {
  return (
    <div className="topbar">
      <Link href="/"><HeaderLogo height={28} /></Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/account/quick-order" style={{ fontSize: 13, color: '#fff' }}>Quick Order</Link>
        <Link href="/account/orders" style={{ fontSize: 13, color: '#fff' }}>My Orders</Link>
        <form action="/api/account/logout" method="post">
          <button type="submit" style={{ background: 'none', border: 'none', color: '#cbd3e0', fontSize: 13, cursor: 'pointer' }}>
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
