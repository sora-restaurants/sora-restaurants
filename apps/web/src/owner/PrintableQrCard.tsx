import type { ManagedTable } from "./session-contract.ts";

type Props = { restaurantName: string; table: ManagedTable; qrImageSrc?: string };

export function PrintableQrCard({ restaurantName, table, qrImageSrc }: Props) {
  return (
    <article className="qr-print-card border border-slate-300 bg-white p-6 text-center text-slate-950">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{restaurantName}</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight">{table.label}</h2>
      <div className="mx-auto mt-6 grid aspect-square w-48 place-items-center border-8 border-slate-950 bg-white p-3">
        {qrImageSrc ? <img src={qrImageSrc} alt={`QR code for ${table.label}`} className="size-full" /> : <span className="text-sm font-bold">QR image supplied at integration</span>}
      </div>
      <p className="mt-6 text-xl font-black">Scan to view the menu</p>
      <p className="mt-2 text-sm text-slate-600">Ordering opens when a staff member starts your table session.</p>
      <p className="mt-5 break-all text-[10px] text-slate-400">{table.qrUrl}</p>
    </article>
  );
}

