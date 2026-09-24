// The "Most ordered" shelf at the top of the catalogue home page.
//
// Stored as a comma-separated list of category IDs in settings under
// MOST_ORDERED_SETTING_KEY, in display order, and edited from Admin > Website
// content. Until the owner saves a list, the page uses DEFAULT_MOST_ORDERED --
// the owner's own ranking (2026-09-25): Crushed Ice, Rainbow, Ruby Corundum,
// Coloured CZ, Nano, Lab Grown, Moissanite, Turkey, Hole Punched, Fancy
// Solitaire, 5A CZ, Swiss CZ. IDs, not names, so a rename doesn't drop a card.
export const MOST_ORDERED_SETTING_KEY = 'most_ordered_category_ids';
export const DEFAULT_MOST_ORDERED = [1, 29, 2, 12, 3, 6, 34, 4, 20, 28, 37, 39];

export function parseMostOrdered(value: string | null | undefined): number[] {
  if (value == null) return DEFAULT_MOST_ORDERED;
  const ids = value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0);
  return [...new Set(ids)];
}

export function serializeMostOrdered(ids: number[]): string {
  return [...new Set(ids)].filter((n) => Number.isSafeInteger(n) && n > 0).join(',');
}
