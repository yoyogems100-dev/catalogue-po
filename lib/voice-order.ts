// Turning a spoken (or typed / pasted) order into order lines. Buyers speak
// the way they write in a notebook or on WhatsApp, in Indian English mixed
// with Hindi:
//
//   "ice crush k cushion shape ka 4 mmm 1000 qty 5mm 500 qty 2mm 3mm 1mm ka 600 piece"
//
// is Crushed Ice Cut, Cushion: 4 mm x 1000, 5 mm x 500, and 2, 3 and 1 mm at
// 600 each. Three steps, all on the device (no paid service, works offline):
//
//   1. normalize() -- lower case, Devanagari to Latin, Hindi/English number
//      words to digits ("dhai hazaar" -> 2500, "two thousand" -> 2000),
//      "4mm"/"4 m m"/"4 mmm" -> "4 mm", "6 by 8" -> "6x8".
//   2. parseOrderText() -- finds catalogue words (exact, alias, or a near
//      spelling/sound-alike: "kushan" is Cushion, "markis" is Marquise) and
//      numbers (size or quantity, from "mm"/"qty"/"ka" and the number itself),
//      then groups them into lines: a quantity closes the sizes said before
//      it, and the stone/shape/colour carry on to the next line until changed.
//   3. resolveLine() -- maps each line onto real catalogue ids for that stone.
//      Anything it can't pin down stays null, with what was heard kept beside
//      it, so the grid can ask the buyer instead of guessing.
import type { CatalogueMap, MapCategory } from './catalogue-map';
import { colorFamilyId } from './color-family';
import { lineQualities, type CategoryQualities, type ShapeQualities } from './qualities';
import { specialCategory } from './order-specs';

// ---------------------------------------------------------------------------
// 1. Normalising what was said

const DEVANAGARI: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऋ': 'ri',
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ृ': 'ri',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '', '़': '', '।': '.',
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};
const CONSONANT = /[\u0915-\u0939\u0958-\u095F]/;
const MATRA = /[\u093E-\u094D]/;

/** Rough Hindi-to-Latin spelling: "कुशन" -> "kushan", which then sounds like Cushion. */
export function transliterate(text: string): string {
  let out = '';
  const chars = [...text.normalize('NFC')];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    const mapped = DEVANAGARI[ch];
    if (mapped === undefined) { out += ch; continue; }
    out += mapped;
    // A bare consonant carries a short "a" unless a vowel sign or virama
    // follows, or it ends the word (Hindi drops the final "a").
    if (CONSONANT.test(ch) && next && !MATRA.test(next) && next !== '़' && /[ऀ-ॿ]/.test(next)) out += 'a';
  }
  return out;
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // Hindi, as speech-to-text spells it in Latin script.
  ek: 1, teen: 3, tin: 3, char: 4, chaar: 4, panch: 5, paanch: 5, pach: 5, chhe: 6, chhah: 6, chheh: 6, saat: 7, sat: 7,
  aath: 8, ath: 8, nau: 9, das: 10, dus: 10, gyarah: 11, barah: 12, baarah: 12, pandrah: 15, bees: 20, bis: 20,
  pachees: 25, pachis: 25, tees: 30, chalis: 40, chaalis: 40, pachas: 50, pachaas: 50, pachchas: 50
};
// "do" is also the English word ("de do"), so it only counts as 2 before a
// multiplier or a unit ("do hazaar", "do mm").
const WEAK_UNITS: Record<string, number> = { do: 2, che: 6 };
const FRACTIONS: Record<string, number> = { dedh: 1.5, dedhh: 1.5, derh: 1.5, dhai: 2.5, dhaai: 2.5, dhaee: 2.5, adha: 0.5, aadha: 0.5, half: 0.5 };
const MULTIPLIERS: Record<string, number> = {
  hundred: 100, sau: 100, so: 100, thousand: 1000, hazaar: 1000, hazar: 1000, hajar: 1000, hajaar: 1000, hazzar: 1000,
  lakh: 100000, lac: 100000, lakhs: 100000, lacs: 100000
};
// "saade teen" = 3.5, "sawa do" = 2.25, "paune teen" = 2.75.
const ADDERS: Record<string, number> = { saade: 0.5, sade: 0.5, saadhe: 0.5, sadhe: 0.5, sawa: 0.25, sava: 0.25, paune: -0.25, pone: -0.25 };

