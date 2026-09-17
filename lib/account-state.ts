import { supabaseAdmin } from './supabase-admin';
import { getCustomerId } from './customer-auth';
import { customerDisplayName } from './customer-display';

// Shared by every page that renders the header account menu (home, category,
// cart, browse) -- was duplicated four times with the same query.
export async function getAccountState(): Promise<{ loggedIn: boolean; customerName: string | null }> {
  const customerId = await getCustomerId();
  if (!customerId) return { loggedIn: false, customerName: null };
  const { data } = await supabaseAdmin.from('customers').select('name, company').eq('id', customerId).maybeSingle();
  return { loggedIn: true, customerName: customerDisplayName(data) };
}
