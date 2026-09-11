import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
export const dynamic = 'force-dynamic';
export async function GET() {
  const flags: Record<string, boolean> = {};
  for (let offset = 0; ; offset += 1000) {
    const {data,error} = await supabasePublic.from('hot_selling_options').select('kind, option_id').order('kind').order('option_id').range(offset,offset+999);
    if(error) return NextResponse.json({error:'Hot-selling flags unavailable'}, {status:503});
    for (const row of data || []) flags[`${row.kind}:${row.option_id}`] = true;
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({flags}, {headers:{'Cache-Control':'no-store'}});
}
