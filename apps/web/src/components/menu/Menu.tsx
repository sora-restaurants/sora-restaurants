"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { submitOrderAction } from "../../app/actions/submit-order.ts";
import type { ThemeId } from "../../themes/themes.ts";
import type { MenuItem, TableMenu } from "./types.ts";

const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
const formatCents = (cents: number) => money.format(cents / 100);
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "placed"; publicRef: string; itemCount: number; totalCents: number }
  | { kind: "error"; message: string };
type Props = { menu: TableMenu; theme: ThemeId; qrToken: string; preview?: boolean };

const ERRORS: Record<string, string> = {
  item_unavailable: "Something in your order just sold out. Please check the menu and try again.",
  table_not_found: "This table's QR code is no longer active. Please ask your waiter.",
  order_too_large: "That order is too large to send in one go. Please ask your waiter.",
  idempotency_conflict: "Your basket changed while the order was sending. Please review it and try again.",
  TABLE_SESSION_NOT_ACTIVE: "Ordering has closed for this table. Please ask a member of staff for help.",
};

export function Menu({ menu, theme, qrToken, preview = false }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [basketOpen, setBasketOpen] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const basketTrigger = useRef<HTMLButtonElement | null>(null);
  const closeBasket = useCallback(() => setBasketOpen(false), []);
  const items = menu.categories.flatMap((category) => category.items);
  const lines = items.filter((item) => cart[item.id]);
  const count = lines.reduce((sum, item) => sum + cart[item.id], 0);
  // Display only. The database resolves every trusted price from the menu item id.
  const estimate = lines.reduce((sum, item) => sum + item.priceCents * cart[item.id], 0);

  const setQuantity = (id: string, quantity: number) => {
    idempotencyKey.current = null;
    setStatus({ kind: "idle" });
    setCart((current) => {
      const next = { ...current };
      if (quantity > 0) next[id] = Math.min(quantity, 50);
      else delete next[id];
      return next;
    });
  };

  async function placeOrder() {
    idempotencyKey.current ??= crypto.randomUUID();
    setStatus({ kind: "sending" });
    if (preview) {
      setStatus({ kind: "placed", publicRef: "PREVIEW", itemCount: count, totalCents: estimate });
      setBasketOpen(false);
      return;
    }
    try {
      const result = await submitOrderAction({
        qrToken,
        idempotencyKey: idempotencyKey.current,
        items: lines.map((item) => ({ menuItemId: item.id, quantity: cart[item.id] })),
      });
      if (result.ok) {
        setStatus({ kind: "placed", publicRef: result.publicRef, itemCount: count, totalCents: estimate });
        setCart({});
        setBasketOpen(false);
        idempotencyKey.current = null;
      } else setStatus({ kind: "error", message: ERRORS[result.error] ?? "We couldn't send your order. Please try again." });
    } catch {
      setStatus({ kind: "error", message: "No connection. Your order was not sent yet — please try again." });
    }
  }

  return (
    <div data-theme={theme} className="menu-shell min-h-dvh bg-bg font-body text-ink antialiased">
      <header className="menu-hero text-on-accent">
        <div className="mx-auto max-w-(--t-max) px-pad pb-7 pt-[calc(var(--t-pad)*2.25)]">
          <div className="mb-8 flex items-center justify-between gap-4"><span className="restaurant-mark" aria-hidden="true">S</span><span className="table-pill">{menu.table}</span></div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] opacity-80">Welcome to</p>
          <h1 className="display max-w-lg text-4xl leading-[0.95] sm:text-5xl">{menu.restaurant}</h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-80">Order at your own pace. Your selections go straight to the kitchen.</p>
        </div>
      </header>

      <nav aria-label="Menu sections" className="sticky top-0 z-20 border-b border-line/60 bg-bg/95 backdrop-blur">
        <ul className="mx-auto flex max-w-(--t-max) gap-2 overflow-x-auto px-pad py-3">
          {menu.categories.map((category, index) => <li key={category.id}><a href={`#c-${category.id}`} className="category-chip focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{category.name}</a></li>)}
        </ul>
      </nav>

      <main id="menu-content" className="mx-auto max-w-(--t-max) px-pad pb-40">
        {menu.categories.length === 0 ? <EmptyMenu /> : menu.categories.map((category, categoryIndex) => (
          <section key={category.id} id={`c-${category.id}`} aria-labelledby={`h-${category.id}`} className="scroll-mt-20 pt-9">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-line/40 pb-3">
              <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-accent">Menu · {String(categoryIndex + 1).padStart(2, "0")}</p><h2 id={`h-${category.id}`} className="display text-3xl leading-none">{category.name}</h2></div>
              <span className="text-sm text-muted">{category.items.length} {category.items.length === 1 ? "dish" : "dishes"}</span>
            </div>
            <ul className="menu-grid">{category.items.map((item, index) => <MenuCard key={item.id} item={item} quantity={cart[item.id] ?? 0} index={index} onChange={setQuantity} />)}</ul>
          </section>
        ))}
      </main>

      <OrderDock triggerRef={basketTrigger} count={count} estimate={estimate} status={status} onOpen={() => setBasketOpen(true)} onDismiss={() => setStatus({ kind: "idle" })} />
      {basketOpen && <BasketSheet returnFocusRef={basketTrigger} lines={lines} cart={cart} estimate={estimate} status={status} onChange={setQuantity} onClose={closeBasket} onPlace={placeOrder} />}
    </div>
  );
}

function EmptyMenu() {
  return <section className="py-16 text-center" aria-labelledby="empty-menu-title"><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Please check back soon</p><h2 id="empty-menu-title" className="display mt-2 text-3xl">The menu is being updated</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">There are no dishes available to order right now. A member of staff will be happy to help.</p></section>;
}

function MenuCard({ item, quantity, index, onChange }: { item: MenuItem; quantity: number; index: number; onChange: (id: string, q: number) => void }) {
  return (
    <li className="menu-card overflow-hidden rounded-theme border border-line/40 bg-surface shadow-[0_12px_40px_color-mix(in_oklch,var(--t-ink)_7%,transparent)]">
      {item.imageUrl ? <div className="relative h-52 overflow-hidden"><img src={item.imageUrl} alt="" className="size-full object-cover" /><div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/45 to-transparent" /></div> : <div className={`dish-art dish-art-${index % 3}`} aria-hidden="true"><span>{item.name.slice(0, 1)}</span></div>}
      <div className="flex min-h-40 flex-col p-5">
        <div className="flex items-start justify-between gap-3"><h3 className="display text-2xl leading-none">{item.name}</h3><p className="shrink-0 font-bold tabular-nums text-accent">{formatCents(item.priceCents)}</p></div>
        {item.description ? <p className="mt-3 text-sm leading-relaxed text-muted">{item.description}</p> : <p className="mt-3 text-sm italic text-muted">Made fresh to order</p>}
        {item.dietaryTags?.length ? <ul aria-label="Dietary information" className="mt-3 flex flex-wrap gap-2">{item.dietaryTags.map((tag) => <li key={tag} className="rounded-full border border-line/40 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted">{tag}</li>)}</ul> : null}
        <div className="mt-auto flex justify-end pt-5">
          {item.soldOut ? <span className="inline-flex min-h-12 items-center rounded-full bg-highlight px-4 text-sm font-bold text-on-highlight">Sold out</span> : quantity === 0 ? <button type="button" onClick={() => onChange(item.id, 1)} aria-label={`Add ${item.name}`} className="add-button focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"><span aria-hidden="true">＋</span> Add to order</button> : <QuantityControl item={item} quantity={quantity} onChange={onChange} />}
        </div>
      </div>
    </li>
  );
}

function QuantityControl({ item, quantity, onChange }: { item: MenuItem; quantity: number; onChange: (id: string, q: number) => void }) {
  return <div className="quantity-control" role="group" aria-label={`${item.name} quantity`}><StepButton label={`Remove one ${item.name}`} onClick={() => onChange(item.id, quantity - 1)}>−</StepButton><output aria-live="polite" className="min-w-10 text-center font-bold tabular-nums">{quantity}</output><StepButton label={`Add one more ${item.name}`} onClick={() => onChange(item.id, quantity + 1)} disabled={quantity >= 50}>+</StepButton></div>;
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="grid size-11 place-items-center rounded-full bg-ink text-xl font-bold text-bg active:scale-95 disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"><span aria-hidden="true">{children}</span></button>;
}

function OrderDock({ triggerRef, count, estimate, status, onOpen, onDismiss }: { triggerRef: React.RefObject<HTMLButtonElement | null>; count: number; estimate: number; status: Status; onOpen: () => void; onDismiss: () => void }) {
  if (status.kind === "placed") return <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-(--t-max) rounded-theme bg-ink p-5 text-bg shadow-2xl"><div className="flex items-center justify-between gap-4"><p><span className="display block text-xl text-on-accent">Order sent to the kitchen</span><span className="mt-1 block text-sm opacity-75">Reference <strong className="tracking-wide text-bg">{status.publicRef}</strong> · {status.itemCount} {status.itemCount === 1 ? "item" : "items"} · {formatCents(status.totalCents)}</span></p><button type="button" onClick={onDismiss} className="min-h-tap shrink-0 rounded-full border border-bg/30 px-4 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-bg">Order more</button></div></div>;
  if (count === 0) return null;
  return <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-bg via-bg to-transparent px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-8"><button ref={triggerRef} type="button" onClick={onOpen} aria-haspopup="dialog" className="mx-auto flex min-h-16 w-full max-w-(--t-max) items-center justify-between gap-4 rounded-theme bg-accent px-5 font-bold text-on-accent shadow-2xl active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"><span className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-on-accent text-sm text-accent">{count}</span>View your order</span><span className="tabular-nums">{formatCents(estimate)} <span aria-hidden="true">→</span></span></button></div>;
}

function BasketSheet({ returnFocusRef, lines, cart, estimate, status, onChange, onClose, onPlace }: { returnFocusRef: React.RefObject<HTMLButtonElement | null>; lines: MenuItem[]; cart: Record<string, number>; estimate: number; status: Status; onChange: (id: string, q: number) => void; onClose: () => void; onPlace: () => void }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const descriptionId = useId();

  useEffect(() => {
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="basket-title" aria-describedby={descriptionId} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-theme sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Almost there</p><h2 id="basket-title" className="display mt-1 text-3xl">Your order</h2></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Close basket" className="grid size-12 place-items-center rounded-full border border-line text-2xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent">×</button></div>
        <ul className="divide-y divide-line/40 border-y border-line/40">{lines.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-sm tabular-nums text-muted">{formatCents(item.priceCents * cart[item.id])}</p></div><QuantityControl item={item} quantity={cart[item.id]} onChange={onChange} /></li>)}</ul>
        <div className="flex items-center justify-between py-5 text-lg font-bold"><span>Estimated total</span><span className="tabular-nums">{formatCents(estimate)}</span></div>
        <p id={descriptionId} className="mb-4 text-xs leading-relaxed text-muted">The kitchen confirms final availability. Prices are securely checked when you place the order.</p>
        {status.kind === "error" && <p role="alert" className="mb-3 rounded-theme bg-highlight p-3 text-sm text-on-highlight">{status.message}</p>}
        <button type="button" onClick={onPlace} disabled={status.kind === "sending" || lines.length === 0} aria-busy={status.kind === "sending"} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-theme bg-accent px-5 text-lg font-bold text-on-accent active:scale-[0.99] disabled:opacity-65">{status.kind === "sending" ? <><span className="spinner" aria-hidden="true" />Sending to kitchen…</> : "Place order"}</button>
      </section>
    </div>
  );
}
