export function Badge({ value }: { value: string | null | undefined }) {
  const key = value ?? "UNCLASSIFIED";
  const styles: Record<string, string> = {
    OK: "border-emerald-400/30 bg-emerald-100 text-emerald-700",
    MISMATCH: "border-rose-400/30 bg-rose-100 text-rose-700",
    NEEDS_REVIEW: "border-amber-400/30 bg-amber-100 text-amber-700",
    BL_COMPARISON: "border-violet-400/30 bg-violet-500/15 text-violet-200",
    SI_REQUEST: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200",
    INVOICE_QUERY: "border-orange-400/30 bg-orange-500/15 text-orange-200",
    SPAM: "border-rose-400/30 bg-rose-100 text-rose-700",
    GENERAL: "border-white/10 bg-white/5 text-slate-400",
  };
  return (
    <span
      className={`inline-flex border rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[.08em] ${styles[key] ?? styles.GENERAL}`}
    >
      {key.replaceAll("_", " ")}
    </span>
  );
}
