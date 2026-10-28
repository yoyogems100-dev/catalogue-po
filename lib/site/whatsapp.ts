// Kept apart from ./public (which reads the database) so browser code can use it.
export function whatsappHref(number: string, message: string) {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
