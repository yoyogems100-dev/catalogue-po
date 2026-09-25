import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { DEFAULT_PICKS_SETTING_KEY, mergePreferences, parseDefaultPreferences, sanitizePreferences } from '@/lib/customer-preferences';

// What a colour means when a buyer orders by colour alone: their own usual
// picks, then the shop defaults. Behind the site sign-in like every /api route
// (admins get the defaults only).
export async function GET() {
  const [{ data: setting }, customerId] = await Promise.all([
    supabaseAdmin.from('settings').select('value').eq('key', DEFAULT_PICKS_SETTING_KEY).maybeSingle(),
    getCustomerId()
  ]);
  let mine: ReturnType<typeof sanitizePreferences> = [];
  if (customerId) {
    const { data: row } = await supabaseAdmin.from('customers').select('*').eq('id', customerId).maybeSingle();
    mine = sanitizePreferences(row?.order_preferences);
  }
  return NextResponse.json({ preferences: mergePreferences(mine, parseDefaultPreferences(setting?.value)) });
}
