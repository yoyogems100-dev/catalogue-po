import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanColorInput } from '@/lib/color-input';

// Makes a new shared master colour -- the same row Admin > Colors' "Add"
// makes. Server-only (service role).
//
// `reuseSameName`: the order builder's "+ Add" passes true, so typing "ruby"
// when a shared "Ruby" already exists hands back that colour to link instead
// of failing (or making a near-twin). Admin > Colors keeps its plain
// "already exists" error.
export async function createSharedColor(rawName: unknown, rawHex: unknown, { reuseSameName = false } = {}):
  Promise<{ id: number; name: string; hex_value: string; ref_photo_url: string | null; created: boolean; row?: any } | { error: string; status: number }> {
  const input = cleanColorInput(rawName, rawHex);
  if ('error' in input) return { error: input.error, status: 400 };

  if (reuseSameName) {
    const { data: same } = await supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url')
      .is('owner_category_id', null).ilike('name', input.name.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle();
    if (same) return { id: same.id, name: same.name, hex_value: same.hex_value, ref_photo_url: same.ref_photo_url, created: false };
  }

  const { data, error } = await supabaseAdmin.from('colors').insert({ name: input.name, hex_value: input.hex }).select().single();
  if (error || !data) {
    const message = error?.code === '23505' ? 'A color with this name already exists.' : error?.message || 'Could not add the colour.';
    return { error: message, status: 400 };
  }
  return { id: data.id, name: data.name, hex_value: data.hex_value, ref_photo_url: data.ref_photo_url ?? null, created: true, row: data };
}
