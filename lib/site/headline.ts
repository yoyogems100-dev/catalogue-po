/**
 * Splits a hero headline so its last sentence can be shown in gold:
 * "Every stone. One trusted source." -> ["Every stone.", "One trusted source."].
 * A single sentence comes back whole, with nothing to accent.
 */
export function splitHeadline(heading: string): [string, string] {
  const text = heading.trim();
  const cut = text.replace(/[.!?]+$/, '').search(/[.!?]\s+[^.!?]*$/);
  if (cut < 0) return [text, ''];
  return [text.slice(0, cut + 1).trim(), text.slice(cut + 1).trim()];
}
