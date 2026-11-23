import { getSettings } from './settings';
import { supabaseAdmin } from './supabase-admin';
import { getCredentials } from './customer-credentials';
import { decryptForAdmin } from './customer-password';
import {
  ORDER_STAGES_SETTING_KEY, JAIPUR_STAGES_SETTING_KEY, resolveOrderStages, resolveJaipurStages, renderStageMessage,
  orderPageUrl, stageUsesPin, stagesFor, type OrderStage
} from './order-milestones';
import { COURIERS_SETTING_KEY, resolveCouriers } from './couriers';

/** The admin-edited stage names/messages (settings cache, cleared on save). */
export async function getOrderStages(): Promise<OrderStage[]> {
  try {
    const settings = await getSettings();
    return resolveOrderStages(settings[ORDER_STAGES_SETTING_KEY]);
  } catch {
    return resolveOrderStages(null);
  }
}

/** Both stage lists: the usual China route and the Jaipur-dispatch one. */
export async function getStageSets(): Promise<{ china: OrderStage[]; jaipur: OrderStage[] }> {
  try {
    const settings = await getSettings();
    return {
      china: resolveOrderStages(settings[ORDER_STAGES_SETTING_KEY]),
      jaipur: resolveJaipurStages(settings[JAIPUR_STAGES_SETTING_KEY])
    };
  } catch {
    return { china: resolveOrderStages(null), jaipur: resolveJaipurStages(null) };
  }
}

/** The courier names admin can pick from. */
export async function getCouriers(): Promise<string[]> {
  try {
    return resolveCouriers((await getSettings())[COURIERS_SETTING_KEY]);
  } catch {
    return resolveCouriers(null);
  }
}

export type OrderDispatch = { fromJaipur: boolean; courier: string | null };

/**
 * An order's dispatch details. Read with select('*') so this still works --
 * as "China route, no courier" -- before the columns exist in the database.
 */
export async function orderDispatch(orderId: number): Promise<OrderDispatch> {
  const { data } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).maybeSingle();
  return {
    fromJaipur: (data as any)?.dispatch_from_jaipur === true,
    courier: typeof (data as any)?.courier === 'string' && (data as any).courier.trim() ? (data as any).courier.trim() : null
  };
}

/** Which of these orders are Jaipur dispatches (empty if the column isn't there yet). */
export async function jaipurOrderIds(orderIds: number[]): Promise<Set<number>> {
  if (!orderIds.length) return new Set();
  const { data, error } = await supabaseAdmin.from('orders').select('id').in('id', orderIds).eq('dispatch_from_jaipur', true);
  if (error) return new Set();
  return new Set((data || []).map((r: any) => Number(r.id)));
}

/** The stage list one order follows. */
export async function stagesForOrder(orderId: number): Promise<OrderStage[]> {
  const [sets, dispatch] = await Promise.all([getStageSets(), orderDispatch(orderId)]);
  return stagesFor(sets, dispatch.fromJaipur);
}

/** Admin-only: the buyer's current login PIN, or null if none is set. */
export async function customerPin(customerId: number | null | undefined) {
  if (!customerId) return null;
  const creds = await getCredentials(customerId).catch(() => null);
  return decryptForAdmin(creds?.password_enc) || null;
}

/**
 * Admin-only: the WhatsApp text for an order's current stage, with the buyer's
 * login number and PIN filled in. Never call this from a buyer-facing route.
 */
export async function orderStageMessage(orderId: number) {
  const { data: order } = await supabaseAdmin.from('orders').select('id, status, customer_id, pdf_url').eq('id', orderId).maybeSingle();
  if (!order) return null;
  const [{ data: customer }, sets, dispatch, pin] = await Promise.all([
    order.customer_id
      ? supabaseAdmin.from('customers').select('name, phone').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string | null; phone: string | null } | null }),
    getStageSets(),
    orderDispatch(order.id),
    customerPin(order.customer_id)
  ]);
  const stages = stagesFor(sets, dispatch.fromJaipur);
  const text = renderStageMessage(stages, order.status, {
    name: customer?.name,
    order: order.id,
    link: orderPageUrl(order.id),
    login: customer?.phone,
    pin,
    pdf: order.pdf_url,
    courier: dispatch.courier
  });
  return {
    status: order.status as string,
    phone: (customer?.phone as string | null) || null,
    text,
    pinMissing: stageUsesPin(stages, order.status) && !pin
  };
}
