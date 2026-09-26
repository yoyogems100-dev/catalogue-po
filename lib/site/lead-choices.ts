import { supabasePublic } from '@/lib/supabase-public';
import type { CategoryChoice } from './leads';
import { getCategoryImages } from './category-images-data';

// The categories a visitor can tick on the Request Catalogue form: the live,
// visible website categories (hidden ones are filtered out by the database's
// read policy), as main categories with their sub-categories.

type Pic = { src: string; cutout?: boolean } | null;
export type ChoiceGroup = { id: number; slug: string; name: string; image: Pic; children: { id: number; slug: string; name: string; image: Pic }[] };

export async function leadCategoryGroups(): Promise<ChoiceGroup[]> {
  const [{ data }, images] = await Promise.all([
    supabasePublic.from('site_categories').select('id, parent_id, slug, name, sort_order').order('sort_order'),
    getCategoryImages()
  ]);
  const pic = (id: number): Pic => (images[id] ? { src: images[id].src, cutout: images[id].cutout } : null);
  const rows = (data || []) as { id: number; parent_id: number | null; slug: string; name: string }[];
  return rows.filter((r) => r.parent_id === null).map((t) => ({
    id: t.id, slug: t.slug, name: t.name, image: pic(t.id),
    children: rows.filter((c) => c.parent_id === t.id).map((c) => ({ id: c.id, slug: c.slug, name: c.name, image: pic(c.id) }))
  }));
}

/** Every tickable category with the name saved on the lead ("CZ › White CZ"). */
export function flattenChoices(groups: ChoiceGroup[]): CategoryChoice[] {
  return groups.flatMap((g) => [{ id: g.id, name: g.name }, ...g.children.map((c) => ({ id: c.id, name: `${g.name} › ${c.name}` }))]);
}
