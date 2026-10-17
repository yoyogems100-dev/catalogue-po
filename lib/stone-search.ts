// "Which stone?" search on the order form: "yellow cz", "ruby 5", "nano 114"
// finds the stone (and colour) so a mixed order moves from one stone to the
// next without going back to the catalogue (owner, 2026-10-17).
import type { CatalogueMap } from './catalogue-map';

export type StoneHit = {
  categoryId: number;
  categoryName: string;
  slug: string;
  colorId: number | null;
  colorName: string | null;
  hex: string | null;
  refPhotoUrl: string | null;
};

const ALIASES: Record<string, string[]> = { swiz: ['swiss'], cz: ['zircon', 'zirconia'], corundum: ['corundam'] };
const words = (s: string) => s.toLowerCase().replace(/#/g, ' ').replace(/[^a-z0-9.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
const withAliases = (ws: string[]) => ws.flatMap((w) => [w, ...(ALIASES[w] || [])]);

/** Stones (and stone + colour pairs) whose names hold every typed word as the start of a word. */
export function searchStones(map: CatalogueMap, query: string, limit = 8): StoneHit[] {
  const q = words(query);
  if (!q.length) return [];
  const colorById = new Map(map.colors.map((c) => [c.id, c]));
  const scored: { hit: StoneHit; score: number }[] = [];
  for (const cat of map.categories) {
    if (!cat.slug) continue;
    const catWords = withAliases(words(cat.name));
    const base = { categoryId: cat.id, categoryName: cat.name, slug: cat.slug };
    // The stone on its own: every word is in its name.
    if (q.every((t) => catWords.some((w) => w.startsWith(t)))) {
      scored.push({ hit: { ...base, colorId: null, colorName: null, hex: null, refPhotoUrl: null }, score: 10 + q.length });
    }
    for (const colorId of cat.colorIds) {
      const color = colorById.get(colorId);
      if (!color) continue;
      const colorWords = words(color.name);
      let colourMatches = 0;
      const ok = q.every((t) => {
        if (colorWords.some((w) => w.startsWith(t))) { colourMatches++; return true; }
        return catWords.some((w) => w.startsWith(t));
      });
      // A pair needs at least one word of the colour; "nano" alone is the stone.
      if (!ok || !colourMatches) continue;
      const exact = colorWords.join(' ') === q.filter((t) => colorWords.some((w) => w.startsWith(t))).join(' ') ? 2 : 0;
      scored.push({ hit: { ...base, colorId, colorName: color.name, hex: color.hex, refPhotoUrl: color.refPhotoUrl }, score: colourMatches * 3 + exact + (colourMatches < q.length ? 1 : 0) });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || (a.hit.colorName || '').length - (b.hit.colorName || '').length || a.hit.categoryName.localeCompare(b.hit.categoryName))
    .slice(0, limit)
    .map((s) => s.hit);
}
