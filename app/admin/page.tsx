import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';

export default async function AdminDashboard() {
  const [{ count: catCount }, { count: photoCount }, { count: shapeCount }, { count: colorCount }, { count: tagCount }] = await Promise.all([
    supabaseAdmin.from('categories').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('photos').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('shapes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('colors').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tags').select('*', { count: 'exact', head: true })
  ]);

  const stats = [
    { label: 'Categories', value: catCount, href: '/admin/categories' },
    { label: 'Photos', value: photoCount, href: '/admin/categories' },
    { label: 'Shapes', value: shapeCount, href: '/admin/shapes' },
    { label: 'Colors', value: colorCount, href: '/admin/colors' },
    { label: 'Tags', value: tagCount, href: '/admin/tags' }
  ];

  return (
    <>
      <h1>Dashboard</h1>

      <Link
        href="/admin/brand-upload"
        className="card"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '18px 22px', marginBottom: 20, background: 'var(--ink)', color: '#fff', border: 'none'
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontFamily: 'Playfair Display', fontWeight: 600 }}>Upload / change header logo</div>
          <div style={{ fontSize: 12.5, color: '#b9c2d4', marginTop: 3 }}>
            Uploads your logo, auto-removes its background, and generates the white version used in the header.
          </div>
        </div>
        <span style={{ fontSize: 13, color: 'var(--gold-soft)', whiteSpace: 'nowrap' }}>Open &rarr;</span>
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card" style={{ padding: 20, display: 'block' }}>
            <div style={{ fontSize: 28, fontFamily: 'Playfair Display', color: 'var(--ink)' }}>{s.value ?? 0}</div>
            <div style={{ fontSize: 12, color: '#8a8370', marginTop: 4 }}>{s.label}</div>
          </Link>
        ))}
      </div>
      <p style={{ marginTop: 24, fontSize: 13.5, color: 'var(--charcoal)' }}>
        Start in <Link href="/admin/shapes" style={{ color: 'var(--navy)', textDecoration: 'underline' }}>Shapes</Link> or{' '}
        <Link href="/admin/colors" style={{ color: 'var(--navy)', textDecoration: 'underline' }}>Colors</Link> to manage the master lists,
        or go straight to <Link href="/admin/categories" style={{ color: 'var(--navy)', textDecoration: 'underline' }}>Categories</Link> to
        link shapes/colors/tags to a category and upload photos.
      </p>
    </>
  );
}
