import { HotEditing, HotStatus } from '@/components/HotSelling';
import AdminNav, { type NavCategory } from '@/components/admin/AdminNav';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import NavProgress from '@/components/admin/NavProgress';

export const metadata = { title: 'Admin · YOYO GEMS', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthed())) redirect('/login');
  // Both category lists feed the side pane's "Categories" drill-downs.
  const [{ data: po }, { data: site }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name').order('num'),
    supabaseAdmin.from('site_categories').select('id, name, parent_id, sort_order').order('sort_order')
  ]);
  const poCategories: NavCategory[] = (po || []).map((c) => ({ id: c.id, name: c.name }));
  // Website categories as a tree flattened in order: each parent, then its sub-categories.
  const siteRows = site || [];
  const siteCategories: NavCategory[] = siteRows.filter((c) => c.parent_id == null).flatMap((p) => [
    { id: p.id, name: p.name },
    ...siteRows.filter((c) => c.parent_id === p.id).map((c) => ({ id: c.id, name: c.name, parent: p.name }))
  ]);
  return (
    <HotEditing><Suspense fallback={null}><NavProgress /></Suspense><div className="admin-shell">
      <AdminNav poCategories={poCategories} siteCategories={siteCategories} />
      <main className="admin-main"><HotStatus />{children}</main>
    </div></HotEditing>
  );
}
