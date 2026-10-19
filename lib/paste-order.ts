// "Paste your list": reads an order the way buyers already write one -- a
// WhatsApp message, a notebook list, or rows copied out of Excel / Numbers --
// and matches every line to a stone, colour, shape, size and quantity in the
// catalogue (owner, 2026-10-17). Nothing is guessed: a line that could be two
// things, or is missing something, is returned with the choices to pick from.
//
//   Blue Nano #114 Pear          <- sets the stone, colour and shape
//   4x6 1000                     <- one line each, carrying them down
//   5 X 7 - 2000 pcs
//   Oval 4x6 1,000               <- a new shape keeps the colour
//
// Copied spreadsheet rows (tab separated, with a header row naming ITEM /
// SHAPE / SIZE / QUANTITY) are read column by column; blank cells carry down
// from the row above, as they do in the team's order sheets.
import type { CatalogueMap, MapCategory } from './catalogue-map';
import { resolveSizes, sortSizes, type QuickSize } from './quick-order';

export type PasteHints = {
  /** Colours named on the line (or carried down), any of which it could be. */
  colorIds: number[];
  shapeIds: number[];
  /** Categories named by a word in their name ("cz", "nano"); null when none was. */
  categoryIds: number[] | null;
  sizeText: string | null;
  qty: number | null;
  grade: string | null;
  /** Words that matched nothing: kept as the line's note. */
  note: string;
  /** An item or shape name that matched nothing in the catalogue ("rodolite"). */
  unknown: string;
};

export type PasteRow = { key: string; line: number; raw: string; block: number; hints: PasteHints };
export type PasteParse = { rows: PasteRow[]; ignored: string[] };

export type PasteField = 'stone' | 'colour' | 'shape' | 'size' | 'quantity' | 'quality';
/** What the buyer chose for a row in the review. */
export type PastePick = Partial<{ categoryId: number; colorId: number; shapeId: number; sizeId: number; qty: number; grade: string }>;

export type PasteResolved = {
  categoryId: number | null;
  colorId: number | null;
  shapeId: number | null;
  sizeId: number | null;
  qty: number | null;
  grade: string | null;
  missing: PasteField[];
  /** Why a field is missing, in words ("No 9x11 mm — nearest: 8x10, 10x12"). */
  problem: string | null;
  /** A category ordered on its own page (Rainbow strips, drilled stones, Moissanite carats). */
  ownPage: boolean;
  categoryChoices: number[];
  colorChoices: number[];
  shapeChoices: number[];
  sizeChoices: number[];
  gradeChoices: string[];
};

export type ResolveContext = {
  /** Qualities offered for a category + shape (Ruby Corundum 5A / 7A); empty for none. */
  qualities?: (categoryId: number, shapeId: number) => string[];
  /** The buyer's usual quality for a category, if they have one. */
  preferredGrade?: (categoryId: number) => string | null;
  /** Categories that can't be ordered from a pasted list. */
  ownPage?: (categoryId: number) => boolean;
  /** The colour a category's order form fixes (Swiss: White), if any. */
  fixedColor?: (categoryId: number) => number | null;
  /** The buyer's usual stone for a colour ("White -> 5A Quality CZ"), if any. */
  preferredCategory?: (colorId: number) => number | null;
};

// ---------------------------------------------------------------------------
// Words

const SHAPE_ALIASES: Record<string, string> = {
  octo: 'octagon', octa: 'octagon', oct: 'octagon',
  buguette: 'baguette', baguatte: 'baguette', bagutte: 'baguette', bagette: 'baguette', baguett: 'baguette', bag: 'baguette',
  trangle: 'triangle', triangel: 'triangle', tringle: 'triangle',
  tapper: 'tapered baguette', taper: 'tapered baguette', tapered: 'tapered baguette',
  trilliant: 'trillion', trilion: 'trillion',
  marquis: 'marquise', marquees: 'marquise', mq: 'marquise',
  rd: 'round', rnd: 'round',
  princes: 'princess', sq: 'square', cush: 'cushion', cushon: 'cushion',
  hart: 'heart', ovel: 'oval', peer: 'pear',
  emerald: 'emerald cut', emarald: 'emerald cut', radient: 'radiant', checkers: 'checker',
  cobochon: 'cabochon', cabachon: 'cabochon', cabochan: 'cabochon', cab: 'cabochon', cabs: 'cabochon',
};

