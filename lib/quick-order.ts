// Reading sizes and quantities the way buyers write them in a notebook:
// "110 -> 70 ct", "2.00 - 50ct", "1.2-1.8 100", "1x1.5x2 50". Used by the
// Moissanite quick order sheet (components/SizeGridComposer).

export type QuickShape = { id: number; name: string };
export type QuickSize = { id: number; shape_id: number; size_mm: string; pcs_per_ct?: number | null };

const EPS = 1e-6;

/** One dimension as written: "110" is 1.10 mm and "200" is 2.00 mm. No stone is 50 mm or more. */
function dim(text: string): number | null {
  const t = text.trim();
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return /^\d+$/.test(t) && n >= 50 ? n / 100 : n;
}

function dims(text: string): number[] | null {
  const parts = text.toLowerCase().replace(/mm/g, '').split(/\s*[x×*]\s*/);
  const out: number[] = [];
  for (const p of parts) {
    const d = dim(p);
    if (d === null) return null;
    out.push(d);
  }
  return out.length ? out : null;
}

function sizeDims(size: QuickSize): number[] {
  return size.size_mm.split(/[x×*]/i).map((p) => Number(p.trim()));
}

// Order-free: buyers write a tapered baguette 1x1.5x2 where the list says 2x1.5x1.
const sorted = (d: number[]) => [...d].sort((x, y) => x - y);
const sameDims = (a: number[], b: number[]) => {
  const sa = sorted(a), sb = sorted(b);
  return sa.length === sb.length && sa.every((v, i) => Math.abs(v - sb[i]) < EPS);
};

export function sortSizes<S extends QuickSize>(list: S[]): S[] {
  return [...list].sort((a, b) => {
    const da = sizeDims(a), db = sizeDims(b);
    for (let i = 0; i < Math.max(da.length, db.length); i++) {
      const d = (da[i] || 0) - (db[i] || 0);
      if (d) return d;
    }
    return 0;
  });
}

/**
 * The sizes a typed size stands for in one shape: one size, every size in a
 * range ("1.2-1.8", "1.2 to 1.8"), or an error saying what is offered nearby.
 */
export function resolveSizes<S extends QuickSize>(shapeSizes: S[], text: string): { sizes: S[] } | { error: string } {
  const t = text.trim().toLowerCase().replace(/\s*mm\b/g, '');
  if (!t) return { error: 'Type a size' };
  const range = t.match(/^(\S+?)\s*(?:-|–|to)\s*(\S+)$/);
  if (range && !/[x×*]/.test(t)) {
    const a = dim(range[1]), b = dim(range[2]);
    if (a === null || b === null) return { error: `“${text.trim()}” is not a size` };
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const hit = sortSizes(shapeSizes.filter((s) => {
      const d = sizeDims(s);
      return d.length === 1 && d[0] >= lo - EPS && d[0] <= hi + EPS;
    }));
    return hit.length ? { sizes: hit } : { error: `No sizes from ${lo} to ${hi} mm` };
  }
  const want = dims(t);
  if (!want) return { error: `“${text.trim()}” is not a size` };
  const hit = shapeSizes.find((s) => sameDims(sizeDims(s), want));
  if (hit) return { sizes: [hit] };
  // "19" with no 19 mm stone is 1.9 mm, written without its point.
  if (/^\d{2,3}$/.test(t)) {
    for (const scale of [10, 100]) {
      const alt = shapeSizes.find((s) => sameDims(sizeDims(s), [Number(t) / scale]));
      if (alt) return { sizes: [alt] };
    }
  }
  const near = nearestSizes(shapeSizes, want);
  return { error: `No ${want.join('x')} mm${near.length ? ` — nearest: ${near.join(', ')}` : ''}` };
}

function nearestSizes(shapeSizes: QuickSize[], want: number[]): string[] {
  return shapeSizes
    .map((s) => ({ s, d: sizeDims(s) }))
    .filter(({ d }) => d.length === want.length)
    .map(({ s, d }) => ({ s, gap: sorted(d).reduce((n, v, i) => n + Math.abs(v - sorted(want)[i]), 0) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 2)
    .map(({ s }) => s.size_mm);
}

/** Sizes to suggest while a size is being typed: those starting with it, as written or as "110" -> 1.1. */
export function suggestSizes<S extends QuickSize>(shapeSizes: S[], text: string, limit = 8): S[] {
  const t = text.trim().toLowerCase().replace(/\s*mm$/, '').replace(/\s+/g, '');
  if (!t || /[-–]|to/.test(t)) return [];
  // Digits with no point, "22" on the way to "225": match sizes without their point too.
  const digits = /^\d{2,}$/.test(t) ? t : null;
  return sortSizes(shapeSizes)
    .filter((s) => {
      const name = s.size_mm.toLowerCase().replace(/\s+/g, '');
      return name.startsWith(t) || (digits !== null && /^\d(\.|$)/.test(name) && (name.replace('.', '') + '00').startsWith(digits));
    })
    .slice(0, limit);
}

/** A shape named the way buyers spell it: "MARQUISS", "Bagutte", "round:". */
export function matchShape<S extends QuickShape>(shapes: S[], text: string): S | null {
  const t = text.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (t.length < 3) return null;
  const exact = shapes.find((s) => s.name.toLowerCase() === t);
  if (exact) return exact;
  const head = t.slice(0, 4);
  const hits = shapes.filter((s) => s.name.toLowerCase().startsWith(head) || s.name.toLowerCase().split(' ').some((w) => w.startsWith(head) && t.length >= 4));
  // "Baguette" also starts "Tapered Baguette"'s last word: prefer the name that starts with it.
  return hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(head)) - Number(a.name.toLowerCase().startsWith(head)) || a.name.length - b.name.length)[0] || null;
}

