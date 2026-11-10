"use client";

export default function TableMenuError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-50 px-6 text-stone-900">
      <section className="max-w-md text-center" role="alert">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-800">Menu unavailable</p>
        <h1 className="mt-3 text-3xl font-bold">We couldn’t load this menu</h1>
        <p className="mt-4 leading-relaxed text-stone-600">Check your connection and try again. If the problem continues, please ask a member of staff.</p>
        <button type="button" onClick={retry} className="mt-7 min-h-12 rounded-full bg-stone-900 px-6 font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-red-700">Try again</button>
      </section>
    </main>
  );
}