// Words in category names that don't tell one stone from another.
const CATEGORY_STOPWORDS = new Set(['stones', 'stone', 'quality', 'high', 'density', 'the', 'and', 'of', 'cut', '&', 'glass', 'synthetic', 'ring']);
const CATEGORY_ALIASES: Record<string, string> = { swiss: 'swiz', crush: 'crushed', labgrown: 'lab', corundam: 'corundum', zircon: 'cz' };
// Filler that is never worth keeping as a note.
const NOTE_STOPWORDS = new Set(['pcs', 'pc', 'pieces', 'piece', 'nos', 'no', 'each', 'mm', 'size', 'sizes', 'qty', 'quantity', 'x', 'and', 'of', 'the', 'in', 'colour', 'color', 'shape', 'stone', 'stones', 'item', 'sr', 'pls', 'please', 'need', 'required', 'want', 'order', 'total', 'also', '-', 'ct']);

const words = (s: string) => s.toLowerCase().replace(/#/g, ' ').replace(/[^a-z0-9.]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  .map((w) => w.replace(/^\.+|\.+$/g, '')).filter(Boolean);
const keyOf = (tokens: string[]) => [...tokens].sort().join(' ');
const isNumeric = (t: string) => /^\d/.test(t);

type Dict = { colors: Map<string, number[]>; shapes: Map<string, number[]>; categoryWords: Map<string, number[]>; maxLen: number };

const dictCache = new WeakMap<CatalogueMap, Dict>();
const GRADE_TOKEN = /^(?:[1-9]a\+?|a{2,4})$/;

function dictFor(map: CatalogueMap): Dict {
  const cached = dictCache.get(map);
  if (cached) return cached;
  const add = (m: Map<string, number[]>, key: string, id: number) => {
    const list = m.get(key);
    if (!list) m.set(key, [id]); else if (!list.includes(id)) list.push(id);
  };
  const colors = new Map<string, number[]>();
  const shapes = new Map<string, number[]>();
  const categoryWords = new Map<string, number[]>();
  let maxLen = 1;
  for (const c of map.colors) {
    const t = words(c.name);
    if (!t.length) continue;
    maxLen = Math.max(maxLen, t.length);
    add(colors, keyOf(t), c.id);
  }
  const shapeByName = new Map<string, number[]>();
  for (const s of map.shapes) {
    const t = words(s.name);
    if (!t.length) continue;
    maxLen = Math.max(maxLen, t.length);
    add(shapes, keyOf(t), s.id);
    const name = t.join(' ');
    shapeByName.set(name, [...(shapeByName.get(name) || []), s.id]);
    // "Emerald Cut" is often just "emerald"; "Oval Cabochon (Pota)" just "oval cabochon".
    const short = t.filter((w) => w !== 'cut' && w !== 'shape' && !/^\(/.test(w));
    if (short.length && short.length < t.length) add(shapes, keyOf(short), s.id);
  }
  for (const [alias, target] of Object.entries(SHAPE_ALIASES)) {
    const ids = shapeByName.get(target);
    if (ids) ids.forEach((id) => add(shapes, keyOf(words(alias)), id));
  }
  for (const cat of map.categories) {
    // "4A" in "4A Quality CZ" names that stone as well as a quality.
    for (const w of words(cat.name)) if (!CATEGORY_STOPWORDS.has(w) && (!isNumeric(w) || GRADE_TOKEN.test(w))) add(categoryWords, w, cat.id);
  }
  for (const [alias, target] of Object.entries(CATEGORY_ALIASES)) {
    const ids = categoryWords.get(target);
    if (ids) ids.forEach((id) => add(categoryWords, alias, id));
  }
  const dict = { colors, shapes, categoryWords, maxLen: Math.min(maxLen, 6) };
  dictCache.set(map, dict);
  return dict;
}

// ---------------------------------------------------------------------------
// One line (or cell group) into what it names

type Segment = {
  colorIds: number[];
  shapeIds: number[];
  categoryIds: number[] | null;
  grade: string | null;
  sizes: string[];
  qty: number | null;
  /** Words and numbers that matched nothing. */
  rest: string[];
  /** Unknown words before the first number: the item's name, not a remark. */
  lead: string[];
  ints?: number[];
  decimals?: string[];
};

/** "1,000" -> "1000", "4 X 6" -> "4x6", "5 mm" -> "5mm", "500 pcs" -> "500pcs", "2k" -> "2000pcs". */
export function normalizeLine(raw: string): string {
  let s = raw.toLowerCase().replace(/[×*]/g, 'x');
  s = s.replace(/(\d),(?=\d{2},\d{3}\b)/g, '$1').replace(/(\d),(?=\d{3}\b)/g, '$1');
  s = s.replace(/(\d)\s*mm\b/g, '$1mm');
  for (let i = 0; i < 3; i++) s = s.replace(/(\d+(?:\.\d+)?)(?:mm)?\s*x\s*(?=\d)/g, '$1x');
  s = s.replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, n) => `${Math.round(Number(n) * 1000)}pcs`);
  s = s.replace(/(\d)\s*(?:pcs|pc|pieces|piece|nos|no)\b\.?/g, '$1pcs');
  return s;
}

