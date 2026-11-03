// A round stone has one diameter. Sizes such as 3x4 or 5x7 sitting under
// Round and Round Checker were oval sizes filed under the wrong shape
// (owner, 2026-11-03), so a round shape takes a single size (5) or an equal
// pair (5x5) and nothing longer one way than the other.

/** Round, Round Checker, Round (16 Hearts 16 Arrows)... */
export function isRoundShape(name: string | null | undefined): boolean {
  return /^round\b/i.test((name || '').trim());
}

/** False only for a round shape given two different dimensions, such as 3x4. */
export function sizeFitsShape(shapeName: string | null | undefined, sizeMm: string | null | undefined): boolean {
  if (!isRoundShape(shapeName)) return true;
  const dims = (sizeMm || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return dims.length < 2 || dims.every((d) => d === dims[0]);
}

export const ROUND_SIZE_MESSAGE = 'A round stone has one size, like 5 or 5x5. Sizes such as 5x7 belong under Oval.';
