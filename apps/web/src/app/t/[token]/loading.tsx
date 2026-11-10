export default function TableMenuLoading() {
  return (
    <main className="min-h-dvh bg-[oklch(96.5%_0.012_80)] text-[oklch(26%_0.02_50)]" aria-busy="true" aria-live="polite">
      <div className="h-64 animate-pulse bg-[oklch(40%_0.075_25)]" />
      <div className="mx-auto max-w-xl px-5 py-8">
        <p className="font-semibold">Loading the menu…</p>
        <span className="sr-only">Please wait while the restaurant menu loads.</span>
        <div className="mt-7 grid gap-5" aria-hidden="true">
          {[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl bg-black/7" />)}
        </div>
      </div>
    </main>
  );
}
