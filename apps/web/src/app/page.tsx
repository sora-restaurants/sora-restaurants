import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh bg-[oklch(17%_0.02_260)] font-[family-name:var(--font-manrope)] text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="grid size-12 place-items-center rounded-full border border-white/40 text-xl font-extrabold">S</div>
          <span className="rounded-full border border-white/30 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/80">
            Staging demo
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.2em] text-[oklch(82%_0.13_250)]">Sora Restaurants</p>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.96] tracking-[-0.055em] sm:text-7xl">
            Order from your table.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-7 text-white/70 sm:text-xl">
            Try the customer ordering experience or open the kitchen screen. This environment contains demo data only.
          </p>

          <div className="mt-10 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
            <Link
              href="/t/staging-demo-table-1"
              className="flex min-h-28 flex-col justify-between rounded-2xl bg-[oklch(58%_0.23_260)] p-5 transition-transform active:scale-[0.98] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/75">Customer demo</span>
              <span className="flex items-end justify-between gap-4 text-2xl font-extrabold">
                Demo Table 1 <span aria-hidden="true">→</span>
              </span>
            </Link>

            <Link
              href="/kitchen"
              className="flex min-h-28 flex-col justify-between rounded-2xl border-2 border-white/50 bg-white/5 p-5 transition-transform active:scale-[0.98] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/55">Staff access</span>
              <span className="flex items-end justify-between gap-4 text-2xl font-extrabold">
                Kitchen sign-in <span aria-hidden="true">→</span>
              </span>
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/15 pt-5 text-sm text-white/45">Demo service · No real customer data</footer>
      </div>
    </main>
  );
}
