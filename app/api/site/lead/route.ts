import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readJson } from '@/lib/site/api';
import { checkLead, rateAllows, RATE } from '@/lib/site/leads';
import { flattenChoices, leadCategoryGroups } from '@/lib/site/lead-choices';

// Public endpoint behind the Request Catalogue form. Stores the request for
// the owner to answer by hand from Admin → Website → Leads. It never sends an
// email or a WhatsApp message.

function visitorHash(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  // Salted so the stored value cannot be turned back into an address.
  return createHash('sha256').update(`${process.env.ADMIN_SESSION_SECRET || 'yoyo-site'}:${ip}`).digest('hex').slice(0, 32);
}

const thanks = () => NextResponse.json({ ok: true });

export async function POST(req: NextRequest) {
  const choices = flattenChoices(await leadCategoryGroups());
  const check = checkLead(await readJson(req), choices);
  if ('spam' in check) return thanks();
  if ('error' in check) return NextResponse.json({ error: check.error, field: check.field }, { status: 400 });
  const lead = check.lead;

  const ipHash = visitorHash(req);
  const since = new Date(Date.now() - RATE.windowMinutes * 60_000).toISOString();
  const [mine, all] = await Promise.all([
    supabaseAdmin.from('site_leads').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
    supabaseAdmin.from('site_leads').select('id', { count: 'exact', head: true }).gte('created_at', since)
  ]);
  if (mine.error || all.error) return NextResponse.json({ error: 'We could not save your request just now. Please message us on WhatsApp instead.' }, { status: 503 });
  if (!rateAllows(mine.count ?? 0, all.count ?? 0)) {
    return NextResponse.json({ error: 'We have received a lot of requests just now. Please message us on WhatsApp instead.' }, { status: 429 });
  }

  // The same number sending again within a day updates its open request
  // rather than adding a second one.
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: open } = await supabaseAdmin.from('site_leads')
    .select('id, category_ids, category_names').eq('whatsapp', lead.whatsapp).eq('status', 'new').gte('created_at', dayAgo)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  const { error } = open
    ? await supabaseAdmin.from('site_leads').update({
        name: lead.name, business_city: lead.business_city,
        category_ids: [...new Set([...(open.category_ids || []), ...lead.category_ids])],
        category_names: [...new Set([...(open.category_names || []), ...lead.category_names])],
        monthly_requirement: lead.monthly_requirement || undefined,
        updated_at: new Date().toISOString()
      }).eq('id', open.id)
    : await supabaseAdmin.from('site_leads').insert({ ...lead, ip_hash: ipHash });
  if (error) {
    console.error('Lead save failed:', error.message);
    return NextResponse.json({ error: 'We could not save your request just now. Please message us on WhatsApp instead.' }, { status: 503 });
  }
  return thanks();
}
