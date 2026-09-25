import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadCatalogueMap } from '@/lib/catalogue-map';
import CatalogueMapClient from './CatalogueMapClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function CatalogueMapPage() {
  const [map, { error: materialsError }] = await Promise.all([
    loadCatalogueMap(supabaseAdmin),
    supabaseAdmin.from('materials').select('id').limit(1)
  ]);
  return (
    <>
      <h1>Catalogue map</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 4, maxWidth: 720 }}>
        What goes with what, from any side: which stones come in a colour, which are cut in a size, and which stones belong to each material.
        Changes save as you tick and show on the site within a minute.
      </p>
      <CatalogueMapClient initialMap={map} materialsReady={!materialsError} />
    </>
  );
}