const SIZE_TOKEN = /^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)+(?:mm)?$|^\d+(?:\.\d+)?mm$/;
// Words that say nothing about which colour or shape is meant.
const FUZZY_IGNORE = new Set([...NOTE_STOPWORDS, 'one', 'two', 'three', 'with', 'hole', 'holes', 'per', 'for', 'cut', 'cuts', 'type', 'new', 'old', 'same', 'as', 'sample', 'last', 'time', 'sent']);

function readSegment(text: string, dict: Dict): Segment {
  const tokens = words(normalizeLine(text));
  const seg: Segment = { colorIds: [], shapeIds: [], categoryIds: null, grade: null, sizes: [], qty: null, rest: [], lead: [] };
  const used = new Array(tokens.length).fill(false);
  // Longest run of words naming a colour or a shape, in any word order
  // ("checker round" is the Round Checker; "nano blue 114" is Blue Nano #114).
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    for (let len = Math.min(dict.maxLen, tokens.length - i); len >= 1; len--) {
      const run = tokens.slice(i, i + len);
      if (run.some((_, j) => used[i + j]) || !run.some((t) => !isNumeric(t))) continue;
      const k = keyOf(run);
      const plural = len === 1 && run[0].length > 3 && run[0].endsWith('s') ? run[0].slice(0, -1) : null;
      const colorHit = dict.colors.get(k);
      const shapeHit = dict.shapes.get(k) || (plural ? dict.shapes.get(plural) : undefined);
      if (!colorHit && !shapeHit) continue;
      if (colorHit) colorHit.forEach((id) => { if (!seg.colorIds.includes(id)) seg.colorIds.push(id); });
      if (shapeHit) shapeHit.forEach((id) => { if (!seg.shapeIds.includes(id)) seg.shapeIds.push(id); });
      for (let j = 0; j < len; j++) used[i + j] = true;
      break;
    }
  }
  const catHits: number[][] = [];
  const ints: number[] = [];
  const decimals: string[] = [];
  let seenNumber = false;
  tokens.forEach((t, i) => {
    if (isNumeric(t)) seenNumber = true;
    if (used[i]) return;
    if (SIZE_TOKEN.test(t)) { seg.sizes.push(t.replace(/mm$/, '')); return; }
    if (/^\d+pcs$/.test(t)) { seg.qty = Number(t.replace('pcs', '')); return; }
    if (/^\d+$/.test(t)) { ints.push(Number(t)); return; }
    if (/^\d+\.\d+$/.test(t)) { decimals.push(t); return; }
    const cats = dict.categoryWords.get(t);
    if (GRADE_TOKEN.test(t)) { seg.grade = t.toUpperCase(); if (cats) catHits.push(cats); return; }
    if (cats) { catHits.push(cats); return; }
    seg.rest.push(t);
    // Unknown words before the numbers are the item's name ("Aqua 8x4.5 50");
    // words after them are a remark ("4x6 1000 for hand setting").
    if (!seenNumber && !FUZZY_IGNORE.has(t) && t.length >= 3) seg.lead.push(t);
  });
  if (catHits.length) {
    // "coloured cz" -> the categories named by both words, else by either.
    const both = catHits.reduce((acc, ids) => acc.filter((id) => ids.includes(id)));
    seg.categoryIds = both.length ? both : [...new Set(catHits.flat())];
  }
  seg.ints = ints;
  seg.decimals = decimals;
  return seg;
}

