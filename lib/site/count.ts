// Splits an editable figure like "9,000+" or "₹2.5 Cr" into the number to
// count up to and the text around it. Pure, so tested.

export type Count = { prefix: string; target: number; decimals: number; grouped: boolean; suffix: string };

export function parseCount(value: string): Count | null {
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec((value || '').trim());
  if (!m) return null;
  const digits = m[2];
  const target = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;
  return { prefix: m[1], target, decimals: (digits.split('.')[1] || '').length, grouped: digits.includes(','), suffix: m[3] };
}

export function formatCount(c: Count, n: number): string {
  const fixed = n.toFixed(c.decimals);
  const [int, dec] = fixed.split('.');
  // Indian grouping (9,000 / 1,00,000) to match how the owner writes figures.
  const body = c.grouped ? Number(int).toLocaleString('en-IN') : int;
  return `${c.prefix}${body}${dec ? `.${dec}` : ''}${c.suffix}`;
}
