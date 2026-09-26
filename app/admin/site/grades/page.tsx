import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import s from '@/components/admin/site/site-admin.module.css';
import GradesClient from './GradesClient';

export const dynamic = 'force-dynamic';

export default async function GradesPage() {
  const [{ data: grades }, { data: uses }, { data: cats }] = await Promise.all([
    supabaseAdmin.from('site_grades').select('id, code, name, summary, description, sort_order, is_visible').order('sort_order'),
    supabaseAdmin.from('site_category_grades').select('grade_id, site_category_id'),
    supabaseAdmin.from('site_categories').select('id, name')
  ]);
  const catName = new Map((cats || []).map((c) => [c.id, c.name]));
  const usedIn: Record<number, string[]> = {};
  (uses || []).forEach((u) => { (usedIn[u.grade_id] ||= []).push(catName.get(u.site_category_id) || ''); });
  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / Grades</div>
      <h1>Grades</h1>
      <p className={s.note}>The order here is the order on the Grades chart page (lowest to highest). Which grades apply to a category is set on that category’s <em>Catalogue &amp; filters</em> tab.</p>
      <GradesClient initial={grades || []} usedIn={usedIn} />
    </>
  );
}