const QTY_WORDS = new Set(['qty', 'quantity', 'quantities', 'qnty', 'qt', 'pcs', 'pc', 'piece', 'pieces', 'peace', 'pis', 'pees', 'nos', 'nag', 'nug', 'dana', 'dane', 'daane', 'daana', 'stone', 'stones', 'line', 'lines', 'lari', 'ladi', 'strand', 'strands', 'kitna', 'chahiye']);
const QTY_BEFORE = new Set(['qty', 'quantity', 'qnty', 'qt']);
const CARAT_WORDS = new Set(['ct', 'cts', 'carat', 'carats', 'karat', 'karet', 'carrot', 'carrots']);
const LINKERS = new Set(['ka', 'ke', 'ki', 'k', 'ko', 'kaa', 'kay']);
const FILLERS = new Set([
  'and', 'aur', 'or', 'also', 'bhi', 'then', 'phir', 'fir', 'next', 'plus', 'with', 'in', 'mein', 'me', 'mai', 'main', 'mei', 'wala', 'wali', 'wale', 'vala', 'vale',
  'shape', 'shapes', 'shep', 'sep', 'shaip', 'cut', 'colour', 'color', 'colours', 'colors', 'rang', 'size', 'sizes', 'stone', 'please', 'pls', 'send', 'bhejo', 'bhej', 'dena', 'de', 'dijiye', 'dedo',
  'chahiye', 'chaiye', 'want', 'need', 'order', 'the', 'a', 'an', 'of', 'for', 'each', 'har', 'sab', 'sabhi', 'all', 'hai', 'hain', 'h', 'is', 'are', 'it', 'yes', 'ok', 'okay',
  'is', 'iska', 'uska', 'same', 'wahi', 'ye', 'yeh', 'vo', 'woh', 'to', 'toh', 'bhai', 'ji', 'sir', 'madam', 'number', 'no', 'code', 'shade', 'tak', 'se', 'pe', 'par', 'and'
]);
const SIZE_JOINERS = new Set(['x', 'by', 'into', 'cross', 'bye', 'buy', 'multiply', 'guna']);

/** Words to tokens, with sizes ("6x8"), units and number words already folded. */
export function normalize(text: string): string[] {
  let t = transliterate(text).toLowerCase();
  t = t.replace(/(\d),(?=\d{2,3}\b)/g, '$1') // 1,000 / 1,00,000
    .replace(/[×*]/g, ' x ')
    .replace(/#/g, ' ')
    .replace(/(\d)\s*(?:m\.\s?m\.?|mm+|m\s+m\b|em\s*a?\s*em\b|millimet(?:er|re)s?|mili(?:meter)?s?|ml)(?![a-z])/g, '$1 mm ')
    .replace(/\b(?:m\.\s?m\.?|mmm+|em\s*a?\s*em|millimet(?:er|re)s?)(?![a-z])/g, ' mm ')
    .replace(/(\d)\s*k\b/g, '$1 thousand ')
    .replace(/(\d)(pcs|pc|qty|nos|ct|cts|x)(?![a-z])/g, '$1 $2 ')
    .replace(/(\d)x(\d)/g, '$1 x $2')
    .replace(/\b(?:ji|jee)\s+(?=\d)/g, 'g ') // "G-40" said aloud
    .replace(/\b([a-z])(\d+)\b/g, '$1 $2') // "g40" -> "g 40"
    .replace(/\b(\d+)\s+a\b/g, '$1a') // "5 a" -> grade 5A
    .replace(/\btriple\s*a\b|\baaa\b/g, '3a')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/(^|\s)\.+|\.+(?=\s|$)/g, ' , ');
  const raw = t.split(/\s+/).filter(Boolean).map((w) => (w === ',' ? ',' : w));

  // Number words to digits.
  const out: string[] = [];
  let i = 0;
  const numAt = (j: number): number | null => {
    const w = raw[j];
    if (w === undefined) return null;
    if (/^\d+(?:\.\d+)?$/.test(w)) return Number(w);
    if (w in UNITS) return UNITS[w];
    if (w in FRACTIONS) return FRACTIONS[w];
    if (w in WEAK_UNITS && (raw[j + 1] in MULTIPLIERS || raw[j + 1] === 'mm')) return WEAK_UNITS[w];
    return null;
  };
  while (i < raw.length) {
    const w = raw[i];
    let adder = 0;
    let j = i;
    if (w in ADDERS && numAt(i + 1) !== null) { adder = ADDERS[w]; j = i + 1; }
    let n = numAt(j);
    if (n === null) { out.push(w); i++; continue; }
    // "twenty five" -> 25
    if (n >= 20 && n < 100 && n % 10 === 0 && !/\d/.test(raw[j]) ) {
      const m = numAt(j + 1);
      if (m !== null && m > 0 && m < 10 && !/\d/.test(raw[j + 1])) { n += m; j++; }
    }
    // "2 point 5" -> 2.5
    if ((raw[j + 1] === 'point' || raw[j + 1] === 'dot') && /^\d$/.test(String(numAt(j + 2) ?? ''))) {
      n = Number(`${n}.${numAt(j + 2)}`);
      j += 2;
    }
    n += adder;
    // Multipliers: "dhai hazaar" 2500, "two thousand five hundred" 2500, "1 lakh" 100000.
    let total = 0;
    let current = n;
    let k = j + 1;
    let usedMultiplier = false;
    while (k < raw.length) {
      const mw = raw[k];
      if (mw in MULTIPLIERS) {
        const mul = MULTIPLIERS[mw];
        if (mul >= 1000) { total += current * mul; current = 0; } else current *= mul;
        usedMultiplier = true;
        k++;
        continue;
      }
      // "2 thousand 5 hundred": a number followed by another multiplier.
      if (usedMultiplier && (mw === 'and' || /^\d+$/.test(mw) || mw in UNITS)) {
        const look = mw === 'and' ? k + 1 : k;
        const m = numAt(look);
        if (m !== null && raw[look + 1] in MULTIPLIERS && MULTIPLIERS[raw[look + 1]] < (total ? 1000 : Infinity)) { current += m; k = look + 1; continue; }
        if (m !== null && m < 100 && total >= 1000 && current === 0 && !(raw[look + 1] === 'mm')) { current += m; k = look + 1; continue; }
      }
      break;
    }
    const value = Math.round((total + current) * 1000) / 1000;
    out.push(String(value));
    i = k;
  }

  // "6 x 8" / "6 by 8" -> "6x8"; "4 mm by 6 mm" too.
  const joined: string[] = [];
  for (let p = 0; p < out.length; p++) {
    const w = out[p];
    const prev = joined[joined.length - 1];
    if (SIZE_JOINERS.has(w) && prev && /^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)*$/.test(prev)) {
      let q = p + 1;
      if (out[q] === 'mm') q++;
      if (/^\d+(?:\.\d+)?$/.test(out[q] || '')) { joined[joined.length - 1] = `${prev}x${out[q]}`; p = q; continue; }
    }
    if (w === 'mm' && SIZE_JOINERS.has(out[p + 1] || '') && /^\d/.test(prev || '')) continue; // "4 mm by 6"
    joined.push(w);
  }
  return joined;
}

