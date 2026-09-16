import ExcelJS from 'exceljs';

// Maps a variety of plausible header spellings to one canonical field key.
// Matching is case-insensitive and ignores surrounding whitespace.
export type AliasMap = Record<string, string>; // normalized header text -> field key

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function parseWorkbookRows(buffer: ArrayBuffer, aliases: AliasMap): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const columnToField = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const field = aliases[normalizeHeader(cell.value)];
    if (field) columnToField.set(colNumber, field);
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    columnToField.forEach((field, colNumber) => {
      const cell = row.getCell(colNumber);
      const value = cell.value === null || cell.value === undefined ? '' : String(cell.value).trim();
      if (value) hasValue = true;
      record[field] = value;
    });
    if (hasValue) rows.push(record);
  });
  return rows;
}
