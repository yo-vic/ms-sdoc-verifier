import type { ExtractedValue, Line, ScoredField } from "./types";
import { scoredFields } from "./types";
const labels: Record<ScoredField, string[]> = {
<<<<<<< HEAD
  shipper: ["shipper/exporter", "shipper", "exporter", "consignor", "shipped by"],
  consignee: ["consignee", "consigned to", "importer", "to the order of"],
  notify_party: ["notify party", "notify", "notify address"],
  port_of_loading: ["port of loading", "load port", "loading port", "pol", "port loading"],
  port_of_discharge: ["port of discharge", "discharge port", "pod", "port discharge"],
  container_count: ["no. of containers or packages", "no of containers", "no. of containers", "total containers", "number of containers", "container count", "containers", "no. of cntrs", "qty of containers"],
  gross_weight_kg: ["gross weight (kg)", "gross weight", "gross wt (kgs)", "gross wt", "g.w."],
=======
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
>>>>>>> 619e29eefdd6c4a92339803fbefdc19a9632f428
};
function esc(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function missing(value: string) {
  return !value.trim() || /^(?:n\/?a|tba|_+|-+)$/i.test(value.trim());
}
export function extractLexicon(lines: Line[]): ExtractedValue[] {
<<<<<<< HEAD
  return scoredFields.map(field => {
    const matches = labels[field].map(label => new RegExp(`^\\s*(?:total\\s+)?${esc(label)}\\s*(?:\\([^)]*\\))?\\s*(?:\\/\\s*intermediate\\s+consignee)?\\s*(?:[:\-]|\\|)?\\s*(.*)$`, "i"));
=======
  return scoredFields.map((field) => {
    const matches = labels[field].map(
      (label) =>
        new RegExp(`^\\s*${esc(label)}\\s*(?:[:\-]|\\|)?\\s*(.*)$`, "i"),
    );
>>>>>>> 619e29eefdd6c4a92339803fbefdc19a9632f428
    for (let i = 0; i < lines.length; i++) {
      for (const match of matches) {
        const found = lines[i].text.match(match);
        if (!found) continue;
<<<<<<< HEAD
        const cell = (text: string) => text.split("|").map(part => part.trim()).find(part => part && !/^\([^)]*\)$/.test(part)) ?? "";
        const value = cell(found[1]) || cell(lines.slice(i + 1).find(line => cell(line.text) && !/^\s*[^:|]{1,45}:\s*(?:\S.*)?$/.test(line.text))?.text ?? "");
        return { field, rawValue: missing(value) ? null : value, normalizedValue: null, evidenceSnippet: lines[i].text, evidenceLine: lines[i].number, extractedBy: "lexicon" };
=======
        const value = found[1].trim() || (lines[i + 1]?.text.trim() ?? "");
        return {
          field,
          rawValue: missing(value) ? null : value,
          normalizedValue: null,
          evidenceSnippet: lines[i].text,
          evidenceLine: lines[i].number,
          extractedBy: "lexicon",
        };
>>>>>>> 619e29eefdd6c4a92339803fbefdc19a9632f428
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