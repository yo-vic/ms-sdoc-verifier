import path from "node:path";
import { parseDocx } from "./docx";
import { parsePdf } from "./pdf";
import { parseTxt } from "./txt";
import { parseXlsx } from "./xlsx";
import type { ParsedDocument } from "../types";
export async function parseAttachment(
  filename: string,
  bytes: Uint8Array,
): Promise<ParsedDocument> {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".txt" || ext === ".csv") return parseTxt(bytes);
  if (ext === ".xlsx" || ext === ".xls") return parseXlsx(bytes);
  if (ext === ".docx") return parseDocx(bytes);
  if (ext === ".pdf") return parsePdf(bytes);
  return { rawText: "", lines: [], readable: false, method: "native" };
}
