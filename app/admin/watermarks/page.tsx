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
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${w.storage_path}`
  }));

  return (
    <>
      <h1>Watermarks</h1>
      <p style={{ color: '#756e5c', fontSize: 13, marginBottom: 20 }}>
        Manage the watermark presets available when adding a watermark to a photo (Category &rarr; Photos &rarr; Watermark). Each preset has its own transparency.
      </p>
      <WatermarksClient initialWatermarks={watermarks} />
    </>
  );
}
