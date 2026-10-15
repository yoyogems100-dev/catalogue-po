import { fetchAllRows } from './fetch-all-rows';

// Photos and drawings already in the catalogue, offered wherever a shape or
// colour gets one ("Choose from existing") so the same picture isn't
// uploaded twice. A picked photo is only ever one of these: the server
// checks it against this list before saving.

export type ReusePhoto = { url: string; label: string; hex?: string | null };
export type ReuseOptions = { shapePhotos: ReusePhoto[]; colourPhotos: ReusePhoto[]; drawings: Record<string, string[]> };

export async function loadReuseOptions(database: any): Promise<ReuseOptions> {
  const [shapes, links, colours] = await Promise.all([
    fetchAllRows<{ id: number; name: string; icon_key: string | null; ref_photo_url: string | null }>((from, to) =>
      database.from('shapes').select('id, name, icon_key, ref_photo_url', { count: 'exact' }).order('sort_order').range(from, to)),
    fetchAllRows<{ shape_id: number; ref_photo_url: string | null; categories: { name: string } | null }>((from, to) =>
      database.from('category_shapes').select('shape_id, ref_photo_url, categories(name)', { count: 'exact' }).not('ref_photo_url', 'is', null).range(from, to)),
    fetchAllRows<{ name: string; hex_value: string | null; ref_photo_url: string | null }>((from, to) =>
      database.from('colors').select('name, hex_value, ref_photo_url', { count: 'exact' }).not('ref_photo_url', 'is', null).order('sort_order').order('name').range(from, to))
  ]);
  if (shapes.error || links.error || colours.error) throw new Error('Could not load the catalogue photos.');

  const shapePhotos: ReusePhoto[] = [];
  const seen = new Set<string>();
  const add = (list: ReusePhoto[], photo: ReusePhoto) => { if (!seen.has(photo.url)) { seen.add(photo.url); list.push(photo); } };
  const nameOf = new Map((shapes.data || []).map((s) => [s.id, s.name]));
  for (const s of shapes.data || []) if (s.ref_photo_url) add(shapePhotos, { url: s.ref_photo_url, label: s.name });
  for (const l of links.data || []) if (l.ref_photo_url) add(shapePhotos, { url: l.ref_photo_url, label: `${nameOf.get(l.shape_id) || 'Shape'} · ${l.categories?.name || 'category'}` });
  const colourPhotos: ReusePhoto[] = [];
  for (const c of colours.data || []) if (c.ref_photo_url) add(colourPhotos, { url: c.ref_photo_url, label: c.name, hex: c.hex_value });

  const drawings: Record<string, string[]> = {};
  for (const s of shapes.data || []) if (s.icon_key) (drawings[s.icon_key] ||= []).push(s.name);
  return { shapePhotos, colourPhotos, drawings };
}

/** A photo can be reused only if the catalogue already has it. */
export async function isExistingPhoto(database: any, kind: 'shape' | 'colour', url: unknown): Promise<boolean> {
  if (typeof url !== 'string' || !url || url.length > 1000) return false;
  const checks = kind === 'colour'
    ? [database.from('colors').select('id').eq('ref_photo_url', url).limit(1)]
    : [database.from('shapes').select('id').eq('ref_photo_url', url).limit(1), database.from('category_shapes').select('shape_id').eq('ref_photo_url', url).limit(1)];
  const results = await Promise.all(checks);
  return results.some((r: any) => !r.error && (r.data || []).length > 0);
}
