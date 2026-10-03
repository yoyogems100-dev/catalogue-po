import { COLOR_FAMILIES } from './color-family';
import { categoryGrades } from './order-specs';

// A buyer's standing defaults: "when I say Red I mean Ruby Corundum 5A",
// "White means 5A Quality CZ". Keyed by colour family so a buyer can start an
// order from the colour alone and land in the right category and grade.
// Stored on customers.order_preferences (jsonb array); set by the buyer at
// sign-up or in My Info, and by the team on the admin customer page. The team
// can also preset the shape, size and quantity a colour starts on (owner,
// 2026-10-03): "Red opens Ruby 5A, Round 3 mm, 500 pcs". The buyer can still
// change any of it before adding the line.
export type OrderPreference = {
  familyId: number;
  categoryId: number;
  grade?: string | null;
  shapeId?: number | null;
  /** As sizeKey() spells it ("3", "6x8"), so it survives 6*8 / 6x8mm spellings. */
  size?: string | null;
  qty?: number | null;
};

export const MAX_PICK_QTY = 10_000_000;

export const MAX_PREFERENCES = COLOR_FAMILIES.length;

// Shop-wide defaults for every buyer, edited in Admin > Catalogue map >
// Colour buttons and stored as JSON in settings. A buyer's own usual picks
// override these colour by colour. Until the owner saves a list (owner's
// choice, 2026-09-26): White -> 5A Quality CZ (37), Red -> Ruby Corundum (2)
// 5A, Yellow -> Fancy Solitaire (28), Green and Blue -> Nano (3).
export const DEFAULT_PICKS_SETTING_KEY = 'default_color_preferences';
export const DEFAULT_COLOR_PREFERENCES: OrderPreference[] = [
  { familyId: 1, categoryId: 37 },
  { familyId: 4, categoryId: 2, grade: '5A' },
  { familyId: 7, categoryId: 28 },
  { familyId: 9, categoryId: 3 },
  { familyId: 10, categoryId: 3 }
];

export function parseDefaultPreferences(value: string | null | undefined): OrderPreference[] {
  if (value == null) return DEFAULT_COLOR_PREFERENCES;
  try { return sanitizePreferences(JSON.parse(value)); } catch { return DEFAULT_COLOR_PREFERENCES; }
}

/** The buyer's own pick for a colour wins; the shop default fills the rest. */
export function mergePreferences(mine: OrderPreference[], defaults: OrderPreference[]): OrderPreference[] {
  const own = new Set(mine.map((p) => p.familyId));
  return [...mine, ...defaults.filter((p) => !own.has(p.familyId))];
}

/** Drops anything malformed, keeps one entry per colour family (first wins). */
export function sanitizePreferences(raw: unknown, validCategoryIds?: Set<number>): OrderPreference[] {
  if (!Array.isArray(raw)) return [];
  const familyIds = new Set(COLOR_FAMILIES.map((f) => f.id));
  const seen = new Set<number>();
  const out: OrderPreference[] = [];
  for (const entry of raw) {
    const familyId = Number((entry as any)?.familyId);
    const categoryId = Number((entry as any)?.categoryId);
    if (!familyIds.has(familyId) || seen.has(familyId)) continue;
    if (!Number.isSafeInteger(categoryId) || categoryId < 1) continue;
    if (validCategoryIds && !validCategoryIds.has(categoryId)) continue;
    const gradeRaw = (entry as any)?.grade;
    const grade = typeof gradeRaw === 'string' && categoryGrades(categoryId).includes(gradeRaw) ? gradeRaw : null;
    const pick: OrderPreference = grade ? { familyId, categoryId, grade } : { familyId, categoryId };
    const shapeId = Number((entry as any)?.shapeId);
    if (Number.isSafeInteger(shapeId) && shapeId > 0) pick.shapeId = shapeId;
    const sizeRaw = (entry as any)?.size;
    if (typeof sizeRaw === 'string' && sizeRaw.trim() && sizeRaw.trim().length <= 24) pick.size = sizeRaw.trim();
    const qty = Number((entry as any)?.qty);
    if (Number.isSafeInteger(qty) && qty > 0 && qty <= MAX_PICK_QTY) pick.qty = qty;
    seen.add(familyId);
    out.push(pick);
    if (out.length >= MAX_PREFERENCES) break;
  }
  return out;
}

export function preferenceForFamily(prefs: OrderPreference[] | null | undefined, familyId: number): OrderPreference | null {
  return (prefs || []).find((p) => p.familyId === familyId) || null;
}

/**
 * Server side: validate a submitted list against the categories that exist.
 * Returns undefined when nothing was submitted, so a caller can leave the
 * column untouched rather than clearing it.
 */
export async function preferencesFromBody(raw: unknown, database: any): Promise<OrderPreference[] | undefined> {
  if (!Array.isArray(raw)) return undefined;
  const { data } = await database.from('categories').select('id');
  return sanitizePreferences(raw, new Set(((data || []) as { id: number }[]).map((c) => c.id)));
}
