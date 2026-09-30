// How a category's order form asks for quantity: what the field is called
// and what it starts on. Most categories ask "Qty per line (pcs)" and start
// empty; Semi Precious Beads are bought by the line (strand), so there it is
// "No. of Lines" starting on 5, counted in lines and weighed in carats.
// Edited in Admin > category > Pricing and stored as one JSON map in
// settings, so a new category needs no migration.

export const QUANTITY_FIELDS_SETTING_KEY = 'category_quantity_fields';
export const QUANTITY_LABEL_MAX = 32;
export const DEFAULT_QTY_MAX = 1_000_000;

export type WeightUnit = 'g' | 'ct';
export const WEIGHT_UNITS: WeightUnit[] = ['g', 'ct'];

export type QuantityField = {
  label: string | null;
  defaultQty: number | null;
  /** What a quantity is counted in ("lines"); null means pieces. */
  unit: string | null;
  /** The weight unit an order line starts on in admin; null means grams. */
  weightUnit: WeightUnit | null;
};

const SEMI_PRECIOUS_BEADS_CATEGORY_ID = 45;

// Until the owner saves something for a category, these apply.
const BUILT_IN: Record<number, QuantityField> = {
  [SEMI_PRECIOUS_BEADS_CATEGORY_ID]: { label: 'No. of Lines', defaultQty: 5, unit: 'lines', weightUnit: 'ct' }
};

const NONE: QuantityField = { label: null, defaultQty: null, unit: null, weightUnit: null };
export const QUANTITY_UNIT_MAX = 16;

/** One entry from the admin form, or undefined when it is unusable. */
export function normalizeQuantityField(raw: unknown): QuantityField | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const labelRaw = (raw as any).label;
  const qtyRaw = (raw as any).defaultQty;
  let label: string | null = null;
  if (typeof labelRaw === 'string') {
    label = labelRaw.replace(/\s+/g, ' ').trim() || null;
    if (label && label.length > QUANTITY_LABEL_MAX) return undefined;
  } else if (labelRaw != null) return undefined;
  const unitRaw = (raw as any).unit;
  let unit: string | null = null;
  if (typeof unitRaw === 'string') {
    unit = unitRaw.replace(/\s+/g, ' ').trim().toLowerCase() || null;
    if (unit === 'pcs' || unit === 'pieces' || unit === 'piece') unit = null;
    if (unit && unit.length > QUANTITY_UNIT_MAX) return undefined;
  } else if (unitRaw != null) return undefined;
  const weightRaw = (raw as any).weightUnit;
  let weightUnit: WeightUnit | null = null;
  if (weightRaw === 'ct') weightUnit = 'ct';
  else if (weightRaw != null && weightRaw !== '' && weightRaw !== 'g') return undefined;
  let defaultQty: number | null = null;
  if (qtyRaw !== null && qtyRaw !== undefined && qtyRaw !== '') {
    const n = Number(qtyRaw);
    if (!Number.isSafeInteger(n) || n < 1 || n > DEFAULT_QTY_MAX) return undefined;
    defaultQty = n;
  }
  return { label, defaultQty, unit, weightUnit };
}

export function parseQuantityFields(value: string | null | undefined): Record<number, QuantityField> {
  if (!value) return {};
  try {
    const raw = JSON.parse(value);
    const out: Record<number, QuantityField> = {};
    if (raw && typeof raw === 'object') {
      for (const [key, entry] of Object.entries(raw)) {
        const id = Number(key);
        const field = normalizeQuantityField(entry);
        if (Number.isSafeInteger(id) && id > 0 && field) out[id] = field;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** A saved entry replaces the built-in one whole, so the owner can clear it. */
export function quantityFieldFor(saved: Record<number, QuantityField>, categoryId: number): QuantityField {
  return saved[categoryId] || BUILT_IN[categoryId] || NONE;
}

// The buyer's own last-used quantity per category, on this device. Only kept
// for categories with a default, where "start where I left off" is the point.
const REMEMBERED_KEY = 'yoyo_po_default_qty_v1';

export function rememberedQty(categoryId: number): number | null {
  try {
    const map = JSON.parse(localStorage.getItem(REMEMBERED_KEY) || '{}');
    const n = Number(map?.[categoryId]);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function rememberQty(categoryId: number, qty: number) {
  try {
    const map = JSON.parse(localStorage.getItem(REMEMBERED_KEY) || '{}') || {};
    map[categoryId] = qty;
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(map));
  } catch { /* private mode: the admin default still applies */ }
}

/** "pcs", or the category's own unit ("lines"). */
export function qtyUnit(field: Pick<QuantityField, 'unit'> | null | undefined): string {
  return field?.unit || 'pcs';
}

/** "8 lines", "5,000 pcs". */
export function formatQty(qty: number, unit?: string | null): string {
  return `${qty.toLocaleString('en-IN')} ${unit || 'pcs'}`;
}

/** Totals per unit, pieces first: "2,064 pcs · 8 lines". Adding lines to
 *  pieces would give a number that means nothing. */
export function formatQtyTotals(items: { qty: number; unit?: string | null }[]): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    const unit = item.unit || 'pcs';
    totals.set(unit, (totals.get(unit) || 0) + item.qty);
  }
  if (!totals.size) totals.set('pcs', 0);
  return [...totals.entries()]
    .sort(([a], [b]) => (a === 'pcs' ? -1 : b === 'pcs' ? 1 : a.localeCompare(b)))
    .map(([unit, qty]) => formatQty(qty, unit))
    .join(' · ');
}

/** A weight as printed: "12.5 ct", "3 g". */
export function formatWeight(weight: number | null | undefined, unit: string | null | undefined): string {
  if (weight == null) return '';
  return `${weight.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit === 'ct' ? 'ct' : 'g'}`;
}
