import { normalize } from "./normalize";
import type { ExtractedValue, ReviewReason, ScoredField } from "./types";
import { scoredFields } from "./types";
export function compareFields(si: ExtractedValue[], bl: ExtractedValue[], reason?: ReviewReason) {
  if (reason) return { status: "NEEDS_REVIEW" as const, reviewReason: reason, mismatches: [] as unknown[] };
  const mismatches: Array<{ field: ScoredField; si_value: string | null; bl_value: string | null }> = [];
  for (const field of scoredFields) {
    const a = si.find(value => value.field === field)?.rawValue ?? null;
    const b = bl.find(value => value.field === field)?.rawValue ?? null;
    const na = a ? normalize(a, field) : null, nb = b ? normalize(b, field) : null;
    if (!na || !nb) return { status: "NEEDS_REVIEW" as const, reviewReason: "missing_value" as const, mismatches: [] as unknown[] };
    if (na !== nb) mismatches.push({ field, si_value: a, bl_value: b });
  }
  return mismatches.length ? { status: "MISMATCH" as const, reviewReason: null, mismatches } : { status: "OK" as const, reviewReason: null, mismatches };
}