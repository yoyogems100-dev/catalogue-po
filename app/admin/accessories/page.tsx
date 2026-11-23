import { supabaseAdmin } from '@/lib/supabase-admin';
import { ACCESSORIES, ACCESSORIES_SETTING_KEY, parseOverrides } from '@/lib/accessories/overrides';
import AccessoriesEditor from './AccessoriesEditor';

// See app/admin/categories/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function AccessoriesAdminPage() {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', ACCESSORIES_SETTING_KEY).maybeSingle();
  return (
    <>
      <div className="hs-page-head">
        <h1>Accessories page</h1>
        <div className="acc-head-actions">
          <a className="btn-ghost" href="/api/admin/accessories/export" download>Download Excel</a>
          <a className="btn-ghost" href="/po/accessories" target="_blank" rel="noopener">View page ↗</a>
        </div>
      </div>
      <p className="hs-intro">
        Every range and style on the <a href="/po/accessories" target="_blank" rel="noopener">Accessories page</a>. Search any
        ID, code, name or colour; rename, change codes and descriptions, hide what you don&rsquo;t want shown, mark styles out of
        stock and arrange the ranges. Nothing is deleted: a hidden item comes back with one tap. Changes show on the page as soon as
        you save. New ranges and photos are still added for you by Claude.
      </p>
      <AccessoriesEditor catalogue={ACCESSORIES} initial={parseOverrides(data?.value ?? null)} />
    </>
  );
}
