import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import s from '@/components/admin/site/site-admin.module.css';
import { WORKSPACES } from '@/components/admin/nav-config';

export const dynamic = 'force-dynamic';

// The same groups as the Website side of the side pane.
const site = WORKSPACES.find((w) => w.key === 'site')!;
const SECTIONS = site.groups.flatMap((g) => g.links).filter((l) => l.detail).map((l) => ({ href: l.href, title: l.label, detail: l.detail! }));

export default async function WebsiteHub() {
  const [{ count: categories }, { count: media }, { count: drafts }, { count: newLeads }] = await Promise.all([
    supabaseAdmin.from('site_categories').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('site_media').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('site_categories').select('id', { count: 'exact', head: true }).is('published', null),
    supabaseAdmin.from('site_leads').select('id', { count: 'exact', head: true }).eq('status', 'new')
  ]);
  return (
    <>
      <h1>Website</h1>
      <p className={s.note}>
        Everything visitors see on the public website. Text saves as a draft while you type; nothing changes on the live site until you press <strong>Publish</strong>.
        Website categories and photos are managed here, separately from the <Link href="/admin/content">PO portal</Link>: adding or removing a photo on one never changes the other.
        Filter options (shapes, sizes, colours) follow the /po catalogue categories each page is linked to.
      </p>
      <div className={s.hubGrid}>
        {SECTIONS.map((x) => (
          <Link key={x.href} href={x.href} className={s.hubCard}>
            <h2>{x.title}{x.href.endsWith('/leads') && newLeads ? <span className={`${s.pill} ${s.pillDraft}`}>{newLeads} new</span> : null}</h2>
            <p>{x.detail}</p>
            <span>Manage →</span>
          </Link>
        ))}
      </div>
      <p className={s.note}>{categories ?? 0} categories · {drafts ?? 0} not yet published · {media ?? 0} images in the library</p>
    </>
  );
}
