import { supabaseAdmin } from './supabase-admin';
import { canOrderForOthers, getCustomerSession } from './customer-auth';
import { customerDisplayName } from './customer-display';

export type AccountState = {
  loggedIn: boolean;
  /** The account in use -- the buyer, while ordering for someone else. */
  customerName: string | null;
  /** May switch to other buyers (customers.can_order_for_others). */
  canSwitch?: boolean;
  /** Set while ordering for someone else: who is really signed in. */
  actingAs?: { selfName: string } | null;
};

// Shared by every page that renders the header account menu (home, category,
// cart, browse) -- was duplicated four times with the same query.
export async function getAccountState(): Promise<AccountState> {
  const session = await getCustomerSession();
  if (!session) return { loggedIn: false, customerName: null };
  const acting = session.actorId !== session.customerId;
  const [{ data }, self, canSwitch] = await Promise.all([
    supabaseAdmin.from('customers').select('name, company').eq('id', session.customerId).maybeSingle(),
    acting ? supabaseAdmin.from('customers').select('name, company').eq('id', session.actorId).maybeSingle() : Promise.resolve({ data: null }),
    canOrderForOthers(session.actorId)
  ]);
  return {
    loggedIn: true,
    customerName: customerDisplayName(data),
    canSwitch,
    actingAs: acting ? { selfName: customerDisplayName(self.data) || 'you' } : null
  };
}
