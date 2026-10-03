// Swiss High Density CZ (category 39): one stone, White Round, so the order
// form shows both as fixed fields. Each size lists the approximate weight of
// 1000 pcs in grams, from the owner's Swiss Heavy price list (SWISS PRICE
// LIST-1.pdf), e.g. "0.90 mm (1.69 gm)".
export const SWISS_CATEGORY_ID = 39;

const GRAMS_PER_1000: Record<string, number> = {
  '0.90': 1.69, '1.00': 2.36, '1.05': 2.67, '1.10': 3.08, '1.15': 3.52,
  '1.20': 4.07, '1.25': 4.43, '1.30': 5.11, '1.40': 6.56, '1.50': 7.04,
  '1.60': 9.01, '1.70': 10.8, '1.75': 11.9, '1.80': 13, '1.90': 14.9,
  '2.00': 17.2, '2.10': 18.9, '2.25': 22.2, '2.50': 32.3, '2.75': 40,
  '3.00': 51.3, '3.25': 67.1, '3.50': 82.6, '3.75': 100, '4.00': 128,
  '4.50': 186, '5.00': 260, '5.50': 344, '6.00': 431, '6.50': 556,
  '7.00': 699
};

/** Grams per 1000 pcs for a Swiss size ("0.9" and "0.90" both match), else null. */
export function swissGramsPer1000(sizeMm: string): number | null {
  const n = Number(sizeMm);
  if (!Number.isFinite(n)) return null;
  return GRAMS_PER_1000[n.toFixed(2)] ?? null;
}

/** "0.90 mm (1.69 gm)" for Swiss sizes on the list; plain "x mm" otherwise. */
export function swissSizeLabel(sizeMm: string): string {
  const g = swissGramsPer1000(sizeMm);
  return g == null ? `${sizeMm} mm` : `${sizeMm} mm (${g} gm)`;
}
