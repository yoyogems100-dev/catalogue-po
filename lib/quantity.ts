// Quantities are whole pieces stored in a Postgres integer column.
export function parseQuantity(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 2147483647 ? quantity : null;
}
