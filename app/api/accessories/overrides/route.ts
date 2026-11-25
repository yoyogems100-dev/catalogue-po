import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { ACCESSORIES_SETTING_KEY, parseOverrides, serializeOverrides } from '@/lib/accessories/overrides';

export const dynamic = 'force-dynamic';

// The Accessories page loads this as a plain <script> before its own, so the
// owner's edits (hidden ranges and styles, new names, order, out of stock) are
// in place before anything is drawn. If it fails, the page simply shows
// everything as built.
export async function GET() {
  const { data } = await supabasePublic.from('settings').select('value').eq('key', ACCESSORIES_SETTING_KEY).maybeSingle();
  const json = serializeOverrides(parseOverrides(data?.value ?? null)).replace(/</g, '\\u003c');
  return new NextResponse(`window.ACC_OV=${json};\n`, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
