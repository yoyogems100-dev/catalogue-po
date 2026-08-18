import Link from 'next/link';
import { WordMark } from '@/components/Logo';

// Middleware (see middleware.ts) already guarantees only authenticated
// requests reach this layout, so no auth check is needed here.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div style={{ marginBottom: 20 }} className="admin-nav-logo"><WordMark height={20} color="#FAF8F3" /></div>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/categories">Categories</Link>
        <Link href="/admin/shapes">Shapes</Link>
        <Link href="/admin/colors">Colors</Link>
        <Link href="/admin/color-palettes">Color Palettes</Link>
        <Link href="/admin/size-palettes">Size Palettes</Link>
        <Link href="/admin/bulk-link">Bulk Link</Link>
        <Link href="/admin/tags">Tags</Link>
        <Link href="/" target="_blank">View public site &rarr;</Link>
        <form action="/api/admin-logout" method="post" style={{ marginTop: 20 }}>
          <button type="submit" style={{ background: 'none', border: 'none', color: '#cbd3e0', padding: '10px 24px', fontSize: 13.5, cursor: 'pointer' }}>
            Log out
          </button>
        </form>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
