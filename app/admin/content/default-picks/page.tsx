import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_PICKS_SETTING_KEY, parseDefaultPreferences } from '@/lib/customer-preferences';
import DefaultPicksEditor from './DefaultPicksEditor';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function DefaultPicksPage() {
  const [{ data: categories }, { data: setting }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').order('num'),
    supabaseAdmin.from('settings').select('value').eq('key', DEFAULT_PICKS_SETTING_KEY).maybeSingle()
  ]);
  return (
    <>
      <h1>Default colour picks</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 18 }}>
        What a colour means for every buyer when they order by colour alone — for example Red means Ruby Corundum 5A.
        A buyer&rsquo;s own usual picks (on their customer page) take priority over these.
      </p>
      <DefaultPicksEditor categories={categories || []} initial={parseDefaultPreferences(setting?.value)} />
    </>
  );
}
