export default function InboxPage() {
  return <main className="mx-auto max-w-3xl px-8 py-20">
    <p className="text-sm font-bold tracking-widest text-[#0F6B66]">CLEARPORT</p>
    <h1 className="mt-5 text-4xl font-semibold tracking-tight">Shipping documents, checked with evidence.</h1>
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Phase 1 · Data foundation</p>
      <h2 className="mt-3 text-xl font-semibold">Connect your dataset</h2>
      <p className="mt-3 leading-7 text-slate-600">The migration and ingestion tools are ready for verification. The interactive inbox arrives in the next phases.</p>
      <p className="mt-4 text-sm text-slate-500">No emails are shown as processed until the pipeline actually runs.</p>
    </section>
  </main>;
}
