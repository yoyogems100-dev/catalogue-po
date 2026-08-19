import { supabaseAdmin } from './supabase-admin';

// Best-effort: a failed notification insert should never block the customer
// action that triggered it (placing/editing an order).
export async function notifyAdmin(type: 'new_order' | 'order_modified', orderId: number, message: string) {
  try {
    await supabaseAdmin.from('notifications').insert({ type, order_id: orderId, message });
  } catch (err) {
    console.error('Failed to write admin notification:', err);
  }
}
