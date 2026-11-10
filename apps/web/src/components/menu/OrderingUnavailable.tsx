"use client";

import { ColorModeToggle, useColorMode } from "../ColorModeToggle.tsx";

export function OrderingUnavailable({ restaurant, table }: { restaurant: string; table: string }) {
  const { mode, toggle } = useColorMode("sora-customer-color-mode");
  return (
    <main className={`grid min-h-dvh place-items-center px-5 ${mode === "dark" ? "bg-[#171512] text-[#FAF7F2]" : "bg-[oklch(97%_0.01_80)] text-[oklch(22%_0.03_50)]"}`}>
      <section className={`w-full max-w-md rounded-3xl border p-7 text-center shadow-xl ${mode === "dark" ? "border-white/15 bg-[#25211D]" : "border-black/10 bg-white"}`} aria-labelledby="ordering-unavailable-title">
        <div className="mb-4 flex justify-end"><ColorModeToggle mode={mode} onToggle={toggle} /></div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[oklch(48%_0.08_35)]">{restaurant} · {table}</p>
        <div aria-hidden="true" className="mx-auto mt-6 grid size-16 place-items-center rounded-full bg-[oklch(91%_0.04_80)] text-2xl">⌛</div>
        <h1 id="ordering-unavailable-title" className="mt-5 text-3xl font-black tracking-tight">This table isn’t taking orders right now</h1>
        <p className="mt-3 leading-relaxed text-black/60">Ask a member of staff to open the session. You can keep this page open and try again shortly.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-7 min-h-12 w-full rounded-full bg-[oklch(35%_0.09_35)] px-5 font-bold text-white">Try again</button>
      </section>
    </main>
  );
}

