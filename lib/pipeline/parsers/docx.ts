import mammoth from "mammoth";
import type { ParsedDocument } from "../types";
const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " " };
export async function parseDocx(bytes: Uint8Array): Promise<ParsedDocument> {
  // HTML keeps paragraph/line breaks inside table cells; extractRawText glues them together ("FZE#813, ...").
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  const rawText = result.value
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|h\d|li|tr|table)>/gi, "\n").replace(/<\/t[dh]>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, m => entities[m])
    .replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  return { rawText, lines: rawText.split("\n").map((text, index) => ({ number: index + 1, text })), readable: rawText.length > 0, method: "native" };
}