// ---------------------------------------------------------------------------
// 2. Catalogue words

type Kind = 'category' | 'shape' | 'color' | 'family';
type Entry = { kind: Kind; ids: number[]; words: string[]; text: string; key: string; alias: boolean; needsMarker?: boolean };

const singular = (w: string) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

function words(name: string): string[] {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[#()'’]/g, ' ').replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/(\d)([a-z])/g, (m, d, l) => (l === 'a' ? m : `${d} ${l}`))
    .split(/\s+/).filter(Boolean).map(singular);
}

/** A rough sound-key for Indian-English spellings: "cushion"/"kushan" -> "ksn". */
export function soundKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';
  w = w.replace(/ph/g, 'f').replace(/sch|sh|ch(?=[ei])/g, 's').replace(/ch/g, 'c').replace(/c(?=[eiy])/g, 's').replace(/ck|c|q/g, 'k')
    .replace(/x/g, 'ks').replace(/w/g, 'v').replace(/z/g, 'j').replace(/([kgtdbp])h/g, '$1').replace(/ti(?=on|an)/g, 's')
    .replace(/y/g, 'i').replace(/gue$|ge$/g, 'j');
  // A leading vowel is just "a": "ice" and "aais" (Hindi spelling) sound alike.
  const first = /[aeiou]/.test(w[0]) ? 'a' : w[0];
  const rest = w.slice(1).replace(/[aeiouh]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// Hand-written aliases: trade short names, Hindi words, and the ways speech
// recognition commonly mishears a word in an Indian accent.
const CATEGORY_ALIASES: Record<number, string[]> = {
  1: ['ice crush', 'crush ice', 'crushed ice', 'ice cut', 'crush cut', 'ice crushed', 'ice crash', 'crash ice'],
  29: ['rainbow'],
  34: ['moissanite', 'moisanite', 'mossanite', 'moissonite', 'mozanite'],
  12: ['coloured cz', 'colour cz', 'color cz', 'cz colour', 'cz color', 'colored cz'],
  2: ['ruby corundum', 'corundum ruby'],
  4: ['turkey', 'turkish', 'turkey ring'],
  20: ['hole punch', 'hole punched', 'hole wala', 'hole'],
  37: ['5a cz', 'cz 5a', '5a quality'],
  39: ['swiss', 'swiz', 'swiss cz', 'high density', 'swiss high density'],
  35: ['3a cz', 'cz 3a', '3a quality'],
  36: ['4a cz', 'cz 4a', '4a quality'],
  32: ['7a', '7a cz', 'cz 7a', '7a quality'],
  38: ['heighted', 'height cz', 'heighted cz'],
  28: ['solitaire', 'fancy solitaire'],
  9: ['opal', 'opals'],
  44: ['mop', 'mother of pearl'],
  19: ['polki', 'flat polki', 'foil polki'],
  13: ['conch', 'queen conch'],
  18: ['foil crystal', 'foiled crystal', 'foil glass crystal'],
  23: ['glass filled', 'ruby glass', 'ruby glass filled'],
  26: ['ruby opaque', 'ruby chatam', 'ruby chatham'],
  25: ['green onyx', 'chatam', 'chatham'],
  27: ['preform', 'ball', 'balls'],
  31: ['starlight', 'star light'],
  42: ['synthetic corundum']
};
const SHAPE_ALIASES: Record<string, string[]> = {
  round: ['gol', 'round', 'rd', 'rond', 'ground'],
  heart: ['dil', 'heart', 'hart', 'haart'],
  oval: ['oval', 'ovel', 'owal', 'ovaal'],
  pear: ['pear', 'pair', 'peer', 'payar'],
  marquise: ['marquise', 'marquis', 'markis', 'marqis', 'markeez', 'badam', 'badaam'],
  baguette: ['baguette', 'baget', 'bagget', 'bagette', 'baguet'],
  cushion: ['cushion', 'kushan', 'cushan', 'kushion', 'cushon', 'kushn'],
  princess: ['princess', 'princes'],
  trillion: ['trillion', 'trillian', 'trilliant'],
  'emerald cut': ['emerald cut', 'emerald shape'],
  square: ['square', 'chokor', 'chaukor', 'squire'],
  triangle: ['triangle', 'tikona', 'trikon'],
  cabochon: ['cabochon', 'cab', 'kaboshan', 'cabochan'],
  star: ['star', 'sitara', 'taara'],
  octagon: ['octagon', 'ashtkon']
};
// Hindi colour words -> colour family (lib/color-family ids).
const FAMILY_WORDS: Record<string, number> = {
  safed: 1, safaid: 1, white: 1, kala: 2, kaala: 2, kali: 2, black: 2, grey: 3, gray: 3, silver: 3, lal: 4, laal: 4, red: 4,
  pink: 5, gulabi: 5, orange: 6, narangi: 6, kesari: 6, peach: 6, yellow: 7, peela: 7, pila: 7, peeli: 7, gold: 7, golden: 7, sunehra: 7,
  brown: 8, bhura: 8, champagne: 8, coffee: 8, green: 9, hara: 9, hari: 9, blue: 10, neela: 10, nila: 10, neeli: 10, aasmani: 10,
  purple: 11, jamuni: 11, baingani: 11, violet: 11
};

/** Every word a buyer might use for the catalogue, built once per map. */
export function buildVocabulary(map: CatalogueMap): Entry[] {
  const byKey = new Map<string, Entry>();
  const add = (kind: Kind, id: number, phrase: string, alias: boolean, needsMarker = false) => {
    const w = words(phrase);
    if (!w.length) return;
    const text = w.join(' ');
    const k = `${kind}|${text}`;
    const existing = byKey.get(k);
    if (existing) { if (!existing.ids.includes(id)) existing.ids.push(id); existing.alias &&= alias; return; }
    byKey.set(k, { kind, ids: [id], words: w, text, key: w.map(soundKey).join(' '), alias, needsMarker });
  };
  const GENERIC = /\b(stones?|quality|cut)\b/g;
  for (const c of map.categories) {
    add('category', c.id, c.name, false);
    const short = c.name.replace(/\(.*?\)/g, ' ').replace(GENERIC, ' ').replace(/\s+/g, ' ').trim();
    if (short && short.toLowerCase() !== c.name.toLowerCase() && words(short).length) add('category', c.id, short, true);
    const inner = c.name.match(/\((.*?)\)/)?.[1];
    if (inner) add('category', c.id, inner, true);
    for (const a of CATEGORY_ALIASES[c.id] || []) add('category', c.id, a, true);
  }
  for (const s of map.shapes) {
    add('shape', s.id, s.name, false);
    const inner = s.name.match(/\((.*?)\)/)?.[1];
    if (inner) add('shape', s.id, inner, true);
    const plain = s.name.replace(/\(.*?\)/g, '').trim();
    if (plain !== s.name) add('shape', s.id, plain, true);
    for (const a of SHAPE_ALIASES[plain.toLowerCase()] || []) add('shape', s.id, a, true);
  }
  for (const c of map.colors) {
    const name = c.name.trim();
    const w = words(name);
    // "104#" / "#46" are only colours when introduced: "number 104", "colour 46".
    const numeric = w.every((x) => /^\d/.test(x));
    add('color', c.id, name, false, numeric);
    // "G-18 Fancy Green" -> also "Fancy Green" and "G 18"; "113# Burma Blue" -> "Burma Blue".
    const code = name.match(/^#?([A-Za-z]{0,3}-?\d+[A-Za-z]?\/?\d*)#?\s+(.+)$/);
    if (code) {
      add('color', c.id, code[2], true);
      add('color', c.id, code[1], true, /^\d/.test(code[1]));
    }
    const trailing = name.match(/^(.+?)\s+#?(\d+)$/);
    if (trailing && !code) add('color', c.id, trailing[1], true);
  }
  for (const [word, family] of Object.entries(FAMILY_WORDS)) add('family', family, word, true);
  return [...byKey.values()];
}

type Match = { entry: Entry; length: number; score: number; heard: string };

/** The best catalogue phrase starting at token i, longest and closest first. */
function matchAt(tokens: string[], i: number, vocab: Entry[], markerBefore: boolean): Match | null {
  let best: Match | null = null;
  for (let n = Math.min(5, tokens.length - i); n >= 1; n--) {
    const slice = tokens.slice(i, i + n);
    if (slice.includes(',')) continue;
    if (n > 1 && (FILLERS.has(slice[n - 1]) || LINKERS.has(slice[n - 1]))) continue;
    const text = slice.map(singular).join(' ');
    const keys = slice.map((w) => soundKey(singular(w))).join(' ');
    for (const e of vocab) {
      if (e.words.length !== n) continue;
      if (e.needsMarker && !markerBefore) continue;
      let score = 0;
      if (e.text === text) score = e.alias ? 0.97 : 1;
      else if (!/\d/.test(text) && text.length >= 4) {
        const d = editDistance(e.text, text);
        const ratio = 1 - d / Math.max(e.text.length, text.length);
        const soundAlike = e.key === keys && e.key.replace(/\s/g, '').length >= 3 && ratio >= 0.5;
        if (ratio >= 0.84 || soundAlike) score = 0.6 + ratio * 0.3;
      }
      if (!score) continue;
      // Longer phrases win ("green onyx" over "green"), then closeness.
      const total = score + n * 0.5;
      if (!best || total > best.score) best = { entry: e, length: n, score: total, heard: slice.join(' ') };
    }
    if (best && best.length === n && best.score >= n * 0.5 + 0.97) break; // exact long match: stop
  }
  return best;
}

// ---------------------------------------------------------------------------
// 3. Grouping into lines

export type Mention = { ids: number[]; heard: string; family?: number | null };
export type RawLine = {
  category?: Mention;
  shape?: Mention;
  color?: Mention;
  grade?: string;
  size?: string;
  sizeHeard?: string;
  qty?: number | null;
  qtyHeard?: string;
};
/** What carries over from one spoken sentence to the next. */
export type ParseContext = { category?: Mention; shape?: Mention; color?: Mention; grade?: string };

const isNum = (w: string) => /^\d+(?:\.\d+)?$/.test(w);
const isSize = (w: string) => /^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)+$/.test(w);
const GRADE = /^(\d)a$|^(aa)$/;

type Token =
  | { t: 'attr'; field: 'category' | 'shape' | 'color'; m: Mention }
  | { t: 'grade'; g: string }
  | { t: 'size'; v: string; heard: string }
  | { t: 'qty'; v: number | null; heard: string }
  | { t: 'num'; v: number; heard: string; afterLinker: boolean; qtyBefore: boolean }
  | { t: 'sep' };

function tokenize(tokens: string[], vocab: Entry[]): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const w = tokens[i];
    const prev = tokens[i - 1];
    if (w === ',') { out.push({ t: 'sep' }); i++; continue; }
    if (isSize(w)) { out.push({ t: 'size', v: w, heard: `${w} mm` }); i += tokens[i + 1] === 'mm' ? 2 : 1; continue; }
    if (isNum(w)) {
      const next = tokens[i + 1];
      if (next === 'mm') { out.push({ t: 'size', v: w, heard: `${w} mm` }); i += 2; continue; }
      if (next && CARAT_WORDS.has(next)) { out.push({ t: 'qty', v: null, heard: `${w} ct` }); i += 2; continue; }
      if (next && QTY_WORDS.has(next) && !(next === 'stone' && /^\d/.test(tokens[i + 2] || ''))) { out.push({ t: 'qty', v: Number(w), heard: `${w} ${next}` }); i += 2; continue; }
      // A colour introduced by a number: "number 113", "#46".
      const markerBefore = prev === 'number' || prev === 'no' || prev === 'code' || prev === 'shade' || prev === 'colour' || prev === 'color';
      if (markerBefore) {
        const m = matchAt(tokens, i, vocab, true);
        if (m && m.entry.kind === 'color') { out.push({ t: 'attr', field: 'color', m: { ids: m.entry.ids, heard: m.heard } }); i += m.length; continue; }
      }
      // "blue nano 113" -- a number can finish a colour name.
      out.push({ t: 'num', v: Number(w), heard: w, afterLinker: !!prev && LINKERS.has(prev), qtyBefore: !!prev && QTY_BEFORE.has(prev) });
      i++;
      continue;
    }
    if (GRADE.test(w)) {
      const m = matchAt(tokens, i, vocab, false);
      if (m && m.length > 1) { /* "5a cz" -- a category, handled below */ } else { out.push({ t: 'grade', g: w.toUpperCase() }); i++; continue; }
    }
    if (FILLERS.has(w) || LINKERS.has(w) || QTY_WORDS.has(w) || w === 'mm') { i++; continue; }
    const m = matchAt(tokens, i, vocab, false);
    if (m) {
      const e = m.entry;
      const mention: Mention = e.kind === 'family' ? { ids: [], heard: m.heard, family: e.ids[0] } : { ids: e.ids, heard: m.heard };
      out.push({ t: 'attr', field: e.kind === 'family' ? 'color' : e.kind, m: mention });
      i += m.length;
      continue;
    }
    i++;
  }
  return out;
}

/**
 * Lines from one spoken sentence. `context` carries the stone/shape/colour
 * from the previous sentence, and the returned context goes into the next.
 */
export function parseOrderText(text: string, map: CatalogueMap, context: ParseContext = {}, vocab = buildVocabulary(map)): { lines: RawLine[]; context: ParseContext; recognised: number } {
  const toks = tokenize(normalize(text), vocab);
  const lines: RawLine[] = [];
  const ctx: ParseContext = { ...context };
  // Which context fields were said since the last line was made: a new stone
  // keeps a shape said just before it ("cushion ... ice crush ka").
  let fresh = new Set<keyof ParseContext>();
  let pending: RawLine[] = []; // sizes still waiting for their quantity
  let lastGroup: RawLine[] = [];
  let afterQty = false;
  let awaitingSize: RawLine | null = null;
  const said = new WeakMap<RawLine, Set<keyof ParseContext>>();
  let recognised = 0;

  const snapshot = (): RawLine => ({ category: ctx.category, shape: ctx.shape, color: ctx.color, grade: ctx.grade });
  const flushPending = () => { lines.push(...pending); pending = []; };

  for (let idx = 0; idx < toks.length; idx++) {
    const tk = toks[idx];
    if (tk.t === 'sep') continue;
    if (tk.t === 'attr' || tk.t === 'grade') {
      recognised++;
      const field: keyof ParseContext = tk.t === 'grade' ? 'grade' : tk.field;
      const value = tk.t === 'grade' ? tk.g : tk.m;
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      if (afterQty && lastGroup.length && lastGroup.every((l) => !l[field])) {
        // Said after the quantity: "cushion 4mm 1000 white" -- the white is for that line.
        lastGroup.forEach((l) => { (l as any)[field] = value; });
      } else if (pending.length && pending.every((l) => !l[field] || !said.get(l)?.has(field))) {
        // "4mm 5mm white 100": sizes first, then the colour -- also replacing
        // a shape only carried over from the line before ("..., 6x8 oval 200").
        pending.forEach((l) => { (l as any)[field] = value; said.get(l)?.add(field); });
      } else if (pending.length && !same(pending[0][field], value)) {
        flushPending(); // a new shape before those sizes got a quantity
      }
      if (field === 'category' && ctx.category && !same(ctx.category, value)) {
        for (const f of ['shape', 'color', 'grade'] as const) if (!fresh.has(f)) delete ctx[f];
      }
      (ctx as any)[field] = value;
      fresh.add(field);
      continue;
    }
    let kind: 'size' | 'qty';
    let value: string | number | null;
    let heard: string;
    if (tk.t === 'size') { kind = 'size'; value = tk.v; heard = tk.heard; }
    else if (tk.t === 'qty') { kind = 'qty'; value = tk.v; heard = tk.heard; }
    else {
      // A bare number: decide size or quantity from what's around it.
      const n = tk.v;
      const nextIsMmRun = (() => {
        // "2 3 1 mm": numbers in a run ending in a size all are sizes.
        for (let j = idx + 1; j < toks.length; j++) {
          const o = toks[j];
          if (o.t === 'num') continue;
          return o.t === 'size' && !String(o.v).includes('x');
        }
        return false;
      })();
      if (tk.qtyBefore) kind = 'qty';
      else if (tk.afterLinker && pending.length) kind = 'qty';
      else if (nextIsMmRun && n < 30) kind = 'size';
      else if (!Number.isInteger(n)) kind = 'size';
      else if (n >= 30) kind = 'qty';
      else if (pending.length && n >= 10) kind = 'qty';
      else kind = 'size';
      value = kind === 'size' ? String(n) : n;
      heard = kind === 'size' ? `${n} mm` : String(n);
    }
    recognised++;
    if (kind === 'size') {
      if (awaitingSize && !awaitingSize.size) {
        // "qty 1000 round 3mm": the quantity came first.
        awaitingSize.size = String(value);
        awaitingSize.sizeHeard = heard;
        awaitingSize = null;
        continue;
      }
      if (afterQty) { afterQty = false; lastGroup = []; }
      const line: RawLine = { ...snapshot(), size: String(value), sizeHeard: heard };
      // Which parts were said for these sizes, rather than carried over.
      said.set(line, new Set(pending.length ? said.get(pending[0]) : fresh));
      pending.push(line);
      fresh = new Set();
    } else {
      if (pending.length) {
        pending.forEach((l) => { l.qty = value as number | null; l.qtyHeard = heard; });
        awaitingSize = null;
        lastGroup = pending;
        flushPending();
      } else {
        const line: RawLine = { ...snapshot(), qty: value as number | null, qtyHeard: heard };
        lines.push(line);
        lastGroup = [line];
        awaitingSize = line;
      }
      afterQty = true;
      fresh = new Set();
    }
  }
  flushPending();
  // "4mm 1000, 5mm 500 cushion ice crush": the stone and shape named once at
  // the end are for the lines before them too -- but only lines made before
  // that part was ever named. Colours stay with the line they were said for.
  for (const field of ['category', 'shape'] as const) {
    if (context[field]) continue;
    const first = lines.findIndex((l) => l[field]);
    if (first > 0) for (let i = 0; i < first; i++) (lines[i] as any)[field] = lines[first][field];
  }
  if (!lines.length && (ctx.category || ctx.shape || ctx.color) && (fresh.size || !Object.keys(context).length)) lines.push(snapshot());
  return { lines, context: ctx, recognised };
}

// ---------------------------------------------------------------------------
// 4. Matching a line to the catalogue

export type VoiceLine = {
  key: string;
  categoryId: number | null;
  shapeId: number | null;
  sizeId: number | null;
  colorId: number | null;
  grade: string | null;
  qty: number | null;
  /** What was heard for each part, shown beside a part that couldn't be matched. */
  heard: { category?: string; shape?: string; size?: string; color?: string; qty?: string; colorFamily?: number | null };
  /** Parts the interpreter filled in itself (the only stone with this shape and size). */
  guessed: { category?: boolean };
};

type ResolveOptions = { qualities?: CategoryQualities | null; shapeQualities?: ShapeQualities | null };

function sizeDims(s: string): number[] | null {
  const parts = s.toLowerCase().replace(/mm/g, '').replace(/[×*]/g, 'x').split('x').map((p) => p.trim());
  const nums = parts.map(Number);
  if (!nums.length || nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return nums.length > 1 && nums.every((n) => n === nums[0]) ? [nums[0]] : nums; // 4x4 is 4
}
const sameDims = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y), sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => Math.abs(v - sb[i]) < 1e-6);
};

