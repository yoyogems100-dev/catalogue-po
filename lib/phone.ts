// One canonical form for a phone number, so the same person is the same
// customer however they type it.
//
// Identity previously used `phone.replace(/\D/g, '')`, which made
// "9079914601", "+91 90799 14601" and "09079914601" three different customers:
// signing in with a different form of your own number produced a new, empty
// account, and the orders and profile on the old one were invisible.
//
// Indian mobile numbers are normalised to their 10-digit national form, which
// is what every customer row already stores. Anything else keeps its full digit
// string, so an international number is still matched consistently against
// itself -- this deliberately does not try to be a general E.164 parser.

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function normalizePhone(input: string | null | undefined): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';

  // Already the 10-digit national number.
  if (INDIAN_MOBILE.test(digits)) return digits;

  // Strip an Indian country code (+91 / 0091) or a trunk prefix (0), but only
  // when what remains is a valid Indian mobile -- so a genuine 10-digit number
  // that happens to start "91" is never truncated.
  for (const prefix of ['0091', '91', '0']) {
    if (digits.startsWith(prefix)) {
      const rest = digits.slice(prefix.length);
      if (INDIAN_MOBILE.test(rest)) return rest;
    }
  }

  return digits;
}

/** A number we are willing to treat as contactable. */
export function isUsablePhone(input: string | null | undefined): boolean {
  return normalizePhone(input).length >= 10;
}
