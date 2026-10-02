import { after } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { notificationHref, type NotificationType } from './notifications';

type Notice = { type: NotificationType; message: string; orderId?: number | null; link?: string | null };

async function write({ type, message, orderId = null, link = null }: Notice) {
  try {
    const { error } = await supabaseAdmin.from('notifications').insert({ type, order_id: orderId, message, link });
    if (error) console.error('Failed to write admin notification:', error.message);
  } catch (err) {
    console.error('Failed to write admin notification:', err);
  }
}

/**
 * Best-effort: a failed notification insert should never block the customer
 * action that triggered it (placing an order, asking for access...). It runs
 * after the response is sent, through `after`, so the serverless function is
 * kept alive for it instead of the write being dropped once the reply goes out.
 */
export function notifyAdmin(notice: Notice) {
  const row = { ...notice, link: notice.link ?? notificationHref({ type: notice.type, order_id: notice.orderId ?? null, link: null }) };
  try {
    after(() => write(row));
  } catch {
    // Outside a request (scripts, tests): write straight away.
    void write(row);
  }
}
