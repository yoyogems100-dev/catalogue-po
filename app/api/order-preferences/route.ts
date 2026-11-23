import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { COLOR_BUTTONS_SETTING_KEY, COLOR_NAMES_SETTING_KEY, parseColorButtons, parseColorNames, sanitizeColorButtons } from '@/lib/color-family';
import { QUALITIES_SETTING_KEY, SHAPE_QUALITIES_SETTING_KEY, parseCategoryQualities, parseShapeQualities } from '@/lib/qualities';
import { sanitizeInterestIds } from '@/lib/customer-interests';
import { getLastOrder } from '@/lib/last-order-server';
import { EMPTY_LAST_ORDER } from '@/lib/usual-picks';
import { DEFAULT_PICKS_SETTING_KEY, mergePreferences, parseDefaultPreferences, sanitizePreferences } from '@/lib/customer-preferences';

// What a colour means when a buyer orders by colour alone -- their own usual
// picks, then the shop defaults -- and which colour buttons they see: their
// own list if the team set one, else the shop's. Behind the site sign-in like
// every /api route (admins get the shop settings only).
export async function GET() {
  const [{ data: settings }, customerId] = await Promise.all([
    supabaseAdmin.from('settings').select('key, value').in('key', [DEFAULT_PICKS_SETTING_KEY, COLOR_BUTTONS_SETTING_KEY, COLOR_NAMES_SETTING_KEY, QUALITIES_SETTING_KEY]),
    getCustomerId()
  ]);
  const setting = (key: string) => (settings || []).find((s: { key: string }) => s.key === key)?.value as string | undefined;
  let mine: ReturnType<typeof sanitizePreferences> = [];
  let myButtons: number[] | null = null;
  let myCategoryIds: number[] = [];
  let lastOrder = EMPTY_LAST_ORDER;
  if (customerId) {
    const [{ data: row }, last] = await Promise.all([
      supabaseAdmin.from('customers').select('*').eq('id', customerId).maybeSingle(),
      getLastOrder(customerId)
    ]);
    lastOrder = last;
    mine = sanitizePreferences(row?.order_preferences);
    myButtons = sanitizeColorButtons(row?.color_buttons);
    myCategoryIds = sanitizeInterestIds(row?.interest_category_ids);
  }
  return NextResponse.json({
    preferences: mergePreferences(mine, parseDefaultPreferences(setting(DEFAULT_PICKS_SETTING_KEY))),
    // Only the buyer's own picks: Quick Order opens a stone for a colour only
    // when the team mapped one for this buyer (owner, 2026-11-03).
    myPreferences: mine,
    // The buyer's go-to categories (admin customer page), listed first in
    // every stone dropdown along with the stones their usual picks open.
    myCategoryIds,
    // What they ordered last: those stones, and per stone its latest lines,
    // listed next in each dropdown ("Your last order").
    lastOrder,
    colorButtons: myButtons ?? parseColorButtons(setting(COLOR_BUTTONS_SETTING_KEY)),
    colorNames: parseColorNames(setting(COLOR_NAMES_SETTING_KEY)),
    // Which qualities each stone offers, so Quick Order can ask for one.
    qualities: parseCategoryQualities(setting(QUALITIES_SETTING_KEY)),
    shapeQualities: parseShapeQualities(setting(SHAPE_QUALITIES_SETTING_KEY))
  });
}
