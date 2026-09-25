import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { requireAdmin } from '@/lib/site/api';
import { LEAD_STATUSES, leadsCsv, type Lead } from '@/lib/site/leads';

/** Every catalogue request (or one status) as a CSV for Excel / Google Sheets. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const status = req.nextUrl.searchParams.get('status');
  const only = LEAD_STATUSES.find((s) => s === status);
  const { data, error } = await fetchAllRows<Lead>((f, t) => {
    let q = supabaseAdmin.from('site_leads')
      .select('id, name, business_city, whatsapp, category_names, monthly_requirement, status, notes, source_path, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (only) q = q.eq('status', only);
    return q.range(f, t);
  });
  if (error) return NextResponse.json({ error: 'Could not export right now.' }, { status: 500 });
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return new NextResponse(leadsCsv(data || []), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yoyo-catalogue-requests${only ? `-${only}` : ''}-${day}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
