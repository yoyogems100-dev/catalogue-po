import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Admin-set short codes (HS, OS...) for the shapes in an order, used by the
 * WhatsApp message. A lookup failure just leaves the full names in place --
 * the order itself must never fail over a label.
 */
export async function withShapeCodes<T extends { shapeId: number }>(cart: T[]): Promise<(T & { shapeCode: string | null })[]> {
  const ids = [...new Set(cart.map((i) => i.shapeId))];
  const { data, error } = ids.length
    ? await supabaseAdmin.from('shapes').select('id, short_code').in('id', ids)
    : { data: [], error: null };
  const codeOf = new Map<number, string>();
  if (!error) for (const row of (data || []) as { id: number; short_code: string | null }[]) {
    if (row.short_code?.trim()) codeOf.set(row.id, row.short_code.trim());
  }
  return cart.map((item) => ({ ...item, shapeCode: codeOf.get(item.shapeId) ?? null }));
}
