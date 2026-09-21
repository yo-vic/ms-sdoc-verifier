import Link from "next/link";
import { Activity, ClipboardCheck, Inbox, LayoutDashboard, Radio, Search, Settings2, ShipWheel, Sparkles } from "lucide-react";

const links = [
  { href: "/", label: "Board", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/review", label: "Review queue", icon: ClipboardCheck },
  { href: "/insights", label: "Insights", icon: Activity },
  { href: "/live", label: "Live connector", icon: Radio },
  { href: "/admin", label: "Admin & export", icon: Settings2 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen text-slate-900">
    <aside className="fixed inset-y-0 z-20 w-64 border-r border-slate-200 bg-[#f6f8f7] p-5">
      <Link href="/" className="flex items-center gap-3 px-2">
        <span className="cp-glow grid h-10 w-10 place-items-center rounded-xl bg-[#0f6b66] text-white"><ShipWheel size={21}/></span>
        <span><span className="block text-xl font-semibold tracking-tight text-slate-900">ClearPort</span><span className="cp-kicker text-[9px] font-bold">SHIP OPERATIONS</span></span>
      </Link>
      <div className="mt-8 px-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Command center</div>
      <nav className="mt-3 space-y-1">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-[#0f6b66]"><Icon size={18}/>{label}</Link>)}</nav>
      <div className="absolute bottom-6 left-5 right-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900"><Sparkles size={14} className="text-[#0f6b66]"/> Intelligence layer</div>
        <p className="mt-2 text-xs leading-5 text-slate-500"><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>Supabase pipeline online</p>
      </div>
    </aside>
    <main className="ml-64">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-8 backdrop-blur-xl">
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 md:flex"><Search size={15}/><span>Search workspace</span><kbd className="ml-8 text-[10px]">Ctrl K</kbd></div>
        <div className="ml-auto flex items-center gap-3 text-sm"><span className="cp-pill rounded-full px-3 py-1.5 text-xs font-semibold"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>Live system</span><span className="grid h-8 w-8 place-items-center rounded-full bg-[#0f6b66] text-xs font-bold text-white">CP</span></div>
      </header>
      {children}
    </main>
  </div>;
}

