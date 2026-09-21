export const scoredFields = [
  "shipper",
  "consignee",
  "notify_party",
  "port_of_loading",
  "port_of_discharge",
  "container_count",
  "gross_weight_kg",
] as const;
export type ScoredField = (typeof scoredFields)[number];
export type Line = { number: number; text: string };
export type ParsedDocument = {
  lines: Line[];
  rawText: string;
  readable: boolean;
  method: "native" | "ocr" | "vision";
};
export type ExtractedValue = {
  field: ScoredField;
  rawValue: string | null;
  normalizedValue: string | null;
  evidenceSnippet: string | null;
  evidenceLine: number | null;
  extractedBy: "lexicon" | "llm";
};
export type ComparisonStatus = "OK" | "MISMATCH" | "NEEDS_REVIEW";
export type ReviewReason =
  "unreadable" | "missing_attachment" | "wrong_doc_type" | "missing_value";
