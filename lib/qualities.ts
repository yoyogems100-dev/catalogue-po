// Which qualities (grades) a category's order form offers -- Ruby Corundum
// 5A / 7A, or A, AA, 3A, 4A, 5A, 7A for another stone -- edited per category
// in Admin > category (the Quality bar) and stored as one JSON map in
// settings, { categoryId: ["5A", "7A"] }, so a new category needs no
// migration. A category with no list has no Quality field. The chosen
// quality rides on the order line as order_specs { kind: 'grade', grade }.

export const QUALITIES_SETTING_KEY = 'category_qualities';
export const QUALITY_MAX_LENGTH = 12;
export const MAX_QUALITIES = 16;

/** Offered as one-tap chips in admin, with any quality already in use. */
export const SUGGESTED_QUALITIES = ['A', 'AA', '3A', '4A', '5A', '6A', '7A', '8A'];

export type CategoryQualities = Record<number, string[]>;

const RUBY_CORUNDUM_CATEGORY_ID = 2;
// Until the owner saves a list for a category, these apply (what the order
// form offered before qualities were editable).
const BUILT_IN: CategoryQualities = { [RUBY_CORUNDUM_CATEGORY_ID]: ['5A', '7A'] };

/** One category's list as saved: trimmed, each once, in the order given. */
export function normalizeQualities(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') return undefined;
    const quality = value.replace(/\s+/g, ' ').trim();
    if (!quality) continue;
    if (quality.length > QUALITY_MAX_LENGTH) return undefined;
    if (!out.some((q) => q.toLowerCase() === quality.toLowerCase())) out.push(quality);
  }
  return out.length > MAX_QUALITIES ? undefined : out;
}

/** The saved map with the built-in lists for categories never saved. */
export function parseCategoryQualities(value: string | null | undefined): CategoryQualities {
  const out: CategoryQualities = { ...BUILT_IN };
  if (!value) return out;
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { return out; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    const qualities = normalizeQualities(list);
    if (Number.isSafeInteger(id) && id > 0 && qualities) out[id] = qualities;
  }
  return out;
}

export function qualitiesFor(all: CategoryQualities | null | undefined, categoryId: number): string[] {
  return (all ?? BUILT_IN)[categoryId] || [];
}

/** Suggestions first, then any other quality some category already uses. */
export function knownQualities(all: CategoryQualities): string[] {
  const out = [...SUGGESTED_QUALITIES];
  for (const list of Object.values(all)) for (const q of list) if (!out.some((o) => o.toLowerCase() === q.toLowerCase())) out.push(q);
  return out;
}
