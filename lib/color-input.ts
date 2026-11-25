// A new colour's name and swatch, as typed in Admin > Colors or in the order
// builder's "+ Add" dialog. Pure, so both routes and the tests share it.

export const DEFAULT_COLOR_HEX = '#B0AFAC';

export function cleanColorInput(name: unknown, hex: unknown): { name: string; hex: string } | { error: string } {
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!clean) return { error: 'Name required' };
  if (clean.length > 80) return { error: 'Keep the colour name under 80 characters.' };
  if (hex === undefined || hex === null || hex === '') return { name: clean, hex: DEFAULT_COLOR_HEX };
  const h = String(hex).trim();
  if (!/^#[0-9a-f]{6}$/i.test(h)) return { error: 'Pick the swatch colour from the colour picker.' };
  return { name: clean, hex: h.toUpperCase() };
}
