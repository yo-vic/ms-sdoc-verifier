import { PDFParse } from "pdf-parse";
import type { ParsedDocument } from "../types";
export async function parsePdf(bytes: Uint8Array): Promise<ParsedDocument> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const lines: { number: number; text: string }[] = [];
    for (const page of result.pages)
      for (const text of page.text.replace(/\r\n?/g, "\n").split("\n"))
        lines.push({ number: lines.length + 1, text });
    return {
      rawText: lines.map((line) => line.text).join("\n"),
      lines,
      readable: lines.some((line) => line.text.trim()),
      method: "native",
    };
  } finally {
    await parser.destroy();
  }
}
