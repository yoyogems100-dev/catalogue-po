import { colorFamilyId } from './color-family';

// The filter box in the shape/colour dropdowns. Buyers type shorthand and
// typos -- "m pink", "mpink", "monalsa", "rose" -- and still mean Monalisa
// Pink, so a plain "name contains the text" test isn't enough. Scores, best
// first; 0 means leave the option out:
//   4  the name contains what was typed, as typed
//   3  every typed word starts a word of the name ("m pink", "mon pi")
//   2  run-together starts of the name's words ("mpink", "mp"), a word
//      inside a joined-up name ("rose" in Creamrose), skipped letters
//      ("blk", "m pnk") or a one-letter typo ("pnik", "monalsa")
//   1  colours only: a colour word of the same family ("rose" finds Monalisa
//      Pink, "mint" finds Green) -- see lib/color-family.ts
// Sizes have their own matcher (sizeSearchScore in lib/size-options.ts).

// Words that say nothing about which option is meant.
const FILLER = new Set(['color', 'colour', 'colors', 'colours', 'stone', 'stones', 'shade', 'cs']);

const words = (s: string) => s.toLowerCase().replace(/[x*×]/g, 'x').split(/[^a-z0-9.#]+/).filter(Boolean);

/** Damerau edit distance capped at `max` (returns max + 1 past it). */
function closeEnough(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length] <= max;
}

function isSubsequence(q: string, w: string): boolean {
  let i = 0;
  for (const ch of w) if (ch === q[i]) i++;
  return i === q.length;
}

/** A typed word against one word of the name: 3 starts it, 2 a one-letter slip. */
function wordScore(q: string, w: string): number {
  if (w.startsWith(q)) return 3;
  // Inside a joined-up name ("rose" in "Creamrose").
  if (q.length >= 3 && w.includes(q)) return 2;
  // Letters skipped, as in "wht", "blk", "grn".
  if (q.length >= 3 && q[0] === w[0] && isSubsequence(q, w)) return 2;
  if (q.length >= 4) {
    // Against the whole word, or the start of a longer one ("monalsa" ~ "monalisa").
    if (closeEnough(q, w, 1) || closeEnough(q, w.slice(0, q.length), 1)) return 2;
  }
  return 0;
}

/** "mpink" / "mp" / "monpink": each piece starts a later word of the name. */
function runTogether(q: string, ws: string[], from = 0): boolean {
  if (!q) return true;
  for (let j = from; j < ws.length; j++) {
    for (let k = Math.min(q.length, ws[j].length); k >= 1; k--) {
      if (ws[j].startsWith(q.slice(0, k)) && runTogether(q.slice(k), ws, j + 1)) return true;
    }
  }
  return false;
}

export function optionSearchScore(query: string, name: string, color?: { hex?: string | null }): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const n = name.toLowerCase();
  if (n.replace(/[x*×]/g, 'x').includes(q.replace(/[x*×]/g, 'x'))) return 4;

  const nameWords = words(name);
  const typed = words(q).filter((w) => !FILLER.has(w));
  if (!typed.length) return 0;
  const family = color ? colorFamilyId(name, color.hex) : null;

  let worst = 4;
  for (const t of typed) {
    let best = Math.max(0, ...nameWords.map((w) => wordScore(t, w)));
    if (!best && t.length >= 2 && runTogether(t, nameWords)) best = 2;
    if (!best && family !== null && t.length >= 3 && colorFamilyId(t) === family) best = 1;
    if (!best) return 0;
    worst = Math.min(worst, best);
  }
  return worst;
}

/** The options that match, best first, keeping the list's own order within a score. */
export function searchOptions<T extends { name: string; hex?: string | null }>(options: T[], query: string, isColor: boolean): T[] {
  if (!query.trim()) return options;
  return options
    .map((o, i) => ({ o, i, score: optionSearchScore(query, o.name, isColor ? { hex: o.hex } : undefined) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.o);
}
