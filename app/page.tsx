import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleAlert, Clock3, LayoutDashboard, ShieldCheck } from "lucide-react";
import { inboxRows } from "@/lib/server-data";
import { Badge } from "@/components/status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await inboxRows();
  const ok = rows.filter((row) => row.comparison?.status === "OK").length;
  const mismatch = rows.filter((row) => row.comparison?.status === "MISMATCH").length;
  const review = rows.filter((row) => row.comparison?.status === "NEEDS_REVIEW").length;
  const docket = rows.filter((row) => row.comparison?.status === "MISMATCH" || row.comparison?.status === "NEEDS_REVIEW").slice(0, 5);

  return <section className="p-8">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div className="flex items-center gap-3"><span className="cp-kicker text-[10px] font-bold">CLEARPORT / BOARD</span><span className="h-1 w-1 rounded-full bg-violet-300"/><span className="text-xs text-slate-500">Document control in one view</span></div>
      <Link href="/inbox" className="cp-action">Open inbox <ArrowUpRight size={14}/></Link>
    </div>

    <div className="relative mt-9 overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-7 py-10 md:px-10">
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl"/>
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-violet-300/50 to-transparent"/>
      <div className="relative grid items-end gap-8 lg:grid-cols-[1.25fr_.75fr]">
        <div>
          <p className="cp-kicker text-xs font-bold">PORT OPERATIONS · EST. 2026</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl font-semibold leading-[.94] tracking-[-.055em] text-white md:text-7xl">Know what ships.<br/><em className="font-serif font-normal text-violet-200">Know what stops.</em></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-500">ClearPort turns every shipping email into a clear operational action before cargo is released: approve it, flag a discrepancy, or route it to a reviewer.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-500"><ShieldCheck className="mb-4 text-violet-300" size={24}/><p className="leading-6">Every outcome traces back to source evidence, so decisions stay defensible from first email to final release.</p><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"/> Supabase pipeline connected</div></div>
      </div>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <Link href="/inbox?filter=all" className="group relative overflow-hidden rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-6 transition hover:-translate-y-1 hover:bg-emerald-400/15"><CheckCircle2 className="absolute -right-3 -bottom-5 text-emerald-300/20" size={130}/><p className="relative text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300">01 · approved</p><p className="relative mt-7 text-5xl font-semibold text-white">{ok}</p><p className="relative mt-2 font-semibold text-emerald-100">Ready to move</p><p className="relative mt-1 text-xs text-emerald-100/60">Verified without a mismatch</p></Link>
      <Link href="/inbox?filter=highlights" className="group relative overflow-hidden rounded-2xl border border-rose-300/20 bg-rose-400/10 p-6 transition hover:-translate-y-1 hover:bg-rose-400/15"><CircleAlert className="absolute -right-3 -bottom-5 text-rose-300/20" size={130}/><p className="relative text-[10px] font-bold uppercase tracking-[.2em] text-rose-300">02 · mismatch</p><p className="relative mt-7 text-5xl font-semibold text-white">{mismatch}</p><p className="relative mt-2 font-semibold text-rose-100">Needs correction</p><p className="relative mt-1 text-xs text-rose-100/60">Field differences found</p></Link>
      <Link href="/review" className="group relative overflow-hidden rounded-2xl border border-amber-300/20 bg-amber-300/10 p-6 transition hover:-translate-y-1 hover:bg-amber-300/15"><Clock3 className="absolute -right-3 -bottom-5 text-amber-200/20" size={130}/><p className="relative text-[10px] font-bold uppercase tracking-[.2em] text-amber-200">03 · attention</p><p className="relative mt-7 text-5xl font-semibold text-white">{review}</p><p className="relative mt-2 font-semibold text-amber-100">Needs a decision</p><p className="relative mt-1 text-xs text-amber-100/60">Evidence needs confirmation</p></Link>
    </div>

    <div className="mt-10 flex items-end justify-between gap-4"><div><h2 className="text-3xl font-semibold tracking-tight text-white">Priority docket</h2><p className="mt-1 text-sm text-slate-500">Open a case to inspect the seven-field comparison.</p></div><Link href="/inbox?filter=highlights" className="text-sm font-semibold text-violet-300 hover:text-violet-100">View all exceptions →</Link></div>
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">{docket.length ? docket.map((row) => <Link key={row.id} href={`/report/${row.id}`} className="group flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-teal-50/40"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><LayoutDashboard size={16}/></span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-800">{row.subject}</p><p className="mt-1 text-xs text-slate-500">{row.sender} · {row.id}</p></div><Badge value={row.comparison?.status}/><ArrowUpRight size={16} className="text-violet-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/></Link>) : <div className="p-10 text-center text-sm text-slate-500">No priority cases yet. Run the comparison pipeline to populate the board.</div>}</div>
  </section>;
}

