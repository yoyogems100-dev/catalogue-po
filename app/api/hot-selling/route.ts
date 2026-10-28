import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { cachedCatalogue, SHARED_JSON_CACHE } from '@/lib/catalogue-cache';

// Same for every buyer: cached, and expired by every admin save (including a
// flame toggle). Admin's editor asks with ?fresh=1 so the CDN never serves it
// a copy from before its own change.
const loadFlags = cachedCatalogue(async (): Promise<Record<string, boolean> | null> => {
  const flags: Record<string, boolean> = {};
  for (let offset = 0; ; offset += 1000) {
    const {data,error} = await supabasePublic.from('hot_selling_options').select('category_id, kind, option_id').order('category_id').order('kind').order('option_id').range(offset,offset+999);
    if(error) throw error;
    for (const row of data || []) flags[`${row.category_id}:${row.kind}:${row.option_id}`] = true;
    if (!data || data.length < 1000) break;
  }
  return flags;
}, ['hot-selling-flags']);

export async function GET(req: NextRequest) {
  const flags = await loadFlags().catch(() => null);
  if (!flags) return NextResponse.json({error:'Hot-selling flags unavailable'}, {status:503});
  const fresh = req.nextUrl.searchParams.has('fresh');
  return NextResponse.json({flags}, {headers:{'Cache-Control': fresh ? 'no-store' : SHARED_JSON_CACHE}});
}
