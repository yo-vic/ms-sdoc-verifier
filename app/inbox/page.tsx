import { inboxRows } from "@/lib/server-data";
import { Badge } from "@/components/status";
import Link from "next/link";

export const dynamic = "force-dynamic";
type Filter = "all" | "highlights" | "live";

function filterHref(filter: Filter) {
  return filter === "all" ? "/inbox" : `/inbox?filter=${filter}`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter: Filter =
    params.filter === "highlights" || params.filter === "live"
      ? params.filter
      : "all";
  const allRows = await inboxRows();
  const rows = allRows.filter((row) => {
    if (filter === "live") return row.source === "live_inbox";
    if (filter === "highlights")
      return (
        row.comparison?.status === "MISMATCH" ||
        row.comparison?.status === "NEEDS_REVIEW"
      );
    return true;
  });
  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "All emails" },
    { key: "highlights", label: "Highlights" },
    { key: "live", label: "Live only" },
  ];

  return (
    <section className="p-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="cp-kicker text-sm font-semibold">INBOX</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Document verification queue
          </h1>
          <p className="mt-2 text-slate-500">
            Every decision is backed by the original document evidence.
          </p>
        </div>
        <div className="cp-panel rounded-xl px-4 py-3 text-sm">
          <b>{allRows.length}</b> emails processed
        </div>
      </div>
      <div className="mt-7 flex gap-2">
        {filters.map(({ key, label }) => (
          <Link
            key={key}
            href={filterHref(key)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${filter === key ? "border-violet-300/60 bg-[#0f6b66] text-white shadow-[0_6px_18px_rgba(157,78,221,.38)]" : "border-slate-200 bg-white text-slate-600 hover:bg-teal-50 hover:text-[#0f6b66]"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {filter === "highlights"
          ? "Showing mismatches and cases that need human review."
          : filter === "live"
            ? "Showing emails received through the live connector."
            : "Showing all dataset and live inbox emails."}
      </p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Sender</th>
              <th className="px-5 py-4">Subject</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Result</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 last:border-0 hover:bg-teal-50/40"
              >
                <td className="max-w-44 truncate px-5 py-4 text-slate-600">
                  {row.sender}
                </td>
                <td className="max-w-md px-5 py-4 font-medium text-slate-800">
                  <span className="block truncate">{row.subject}</span>
                  <span className="mt-1 text-xs text-slate-400">
                    {row.id}
                    {row.source === "live_inbox" && " · LIVE"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Badge value={row.category} />
                </td>
                <td className="px-5 py-4">
                  {row.comparison ? (
                    <Badge value={row.comparison.status} />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/report/${row.id}`} className="cp-action">
                    Open report <span aria-hidden="true">↗</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            No emails match this filter yet.
          </div>
        )}
      </div>
    </section>
  );
}
