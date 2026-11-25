// Admin > Accessories edits, layered over the hand-built Accessories page
// (public/po/accessories/index.html). Only the differences are stored, as one
// JSON value in `settings`; the page loads them from /api/accessories/overrides
// before it draws, so an empty value means "exactly as built".
import catalogue from './catalogue.json';

export const ACCESSORIES_SETTING_KEY = 'accessories_overrides';
export const DEFAULT_PAGE_TITLE = 'Bracelet Collection';
export const DEFAULT_PAGE_INTRO = 'Choose a category to see every colour, or search all styles by name, colour or code.';
export const DEFAULT_WHATSAPP = '919079914601';

export type AccessoryRange = { id: string; series: string; name: string; text: string; finish: string; views: string[]; cover?: string };
export type AccessoryStyle = { sku: string; cat: string; code: string; name: string; style: string; colours: string[]; dots: string[]; families: string[]; thumb?: string };
export type AccessoryCatalogue = { ranges: AccessoryRange[]; styles: AccessoryStyle[] };

/** `deleted` takes it off the page and out of the admin list; it can be restored from Deleted. */
export type RangeEdit = { hidden?: boolean; deleted?: boolean; name?: string; text?: string; finish?: string };
export type StyleEdit = { hidden?: boolean; deleted?: boolean; out?: boolean; name?: string; code?: string };
export type AccessoryOverrides = {
  page: { title?: string; intro?: string; whatsapp?: string };
  /** Range ids in the order the owner arranged them; ranges not listed follow in series order. */
  order: string[];
  ranges: Record<string, RangeEdit>;
  styles: Record<string, StyleEdit>;
};

export const ACCESSORIES = catalogue as AccessoryCatalogue;

export const emptyOverrides = (): AccessoryOverrides => ({ page: {}, order: [], ranges: {}, styles: {} });

const ID = /^[A-Za-z0-9_-]{1,24}$/;
// The page puts these strings into its HTML, so angle brackets never get through.
function text(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return t || undefined;
}
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Reads a stored (or submitted) value, keeping only known, clean fields. Junk becomes "no edits". */
export function parseOverrides(raw: unknown): AccessoryOverrides {
  let src: unknown = raw;
  if (typeof raw === 'string') {
    try { src = JSON.parse(raw); } catch { src = null; }
  }
  const o = obj(src);
  const out = emptyOverrides();

  const page = obj(o.page);
  const title = text(page.title, 80), intro = text(page.intro, 400);
  const whatsapp = typeof page.whatsapp === 'string' ? page.whatsapp.replace(/\D/g, '') : '';
  if (title) out.page.title = title;
  if (intro) out.page.intro = intro;
  if (whatsapp.length >= 8 && whatsapp.length <= 15) out.page.whatsapp = whatsapp;

  if (Array.isArray(o.order)) out.order = [...new Set(o.order.filter((id): id is string => typeof id === 'string' && ID.test(id)))].slice(0, 500);

  for (const [id, v] of Object.entries(obj(o.ranges)).slice(0, 500)) {
    if (!ID.test(id)) continue;
    const e = obj(v), r: RangeEdit = {};
    if (e.hidden === true) r.hidden = true;
    if (e.deleted === true) r.deleted = true;
    const name = text(e.name, 80), desc = text(e.text, 600), finish = text(e.finish, 160);
    if (name) r.name = name;
    if (desc) r.text = desc;
    if (finish) r.finish = finish;
    if (Object.keys(r).length) out.ranges[id] = r;
  }
  for (const [sku, v] of Object.entries(obj(o.styles)).slice(0, 5000)) {
    if (!ID.test(sku)) continue;
    const e = obj(v), s: StyleEdit = {};
    if (e.hidden === true) s.hidden = true;
    if (e.deleted === true) s.deleted = true;
    if (e.out === true) s.out = true;
    const name = text(e.name, 80), code = text(e.code, 24);
    if (name) s.name = name;
    if (code) s.code = code;
    if (Object.keys(s).length) out.styles[sku] = s;
  }
  return out;
}