/** Free text: the last whole number is the quantity (unless "pcs" marked one), a decimal or "mm" number the size. */
function settleNumbers(seg: Segment) {
  const ints = seg.ints || [], decimals = seg.decimals || [];
  if (seg.qty === null && ints.length && (seg.sizes.length || decimals.length || ints.length > 1)) seg.qty = ints.pop()!;
  else if (seg.qty === null && ints.length === 1 && !seg.sizes.length && ints[0] >= 50) seg.qty = ints.pop()!;
  if (!seg.sizes.length && decimals.length) seg.sizes.push(decimals.shift()!);
  if (!seg.sizes.length && ints.length && ints[0] < 50) seg.sizes.push(String(ints.shift()!));
  ints.forEach((n) => seg.rest.push(String(n)));
  decimals.forEach((d) => seg.rest.push(d));
  seg.ints = []; seg.decimals = [];
}

/** Names that hold every typed word as the start of one of their words: "aqua" -> Aqua Blue, "checker" -> Round Checker. */
function namesStartingWith(list: { id: number; name: string }[], lead: string[]): number[] {
  if (!lead.length) return [];
  return list.filter((x) => {
    const ws = words(x.name);
    return lead.every((l) => ws.some((w) => w.startsWith(l)));
  }).map((x) => x.id);
}

function mergeSegments(a: Segment, b: Segment): Segment {
  const uniq = (x: number[], y: number[]) => [...new Set([...x, ...y])];
  return {
    colorIds: uniq(a.colorIds, b.colorIds), shapeIds: uniq(a.shapeIds, b.shapeIds),
    categoryIds: a.categoryIds && b.categoryIds ? (a.categoryIds.filter((id) => b.categoryIds!.includes(id)).length ? a.categoryIds.filter((id) => b.categoryIds!.includes(id)) : uniq(a.categoryIds, b.categoryIds)) : a.categoryIds || b.categoryIds,
    grade: a.grade || b.grade, sizes: [...a.sizes, ...b.sizes], qty: a.qty ?? b.qty,
    rest: [...a.rest, ...b.rest], lead: [...a.lead, ...b.lead],
    ints: [...(a.ints || []), ...(b.ints || [])], decimals: [...(a.decimals || []), ...(b.decimals || [])],
  };
}

// ---------------------------------------------------------------------------
// The whole paste

type Columns = { item: number[]; shape: number[]; size: number; qty: number; note: number; ignore: number[] };

