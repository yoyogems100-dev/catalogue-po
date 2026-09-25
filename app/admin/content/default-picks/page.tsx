import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_PICKS_SETTING_KEY, parseDefaultPreferences } from '@/lib/customer-preferences';
import { COLOR_BUTTONS_SETTING_KEY, parseColorButtons } from '@/lib/color-family';
import DefaultPicksEditor from './DefaultPicksEditor';
import ColorButtonsEditor from './ColorButtonsEditor';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function QuickOrderSetupPage() {
  const [{ data: categories }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').order('num'),
    supabaseAdmin.from('settings').select('key, value').in('key', [DEFAULT_PICKS_SETTING_KEY, COLOR_BUTTONS_SETTING_KEY])
  ]);
  const setting = (key: string) => (settings || []).find((s: { key: string }) => s.key === key)?.value as string | undefined;
  const hint = { fontSize: 13, color: '#756e5c', marginBottom: 18 };
  return (
    <>
      <h1>Quick Order setup</h1>

      <h2 style={{ marginTop: 8, fontSize: 17 }}>1. Colour buttons</h2>
      <p style={hint}>
        The colour buttons buyers can start an order from — on the home page (&ldquo;Order by colour&rdquo;) and at the top of Quick Order.
        Tick the ones to show and use the arrows to set their order. The home page only shows a colour that some category actually carries.
      </p>
      <ColorButtonsEditor initialIds={parseColorButtons(setting(COLOR_BUTTONS_SETTING_KEY))} />

      <h2 style={{ marginTop: 32, fontSize: 17 }}>2. What each colour opens</h2>
      <p style={hint}>
        The stone and quality a colour fills in for every buyer — for example Red opens Ruby Corundum 5A, White opens 5A Quality CZ.
        A buyer&rsquo;s own picks (Customers → the buyer → Usual picks) take priority over these, colour by colour.
      </p>
      <DefaultPicksEditor categories={categories || []} initial={parseDefaultPreferences(setting(DEFAULT_PICKS_SETTING_KEY))} />
    </>
  );
}
