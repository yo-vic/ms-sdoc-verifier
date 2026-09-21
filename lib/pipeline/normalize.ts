import type { ScoredField } from "./types";
const legal = /\b(?:ltd|limited|inc|pte|llc|gmbh|sdn\.?\s*bhd)\b\.?/gi;
const ports: Record<string, string> = {
  mypkg: "port klang",
  portklang: "port klang",
  cnntg: "nantong",
  pkkhi: "karachi",
  pecll: "callao",
};
export function normalize(
  value: string | null,
  field: ScoredField,
): string | null {
  if (!value || /^(?:n\/?a|tba|_+|-+)$/i.test(value.trim())) return null;
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[\s,;]+/g, " ");
  if (field === "shipper" || field === "consignee")
    return base.replace(legal, "").replace(/\s+/g, " ").trim();
  if (field === "port_of_loading" || field === "port_of_discharge") {
    const code = base.match(/\(([a-z]{2,5})\)/)?.[1];
    return code && ports[code] ? ports[code] : base;
  }
  if (field === "container_count") {
    const totals = [...base.matchAll(/(\d+)\s*(?:x|×)\s*\d+/g)].reduce(
      (sum, m) => sum + Number(m[1]),
      0,
    );
    return String(totals || Number(base.match(/\d+/)?.[0] ?? 0)) || null;
  }
  if (field === "gross_weight_kg") {
    const n = Number(base.replace(/,/g, "").match(/[\d.]+/)?.[0]);
    if (!Number.isFinite(n)) return null;
    if (/\b(?:lb|lbs|pounds?)\b/.test(base))
      return String(Math.round(n * 0.453592));
    if (/\b(?:mt|tonnes?|tons?)\b/.test(base))
      return String(Math.round(n * 1000));
    return String(Math.round(n));
  }
  return base;
}