function headerColumns(cells: string[]): Columns | null {
  const cols: Columns = { item: [], shape: [], size: -1, qty: -1, note: -1, ignore: [] };
  cells.forEach((c, i) => {
    const h = c.trim().toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!h) return;
    // The first SIZE / QUANTITY column wins: some sheets keep a second,
    // working copy of the table to the right.
    if (/^(item|items|colou?r|stone|material|description|product|name of item)$/.test(h)) cols.item.push(i);
    else if (/^(shape|cut|shapecut|shape cut)$/.test(h)) cols.shape.push(i);
    else if (/^(size|sizes|size mm|mm)$/.test(h) && cols.size < 0) cols.size = i;
    else if (/^(quantity|qty|pcs|pieces|nos)$/.test(h) && cols.qty < 0) cols.qty = i;
    else if (/^(remark|remarks|note|notes|comment)$/.test(h) && cols.note < 0) cols.note = i;
    else cols.ignore.push(i);
  });
  return (cols.size >= 0 && cols.qty >= 0) || (cols.item.length && (cols.size >= 0 || cols.qty >= 0)) ? cols : null;
}

/** "100 Pcs Each" -> 100; anything else in the cell is a remark. */
function qtyCell(text: string): { qty: number | null; rest: string[] } {
  const t = words(normalizeLine(text));
  const m = t[0]?.match(/^(\d+)(?:pcs)?$/);
  return m ? { qty: Number(m[1]), rest: t.slice(1) } : { qty: null, rest: t };
}

