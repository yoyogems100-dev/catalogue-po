import type { SupabaseClient } from '@supabase/supabase-js';

// The owner's own code for a colour ("#39" for YOTCF-05), kept in the
// admin-only color_admin_codes table. Admin order screens show it after the
// name -- "YOTCF-05 (#39)" -- and nothing a buyer sees ever does: invoices,
// PDFs, WhatsApp messages and the order's saved colour all use the plain name.
export const ADMIN_COLOR_CODE_MAX = 30;

export function adminColorLabel(name: string, code: string | null | undefined): string {
  const c = (code || '').trim().replace(/^#/, '');
  return c ? `${name} (#${c})` : name;
}

/** "#39 " / " 39" -> "39"; blank -> null. */
export function cleanAdminColorCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.replace(/\s+/g, ' ').trim().replace(/^#\s*/, '');
  return code ? code.slice(0, ADMIN_COLOR_CODE_MAX) : null;
}

/** color id -> code. Empty (not an error) until the table's migration is applied. */
export async function fetchAdminColorCodes(db: SupabaseClient, colorIds: number[]): Promise<Record<number, string>> {
  if (!colorIds.length) return {};
  const { data, error } = await db.from('color_admin_codes').select('color_id, code').in('color_id', colorIds);
  if (error) return {};
  return Object.fromEntries((data || []).map((r: { color_id: number; code: string }) => [r.color_id, r.code]));
}
