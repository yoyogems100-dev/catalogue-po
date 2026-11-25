// Plain-language money, quantity and date formatting for the Tally portal.

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const INR2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** ₹1,23,456 (rupees, no paise). */
export function rupees(n: number): string {
  const v = Math.round(n || 0);
  return `${v < 0 ? '−' : ''}₹${INR.format(Math.abs(v))}`;
}

/** Short form for tiles and bars: ₹4.2 Cr, ₹12.5 L, ₹8,400. */
export function rupeesShort(n: number): string {
  const a = Math.abs(n || 0);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)} Cr`;
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)} L`;
  return `${sign}₹${INR.format(Math.round(a))}`;
}
const trim = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '');

/** A rate like 0.059 or 150 — keeps small rates readable. */
export function rate(n: number): string {
  if (!n) return '—';
  if (Math.abs(n) < 1) return `₹${n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `₹${INR2.format(n)}`;
}

export function qty(n: number, unit = ''): string {
  const s = Number.isInteger(n) ? INR.format(n) : INR2.format(n);
  return unit ? `${s} ${unit}` : s;
}

/** Sum of quantities in mixed units: "12,000 Pcs + 11.22 Ct". */
export function qtyByUnit(m: Map<string, number>): string {
  const parts = [...m.entries()].filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([u, v]) => qty(v, u));
  return parts.join(' + ') || '—';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-04-01 → 1 Apr 2026 */
export function day(d: string): string {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d || '—';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** 2026-04 → Apr 2026 */
export function month(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ym;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** "today", "3 days ago", "2 months ago". `now` is YYYY-MM-DD. */
export function ago(d: string, now: string): string {
  if (!d) return 'never';
  const n = daysBetween(d, now);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 31) return `${n} days ago`;
  const mo = Math.round(n / 30.4);
  return mo < 12 ? `${mo} month${mo > 1 ? 's' : ''} ago` : `${(n / 365).toFixed(1)} years ago`;
}
