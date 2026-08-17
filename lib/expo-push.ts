import { supabaseAdmin } from '@/lib/supabase-admin';

// Expo's push service -- free, no Firebase/APNs setup needed on our side, Expo
// handles routing to Android/iOS. No access token required for basic sending.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Best-effort: failures here should never block or fail the caller's real action
// (e.g. an admin status update). Push is a nice-to-have, not a critical path.
export async function sendPushToCustomer(customerId: number, title: string, body: string, data?: Record<string, any>) {
  try {
    const { data: tokens } = await supabaseAdmin.from('push_tokens').select('expo_push_token').eq('customer_id', customerId);
    if (!tokens || tokens.length === 0) return { ok: true, sent: 0 };

    const messages = tokens.map((t: any) => ({
      to: t.expo_push_token,
      sound: 'default',
      title,
      body,
      data: data || {}
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages)
    });

    if (!res.ok) {
      console.error(`Expo push send failed (${res.status}): ${await res.text().catch(() => '')}`);
      return { ok: false, sent: 0 };
    }

    return { ok: true, sent: messages.length };
  } catch (err: any) {
    console.error('Expo push send threw:', err);
    return { ok: false, sent: 0 };
  }
}
