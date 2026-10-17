// Quantities are whole pieces stored in a Postgres integer column.
export function parseQuantity(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 2147483647 ? quantity : null;
}

/** "1k" -> "1000", "2.5k" -> "2500" as it's typed; anything else unchanged. */
export function expandQtyShorthand(value: string): string {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*k$/i);
  if (!m) return value;
  const n = Math.round(Number(m[1]) * 1000);
  return Number.isSafeInteger(n) ? String(n) : value;
}
