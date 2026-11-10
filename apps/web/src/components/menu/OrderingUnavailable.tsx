"use client";

export function OrderingUnavailable({ restaurant, table }: { restaurant: string; table: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[oklch(97%_0.01_80)] px-5 text-[oklch(22%_0.03_50)]">
      <section className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-7 text-center shadow-xl" aria-labelledby="ordering-unavailable-title">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[oklch(48%_0.08_35)]">{restaurant} · {table}</p>
        <div aria-hidden="true" className="mx-auto mt-6 grid size-16 place-items-center rounded-full bg-[oklch(91%_0.04_80)] text-2xl">⌛</div>
        <h1 id="ordering-unavailable-title" className="mt-5 text-3xl font-black tracking-tight">Ordering is not open yet</h1>
        <p className="mt-3 leading-relaxed text-black/60">Please ask a member of staff to activate this table. You can keep this page open and try again shortly.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-7 min-h-12 w-full rounded-full bg-[oklch(35%_0.09_35)] px-5 font-bold text-white">Try again</button>
      </section>
    </main>
  );
}