/** The size id for a heard size in this stone and shape, or null. */
export function findSize(map: CatalogueMap, category: MapCategory, shapeId: number, heard: string): number | null {
  const want = sizeDims(heard);
  if (!want) return null;
  const linked = new Set(category.sizeIds);
  const candidates = map.sizes.filter((s) => s.shapeId === shapeId && linked.has(s.id));
  const hit = candidates.find((s) => { const d = sizeDims(s.sizeMm); return !!d && sameDims(d, want); });
  if (hit) return hit.id;
  // "19" or "110" said without the point: 1.9 / 1.1 mm.
  if (want.length === 1 && Number.isInteger(want[0]) && want[0] >= 10) {
    for (const scale of [10, 100]) {
      const alt = candidates.find((s) => { const d = sizeDims(s.sizeMm); return !!d && sameDims(d, [want[0] / scale]); });
      if (alt) return alt.id;
    }
  }
  return null;
}

/** Sizes offered nearby, for a "not available" hint. */
export function nearestSizes(map: CatalogueMap, category: MapCategory, shapeId: number, heard: string, count = 2): string[] {
  const want = sizeDims(heard);
  if (!want) return [];
  const linked = new Set(category.sizeIds);
  return map.sizes
    .filter((s) => s.shapeId === shapeId && linked.has(s.id))
    .map((s) => ({ s, d: sizeDims(s.sizeMm) }))
    .filter((x): x is { s: typeof x.s; d: number[] } => !!x.d && x.d.length === want.length)
    .map(({ s, d }) => ({ s, gap: d.reduce((n, v, i) => n + Math.abs(v - want[i]), 0) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, count)
    .map(({ s }) => s.sizeMm);
}

function categoryFits(map: CatalogueMap, c: MapCategory, line: RawLine): boolean {
  if (line.shape?.ids.length && !line.shape.ids.some((id) => c.shapeIds.includes(id))) return false;
  if (line.color?.ids.length && !line.color.ids.some((id) => c.colorIds.includes(id))) return false;
  if (line.size && line.shape?.ids.length) {
    const shapeId = line.shape.ids.find((id) => c.shapeIds.includes(id));
    if (!shapeId || !findSize(map, c, shapeId, line.size)) return false;
  }
  return true;
}

export function gradesFor(opts: ResolveOptions, categoryId: number | null, shapeId: number | null): string[] {
  if (!categoryId) return [];
  return lineQualities(opts.qualities ?? null, opts.shapeQualities ?? null, categoryId, shapeId ?? 0);
}

let seq = 0;
const newKey = () => `v${Date.now().toString(36)}${(seq++).toString(36)}`;

/** One parsed line on real catalogue ids; whatever doesn't fit stays null. */
export function resolveLine(map: CatalogueMap, line: RawLine, opts: ResolveOptions = {}): VoiceLine {
  const out: VoiceLine = {
    key: newKey(),
    categoryId: null, shapeId: null, sizeId: null, colorId: null, grade: null,
    qty: line.qty && line.qty > 0 ? Math.round(line.qty) : null,
    heard: {
      category: line.category?.heard, shape: line.shape?.heard, size: line.sizeHeard, color: line.color?.heard,
      qty: line.qty ? undefined : line.qtyHeard, colorFamily: line.color?.family ?? (line.color?.ids.length ? null : undefined)
    },
    guessed: {}
  };
  // "5A" with no stone named: the 5A Quality CZ category.
  let category: MapCategory | undefined;
  const named = line.category?.ids.map((id) => map.categories.find((c) => c.id === id)).filter((c): c is MapCategory => !!c) || [];
  if (named.length) category = named.find((c) => categoryFits(map, c, line)) || (named.length === 1 ? named[0] : undefined);
  if (!category && !line.category && line.grade) {
    const g = line.grade.toLowerCase();
    category = map.categories.find((c) => c.name.toLowerCase().startsWith(`${g} quality`));
  }
  if (!category && !line.category && (line.shape?.ids.length || line.color?.ids.length)) {
    // No stone named: if exactly one stone carries this shape/size/colour, it's that one.
    const fits = map.categories.filter((c) => categoryFits(map, c, line));
    if (fits.length === 1) { category = fits[0]; out.guessed.category = true; }
  }
  out.categoryId = category?.id ?? null;
  if (category) delete out.heard.category;
  return refitLine(map, out, opts, line.grade);
}

/**
 * Fill in what can be matched for the line's stone, from what was heard --
 * also run when the buyer changes the stone or shape in the grid, so a size
 * heard as "4 mm" lands on 4x4 once Cushion is chosen.
 */
export function refitLine(map: CatalogueMap, line: VoiceLine, opts: ResolveOptions = {}, heardGrade?: string | null): VoiceLine {
  const out: VoiceLine = { ...line, heard: { ...line.heard } };
  const category = out.categoryId ? map.categories.find((c) => c.id === out.categoryId) : undefined;
  if (!category) return out;
  const vocab = shapeVocabCache.get(map) ?? buildVocabulary(map);
  shapeVocabCache.set(map, vocab);
  const idsFor = (heard: string | undefined, kind: Kind) => {
    if (!heard) return [] as number[];
    const toks = normalize(heard);
    const m = matchAt(toks, 0, vocab.filter((e) => e.kind === kind), true);
    return m ? m.entry.ids : [];
  };

  // Shape
  if (out.shapeId && !category.shapeIds.includes(out.shapeId)) {
    out.heard.shape ||= map.shapes.find((s) => s.id === out.shapeId)?.name;
    out.shapeId = null;
  }
  if (!out.shapeId) {
    const ids = idsFor(out.heard.shape, 'shape').filter((id) => category.shapeIds.includes(id));
    if (ids.length) out.shapeId = ids[0];
    else if (category.shapeIds.length === 1) out.shapeId = category.shapeIds[0];
    if (out.shapeId) delete out.heard.shape;
  }

  // Size
  if (out.sizeId && (!category.sizeIds.includes(out.sizeId) || map.sizes.find((s) => s.id === out.sizeId)?.shapeId !== out.shapeId)) {
    out.heard.size ||= map.sizes.find((s) => s.id === out.sizeId)?.sizeMm;
    out.sizeId = null;
  }
  if (!out.sizeId && out.shapeId) {
    if (out.heard.size) {
      out.sizeId = findSize(map, category, out.shapeId, out.heard.size);
    } else {
      const own = map.sizes.filter((s) => s.shapeId === out.shapeId && category.sizeIds.includes(s.id));
      if (own.length === 1) out.sizeId = own[0].id; // a shape with one size
    }
    if (out.sizeId) delete out.heard.size;
  }

  // Colour: exact name first, then the one colour of that family in this stone.
  if (out.colorId && !category.colorIds.includes(out.colorId)) {
    out.heard.color ||= map.colors.find((c) => c.id === out.colorId)?.name;
    out.colorId = null;
  }
  if (!out.colorId) {
    const exact = idsFor(out.heard.color, 'color').filter((id) => category.colorIds.includes(id));
    if (exact.length) out.colorId = exact[0];
    else {
      const family = out.heard.colorFamily ?? (out.heard.color ? familyOfHeard(out.heard.color, vocab) : null);
      const inCat = map.colors.filter((c) => category.colorIds.includes(c.id));
      if (family) {
        const fam = inCat.filter((c) => (c.familyId ?? colorFamilyId(c.name, c.hex)) === family);
        if (fam.length === 1) out.colorId = fam[0].id;
      } else if (!out.heard.color && inCat.length === 1) out.colorId = inCat[0].id; // White (DEF) for Moissanite
    }
    if (out.colorId) { delete out.heard.color; delete out.heard.colorFamily; }
  }

  // Quality
  const grades = gradesFor(opts, category.id, out.shapeId);
  if (out.grade && !grades.includes(out.grade)) out.grade = null;
  if (!out.grade && grades.length) {
    const g = heardGrade?.toUpperCase();
    out.grade = g && grades.includes(g) ? g : grades.length === 1 ? grades[0] : null;
  }
  if (!grades.length) out.grade = null;
  return out;
}

const shapeVocabCache = new WeakMap<CatalogueMap, Entry[]>();

function familyOfHeard(heard: string, vocab: Entry[]): number | null {
  for (const w of normalize(heard).reverse()) {
    const e = vocab.find((v) => v.kind === 'family' && v.text === w);
    if (e) return e.ids[0];
  }
  const fam = colorFamilyId(heard);
  return fam;
}

/** What still needs choosing before a line can go in the cart. */
export function missingParts(map: CatalogueMap, line: VoiceLine, opts: ResolveOptions = {}): string[] {
  const missing: string[] = [];
  if (!line.categoryId) missing.push('stone');
  if (!line.shapeId) missing.push('shape');
  if (!line.sizeId) missing.push('size');
  if (!line.colorId) missing.push('colour');
  if (line.categoryId && gradesFor(opts, line.categoryId, line.shapeId).length && !line.grade) missing.push('quality');
  if (!line.qty || line.qty <= 0) missing.push('qty');
  return missing;
}

/** Hole Punched and Rainbow Corundum need extra choices made on their own page. */
export const needsOwnPage = (categoryId: number | null) => !!categoryId && !!specialCategory(categoryId);

/**
 * Speech recognisers return a few guesses for each sentence; the one that
 * names the most catalogue words and numbers is the one meant.
 */
export function bestAlternative(alternatives: string[], map: CatalogueMap, context: ParseContext, vocab = buildVocabulary(map)): string {
  let best = alternatives[0] || '';
  let bestScore = -1;
  for (const alt of alternatives) {
    const { lines, recognised } = parseOrderText(alt, map, context, vocab);
    const filled = lines.reduce((n, l) => n + (l.size ? 1 : 0) + (l.qty ? 1 : 0), 0);
    const score = recognised * 2 + filled;
    if (score > bestScore) { best = alt; bestScore = score; }
  }
  return best;
}
