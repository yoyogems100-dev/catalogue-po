import { getSettings } from './settings';
import { supabaseAdmin } from './supabase-admin';
import { getCredentials } from './customer-credentials';
import { decryptForAdmin } from './customer-password';
import {
  ORDER_STAGES_SETTING_KEY, resolveOrderStages, renderStageMessage, orderPageUrl, stageUsesPin, type OrderStage
} from './order-milestones';

/** The admin-edited stage names/messages (settings cache, cleared on save). */
export async function getOrderStages(): Promise<OrderStage[]> {
  try {
    const settings = await getSettings();
    return resolveOrderStages(settings[ORDER_STAGES_SETTING_KEY]);
  } catch {
    return resolveOrderStages(null);
  }
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
  const [{ data: customer }, stages, pin] = await Promise.all([
    order.customer_id
      ? supabaseAdmin.from('customers').select('name, phone').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string | null; phone: string | null } | null }),
    getOrderStages(),
    customerPin(order.customer_id)
  ]);
  const text = renderStageMessage(stages, order.status, {
    name: customer?.name,
    order: order.id,
    link: orderPageUrl(order.id),
    login: customer?.phone,
    pin,
    pdf: order.pdf_url
  });
  return {
    status: order.status as string,
    phone: (customer?.phone as string | null) || null,
    text,
    pinMissing: stageUsesPin(stages, order.status) && !pin
  };
}
