import type { ExtractedValue, Line, ScoredField } from "./types";
import { scoredFields } from "./types";
const labels: Record<ScoredField, string[]> = {
  shipper: [
    "shipper/exporter",
    "shipper",
    "exporter",
    "consignor",
    "shipped by",
  ],
  consignee: ["consignee", "consigned to", "importer"],
  notify_party: ["notify party", "notify", "notify address"],
  port_of_loading: [
    "port of loading",
    "load port",
    "loading port",
    "pol",
    "port loading",
  ],
  port_of_discharge: [
    "port of discharge",
    "discharge port",
    "pod",
    "port discharge",
  ],
  container_count: [
    "no. of containers or packages",
    "no of containers",
    "number of containers",
    "container count",
    "containers",
    "no. of cntrs",
    "qty of containers",
  ],
  gross_weight_kg: [
    "gross weight (kg)",
    "gross weight",
    "gross wt (kgs)",
    "gross wt",
    "g.w.",
  ],
};
function esc(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function missing(value: string) {
  return !value.trim() || /^(?:n\/?a|tba|_+|-+)$/i.test(value.trim());
}
export function extractLexicon(lines: Line[]): ExtractedValue[] {
  return scoredFields.map((field) => {
    const matches = labels[field].map(
      (label) =>
        new RegExp(`^\\s*${esc(label)}\\s*(?:[:\-]|\\|)?\\s*(.*)$`, "i"),
    );
    for (let i = 0; i < lines.length; i++) {
      for (const match of matches) {
        const found = lines[i].text.match(match);
        if (!found) continue;
        const value = found[1].trim() || (lines[i + 1]?.text.trim() ?? "");
        return {
          field,
          rawValue: missing(value) ? null : value,
          normalizedValue: null,
          evidenceSnippet: lines[i].text,
          evidenceLine: lines[i].number,
          extractedBy: "lexicon",
        };
      }
    }
    return {
      field,
      rawValue: null,
      normalizedValue: null,
      evidenceSnippet: null,
      evidenceLine: null,
      extractedBy: "lexicon",
    };
  });
}