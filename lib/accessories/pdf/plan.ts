// Page plan for the Accessories PDF catalogue (Admin > Accessories > Download PDF).
// Pure layout maths, shared by the browser download and the test script: which
// category starts on which page, how its styles split over pages, and where the
// contents / index / colour-finder rows fall. Ported from the first hand-built
// catalogue (final edit/_tools/pdfcat/build_pdf.py), so measurements are in PDF
// points with y counted UP from the bottom of an A4 page, as there.
import { effectiveCatalogue, effectiveSections, type AccessoryCatalogue, type AccessoryOverrides, type EffectiveRange, type EffectiveStyle } from '../overrides';

export const W = 595.28, H = 841.89, MX = 36;
export const COLS = 4;
export const TW = (W - 2 * MX - (COLS - 1) * 12) / COLS;
export const IMG = TW;
export const TILE_H = IMG + 46;
export const RH = TILE_H + 6, HB = 196, PAD = 20, BOT = 50, GAP = 22, CONT_TOP = H - 66;
export const IDX_TOP = H - 118, IDX_BOT = 60, ROW_H = 40, SEC_H = 30;
export const GRID_ROW = 15.2, GRID_TOP0 = H - 150, GRID_TOPN = H - 106;

export type PdfSection = { id: string; name: string; sub: string; cats: EffectiveRange[] };
export type PdfOptions = {
  title: string;
  subtitle: string;
  preparedFor: string;
  contents: boolean;
  index: boolean;
  finder: boolean;
  howToOrder: boolean;
  whatsapp: string;
  edition: string;
};

// ---- colour families for the finder grid and the "x solid · y multicolour" line ----
export const FIND: [string, string, string | null][] = [
  ['yellow', 'Yellow & Gold', '#E9C23A'], ['red', 'Red & Orange', '#D2452F'], ['pink', 'Pink & Berry', '#E58FB6'],
  ['purple', 'Lilac & Violet', '#9A7FCF'], ['blue', 'Blue & Teal', '#3F86C4'], ['green', 'Green & Olive', '#4E9A55'],
  ['brown', 'Brown & Tan', '#8A5A35'], ['neutral', 'Neutral & Pearl', '#D9D2C2'], ['dark', 'Navy & Black', '#1F2A44'],
  ['multi', 'Multicolour & Patterns', null]
];
export const FNAME: Record<string, string> = Object.fromEntries(FIND.map(([k, n]) => [k, n]));
// The page stores families as display names ("Navy & Dark") or raw keys ("orange").
const FKEY: Record<string, string> = {
  'Yellow & Gold': 'yellow', 'Pink & Berry': 'pink', 'Lilac & Violet': 'purple', 'Blue & Teal': 'blue', 'Green & Olive': 'green',
  'Red & Orange': 'red', 'Brown & Tan': 'brown', 'Neutral & Pearl': 'neutral', 'Navy & Dark': 'dark',
  orange: 'red', white: 'neutral', beige: 'neutral', grey: 'neutral', silver: 'neutral', black: 'dark', gold: 'yellow', multi: 'multi'
};
const MULTI = new Set(['Multicolour', 'Two-tone', 'Space-dyed', 'Pattern', 'Banded']);
const KEYS = new Set(FIND.map(([k]) => k));

export function fams(p: EffectiveStyle): Set<string> {
  const s = new Set(p.families.map((f) => FKEY[f] || f).filter((k) => KEYS.has(k)));
  if (MULTI.has(p.style) || s.size > 2) s.add('multi');
  return s;
}

/**
 * 1-3 colours for a style's dot. Colours the page has no shade for come through as
 * #cccccc; they are dropped when a real one exists, else `fallback` (the swatch's own
 * middle colour, measured when the photos load) is used. A solid style shows one colour.
 */
