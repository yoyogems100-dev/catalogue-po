// The courier list admin picks from on an order (Orders > Stages & messages).
// Stored as a JSON array of names in settings.couriers; these are the defaults
// until the list is first saved.
export const COURIERS_SETTING_KEY = 'couriers';

export const DEFAULT_COURIERS = [
  'Sainath Courier',
  'Hindustan Courier',
  'Manoj Ambalal',
  'DTDC',
  'Professional Courier',
  'BVC',
  'Jaynti Praveen',
  'Shree Ambey Courier',
  'SP Courier',
  'Bhawani Air Parcel',
  'Shyam Parcel',
  'Madhur Courier',
  'Tirupati Courier'
];

export const MAX_COURIER_NAME = 60;

/** Saved JSON -> clean list (trimmed, no blanks or repeats). Bad data -> defaults. */
export function resolveCouriers(raw: unknown): string[] {
  let saved: unknown = raw;
  if (typeof raw === 'string') {
    try { saved = JSON.parse(raw); } catch { saved = null; }
  }
  if (!Array.isArray(saved)) return [...DEFAULT_COURIERS];
  return cleanCourierList(saved);
}

export function cleanCourierList(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const name = item.replace(/\s+/g, ' ').trim().slice(0, MAX_COURIER_NAME);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}
