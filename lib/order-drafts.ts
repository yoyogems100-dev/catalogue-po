import { supabaseAdmin } from '@/lib/supabase-admin';
import { maskPhone } from '@/lib/mask';

// Draft orders (Admin > New order > "Save as draft"). Server-only helpers.
//
// Drafts live in their own table (supabase/migrations/20261125090000_order_drafts.sql)
// so they never reach an order list, count, queue, the buyer's My orders,
// notifications or WhatsApp. Until that migration is applied the table is
// missing: every helper here then reports DRAFTS_UNAVAILABLE instead of
// throwing, and the rest of the order screen keeps working.

export const DRAFTS_UNAVAILABLE = 'Draft orders need a one-time database update before they can be saved. The order itself can still be created.';

/** Postgres "undefined table", or PostgREST's "table not in the schema cache". */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /order_drafts/.test(error.message || '') && /does not exist|schema cache|not find/i.test(error.message || '');
}

export type DraftSummary = {
  id: number;
  customerId: number | null;
  customerLabel: string;
  lineCount: number;
  pieces: number;
  categories: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** What the drafts list shows for one draft, from its saved payload. */
export function summarizeDraft(row: { id: number; customer_id: number | null; payload: any; created_at: string; updated_at: string }, customerName?: string | null): DraftSummary {
  const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const cart: any[] = Array.isArray(p.cart) ? p.cart : [];
  const newCustomer = p.customerMode === 'new' ? [String(p.newName || '').trim(), String(p.newPhone || '').trim() ? maskPhone(String(p.newPhone).trim()) : ''].filter(Boolean).join(' · ') : '';
  return {
    id: row.id,
    customerId: row.customer_id,
    customerLabel: customerName?.trim() || (newCustomer ? `New: ${newCustomer}` : 'No customer yet'),
    lineCount: cart.length,
    pieces: cart.reduce((n, l) => n + (Number(l?.qty) || 0), 0),
    categories: [...new Set(cart.map((l) => String(l?.categoryName || '')).filter(Boolean))],
    note: String(p.comment || '').trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Every draft, newest edit first, or `null` when the table isn't there yet. */
export async function listOrderDrafts(): Promise<DraftSummary[] | null> {
  const { data, error } = await supabaseAdmin.from('order_drafts').select('id, customer_id, payload, created_at, updated_at').order('updated_at', { ascending: false }).limit(500);
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(error.message);
  }
  const ids = [...new Set((data || []).map((d: any) => d.customer_id).filter(Boolean))];
  const { data: customers } = ids.length
    ? await supabaseAdmin.from('customers').select('id, name, company').in('id', ids)
    : { data: [] as any[] };
  const nameOf = new Map((customers || []).map((c: any) => [c.id, c.name?.trim() || c.company?.trim() || null]));
  return (data || []).map((row: any) => summarizeDraft(row, nameOf.get(row.customer_id)));
}

/** How many drafts there are; 0 when the table isn't there yet. */
export async function countOrderDrafts(): Promise<number> {
  const { count, error } = await supabaseAdmin.from('order_drafts').select('id', { count: 'exact', head: true });
  return error ? 0 : count || 0;
}

export async function deleteOrderDraft(id: number): Promise<void> {
  // Best effort: an order that was placed is never undone over a leftover draft.
  await supabaseAdmin.from('order_drafts').delete().eq('id', id);
}
