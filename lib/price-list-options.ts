/**
 * What the admin types in the "Download price list" dialog: who the copy is
 * for, the date to print, and any prices changed just for that customer.
 * None of it is saved -- the stored prices stay the list's starting point.
 * Pure and shared by the dialog and the PDF route.
 */

export const CUSTOMER_NAME_MAX = 80;

export type PriceListOptions = {
  customerName: string | null;
  /** YYYY-MM-DD. */
  date: string;
  /** One row per grid row, one price per column; null prints "–". */
  prices: (number | null)[][] | null;
};

/** Today in India as YYYY-MM-DD, whatever the server's own clock zone. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-17" -> "17 Oct 2026", without a time zone moving the day. */
export function printDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function validDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Checks the dialog's request against the grid it was built from. Returns the
 * options, or an error a person can act on. Price rows must match the grid's
 * shape exactly: a list printed from a stale dialog (the prices changed under
 * it) must fail loudly rather than put a price beside the wrong size.
 */
export function parsePriceListOptions(body: any, gridShape: { rows: number; columns: number } | null, now = new Date()):
  { ok: true; options: PriceListOptions } | { ok: false; error: string } {
  const rawName = tidyCustomerName(body?.customer_name);
  if (rawName.length > CUSTOMER_NAME_MAX) return { ok: false, error: `Keep the customer name under ${CUSTOMER_NAME_MAX} characters.` };

  const date = body?.date == null || body.date === '' ? todayIso(now) : body.date;
  if (!validDate(date)) return { ok: false, error: 'Choose a valid date.' };

  let prices: (number | null)[][] | null = null;
  if (body?.prices != null) {
    const parsed = parsePriceMatrix(body.prices, gridShape);
    if ('error' in parsed) return parsed;
    prices = parsed.prices;
  }
  return { ok: true, options: { customerName: rawName || null, date, prices } };
}

/**
 * A grid of prices typed in the admin -- one row per grid row, one cell per
 * column, null or '' for "no price" -- checked against the grid it was typed
 * into. A mismatch means the saved grid changed under the screen, and must
 * fail rather than put a price beside the wrong size.
 */
export function parsePriceMatrix(raw: unknown, gridShape: { rows: number; columns: number } | null):
  { ok: true; prices: (number | null)[][] } | { ok: false; error: string } {
  if (!gridShape) return { ok: false, error: 'This price list has no editable grid.' };
  if (!Array.isArray(raw) || raw.length !== gridShape.rows || raw.some((r: unknown) => !Array.isArray(r) || r.length !== gridShape.columns)) {
    return { ok: false, error: 'The prices changed since this screen opened. Reload and try again.' };
  }
  const prices: (number | null)[][] = [];
  for (const row of raw as unknown[][]) {
    const out: (number | null)[] = [];
    for (const cell of row) {
      if (cell === null || cell === '') { out.push(null); continue; }
      const n = typeof cell === 'number' ? cell : Number(cell);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, error: 'Prices must be numbers of 0 or more.' };
      out.push(Math.round(n * 100) / 100);
    }
    prices.push(out);
  }
  return { ok: true, prices };
}

/** Customer name as stored and printed: single spaces, trimmed; '' when blank. */
export function tidyCustomerName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
}

/** A file name a phone or WhatsApp keeps intact: ASCII letters, digits, dashes. */
export function priceListFileName(base: string, options: Pick<PriceListOptions, 'customerName' | 'date'>): string {
  const slug = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [base, options.customerName ? slug(options.customerName) : '', options.date].filter(Boolean).join('-') + '.pdf';
}
