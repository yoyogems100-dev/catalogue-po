import { supabasePublic } from '@/lib/supabase-public';
import type { CategoryChoice } from './leads';

// The categories a visitor can tick on the Request Catalogue form: the live,
// visible website categories (hidden ones are filtered out by the database's
// read policy), as main categories with their sub-categories.

export type ChoiceGroup = { id: number; slug: string; name: string; children: { id: number; slug: string; name: string }[] };

export async function leadCategoryGroups(): Promise<ChoiceGroup[]> {
  const { data } = await supabasePublic.from('site_categories').select('id, parent_id, slug, name, sort_order').order('sort_order');
  const rows = (data || []) as { id: number; parent_id: number | null; slug: string; name: string }[];
  return rows.filter((r) => r.parent_id === null).map((t) => ({
    id: t.id, slug: t.slug, name: t.name,
    children: rows.filter((c) => c.parent_id === t.id).map((c) => ({ id: c.id, slug: c.slug, name: c.name }))
  }));
}

/** Every tickable category with the name saved on the lead ("CZ › White CZ"). */
export function flattenChoices(groups: ChoiceGroup[]): CategoryChoice[] {
  return groups.flatMap((g) => [{ id: g.id, name: g.name }, ...g.children.map((c) => ({ id: c.id, name: `${g.name} › ${c.name}` }))]);
}
