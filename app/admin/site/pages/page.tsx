import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pageSchemas } from '@/lib/site/page-schemas';
import { PAGE_LIST } from '@/lib/site/page-list';
import s from '@/components/admin/site/site-admin.module.css';

export const dynamic = 'force-dynamic';

export default async function SitePages() {
  const { data } = await supabaseAdmin.from('site_pages').select('key, published_at, updated_at');
  const byKey = new Map((data || []).map((r) => [r.key, r]));
  const available = PAGE_LIST.filter((p) => pageSchemas[p.key]);
  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / Pages</div>
      <h1>Pages</h1>
      <div className={s.hubGrid}>
        {available.map((p) => (
          <Link key={p.key} href={`/admin/site/pages/${p.key}`} className={s.hubCard}>
            <h2>{p.title}{!byKey.get(p.key)?.published_at && <span className={`${s.pill} ${s.pillDraft}`}>Starting text</span>}</h2>
            <p>{p.detail}</p>
            <span>Edit →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
