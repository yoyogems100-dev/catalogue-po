// Wrapper around WaSarathi / Clixrio (white-label Meta WhatsApp Business Cloud API).
// Dashboard: dash.clixrio.com. Sender number: +91 88247 92650.
//
// Business-initiated messages require pre-approved templates on the Meta Cloud API,
// so this always sends a template message, never free-form text.
//
// NOTE: built against the standard Meta Cloud API template-message request shape,
// since Clixrio's exact request/auth format hasn't been confirmed yet. Verify
// against a real Clixrio API example before trusting this against production
// traffic -- the URL path and auth header may need adjusting.
//
// Sending is gated behind WHATSAPP_OTP_ENABLED (defaults to disabled) until
// WASARTHI_API_URL / WASARTHI_API_KEY are confirmed set and the templates below
// are confirmed approved. While disabled, this logs what would have been sent.
//
// TO GO LIVE: set WHATSAPP_OTP_ENABLED=true (plus WASARTHI_API_URL / WASARTHI_API_KEY)
// in Vercel env vars. That's it -- no code change needed, the stub branch below just
// stops being reached. Nothing here needs deleting once it's confirmed working; it's
// dead code at that point but harmless to leave.

type SendResult = { ok: boolean; stubbed: boolean; error?: string };

export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  params: string[],
  languageCode = 'en_US'
): Promise<SendResult> {
  const digits = phone.replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;

  // WORKAROUND: stub path while WHATSAPP_OTP_ENABLED is unset/false. Logs instead of
  // sending. Flip the env var to switch to real sending -- see note above.
  if (process.env.WHATSAPP_OTP_ENABLED !== 'true') {
    console.log(`[WhatsApp stub] would send template "${templateName}" to ${withCountryCode} with params: ${JSON.stringify(params)}`);
    return { ok: true, stubbed: true };
  }

  const apiUrl = process.env.WASARTHI_API_URL;
  const apiKey = process.env.WASARTHI_API_KEY;
  if (!apiUrl || !apiKey) {
    console.error('WHATSAPP_OTP_ENABLED is true but WASARTHI_API_URL / WASARTHI_API_KEY are not set.');
    return { ok: false, stubbed: false, error: 'WhatsApp API not configured' };
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: withCountryCode,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: params.map((text) => ({ type: 'text', text }))
            }
          ]
        }
      })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`WhatsApp send failed (${res.status}): ${body}`);
      return { ok: false, stubbed: false, error: `Provider returned ${res.status}` };
    }

    return { ok: true, stubbed: false };
  } catch (err: any) {
    console.error('WhatsApp send threw:', err);
    return { ok: false, stubbed: false, error: err.message || 'Network error' };
  }
}

// Confirmed approved template names (Clixrio dashboard). Env var override is kept
// only in case a name ever needs to change without a redeploy.
export const WHATSAPP_TEMPLATES = {
  otp: process.env.WASARTHI_OTP_TEMPLATE_NAME || 'yoyo_otp_login',
  orderStatus: process.env.WASARTHI_ORDER_STATUS_TEMPLATE_NAME || 'yoyo_order_status_update'
};
