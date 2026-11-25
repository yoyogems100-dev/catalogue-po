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
        This is the <a href="/po/accessories" target="_blank" rel="noopener">Accessories page</a> as buyers see it. Tap any text to
        change it; tap a category to edit its styles. Hide keeps an item but takes it off the page; Delete removes it from the page and
        this list (restore it from <strong>Deleted</strong>). Nothing changes on the page until you press Save. New categories and photos
        are still added for you by Claude.
      </p>
      <AccessoriesEditor catalogue={ACCESSORIES} initial={parseOverrides(data?.value ?? null)} />
    </>
  );
}
