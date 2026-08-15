export function buildWhatsAppUrl(rawNumber: string, message: string): string {
  const digits = (rawNumber || '').replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}