export function dotsOf(p: EffectiveStyle, fallback?: string): string[] {
  let r = (p.dots || []).map((h) => h.trim().toUpperCase()).filter((h) => /^#[0-9A-F]{6}$/.test(h));
  const known = r.filter((h) => h !== '#CCCCCC');
  if (known.length) r = known;
  else if (fallback) r = [fallback];
  if (p.style === 'Solid') r = r.slice(0, 1);
  return r.length ? r.slice(0, 3) : ['#CCCCCC'];
}

export function styleSummary(ps: EffectiveStyle[]) {
  const solid = ps.filter((p) => !fams(p).has('multi')).length, multi = ps.length - solid;
  return [solid ? `${solid} solid` : '', multi ? `${multi} multicolour & pattern` : ''].filter(Boolean).join(' · ');
}
export const coloursWord = (n: number) => `${n} colour${n === 1 ? '' : 's'}`;

// ---- the plan ----
export type TileOp = { kind: 'tiles'; cat: string; styles: EffectiveStyle[]; ytop: number };
export type CatOp = { kind: 'head'; cat: string; T: number } | { kind: 'cont'; cat: string } | TileOp;
export type CatPage = { sec: PdfSection; ops: CatOp[] };
export type ListItem = { kind: 'sec'; sec: PdfSection } | { kind: 'cat'; cat: EffectiveRange };

export type Plan = {
  sections: PdfSection[];
  byCat: Map<string, EffectiveStyle[]>;
  order: string[];
  secOf: Map<string, PdfSection>;
  rangeOf: Map<string, EffectiveRange>;
  catPages: CatPage[];
  indexPages: ListItem[][];
  gridPages: ListItem[][];
  /** Page number of each destination: contents, index, finder, order, cat:<id>, sec:<id>. */
  pg: Record<string, number>;
  total: number;
  styleCount: number;
};

/**
 * `sections` are the chosen shop sections, each with its chosen categories in
 * page order; `styles` every style that should print. Categories with no
 * styles left are dropped, then empty sections.
 */
export function planCatalogue(sectionsIn: PdfSection[], styles: EffectiveStyle[], opt: Pick<PdfOptions, 'contents' | 'index' | 'finder' | 'howToOrder'>): Plan {
  const byCat = new Map<string, EffectiveStyle[]>();
  for (const s of styles) { const l = byCat.get(s.cat); if (l) l.push(s); else byCat.set(s.cat, [s]); }
  const sections: PdfSection[] = sectionsIn
    .map((s) => ({ ...s, cats: s.cats.filter((c) => byCat.get(c.id)?.length) }))
    .filter((s) => s.cats.length);
  const rangeOf = new Map(sections.flatMap((s) => s.cats.map((c) => [c.id, c] as const)));
  const nrows = (cid: string) => Math.ceil(byCat.get(cid)!.length / COLS);
  const rowsFit = (T: number) => { const room = T - HB - PAD - TILE_H - BOT; return room < 0 ? 0 : Math.floor(room / RH) + 1; };
  const CONT_ROWS = Math.floor((CONT_TOP - TILE_H - BOT) / RH) + 1;

  // Categories share a page when there is room: one starts below the previous if it
  // fits whole or 2+ rows fit; otherwise a later one from the same section that fits
  // is pulled up. Every section starts on a new page.
  const catPages: CatPage[] = [];
  for (const s of sections) {
    const queue = s.cats.map((c) => c.id), final: string[] = [];
    let page: CatPage = { sec: s, ops: [] }; catPages.push(page); let T = H;
    while (queue.length) {
      let cid = queue[0];
      if (T < H) {
        const room = rowsFit(T);
        if (room < nrows(cid)) {
          const alt = queue.slice(1).find((q) => nrows(q) <= room);
          if (alt) { queue.splice(queue.indexOf(alt), 1); queue.unshift(alt); cid = alt; }
          else if (room < 2) { page = { sec: s, ops: [] }; catPages.push(page); T = H; }
        }
      }
      queue.shift(); final.push(cid);
      const ps = byCat.get(cid)!; const k = Math.min(rowsFit(T), nrows(cid)) * COLS;
      page.ops.push({ kind: 'head', cat: cid, T });
      const ytop = T - HB - PAD;
      page.ops.push({ kind: 'tiles', cat: cid, styles: ps.slice(0, k), ytop });
      let lastTop = ytop - (Math.ceil(k / COLS) - 1) * RH;
      let rest = ps.slice(k);
      while (rest.length) {
        page = { sec: s, ops: [] }; catPages.push(page);
        const chunk = rest.slice(0, CONT_ROWS * COLS); rest = rest.slice(CONT_ROWS * COLS);
        page.ops.push({ kind: 'cont', cat: cid }, { kind: 'tiles', cat: cid, styles: chunk, ytop: CONT_TOP });
        lastTop = CONT_TOP - (Math.ceil(chunk.length / COLS) - 1) * RH;
      }
      T = lastTop - TILE_H - GAP;
    }
    s.cats = final.map((id) => rangeOf.get(id)!);
  }
  const order = sections.flatMap((s) => s.cats.map((c) => c.id));
  const secOf = new Map(sections.flatMap((s) => s.cats.map((c) => [c.id, s] as const)));

  const indexPages: ListItem[][] = [];
  { let y = IDX_TOP, cur: ListItem[] = [];
    for (const s of sections) {
      if (y - SEC_H - ROW_H < IDX_BOT) { indexPages.push(cur); cur = []; y = H - 70; }
      cur.push({ kind: 'sec', sec: s }); y -= SEC_H;
      for (const c of s.cats) {
        if (y - ROW_H < IDX_BOT) { indexPages.push(cur); cur = []; y = H - 70; }
        cur.push({ kind: 'cat', cat: c }); y -= ROW_H;
      }
    }
    indexPages.push(cur); }
  const gridPages: ListItem[][] = [];
  { let y = GRID_TOP0, cur: ListItem[] = [];
    for (const s of sections) {
      if (y - 2 * GRID_ROW < 60) { gridPages.push(cur); cur = []; y = GRID_TOPN; }
      cur.push({ kind: 'sec', sec: s }); y -= GRID_ROW + 4;
      for (const c of s.cats) {
        if (y - GRID_ROW < 60) { gridPages.push(cur); cur = []; y = GRID_TOPN; }
        cur.push({ kind: 'cat', cat: c }); y -= GRID_ROW;
      }
    }
    gridPages.push(cur); }

  const pg: Record<string, number> = { cover: 1 };
  let n = 2;
  if (opt.contents) pg.contents = n++;
  if (opt.index) { pg.index = n; n += indexPages.length; }
  if (opt.finder) { pg.finder = n; n += gridPages.length; }
  catPages.forEach((p, i) => { for (const op of p.ops) if (op.kind === 'head') pg[`cat:${op.cat}`] = n + i; });
  n += catPages.length;
  if (opt.howToOrder) pg.order = n++;
  for (const s of sections) pg[`sec:${s.id}`] = pg[`cat:${s.cats[0].id}`];

  return { sections, byCat, order, secOf, rangeOf, catPages, indexPages, gridPages, pg, total: n - 1, styleCount: order.reduce((a, id) => a + byCat.get(id)!.length, 0) };
}

/** Every picture the PDF needs, so the caller can load them before drawing. */
export function picturesOf(plan: Plan) {
  const covers = new Set<string>(), thumbs = new Set<string>(), swatches = new Set<string>();
  for (const id of plan.order) {
    const r = plan.rangeOf.get(id)!;
    if (coverOf(r)) covers.add(coverOf(r));
    for (const s of plan.byCat.get(id)!) { if (s.thumb) thumbs.add(s.thumb); if (s.swatch) swatches.add(s.swatch); }
  }
  return { covers: [...covers], thumbs: [...thumbs], swatches: [...swatches] };
}

// Two categories print a real group shot instead of the page's card picture
// (white-balanced only; chosen for the first PDF catalogue).
const COVER_OVERRIDE: Record<string, string> = { y95: '/po/pdf/cover-y95.jpg', y16: '/po/pdf/cover-y16.jpg' };
export const coverOf = (r: EffectiveRange) => COVER_OVERRIDE[r.id] || r.cover || '';

export const waLink = (num: string, text?: string) => `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const prettyPhone = (num: string) => (/^91\d{10}$/.test(num) ? `+91 ${num.slice(2, 7)} ${num.slice(7)}` : `+${num}`);

/**
 * What prints for a choice of categories: the shop sections as buyers see them
 * (with the owner's saved edits), keeping only the picked categories. Hidden and
 * deleted ranges/styles never print; out-of-stock styles only when asked.
 */
export function pdfSelection(cat: AccessoryCatalogue, ov: AccessoryOverrides, picked: Set<string>, includeOut: boolean) {
  const { ranges, styles } = effectiveCatalogue(ov, cat);
  const rangeById = new Map(ranges.map((r) => [r.id, r]));
  const sections: PdfSection[] = effectiveSections(ov.sections, cat).map((g) => ({
    id: g.id, name: g.name, sub: g.sub,
    cats: g.cats.map((id) => rangeById.get(id)).filter((r): r is EffectiveRange => !!r && picked.has(r.id) && !r.hidden && !r.deleted)
  }));
  const keep = styles
    .filter((s) => !s.hidden && !s.deleted && !s.rangeHidden && (includeOut || !s.out));
  return { sections, styles: keep };
}
