import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import s from '@/components/admin/site/site-admin.module.css';
import FaqsClient from './FaqsClient';

export const dynamic = 'force-dynamic';

export default async function FaqsPage() {
  const { data } = await supabaseAdmin.from('site_faqs').select('id, question, answer, sort_order, is_visible').order('sort_order').order('id');
  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / FAQ</div>
      <h1>FAQ</h1>
      <p className={s.note}>
        Questions show on the <a href="/faq" target="_blank" rel="noopener noreferrer">FAQ page ↗</a> in this order, and Google can show them as answers in search.
        Changes go live as soon as you save. The page heading and intro are under <Link href="/admin/site/pages/faq">Pages → FAQ page</Link>.
      </p>
      <FaqsClient initial={data || []} />
    </>
  );
}
