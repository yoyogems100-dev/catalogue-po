// A note on one order line ("Radiant cut required", "for hand setting"),
// stored in order_items.note. Until that column exists in a database the
// notes are kept in the order's comment instead, so nothing typed is lost
// and the code can ship before or after the migration.

export const LINE_NOTE_MAX = 300;

/** Trimmed, single-spaced, at most LINE_NOTE_MAX characters; null when empty. */
export function cleanLineNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const note = value.replace(/\s+/g, ' ').trim().slice(0, LINE_NOTE_MAX);
  return note || null;
}

type NotedRow = { note?: string | null };
type Label = { shapeName: string; sizeMm: string; colorName: string; note?: string | null };

/** The comment with each line's note added, for a database without the column. */
export function commentWithLineNotes(comment: string | null, lines: Label[]): string | null {
  const notes = lines.filter((l) => cleanLineNote(l.note)).map((l) => `${l.shapeName} ${l.sizeMm} ${l.colorName}: ${cleanLineNote(l.note)}`);
  return [comment?.trim(), ...notes].filter(Boolean).join('\n') || null;
}

const missingNoteColumn = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /\bnote\b/.test(error.message || '') && /column/i.test(error.message || ''));

/**
 * Inserts order lines with their notes. If the database has no note column
 * yet, inserts them without and reports that the notes need to go elsewhere.
 */
export async function insertOrderItems<T extends NotedRow>(db: any, rows: T[]): Promise<{ error: { message: string } | null; notesKept: boolean }> {
  const anyNote = rows.some((r) => r.note);
  const first = await db.from('order_items').insert(anyNote ? rows : rows.map(({ note, ...rest }) => rest));
  if (!first.error || !anyNote || !missingNoteColumn(first.error)) return { error: first.error, notesKept: true };
  const retry = await db.from('order_items').insert(rows.map(({ note, ...rest }) => rest));
  return { error: retry.error, notesKept: false };
}
