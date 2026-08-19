import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { photoUrl } from '@/lib/photos';

// Powers the app's "what's new" section -- recently added categories and photos,
// nothing more. Public, no auth, no new tables (just recency-ordered reads against
// what already exists).
export async function GET() {
  const [{ data: categories }, { data: photos }] = await Promise.all([
    supabasePublic.from('categories').select('id, name, slug, created_at').order('created_at', { ascending: false }).limit(10),
    supabasePublic
      .from('photos')
      .select('id, category_id, storage_path, drive_id, created_at')
      .eq('is_cover_only', false)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  const categoryIds = [...new Set((photos || []).map((p: any) => p.category_id).filter(Boolean))];
  const { data: photoCategories } = categoryIds.length
    ? await supabasePublic.from('categories').select('id, name, slug').in('id', categoryIds)
    : { data: [] };
  const catMap: Record<number, { name: string; slug: string }> = Object.fromEntries(
    (photoCategories || []).map((c: any) => [c.id, { name: c.name, slug: c.slug }])
  );

  const categoriesFormatted = (categories || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    createdAt: c.created_at
  }));

  const photosFormatted = (photos || []).map((p: any) => ({
    id: p.id,
    url: photoUrl(p, 500),
    categoryName: catMap[p.category_id]?.name || null,
    categorySlug: catMap[p.category_id]?.slug || null,
    createdAt: p.created_at
  }));

  return NextResponse.json({ categories: categoriesFormatted, photos: photosFormatted });
}
