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
/** A shop section on the landing page (GROUPS in index.html): ranges in display order. `more` catches every range not listed. */
export type AccessoryGroup = { id: string; name: string; sub: string; cats: string[] };
export type AccessoryCatalogue = { ranges: AccessoryRange[]; styles: AccessoryStyle[]; groups?: AccessoryGroup[] };

/** `deleted` takes it off the page and out of the admin list; it can be restored from Deleted. */
export type RangeEdit = { hidden?: boolean; deleted?: boolean; name?: string; text?: string; finish?: string };
export type StyleEdit = { hidden?: boolean; deleted?: boolean; out?: boolean; name?: string; code?: string };
/** Admin > Accessories > Shop sections. Only differences from the page's own GROUPS are kept. */
export type SectionsEdit = {
  /** Section ids in the owner's order ("More styles" always stays last). */
  seq?: string[];
  names?: Record<string, { name?: string; sub?: string }>;
  /** Range id -> the section it was moved to. */
  move?: Record<string, string>;
  /** Section id -> its range ids in the owner's order. */
  order?: Record<string, string[]>;
};
export type AccessoryOverrides = {
  page: { title?: string; intro?: string; whatsapp?: string };
  sections?: SectionsEdit;
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
  const sections = parseSections(o.sections);
  if (sections) out.sections = sections;
  return out;
}

const ids = (v: unknown, max = 500) => (Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === 'string' && ID.test(id)))].slice(0, max) : []);

function parseSections(raw: unknown): SectionsEdit | undefined {
  const o = obj(raw), out: SectionsEdit = {};
  const seq = ids(o.seq, 100);
  if (seq.length) out.seq = seq;
  const names: NonNullable<SectionsEdit['names']> = {};
  for (const [g, v] of Object.entries(obj(o.names)).slice(0, 100)) {
    if (!ID.test(g)) continue;
    const e = obj(v), name = text(e.name, 80), sub = text(e.sub, 200), n: { name?: string; sub?: string } = {};
    if (name) n.name = name;
    if (sub) n.sub = sub;
    if (Object.keys(n).length) names[g] = n;
  }
  if (Object.keys(names).length) out.names = names;
  const move: Record<string, string> = {};
  for (const [id, g] of Object.entries(obj(o.move)).slice(0, 500)) if (ID.test(id) && typeof g === 'string' && ID.test(g)) move[id] = g;
  if (Object.keys(move).length) out.move = move;
  const order: Record<string, string[]> = {};
  for (const [g, v] of Object.entries(obj(o.order)).slice(0, 100)) { const l = ids(v); if (ID.test(g) && l.length) order[g] = l; }
  if (Object.keys(order).length) out.order = order;
  return Object.keys(out).length ? out : undefined;
}

export type EffectiveSection = AccessoryGroup & { original: { name: string; sub: string } };
const numKey = (r: AccessoryRange) => { const m = /(\d+)\D*$/.exec(r.series); return m ? +m[1] : Infinity; };

/**
 * The shop sections as buyers see them, with the owner's edits applied. Mirrors the
 * "Admin > Accessories sections" block in index.html: unlisted ranges join "More styles"
 * in series order, then names, moves, per-section order and section order apply.
 */
