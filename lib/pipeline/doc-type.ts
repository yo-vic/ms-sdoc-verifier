import type { Line } from "./types";
export type DocumentType = "SI" | "BL" | "unknown";
export function detectDocumentType(lines: Line[]): DocumentType {
  const header = lines.slice(0, 20).map(line => line.text).join(" ").toLowerCase();
  if (/\b(?:bill of lading|b\/l)\b/.test(header)) return "BL";
  if (/\b(?:shipping instruction|shipper.?s instruction|s\/i)\b/.test(header)) return "SI";
  const all = lines.map(line => line.text).join(" ").toLowerCase();
  if (/bill of lading no|place and date of issue/.test(all)) return "BL";
  if (/booking ref|documents required/.test(all) && /shipper|consignee/.test(all)) return "SI";
  return "unknown";
}
