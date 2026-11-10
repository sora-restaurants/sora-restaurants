export default function TableMenuNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-50 px-6 text-stone-900">
      <section className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-800">QR code not active</p>
        <h1 className="mt-3 text-3xl font-bold">This table menu isn’t available</h1>
        <p className="mt-4 leading-relaxed text-stone-600">Please check that you scanned the QR code on your table, or ask a member of staff for help.</p>
      </section>
    </main>
  );
}
