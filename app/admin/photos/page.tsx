import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import PhotoUploadClient from './PhotoUploadClient';

export const dynamic = 'force-dynamic';

// Upload photos without first navigating into a category, tagging a whole
// batch as it lands. Anything left blank -- the category included -- is filled
// in later: an uncategorised photo waits in the Unassigned inbox below rather
// than blocking the upload on a decision nobody has made yet.
export default async function AdminPhotosPage() {
  const [{ data: categories }, { data: unassigned }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name, slug').order('name'),
    supabaseAdmin
      .from('photos')
      .select('*, photo_tags(tag_id), photo_shapes(shape_id), photo_sizes(shape_size_id), photo_colors(color_id)')
      .is('category_id', null)
      .order('id', { ascending: false })
  ]);

  const inbox = (unassigned || []).map((p: any) => ({
    id: p.id,
    url: photoUrl(p, 400),
    productCode: p.product_code || null,
    shapeIds: (p.photo_shapes || []).map((r: any) => r.shape_id),
    sizeIds: (p.photo_sizes || []).map((r: any) => r.shape_size_id),
    colorIds: (p.photo_colors || []).map((r: any) => r.color_id),
    tagIds: (p.photo_tags || []).map((r: any) => r.tag_id),
    parentPhotoId: p.parent_photo_id ?? null
  }));

  return (
    <>
      <h1>Upload photos</h1>
      <p style={{ color: '#756e5c', fontSize: 13, marginBottom: 20 }}>
        Tag a whole batch once as it uploads, then correct any single photo below. A photo needs no category to be
        uploaded &mdash; leave it unassigned and give it one here whenever you know it.
      </p>
      <PhotoUploadClient
        categories={(categories || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))}
        inbox={inbox}
      />
    </>
  );
}
