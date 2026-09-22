import WatermarksClient from './WatermarksClient';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PHOTOS_BUCKET } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function WatermarksPage() {
  const { data } = await supabaseAdmin.from('watermarks').select('*').order('sort_order').order('id');
  const watermarks = (data || []).map((w) => ({
    id: w.id,
    name: w.name,
    opacity: Number(w.opacity),
    text: w.text || null,
    color: w.color || null,
    // Null for a typed watermark -- it is drawn on demand, not stored as a file.
    url: w.storage_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${w.storage_path}` : null
  }));

  return (
    <>
      <h1>Watermarks</h1>
      <p style={{ color: '#756e5c', fontSize: 13, marginBottom: 20 }}>
        Presets for the Watermark control on Category &rarr; Photos, where they can be applied to a whole selection at once.
      </p>
      <WatermarksClient initialWatermarks={watermarks} />
    </>
  );
}
