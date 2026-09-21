export default function LivePage() {
  const address =
    process.env.LIVE_FORWARDING_ADDRESS ?? "Configure LIVE_FORWARDING_ADDRESS";
  return (
    <section className="p-8">
      <p className="text-sm font-semibold text-[#0f6b66]">LIVE CONNECTOR</p>
      <h1 className="mt-1 text-3xl font-semibold">
        Watch documents move through ClearPort
      </h1>
      <div className="mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8">
        <p className="text-slate-600">
          Forward an email with an SI and draft BL attached to:
        </p>
        <code className="mt-3 block rounded-xl bg-teal-50 p-4 text-lg font-semibold text-[#0f6b66]">
          {address}
        </code>
        <div className="mt-8 grid grid-cols-4 gap-2 text-center text-sm">
          {["Received", "Classified", "Extracted", "Compared"].map((x, i) => (
            <div
              key={x}
              className={`rounded-lg p-3 ${i === 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}
            >
              {x}
            </div>
          ))}
        </div>
        <p className="mt-7 text-sm text-slate-500">
          Inbound webhook setup is required before real messages can appear
          here. Dataset mode is active now.
        </p>
      </div>
    </section>
  );
}
