// What a price is quoted per. Most categories sell by the piece; Rainbow
// Corundum sells by the strip. Stored on the category as free text so the
// owner can name a unit we did not think of without waiting for a migration.
// NULL in the database means "piece", so existing rows keep their meaning.

export const DEFAULT_PRICE_UNIT = 'piece';

/** The units offered in the picker. Anything else is typed under "Other". */
export const PRICE_UNIT_PRESETS = ['piece', 'strip', 'pair', 'set', 'line', 'carat', 'gram'] as const;

export const PRICE_UNIT_MAX = 24;

/** The word to print. Handles null, empty and whitespace-only alike. */
export function priceUnitLabel(unit: string | null | undefined): string {
  return (unit || '').trim() || DEFAULT_PRICE_UNIT;
}

/**
 * Accepts what the admin form sends and returns what belongs in the column, or
 * `undefined` when the value is unusable. A blank field and the word "piece"
 * both store NULL, so the default is one representation rather than two.
 */
export function normalizePriceUnit(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  // A unit is one word in a sentence ("INR per strip"), so newlines and runs
  // of spaces would only ever be a paste accident.
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return null;
  if (value.length > PRICE_UNIT_MAX) return undefined;
  return value.toLowerCase() === DEFAULT_PRICE_UNIT ? null : value;
}
