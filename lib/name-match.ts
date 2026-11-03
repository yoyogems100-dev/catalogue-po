// How a typed word matches a word of a stone's name -- looser than "starts
// with", which missed "tcf" for YOTCF and "moisanite" for Moissanite (owner,
// 2026-11-03). Only for category names: shape and colour words keep matching
// from the start, so "red" doesn't find every "Coloured" stone.

/** Edits (insert, delete, change one letter) between two short words, stopping past `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * 3 the word starts with what was typed, 2 holds it further in ("tcf" in
 * "yotcf", 3+ letters), 1 is a near miss ("moisanite", 4+ letters, one slip;
 * two from 8 letters), 0 no match.
 */
export function nameWordScore(token: string, word: string): number {
  if (!token) return 0;
  if (word.startsWith(token)) return 3;
  if (token.length >= 3 && word.includes(token)) return 2;
  if (token.length >= 4 && !/^\d+$/.test(token)) {
    const max = token.length >= 8 ? 2 : 1;
    // Against the whole word, and (from 5 letters, so "opal" doesn't find
    // "Opaque") against its start while the buyer is still typing.
    const starts = token.length >= 5 ? [word.slice(0, token.length), word.slice(0, token.length + 1)] : [];
    for (const target of [word, ...starts]) {
      if (target.length >= 3 && editDistance(token, target, max) <= max) return 1;
    }
  }
  return 0;
}

/** The weakest of the typed words' best matches in a name: 0 unless every word matches. */
export function nameMatchScore(tokens: string[], words: string[]): number {
  if (!tokens.length) return 0;
  let score = 3;
  for (const t of tokens) {
    const best = Math.max(0, ...words.map((w) => nameWordScore(t, w)));
    if (!best) return 0;
    score = Math.min(score, best);
  }
  return score;
}
