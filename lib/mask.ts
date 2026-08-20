// UI/UX audit (Critical -- "Customer data is overexposed"): admin order
// lists showed full phone numbers even when just scanning for a specific
// order, not actually contacting the customer. Masks to the last 4 digits
// -- enough to recognize a repeat customer, not enough to read off/misuse
// from a screen-share or over someone's shoulder.
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  const last4 = digits.slice(-4);
  return `••••••${last4}`;
}
