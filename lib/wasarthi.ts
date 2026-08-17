// Wrapper around Wasarathi's documented template-send API (confirmed 2026-08-17
// from their dashboard's "API Endpoint" page -- this replaced an earlier guess
// built against the generic Meta Cloud API shape, which is why the first live
// test silently failed):
//
//   POST https://wasarathi.com/api/v1/whatsapp/send/template
//   Content-Type: application/x-www-form-urlencoded
//   apiToken=<token>&phone_number_id=<sender id>&template_id=<numeric id>
//   &templateVariable-1-1=<var 1>&templateVariable-2-2=<var 2>&...&phone_number=<recipient>
//
// templateVariable-N-N: only one example (2 variables: -1-1 and -2-2) was
// available, so "repeat the variable's position twice" is inferred, not
// confirmed -- verify against a real send before trusting it beyond 1-2 vars.
//
// Also unconfirmed: the response body shape on success/failure (never seen a
// real response yet). res.ok is checked on HTTP status only; log output should
// be checked after the first real send to tighten this up.
//
// Sending is gated behind WHATSAPP_OTP_ENABLED (defaults to disabled) until the
// env vars below are set and the template IDs are confirmed correct. While
// disabled, this logs what would have been sent.
//
// TO GO LIVE: set WHATSAPP_OTP_ENABLED=true plus WASARTHI_API_TOKEN,
// WASARTHI_PHONE_NUMBER_ID, WASARTHI_OTP_TEMPLATE_ID, WASARTHI_ORDER_STATUS_TEMPLATE_ID
// in Vercel env vars. That's it -- no code change needed.

type SendResult = { ok: boolean; stubbed: boolean; error?: string };
type TemplateConfig = { name: string; id: string | undefined };

const WASARTHI_API_URL = process.env.WASARTHI_API_URL || 'https://wasarathi.com/api/v1/whatsapp/send/template';

export async function sendWhatsAppTemplate(
  phone: string,
  template: TemplateConfig,
  params: string[]
): Promise<SendResult> {
  const digits = phone.replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;

  // WORKAROUND: stub path while WHATSAPP_OTP_ENABLED is unset/false. Logs instead of
  // sending. Flip the env var to switch to real sending -- see note above.
  if (process.env.WHATSAPP_OTP_ENABLED !== 'true') {
    console.log(`[WhatsApp stub] would send template "${template.name}" to ${withCountryCode} with params: ${JSON.stringify(params)}`);
    return { ok: true, stubbed: true };
  }

  const apiToken = process.env.WASARTHI_API_TOKEN;
  const phoneNumberId = process.env.WASARTHI_PHONE_NUMBER_ID;
  if (!apiToken || !phoneNumberId) {
    console.error('WHATSAPP_OTP_ENABLED is true but WASARTHI_API_TOKEN / WASARTHI_PHONE_NUMBER_ID are not set.');
    return { ok: false, stubbed: false, error: 'WhatsApp API not configured' };
  }
  if (!template.id) {
    console.error(`WHATSAPP_OTP_ENABLED is true but no template_id is set for "${template.name}".`);
    return { ok: false, stubbed: false, error: `Missing template_id for ${template.name}` };
  }

  const body = new URLSearchParams({
    apiToken,
    phone_number_id: phoneNumberId,
    template_id: template.id,
    phone_number: withCountryCode
  });
  params.forEach((value, i) => body.append(`templateVariable-${i + 1}-${i + 1}`, value));

  try {
    const res = await fetch(WASARTHI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const responseText = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`WhatsApp send failed (${res.status}): ${responseText}`);
      return { ok: false, stubbed: false, error: `Provider returned ${res.status}` };
    }

    console.log(`WhatsApp send response for "${template.name}" to ${withCountryCode}: ${responseText}`);
    return { ok: true, stubbed: false };
  } catch (err: any) {
    console.error('WhatsApp send threw:', err);
    return { ok: false, stubbed: false, error: err.message || 'Network error' };
  }
}

// Confirmed approved template names (Wasarathi dashboard). template_id must be
// filled in via env var -- the docs example (427303) is a generic illustration,
// not confirmed to be either of these specific templates' real ID.
export const WHATSAPP_TEMPLATES: { otp: TemplateConfig; orderStatus: TemplateConfig } = {
  otp: {
    name: process.env.WASARTHI_OTP_TEMPLATE_NAME || 'yoyo_otp_login',
    id: process.env.WASARTHI_OTP_TEMPLATE_ID
  },
  orderStatus: {
    name: process.env.WASARTHI_ORDER_STATUS_TEMPLATE_NAME || 'yoyo_order_status_update',
    id: process.env.WASARTHI_ORDER_STATUS_TEMPLATE_ID
  }
};
