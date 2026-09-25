import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { COLOR_BUTTONS_SETTING_KEY, parseColorButtons } from '@/lib/color-family';
import { DEFAULT_PICKS_SETTING_KEY, mergePreferences, parseDefaultPreferences, sanitizePreferences } from '@/lib/customer-preferences';

// What a colour means when a buyer orders by colour alone: their own usual
// picks, then the shop defaults -- plus which colour buttons to show. Behind the site sign-in like every /api route
// (admins get the defaults only).
export async function GET() {
  const [{ data: settings }, customerId] = await Promise.all([
    supabaseAdmin.from('settings').select('key, value').in('key', [DEFAULT_PICKS_SETTING_KEY, COLOR_BUTTONS_SETTING_KEY]),
    getCustomerId()
  ]);
  const setting = (key: string) => (settings || []).find((s: { key: string }) => s.key === key)?.value as string | undefined;
  let mine: ReturnType<typeof sanitizePreferences> = [];
  if (customerId) {
    const { data: row } = await supabaseAdmin.from('customers').select('*').eq('id', customerId).maybeSingle();
    mine = sanitizePreferences(row?.order_preferences);
  }
  return NextResponse.json({
    preferences: mergePreferences(mine, parseDefaultPreferences(setting(DEFAULT_PICKS_SETTING_KEY))),
    colorButtons: parseColorButtons(setting(COLOR_BUTTONS_SETTING_KEY))
  });
}
