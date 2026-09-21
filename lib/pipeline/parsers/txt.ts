import type { ParsedDocument } from "../types";
export function parseTxt(bytes: Uint8Array): ParsedDocument {
  const rawText = new TextDecoder().decode(bytes).replace(/\r\n?/g, "\n");
  return {
    rawText,
    lines: rawText
      .split("\n")
      .map((text, index) => ({ number: index + 1, text })),
    readable: rawText.trim().length > 0,
    method: "native",
  };
}
