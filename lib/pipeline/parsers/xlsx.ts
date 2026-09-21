import XLSX from "xlsx";
import type { ParsedDocument } from "../types";
export function parseXlsx(bytes: Uint8Array): ParsedDocument {
  const book = XLSX.read(bytes, { type: "array", cellText: true });
  const rows: string[] = [];
  for (const name of book.SheetNames) {
    rows.push(`[Sheet: ${name}]`);
    const sheet = book.Sheets[name];
    for (const row of XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
    }))
      rows.push(row.map(String).join(" | "));
  }
  const rawText = rows.join("\n");
  return {
    rawText,
    lines: rows.map((text, index) => ({ number: index + 1, text })),
    readable: rawText.trim().length > 0,
    method: "native",
  };
}
