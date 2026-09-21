import mammoth from "mammoth";
import type { ParsedDocument } from "../types";
const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " " };
export async function parseDocx(bytes: Uint8Array): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const rawText = result.value.replace(/\r\n?/g, "\n");
  return {
    rawText,
    lines: rawText
      .split("\n")
      .map((text, index) => ({ number: index + 1, text })),
    readable: rawText.trim().length > 0,
    method: "native",
  };
}