/** Reads a pasted list into rows. Lines that name things but no size or quantity carry down to the lines below. */
export function parsePastedList(text: string, map: CatalogueMap): PasteParse {
  const dict = dictFor(map);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const rows: PasteRow[] = [];
  const ignored: string[] = [];
  const ctx = { colorIds: [] as number[], shapeIds: [] as number[], categoryIds: null as number[] | null, grade: null as string | null, note: '', unknown: '' };
  let block = 0;
  let columns: Columns | null = null;
  const firstFilled = lines.findIndex((l) => l.trim());
  if (firstFilled >= 0 && lines[firstFilled].includes('\t')) columns = headerColumns(lines[firstFilled].split('\t'));

  lines.forEach((raw, index) => {
    if (!raw.trim() || (columns && index === firstFilled)) return;
    let seg: Segment;
    let noteCell = '';
    // Unknown words in the colour/item part and in the shape part.
    let itemLead: string[] = [];
    let shapeLead: string[] = [];
    let flagged = false;
    if (columns) {
      const cells = raw.split('\t');
      const at = (i: number) => (i >= 0 ? cells[i] || '' : '');
      const item = readSegment(columns.item.map(at).join(' '), dict);
      const shape = readSegment(columns.shape.map(at).join(' '), dict);
      itemLead = item.rest.filter((w) => !FUZZY_IGNORE.has(w) && w.length >= 3 && !isNumeric(w));
      shapeLead = shape.rest.filter((w) => !FUZZY_IGNORE.has(w) && w.length >= 3 && !isNumeric(w));
      seg = mergeSegments(item, shape);
      const q = qtyCell(at(columns.qty));
      const sizeText = at(columns.size).trim();
      const strayNumbers = seg.sizes.length || (seg.ints || []).length || (seg.decimals || []).length;
      if (q.qty !== null || !strayNumbers) {
        if (sizeText) seg.sizes = [normalizeLine(sizeText).replace(/\s+/g, '').replace(/mm$/, '')];
        seg.qty = q.qty;
        seg.rest.push(...q.rest);
        (seg.ints || []).forEach((n) => seg.rest.push(String(n)));
        (seg.decimals || []).forEach((d) => seg.rest.push(d));
      } else {
        // A row typed one column off ("Gold CZ | 1.10mm | 15000" under
        // ITEM | SHAPE | SIZE): read its numbers as free text instead.
        seg = mergeSegments(seg, readSegment(`${sizeText} ${at(columns.qty)}`, dict));
        seg.sizes = seg.sizes.filter(Boolean);
        settleNumbers(seg);
      }
      noteCell = at(columns.note).trim();
      // Something order-like outside the columns read (an extra block typed
      // beside the table) is reported rather than dropped.
      const outside = columns.ignore.map(at).join(' ');
      if (/\d\s*[x×*]\s*\d/i.test(outside)) { ignored.push(columns.ignore.map(at).filter((c) => c.trim()).join('  ')); flagged = true; }
    } else {
      seg = readSegment(raw, dict);
      settleNumbers(seg);
      itemLead = seg.lead;
    }

    // An item or shape we couldn't name exactly: look for names that start
    // with its words, and never let the row above's colour/shape stand in.
    let unknown = '';
    let dropColour = false, dropShape = false;
    if (!seg.colorIds.length && itemLead.length) {
      const colours = namesStartingWith(map.colors, itemLead);
      const shapes = columns ? [] : namesStartingWith(map.shapes, itemLead);
      if (colours.length) seg.colorIds = colours;
      if (shapes.length && !seg.shapeIds.length) seg.shapeIds = shapes;
      if (!colours.length && !shapes.length) unknown = itemLead.join(' ');
      if (!colours.length) dropColour = true;
    }
    if (!seg.shapeIds.length && shapeLead.length) {
      const shapes = namesStartingWith(map.shapes, shapeLead);
      if (shapes.length) seg.shapeIds = shapes;
      else { dropShape = true; unknown = [unknown, shapeLead.join(' ')].filter(Boolean).join(' '); }
    }
    const nameWords = new Set([...itemLead, ...shapeLead]);
    const restNote = seg.rest.filter((w) => !NOTE_STOPWORDS.has(w) && !nameWords.has(w)).join(' ');
    const own = [noteCell, restNote].filter(Boolean).join(' · ');
    const noNumbers = !seg.sizes.length && seg.qty === null;
    // A line of plain words under a row ("for hand setting") is that block's
    // note, not a new item -- unless its words name a colour, shape or stone.
    if (noNumbers && !columns && rows.length && !seg.colorIds.length && !seg.shapeIds.length && !seg.categoryIds) {
      const words = [own, unknown].filter(Boolean).join(' ');
      if (words) {
        const last = rows[rows.length - 1];
        ctx.note = [ctx.note, words].filter(Boolean).join(' · ');
        rows.filter((r) => r.block === last.block).forEach((r) => { r.hints.note = [r.hints.note, words].filter(Boolean).join(' · '); });
      }
      return;
    }
    if (dropColour) { ctx.colorIds = []; if (!seg.categoryIds) ctx.categoryIds = null; }
    if (dropShape) ctx.shapeIds = [];

    const namesSomething = !!(seg.colorIds.length || seg.shapeIds.length || seg.categoryIds || itemLead.length || shapeLead.length);
    if (seg.colorIds.length) { ctx.colorIds = seg.colorIds; ctx.categoryIds = seg.categoryIds; }
    else if (seg.categoryIds) {
      // A new stone named without a colour: colours (and shapes) carried from
      // above only stay if that stone has them.
      const named = map.categories.filter((c) => seg.categoryIds!.includes(c.id));
      ctx.categoryIds = seg.categoryIds;
      ctx.colorIds = ctx.colorIds.filter((id) => named.some((c) => c.colorIds.includes(id)));
      if (!seg.shapeIds.length) ctx.shapeIds = ctx.shapeIds.filter((id) => named.some((c) => c.shapeIds.includes(id)));
    }
    if (seg.shapeIds.length) ctx.shapeIds = seg.shapeIds;
    if (seg.grade) ctx.grade = seg.grade;
    if (namesSomething) { block++; ctx.note = ''; ctx.unknown = unknown; }

    if (noNumbers) {
      if (namesSomething) { if (own) ctx.note = own; return; }
      if (rows.length && !flagged) ignored.push(raw.trim().replace(/\t+/g, '  '));
      return;
    }
    // A remark in a sheet's note column, or words on a row, hold for the rest of its block.
    if (own) ctx.note = [ctx.note, own].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
    const sizes = seg.sizes.length ? seg.sizes : [null];
    sizes.forEach((sizeText, i) => {
      rows.push({
        key: `${index}-${i}`,
        line: index + 1,
        raw: raw.trim().replace(/\t+/g, '  '),
        block,
        hints: {
          colorIds: ctx.colorIds, shapeIds: ctx.shapeIds, categoryIds: ctx.categoryIds,
          sizeText, qty: seg.qty, grade: seg.grade || ctx.grade, note: ctx.note, unknown: ctx.unknown,
        },
      });
    });
  });
  return { rows, ignored };
}

