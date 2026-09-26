import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_REPLY, type Lead, type ReplySettings } from '@/lib/site/leads';
import s from '@/components/admin/site/site-admin.module.css';
import LeadsClient from './LeadsClient';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const [{ data: leads, error }, { data: reply }] = await Promise.all([
    supabaseAdmin.from('site_leads')
      .select('id, name, business_city, whatsapp, category_names, monthly_requirement, status, notes, source_path, created_at')
      .order('created_at', { ascending: false }).limit(1000),
    supabaseAdmin.from('site_private_settings').select('value').eq('key', 'lead_reply').maybeSingle()
  ]);
  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / Catalogue requests</div>
      <h1>Catalogue requests</h1>
      <p className={s.note}>
        Everyone who filled in the <a href="/request-catalogue" target="_blank" rel="noopener noreferrer">Request Catalogue form ↗</a>, newest first.
        Nothing is sent automatically: tap <strong>Reply on WhatsApp</strong> to open a ready-written message, check it, and send it from your phone.
      </p>
      {error
        ? <p role="alert">Requests could not be loaded. Please refresh.</p>
        : <LeadsClient initial={(leads || []) as Lead[]} reply={{ ...DEFAULT_REPLY, ...((reply?.value as Partial<ReplySettings>) || {}) }} />}
    </>
  );
}
