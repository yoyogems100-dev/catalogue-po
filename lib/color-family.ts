// Buyers think "blue" or "red", not "113# Burma Blue" or "G-36". The colour
// master list is ~200 supplier codes in several naming conventions, so the
// home page filters by family instead and lets the category page carry the
// exact code.
//
// The name decides first: supplier hex values on coded entries are often
// placeholders (e.g. "#204 London Blue" is stored as an olive #998848), so
// the swatch is only consulted for names with no colour word at all
// ("104#", "#46").
export type ColorFamily = {
  id: number;
  name: string;
  hex: string;
};

export const COLOR_FAMILIES: ColorFamily[] = [
  { id: 1, name: 'White', hex: '#F2F1ED' },
  { id: 2, name: 'Black', hex: '#1A1A1A' },
  { id: 3, name: 'Grey & Silver', hex: '#8B8B8B' },
  { id: 4, name: 'Red', hex: '#9B111E' },
  { id: 5, name: 'Pink', hex: '#E4A0BE' },
  { id: 6, name: 'Orange & Peach', hex: '#E2793D' },
  { id: 7, name: 'Yellow & Gold', hex: '#E8B923' },
  { id: 8, name: 'Champagne & Brown', hex: '#8C6239' },
  { id: 9, name: 'Green', hex: '#3FAE6A' },
  { id: 10, name: 'Blue', hex: '#1B3A8B' },
  { id: 11, name: 'Purple', hex: '#7E4A9B' },
  { id: 12, name: 'Colour change', hex: '#8B7FB0' }
];

// Priority order matters: "Morganite Orange" is orange, not pink; "Purple
// Garnet" is purple, not red; "Rose Gold" is pink, not gold; "Turquoise Green"
// reads as blue-green and sits with the blues.
const RULES: [number, RegExp][] = [
  [12, /change|alexandrite/],
  [1, /white|colou?rless|clear|cream|ivory/],
  [2, /black/],
  [3, /gr[ae]y|silver|platinum/],
  [6, /orange|padparadscha|partschinite|peach|mars stone/],
  [5, /pink|rose|morganite|kunzite|fuchsia|mauve|rhodolite/],
  [11, /purple|violet|amethyst|lavender|orchid/],
  [4, /red|ruby|garnet|burgundy/],
  [10, /blue|sapphire|aqua|paraiba|topaz|zircon|turquoise|tanzanite/],
  [9, /green|emerald|peridot|olive|tsavorite|mint|malachite|tourmaline|apple/],
  [7, /yellow|lemon|gold|canary|amber|citrine/],
  [8, /brown|coffee|bronze|champagne|almond|chocolate/]
];

function hexFamily(hex: string | null | undefined): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l > 0.9) return 1;
  if (l < 0.12) return 2;
  if (s < 0.15) return 3;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return 4;
  if (h < 40) return 6;
  if (h < 70) return 7;
  if (h < 165) return 9;
  if (h < 255) return 10;
  if (h < 290) return 11;
  return 5;
}

export function colorFamilyId(name: string, hex?: string | null): number | null {
  const n = name.toLowerCase();
  for (const [id, re] of RULES) if (re.test(n)) return id;
  return hexFamily(hex);
}

/** Family name first, then the colour's own name -- what a buyer might type. */
export function colorSearchText(name: string, hex?: string | null): string {
  const family = COLOR_FAMILIES.find((f) => f.id === colorFamilyId(name, hex));
  return `${family ? family.name.toLowerCase() : ''} ${name.toLowerCase()}`;
}
