import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadCatalogueMap } from '@/lib/catalogue-map';
import { COLOR_BUTTONS_SETTING_KEY, parseColorButtons } from '@/lib/color-family';
import { DEFAULT_PICKS_SETTING_KEY, parseDefaultPreferences } from '@/lib/customer-preferences';
import CatalogueMapClient, { type Tab } from './CatalogueMapClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

const TABS: Tab[] = ['buttons', 'colour', 'size', 'materials', 'preview'];

export default async function CatalogueMapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [map, { error: materialsError }, { data: settings }] = await Promise.all([
    loadCatalogueMap(supabaseAdmin),
    supabaseAdmin.from('materials').select('id').limit(1),
    supabaseAdmin.from('settings').select('key, value').in('key', [COLOR_BUTTONS_SETTING_KEY, DEFAULT_PICKS_SETTING_KEY])
  ]);
  const setting = (key: string) => (settings || []).find((s: { key: string }) => s.key === key)?.value as string | undefined;
  return (
    <>
      <h1>Catalogue map</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 4, maxWidth: 720 }}>
        What goes with what, from any side: the colour buttons buyers start from, which stones come in a colour, which are cut in a size,
        and which stones belong to each material.
      </p>
      <CatalogueMapClient
        initialMap={map}
        materialsReady={!materialsError}
        initialTab={TABS.includes(tab as Tab) ? (tab as Tab) : 'buttons'}
        shopButtons={parseColorButtons(setting(COLOR_BUTTONS_SETTING_KEY))}
        shopPicks={parseDefaultPreferences(setting(DEFAULT_PICKS_SETTING_KEY))}
      />
    </>
  );
}
