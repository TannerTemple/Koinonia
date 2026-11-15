/**
 * CSV that opens correctly in Excel, Numbers and Google Sheets.
 *
 * - Fields with commas, quotes or line breaks are quoted; quotes are doubled.
 * - A field starting with = + - or @ gets a leading apostrophe, so a spreadsheet shows it
 *   as text instead of running it as a formula (someone's note could start with "=").
 * - Lines end with CRLF and the file starts with a byte-order mark, which is what Excel
 *   needs to read accents and non-Latin names.
 */
export type CsvValue = string | number | boolean | null | undefined;

export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return "﻿" + [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