export function effectiveSections(edit: SectionsEdit | undefined, cat: AccessoryCatalogue = ACCESSORIES): EffectiveSection[] {
  const e = edit || {};
  const known = new Set(cat.ranges.map((r) => r.id));
  const groups: EffectiveSection[] = (cat.groups?.length ? cat.groups : [{ id: 'more', name: 'More styles', sub: '', cats: [] }])
    .map((g) => ({ ...g, cats: g.cats.filter((id) => known.has(id)), original: { name: g.name, sub: g.sub } }));
  const byId = new Map(groups.map((g) => [g.id, g]));
  let more = byId.get('more');
  if (!more) { more = { id: 'more', name: 'More styles', sub: '', cats: [], original: { name: 'More styles', sub: '' } }; groups.push(more); byId.set('more', more); }
  const listed = new Set(groups.flatMap((g) => g.cats));
  more.cats.push(...cat.ranges.filter((r) => !listed.has(r.id)).sort((a, b) => numKey(a) - numKey(b) || a.series.localeCompare(b.series)).map((r) => r.id));
  for (const [g, n] of Object.entries(e.names || {})) { const x = byId.get(g); if (!x) continue; if (n.name) x.name = n.name; if (n.sub) x.sub = n.sub; }
  for (const [id, g] of Object.entries(e.move || {})) {
    const t = byId.get(g);
    if (!t || !known.has(id)) continue;
    for (const x of groups) { const i = x.cats.indexOf(id); if (i >= 0) x.cats.splice(i, 1); }
    t.cats.push(id);
  }
  for (const [g, list] of Object.entries(e.order || {})) {
    const x = byId.get(g);
    if (!x) continue;
    const r = new Map(list.map((id, i) => [id, i]));
    x.cats = x.cats.map((id, i) => [id, i] as const).sort((a, b) => (r.get(a[0]) ?? Infinity) - (r.get(b[0]) ?? Infinity) || a[1] - b[1]).map((a) => a[0]);
  }
  const rk = new Map((e.seq || []).map((g, i) => [g, i]));
  return groups.map((g, i) => [g, i] as const)
    .sort((a, b) => Number(a[0].id === 'more') - Number(b[0].id === 'more') || (rk.get(a[0].id) ?? Infinity) - (rk.get(b[0].id) ?? Infinity) || a[1] - b[1])
    .map((a) => a[0]);
}

/** Keeps only the section edits that change something, so "back to how it was" stores nothing. */
export function normalizeSections(edit: SectionsEdit | undefined, cat: AccessoryCatalogue = ACCESSORIES): SectionsEdit | undefined {
  if (!edit) return undefined;
  const base = effectiveSections(undefined, cat);
  const baseOf = new Map(base.flatMap((g) => g.cats.map((id) => [id, g.id] as const)));
  const known = new Map(base.map((g) => [g.id, g]));
  const out: SectionsEdit = {};
  const move: Record<string, string> = {};
  for (const [id, g] of Object.entries(edit.move || {})) if (known.has(g) && baseOf.has(id) && baseOf.get(id) !== g) move[id] = g;
  if (Object.keys(move).length) out.move = move;
  const names: NonNullable<SectionsEdit['names']> = {};
  for (const [g, n] of Object.entries(edit.names || {})) {
    const b = known.get(g);
    if (!b) continue;
    const x: { name?: string; sub?: string } = {};
    if (n.name && n.name !== b.name) x.name = n.name;
    if (n.sub && n.sub !== b.sub) x.sub = n.sub;
    if (Object.keys(x).length) names[g] = x;
  }
  if (Object.keys(names).length) out.names = names;
  // An order list is kept (trimmed to the section's own ranges) only if it changes that section.
  const moved = effectiveSections({ move: out.move }, cat);
  const order: Record<string, string[]> = {};
  for (const [g, list] of Object.entries(edit.order || {})) {
    const x = moved.find((s) => s.id === g);
    if (!x) continue;
    const mine = new Set(x.cats), l = list.filter((id) => mine.has(id));
    const after = effectiveSections({ move: out.move, order: { [g]: l } }, cat).find((s) => s.id === g)!;
    if (after.cats.join() !== x.cats.join()) order[g] = after.cats;
  }
  if (Object.keys(order).length) out.order = order;
  const seq = effectiveSections({ seq: edit.seq }, cat).map((g) => g.id);
  if (seq.join() !== base.map((g) => g.id).join()) out.seq = seq.filter((g) => g !== 'more');
  return Object.keys(out).length ? out : undefined;
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
  const sec = normalizeSections(clean.sections, cat);
  const sections = sec ? { sections: Object.fromEntries((['seq', 'names', 'move', 'order'] as const).filter((k) => sec[k]).map((k) => [k, Array.isArray(sec[k]) ? sec[k] : sortKeys(sec[k] as Record<string, unknown>)])) } : {};
  return JSON.stringify({ page: clean.page, order: clean.order, ranges: sortKeys(clean.ranges), styles: sortKeys(clean.styles), ...sections });
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
