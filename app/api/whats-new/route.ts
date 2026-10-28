import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { photoUrl } from '@/lib/photos';
import { cachedCatalogue, SHARED_JSON_CACHE } from '@/lib/catalogue-cache';

// Powers the app's "what's new" section -- recently added categories and photos,
// nothing more. Public, no auth, no new tables (just recency-ordered reads against
// what already exists). The same for everyone, so cached until the next admin save.
const load = cachedCatalogue(async () => {
  const [{ data: categories }, { data: photos }] = await Promise.all([
    supabasePublic.from('categories').select('id, name, slug, created_at').order('created_at', { ascending: false }).limit(10),
    supabasePublic
      .from('photos')
      .select('*')
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

  // Photos of an archived category are hidden with it: it is absent from
  // catMap because the public read policy skips archived categories.
  const photosFormatted = (photos || []).filter((p: any) => catMap[p.category_id]).map((p: any) => ({
    id: p.id,
    url: photoUrl(p, 500),
    categoryName: catMap[p.category_id]?.name || null,
    categorySlug: catMap[p.category_id]?.slug || null,
    createdAt: p.created_at
  }));

  return { categories: categoriesFormatted, photos: photosFormatted };
}, ['whats-new']);

export async function GET() {
  return NextResponse.json(await load(), { headers: { 'Cache-Control': SHARED_JSON_CACHE } });
}
