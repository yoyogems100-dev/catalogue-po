import { supabaseAdmin } from '@/lib/supabase-admin';
import { MOST_ORDERED_SETTING_KEY, parseMostOrdered } from '@/lib/most-ordered';
import MostOrderedEditor from './MostOrderedEditor';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function MostOrderedPage() {
  const [{ data: categories }, { data: setting }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').order('num'),
    supabaseAdmin.from('settings').select('value').eq('key', MOST_ORDERED_SETTING_KEY).maybeSingle()
  ]);
  return (
    <>
      <h1>Most ordered categories</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 18 }}>
        These appear first on the catalogue home page under &ldquo;Most ordered&rdquo;, in this order. Every other
        category follows below under &ldquo;More categories&rdquo;.
      </p>
      <MostOrderedEditor categories={categories || []} initialIds={parseMostOrdered(setting?.value)} />
    </>
  );
}