// ---------------------------------------------------------------------------
// Matching a row to the catalogue

const quick = (map: CatalogueMap, cat: MapCategory, shapeId: number): QuickSize[] => {
  const ids = new Set(cat.sizeIds);
  return sortSizes(map.sizes.filter((s) => s.shapeId === shapeId && ids.has(s.id)).map((s) => ({ id: s.id, shape_id: s.shapeId, size_mm: s.sizeMm })));
};
const sizeFits = (map: CatalogueMap, cat: MapCategory, shapeIds: number[], sizeText: string) =>
  (shapeIds.length ? shapeIds : cat.shapeIds).some((sid) => 'sizes' in resolveSizes(quick(map, cat, sid), sizeText));

/** One row against the catalogue, with the buyer's picks applied. `prefer` is the stone the rows above settled on. */
export function resolveRow(row: PasteRow, pick: PastePick, map: CatalogueMap, ctx: ResolveContext = {}, prefer: number | null = null): PasteResolved {
  const h = row.hints;
  const out: PasteResolved = {
    categoryId: null, colorId: null, shapeId: null, sizeId: null, qty: pick.qty ?? h.qty, grade: null,
    missing: [], problem: null, ownPage: false,
    categoryChoices: [], colorChoices: [], shapeChoices: [], sizeChoices: [], gradeChoices: [],
  };
  const shapeHint = pick.shapeId ? [pick.shapeId] : h.shapeIds;
  const colorHint = pick.colorId ? [pick.colorId] : h.colorIds;

  // Stone
  let cats = map.categories;
  if (pick.categoryId) cats = cats.filter((c) => c.id === pick.categoryId);
  else {
    if (h.categoryIds) cats = cats.filter((c) => h.categoryIds!.includes(c.id));
    if (colorHint.length) cats = cats.filter((c) => colorHint.some((id) => c.colorIds.includes(id)));
    if (shapeHint.length) cats = cats.filter((c) => shapeHint.some((id) => c.shapeIds.includes(id)));
    if (cats.length > 1 && h.sizeText) {
      const fit = cats.filter((c) => sizeFits(map, c, shapeHint.filter((id) => c.shapeIds.includes(id)), h.sizeText!));
      if (fit.length) cats = fit;
    }
  }
  const named = !!(h.categoryIds || colorHint.length || shapeHint.length);
  let cat: MapCategory | undefined;
  if (cats.length === 1) cat = cats[0];
  else if (cats.length > 1 && prefer && cats.some((c) => c.id === prefer)) cat = cats.find((c) => c.id === prefer);
  else if (cats.length > 1 && ctx.preferredCategory) {
    const usual = colorHint.map((id) => ctx.preferredCategory!(id)).find((id) => id && cats.some((c) => c.id === id));
    if (usual) cat = cats.find((c) => c.id === usual);
  }
  if (!cat) {
    out.missing.push('stone');
    out.categoryChoices = (cats.length > 1 ? cats : !named ? map.categories
      : map.categories.filter((c) => (h.categoryIds?.includes(c.id)) || colorHint.some((id) => c.colorIds.includes(id)))).map((c) => c.id);
    if (!out.categoryChoices.length) out.categoryChoices = map.categories.map((c) => c.id);
    out.problem = cats.length > 1 ? 'Which stone?' : named ? 'No stone has all of this — choose one' : 'Choose the stone';
  } else {
    out.categoryId = cat.id;
    out.ownPage = !!ctx.ownPage?.(cat.id);
  }

  if (cat) {
    // Colour
    const colours = colorHint.filter((id) => cat!.colorIds.includes(id));
    const fixed = ctx.fixedColor?.(cat.id) ?? null;
    if (colours.length === 1) out.colorId = colours[0];
    else if (!colours.length && cat.colorIds.length === 1) out.colorId = cat.colorIds[0];
    else if (!colours.length && fixed && cat.colorIds.includes(fixed)) out.colorId = fixed;
    else {
      out.missing.push('colour');
      out.colorChoices = colours.length > 1 ? colours : cat.colorIds;
    }
    // Shape
    const shapesHere = shapeHint.filter((id) => cat!.shapeIds.includes(id));
    if (shapesHere.length === 1) out.shapeId = shapesHere[0];
    else if (shapesHere.length > 1 && h.sizeText) {
      const fit = shapesHere.filter((id) => 'sizes' in resolveSizes(quick(map, cat!, id), h.sizeText!));
      if (fit.length === 1) out.shapeId = fit[0];
    } else if (!shapesHere.length && cat.shapeIds.length === 1) out.shapeId = cat.shapeIds[0];
    if (!out.shapeId) {
      out.missing.push('shape');
      out.shapeChoices = shapesHere.length > 1 ? shapesHere : cat.shapeIds;
    }
    // Size
    if (out.shapeId) {
      const list = quick(map, cat, out.shapeId);
      out.sizeChoices = list.map((s) => s.id);
      if (pick.sizeId && list.some((s) => s.id === pick.sizeId)) out.sizeId = pick.sizeId;
      else if (h.sizeText) {
        const r = resolveSizes(list, h.sizeText);
        if ('sizes' in r) out.sizeId = r.sizes[0].id;
        else out.problem = out.problem || r.error;
      } else if (list.length === 1) out.sizeId = list[0].id;
      if (!out.sizeId) out.missing.push('size');
    }
    // Quality
    if (out.shapeId) {
      const grades = ctx.qualities?.(cat.id, out.shapeId) || [];
      out.gradeChoices = grades;
      if (grades.length) {
        const preferred = ctx.preferredGrade?.(cat.id) || null;
        out.grade = [pick.grade, h.grade, preferred, grades.length === 1 ? grades[0] : null].find((g) => g && grades.includes(g)) || null;
        if (!out.grade) out.missing.push('quality');
      }
    }
  }
  if (!out.qty || out.qty <= 0 || !Number.isSafeInteger(out.qty) || out.qty > 2147483647) { out.qty = null; out.missing.push('quantity'); }
  if (h.unknown && out.missing.some((f) => f === 'stone' || f === 'colour' || f === 'shape')) out.problem = `Not in the catalogue as written: “${h.unknown}”`;
  return out;
}

/** Every row in order; a row's stone, when left open, follows the stone of the rows above it. */
export function resolveAll(rows: PasteRow[], picks: Record<string, PastePick>, map: CatalogueMap, ctx: ResolveContext = {}): PasteResolved[] {
  let prefer: number | null = null;
  return rows.map((row) => {
    const r = resolveRow(row, picks[row.key] || {}, map, ctx, prefer);
    if (r.categoryId) prefer = r.categoryId;
    return r;
  });
}

export const isReady = (r: PasteResolved) => r.missing.length === 0 && !r.ownPage;

/** A pasted line, named, ready to become an order line. */
export type PastedLine = {
  categoryId: number; categoryName: string;
  shapeId: number; shapeName: string;
  sizeId: number; sizeMm: string;
  colorId: number; colorName: string; colorHex: string | null; colorRefPhotoUrl: string | null;
  qty: number; grade: string | null; note: string;
  shapeRefPhotoUrl?: string | null; shapeIconKey?: string | null; qtyUnit?: string | null;
};
