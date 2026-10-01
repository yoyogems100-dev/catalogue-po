// Reading sizes the way buyers write them in a notebook: "110" (1.10 mm),
// "2.00", "1.2-1.8", "3, 3.5, 4", "1x1.5x2". Used by the Moissanite quick
// order sheet (components/SizeGridComposer).

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
  // "3, 3.5, 4-5": each part on its own, in size order, once each.
  if (text.includes(',')) {
    const found = new Map<number, S>();
    for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
      const r = resolveSizes(shapeSizes, part);
      if ('error' in r) return r;
      r.sizes.forEach((s) => found.set(s.id, s));
    }
    return found.size ? { sizes: sortSizes([...found.values()]) } : { error: 'Type a size' };
  }
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
