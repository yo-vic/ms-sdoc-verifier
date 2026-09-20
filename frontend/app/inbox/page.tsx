"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function InboxPage() {
  const [status, setStatus] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Poll status when a run is active
  useEffect(() => {
    fetchStatus();
    fetchResults();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/run/status`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error("Failed to fetch status", e);
    }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/results`);
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error("Failed to fetch results", e);
    }
  };

  const handleStartRun = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/run?limit=5`, { method: "POST" });
      await fetchStatus();
    } catch (e) {
      console.error("Failed to start run", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-8 py-12">
      <p className="text-sm font-bold tracking-widest text-[#0F6B66]">CLEARPORT</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Shipping Documents Dashboard</h1>

      {/* Control Panel */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Verification Pipeline</h2>
            <p className="text-sm text-slate-500">
              {status?.running 
                ? `Processing ${status.processed} / ${status.total}...` 
                : "Pipeline ready to process inbox items."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchStatus}
              className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-slate-50"
            >
              Refresh Status
            </button>
            <button
              onClick={handleStartRun}
              disabled={status?.running || loading}
              className="px-4 py-2 text-sm font-medium bg-[#0F6B66] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {status?.running ? "Running..." : "Run Pipeline (5 Items)"}
            </button>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Processed Results ({results.length})</h2>
        {results.length === 0 ? (
          <p className="text-sm text-slate-500">No processed results available yet.</p>
        ) : (
          <div className="space-y-3">
            {results.map((item) => (
              <div key={item.email_id} className="p-4 border rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{item.email_id}</p>
                  <p className="text-xs text-slate-500">Category: {item.category}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  item.status === "OK" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {item.status || "PENDING"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// export default function InboxPage() {
//   return <main className="mx-auto max-w-3xl px-8 py-20">
//     <p className="text-sm font-bold tracking-widest text-[#0F6B66]">CLEARPORT</p>
//     <h1 className="mt-5 text-4xl font-semibold tracking-tight">Shipping documents, checked with evidence.</h1>
//     <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-8">
//       <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Phase 1 · Data foundation</p>
//       <h2 className="mt-3 text-xl font-semibold">Connect your dataset</h2>
//       <p className="mt-3 leading-7 text-slate-600">The migration and ingestion tools are ready for verification. The interactive inbox arrives in the next phases.</p>
//       <p className="mt-4 text-sm text-slate-500">No emails are shown as processed until the pipeline actually runs.</p>
//     </section>
//   </main>;
// }
