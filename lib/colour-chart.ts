// The customer colour chart (components/ColorChartPreview.tsx): which family a
// colour sits in -- from its name where the name says ("Morganite Pink",
// "Sky Blue"), else from its swatch hex -- and its supplier code split from
// the name ("G-42 M-Pink" -> "G-42" + "M-Pink").

export type ChartColour = { id: number; name: string; hex: string | null; refPhotoUrl: string | null };

export const COLOUR_FAMILIES = ['Whites', 'Yellows', 'Oranges', 'Champagne & browns', 'Reds', 'Pinks', 'Purples', 'Blues', 'Aquas & teals', 'Greens', 'Greys & smoky'] as const;
export type ColourFamily = (typeof COLOUR_FAMILIES)[number];

function hsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

// First match wins, so "Purplish Pink" is a pink and "Rose Purple" a purple.
const BY_NAME: [RegExp, ColourFamily][] = [
  [/white|clear|crystal/, 'Whites'],
  [/gr[ae]y|smok|black/, 'Greys & smoky'],
  [/brown|coffee|champagne|mars|chocolate/, 'Champagne & browns'],
  [/yellow|lemon|gold/, 'Yellows'],
  [/orange|papaya|partschinite|padparadscha|peach/, 'Oranges'],
  [/pink/, 'Pinks'],
  [/purple|violet|orchid|lavender|amethyst/, 'Purples'],
  [/red|ruby/, 'Reds'],
  [/rhodolite|rosy|rose|garnet/, 'Pinks'],
  [/paraiba|aqua|teal|ice blue|sky|mint blue|turquoise/, 'Aquas & teals'],
  [/blue|sapphire|tanzanite/, 'Blues'],
  [/green|emerald|peridot|olive|mint|tourmaline/, 'Greens']
];

export function colourFamily(hex: string | null, name = ''): ColourFamily {
  const words = splitColourCode(name).label.toLowerCase();
  for (const [re, family] of BY_NAME) if (re.test(words)) return family;
  const v = hex ? hsl(hex) : null;
  if (!v) return 'Greys & smoky';
  const [h, s, l] = v;
  if (l > 0.9 || (l > 0.8 && s < 0.35 && !(h >= 40 && h < 70))) return 'Whites';
  if (s < 0.2) return 'Greys & smoky';
  if (h >= 345 || h < 10) return 'Reds';
  if (h < 45) return l < 0.45 || (h >= 30 && s < 0.66) ? 'Champagne & browns' : 'Oranges';
  if (h < 70) return 'Yellows';
  if (h < 165) return 'Greens';
  if (h < 200) return 'Aquas & teals';
  if (h < 250) return 'Blues';
  if (h < 300) return 'Purples';
  return 'Pinks';
}

/** "G-42 M-Pink" -> { code: 'G-42', label: 'M-Pink' }; names without a code stay whole. */
export function splitColourCode(name: string): { code: string | null; label: string } {
  const m = /^([A-Z]{1,3}-?\s?\d{1,3}[A-Z]?)\s+(.+)$/.exec(name.trim());
  return m ? { code: m[1].replace(/\s/g, ''), label: m[2] } : { code: null, label: name };
}
