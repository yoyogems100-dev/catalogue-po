// Recent discussions with a buyer (calls, meetings, exhibitions). Written by
// the team in Admin > Customers > Discussions, read by the buyer under
// My Account > Discussions. Table: customer_discussions.

export const DISCUSSION_PLACES_SETTING_KEY = 'discussion_places';
export const DEFAULT_DISCUSSION_PLACES = ['Jaipur office', 'Surat office', 'Phone', 'Exhibition'] as const;
/** Always offered last in the Place box; picking it shows a free-text box. */
export const OTHER_PLACE = 'Other';

export const PLACE_MAX = 60;
export const LABEL_MAX = 120;
export const DETAILS_MAX = 2000;
export const NOTES_MAX = 5000;
export const ITEMS_MAX = 40;
export const PHOTOS_PER_ITEM_MAX = 12;
export const DISCUSSION_PHOTO_UPLOAD_LIMIT = 4 * 1024 * 1024;

/** photos are storage paths in the public `photos` bucket:
 *  discussions/<customer id>/<uuid>.webp */
export type DiscussionItem = { category_id: number | null; label: string; details: string; photos: string[] };

const PHOTO_PATH = /^discussions\/(\d+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function discussionPhotoPath(customerId: number, uuid: string) {
  return `discussions/${customerId}/${uuid}.webp`;
}

/** Public URL of a saved photo path. */
export function discussionPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}

/** Only photos uploaded through the discussion upload (for this buyer, when
 *  customerId is given), once each, capped. */
export function sanitizePhotos(raw: unknown, customerId?: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const m = PHOTO_PATH.exec(v);
    if (!m || (customerId !== undefined && Number(m[1]) !== customerId) || out.includes(v)) continue;
    out.push(v);
    if (out.length >= PHOTOS_PER_ITEM_MAX) break;
  }
  return out;
}
export type Discussion = {
  id: number;
  customer_id: number;
  held_on: string;
  place: string | null;
  items: DiscussionItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const oneLine = (v: unknown, max: number) => clean(v, max).replace(/\s+/g, ' ');

/** The team's place list from settings, or the starting list if none saved. */
export function parseDiscussionPlaces(raw: string | null | undefined): string[] {
  if (!raw) return [...DEFAULT_DISCUSSION_PLACES];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return sanitizePlaces(parsed);
  } catch { /* fall through */ }
  return [...DEFAULT_DISCUSSION_PLACES];
}

/** Trimmed, de-duplicated (case-insensitive), without "Other". */
export function sanitizePlaces(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const p = oneLine(v, PLACE_MAX);
    const key = p.toLowerCase();
    if (!p || key === OTHER_PLACE.toLowerCase() || seen.has(key)) continue;
    seen.add(key); out.push(p);
    if (out.length >= 50) break;
  }
  return out;
}

/** "2026-11-27" or null. */
export function cleanDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

/** Discussed items: drops blank rows; label falls back to "General". */
export function sanitizeItems(raw: unknown, customerId?: number): DiscussionItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscussionItem[] = [];
  for (const r of raw.slice(0, ITEMS_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    const details = clean(row.details, DETAILS_MAX);
    const id = Number(row.category_id);
    const category_id = Number.isSafeInteger(id) && id > 0 ? id : null;
    const photos = sanitizePhotos(row.photos, customerId);
    if (!details && !category_id && !photos.length) continue;
    out.push({ category_id, label: oneLine(row.label, LABEL_MAX) || 'General', details, photos });
  }
  return out;
}

/** Body of a save → the row values, or an error for the team. */
export function discussionFromBody(body: any, customerId: number): { values: { held_on: string; place: string | null; items: DiscussionItem[]; notes: string | null } } | { error: string } {
  const held_on = cleanDate(body?.heldOn);
  if (!held_on) return { error: 'Pick the date it was held.' };
  const items = sanitizeItems(body?.items, customerId);
  const notes = clean(body?.notes, NOTES_MAX) || null;
  if (!items.length && !notes) return { error: 'Add at least one discussed item or a note.' };
  const place = oneLine(body?.place, PLACE_MAX) || null;
  return { values: { held_on, place, items, notes } };
}

export function formatDiscussionDate(isoDate: string) {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}
