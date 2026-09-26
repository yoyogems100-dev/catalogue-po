import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import s from '@/components/admin/site/site-admin.module.css';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/admin/site/pages', title: 'Pages & settings', detail: 'Home, About, Quality, How to order, Contact, and site-wide contact details, footer and search settings.' },
  { href: '/admin/site/categories', title: 'Categories', detail: 'The 11 website categories and their sub-categories: order, visibility, page text, gallery, filters.' },
  { href: '/admin/site/media', title: 'Images', detail: 'Upload, describe and tag website images. Assign them to categories, colours, shapes and sizes.' },
  { href: '/admin/site/grades', title: 'Grades', detail: 'A, 3A, 5A, 7A, High Density Swiss — names, order and explanations.' },
  { href: '/admin/site/faqs', title: 'FAQ', detail: 'Questions and answers on the FAQ page: add, edit, reorder, hide or delete.' }
];

export default async function WebsiteHub() {
  const [{ count: categories }, { count: media }, { count: drafts }] = await Promise.all([
    supabaseAdmin.from('site_categories').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('site_media').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('site_categories').select('id', { count: 'exact', head: true }).is('published', null)
  ]);
  return (
    <>
      <h1>Website</h1>
      <p className={s.note}>
        Everything visitors see on the public website. Text saves as a draft while you type; nothing changes on the live site until you press <strong>Publish</strong>.
        Shapes, sizes and colours come from your catalogue — manage those under <Link href="/admin/shapes">Shapes</Link> and <Link href="/admin/colors">Colors</Link>.
      </p>
      <div className={s.hubGrid}>
        {SECTIONS.map((x) => (
          <Link key={x.href} href={x.href} className={s.hubCard}>
            <h2>{x.title}</h2>
            <p>{x.detail}</p>
            <span>Manage →</span>
          </Link>
        ))}
      </div>
      <p className={s.note}>{categories ?? 0} categories · {drafts ?? 0} not yet published · {media ?? 0} images in the library</p>
    </>
  );
}