export type ParsedLine = { shapeId: number; sizeId: number; amount: number };
/** problems: why each line was not added; rejected: those lines as written, to correct and read again. */
export type ParseResult = { lines: ParsedLine[]; problems: string[]; rejected: string[] };

/**
 * A whole order typed or pasted as text, one shape heading then its sizes:
 *
 *   Round
 *   1.00 -> 30 ct
 *   1.2-1.8 100
 *   Pear: 7x9 20
 *
 * Lines before any heading belong to `currentShapeId`. A size the heading's
 * shape lacks is looked up in shapes whose name contains it (a 1x1.5x2 under
 * "Baguette" is a Tapered Baguette). Weight is only for sizes sold by carat;
 * "ct" written against a size sold by pieces is reported, not converted.
 */
export function parseOrderText<S extends QuickSize>(text: string, shapes: QuickShape[], sizes: S[], currentShapeId: number | null): ParseResult {
  const lines: ParsedLine[] = [];
  const problems: string[] = [];
  const rejected: string[] = [];
  let shapeId = currentShapeId;
  const segments = text
    .replace(/→|->|=>|—|–(?=\s)/g, ' ')
    .split(/\n|;|,(?!\d)/)
    .map((s) => s.trim())
    .filter(Boolean);

  let heading = '';
  const reject = (seg: string, why: string) => {
    problems.push(`${seg} — ${why}`);
    // Keep the shape heading with a rejected line, so reading it again lands in the same shape.
    if (heading && !rejected.includes(heading)) rejected.push(heading);
    rejected.push(seg);
  };
  for (let seg of segments) {
    // "Round:" or "Round: 1 30" -- a heading, optionally with the first item.
    const head = seg.match(/^([a-z][a-z ]*?)\s*[:\-]?\s*(?=\d|$)/i);
    if (head && head[1].trim()) {
      const shape = matchShape(shapes, head[1]);
      if (!shape) { reject(seg, `shape not recognised`); continue; }
      shapeId = shape.id;
      heading = shape.name;
      seg = seg.slice(head[0].length).trim();
      if (!seg) continue;
    }
    if (shapeId === null) { reject(seg, `say which shape first`); continue; }
    // Size, then amount with an optional unit; a spaced dash is only a separator.
    const m = seg.replace(/\s+-\s+/g, ' ').match(/^(.+?)\s+(\d+)\s*(ct|cts|carat|carats|pcs|pc|pieces)?\.?$/i);
    if (!m) { reject(seg, `write the size then the amount, e.g. 1.1 70`); continue; }
    const [, sizeText, amountText, unit] = m;
    const amount = Number(amountText);
    if (!Number.isSafeInteger(amount) || amount <= 0) { reject(seg, `amount must be a whole number`); continue; }

    const own = sizes.filter((s) => s.shape_id === shapeId);
    let found = resolveSizes(own, sizeText);
    let foundShapeId = shapeId;
    if ('error' in found) {
      const name = shapes.find((s) => s.id === shapeId)?.name.toLowerCase() || '';
      for (const other of shapes) {
        if (other.id === shapeId || !name || !other.name.toLowerCase().includes(name)) continue;
        const alt = resolveSizes(sizes.filter((s) => s.shape_id === other.id), sizeText);
        if ('sizes' in alt) { found = alt; foundShapeId = other.id; break; }
      }
    }
    if ('error' in found) { reject(seg, `${found.error}`); continue; }
    const byWeight = /^c/i.test(unit || '');
    const wrongUnit = found.sizes.find((s) => byWeight && !s.pcs_per_ct);
    if (wrongUnit) { reject(seg, `${wrongUnit.size_mm} mm is ordered in pcs, not ct`); continue; }
    const byPcs = /^p/i.test(unit || '');
    const wrongPcs = found.sizes.find((s) => byPcs && s.pcs_per_ct);
    if (wrongPcs) { reject(seg, `${wrongPcs.size_mm} mm is ordered in ct`); continue; }
    for (const s of found.sizes) lines.push({ shapeId: foundShapeId, sizeId: s.id, amount });
  }
  return { lines, problems, rejected };
}