/** Stable JSON, dropping edits that only repeat what the page already says. */
export function serializeOverrides(o: AccessoryOverrides, cat: AccessoryCatalogue = ACCESSORIES): string {
  const clean = parseOverrides(o);
  const ranges = new Map(cat.ranges.map((r) => [r.id, r]));
  const styles = new Map(cat.styles.map((s) => [s.sku, s]));
  for (const [id, e] of Object.entries(clean.ranges)) {
    const r = ranges.get(id);
    if (r) {
      if (e.name === r.name) delete e.name;
      if (e.text === r.text) delete e.text;
      if (e.finish === r.finish) delete e.finish;
    }
    if (!Object.keys(e).length) delete clean.ranges[id];
  }
  for (const [sku, e] of Object.entries(clean.styles)) {
    const s = styles.get(sku);
    if (s) {
      if (e.name === s.name) delete e.name;
      if (e.code === s.code) delete e.code;
    }
    if (!Object.keys(e).length) delete clean.styles[sku];
  }
  if (clean.page.title === DEFAULT_PAGE_TITLE) delete clean.page.title;
  if (clean.page.intro === DEFAULT_PAGE_INTRO) delete clean.page.intro;
  if (clean.page.whatsapp === DEFAULT_WHATSAPP) delete clean.page.whatsapp;
  const sortKeys = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({ page: clean.page, order: clean.order, ranges: sortKeys(clean.ranges), styles: sortKeys(clean.styles) });
}

const numOf = (s: string) => { const m = /(\d+)\D*$/.exec(s); return m ? +m[1] : Infinity; };

/** Ranges in the order buyers see them: the owner's order first, then the page's own series order. */
export function orderedRanges(o: AccessoryOverrides, cat: AccessoryCatalogue = ACCESSORIES): AccessoryRange[] {
  const rank = new Map(o.order.map((id, i) => [id, i]));
  const index = new Map(cat.ranges.map((r, i) => [r.id, i]));
  return [...cat.ranges].sort((a, b) => {
    const ra = rank.get(a.id) ?? Infinity, rb = rank.get(b.id) ?? Infinity;
    if (ra !== rb) return ra - rb;
    const na = numOf(a.series), nb = numOf(b.series);
    if (na !== nb) return na - nb;
    if (a.series !== b.series) return a.series.localeCompare(b.series);
    return index.get(a.id)! - index.get(b.id)!;
  });
}

export type EffectiveRange = AccessoryRange & { original: AccessoryRange; hidden: boolean; deleted: boolean; styleCount: number; shownCount: number };
export type EffectiveStyle = AccessoryStyle & { original: AccessoryStyle; hidden: boolean; deleted: boolean; out: boolean; rangeHidden: boolean };

/** Every range and style with the owner's edits applied, for the admin list and the Excel export. */
export function effectiveCatalogue(o: AccessoryOverrides, cat: AccessoryCatalogue = ACCESSORIES) {
  const styles: EffectiveStyle[] = cat.styles.map((s) => {
    const e = o.styles[s.sku] || {};
    return { ...s, name: e.name || s.name, code: e.code || s.code, original: s, hidden: !!e.hidden, deleted: !!e.deleted, out: !!e.out, rangeHidden: !!(o.ranges[s.cat]?.hidden || o.ranges[s.cat]?.deleted) };
  });
  const ranges: EffectiveRange[] = orderedRanges(o, cat).map((r) => {
    const e = o.ranges[r.id] || {};
    const mine = styles.filter((s) => s.cat === r.id);
    return { ...r, name: e.name || r.name, text: e.text || r.text, finish: e.finish || r.finish, original: r, hidden: !!e.hidden, deleted: !!e.deleted, styleCount: mine.filter((s) => !s.deleted).length, shownCount: mine.filter((s) => !s.hidden && !s.deleted).length };
  });
  return { ranges, styles };
}
