"use client";

import { useRef, useState } from "react";
import { submitOrderAction } from "../../app/actions/submit-order.ts";
import { newIdempotencyKey } from "../../lib/idempotency-key.ts";
import { formatRand } from "../../lib/money.ts";
import type { ThemeId } from "../../themes/themes.ts";
import type { MenuItem, TableMenu } from "./types.ts";

const formatCents = formatRand;

type Props = {
  menu: TableMenu;
  theme: ThemeId;
  qrToken: string;
  /** Preview pages show the design without placing a real order. */
  preview?: boolean;
};

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "placed"; publicRef: string; statusToken?: string } | { kind: "error"; message: string };

const ERRORS: Record<string, string> = {
  item_unavailable: "Something in your order just sold out. Please check the menu and try again.",
  table_not_found: "This table's QR code is no longer active. Please ask your waiter.",
  order_too_large: "That order is too large to send in one go. Please ask your waiter.",
};

export function Menu({ menu, theme, qrToken, preview = false }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // One key per order attempt, so a retry after a dropped connection cannot create a second order.
  const idempotencyKey = useRef<string | null>(null);

  const items = menu.categories.flatMap((c) => c.items);
  const lines = items.filter((item) => cart[item.id]);
  const count = lines.reduce((sum, item) => sum + cart[item.id], 0);
  // Display only: the server prices the order from its own records.
  const estimate = lines.reduce((sum, item) => sum + item.priceCents * cart[item.id], 0);

  const setQuantity = (id: string, quantity: number) => {
    idempotencyKey.current = null;
    setCart((current) => {
      const next = { ...current };
      if (quantity > 0) next[id] = Math.min(quantity, 50);
      else delete next[id];
      return next;
    });
  };

  async function placeOrder() {
    idempotencyKey.current ??= newIdempotencyKey();
    setStatus({ kind: "sending" });
    if (preview) {
      setStatus({ kind: "placed", publicRef: "PREVIEW" });
      return;
    }
    try {
      const result = await submitOrderAction({
        qrToken,
        idempotencyKey: idempotencyKey.current,
        items: lines.map((item) => ({ menuItemId: item.id, quantity: cart[item.id] })),
      });
      if (result.ok) {
        setStatus({ kind: "placed", publicRef: result.publicRef, statusToken: result.statusToken });
        setCart({});
        idempotencyKey.current = null;
      } else {
        setStatus({ kind: "error", message: ERRORS[result.error] ?? "We couldn't send your order. Please try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "No connection. Your order was not sent yet — please try again." });
    }
  }

  return (
    <div data-theme={theme} className="min-h-dvh bg-bg font-body text-ink antialiased">
      <header className="border-theme border-0 border-b bg-surface">
        <div className="mx-auto max-w-(--t-max) px-pad pb-pad pt-[calc(var(--t-pad)*2)]">
          <p className="text-sm text-muted">{menu.table}</p>
          <h1 className="display text-4xl leading-none">{menu.restaurant}</h1>
          <CallWaiterButton qrToken={qrToken} preview={preview} />
        </div>
        <nav aria-label="Menu sections" className="mx-auto max-w-(--t-max) overflow-x-auto px-pad pb-pad">
          <ul className="flex gap-2">
            {menu.categories.map((category) => (
              <li key={category.id}>
                <a
                  href={`#c-${category.id}`}
                  className="border-theme inline-flex min-h-tap items-center whitespace-nowrap rounded-theme px-4 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {category.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-(--t-max) px-pad pb-40">
        {menu.categories.map((category) => (
          <section key={category.id} id={`c-${category.id}`} aria-labelledby={`h-${category.id}`} className="scroll-mt-4 pt-[calc(var(--t-gap)*1.5)]">
            <h2 id={`h-${category.id}`} className="display mb-[var(--t-gap)] text-2xl">
              {category.name}
            </h2>
            <ul className="menu-grid">
              {category.items.map((item) => (
                <MenuRow key={item.id} item={item} quantity={cart[item.id] ?? 0} onChange={setQuantity} />
              ))}
            </ul>
          </section>
        ))}
      </main>

      <OrderBar count={count} estimate={estimate} status={status} onPlace={placeOrder} onDismiss={() => setStatus({ kind: "idle" })} />
    </div>
  );
}

function CallWaiterButton({ qrToken, preview }: { qrToken: string; preview: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "called" | "failed">("idle");

  async function call() {
    setState("sending");
    const ok =
      preview ||
      (await fetch("/api/tables/call-waiter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qrToken }),
      }).then((r) => r.ok, () => false));
    setState(ok ? "called" : "failed");
    // Let them call again later if nobody came.
    if (ok) setTimeout(() => setState("idle"), 60_000);
  }

  return (
    <button
      type="button"
      onClick={call}
      disabled={state === "sending" || state === "called"}
      className="border-theme mt-3 inline-flex min-h-tap items-center rounded-theme px-4 font-semibold disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {state === "called" ? "✓ Waiter called" : state === "failed" ? "Try calling again" : state === "sending" ? "Calling…" : "Call waiter"}
    </button>
  );
}

function MenuRow({ item, quantity, onChange }: { item: MenuItem; quantity: number; onChange: (id: string, q: number) => void }) {
  return (
    <li className="border-theme flex items-start justify-between gap-4 rounded-theme bg-surface p-pad">
      <div className="min-w-0">
        <h3 className="display text-xl leading-tight">{item.name}</h3>
        {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
        <p className="mt-2 font-semibold tabular-nums">{formatCents(item.priceCents)}</p>
      </div>
      {quantity === 0 ? (
        <button
          type="button"
          onClick={() => onChange(item.id, 1)}
          aria-label={`Add ${item.name}`}
          className="min-h-tap min-w-tap shrink-0 rounded-theme bg-accent px-4 font-semibold text-on-accent transition-transform active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Add
        </button>
      ) : (
        <div className="flex shrink-0 items-center" role="group" aria-label={`${item.name} quantity`}>
          <StepButton label={`Remove one ${item.name}`} onClick={() => onChange(item.id, quantity - 1)}>
            −
          </StepButton>
          <output aria-live="polite" className="min-w-8 text-center font-semibold tabular-nums">
            {quantity}
          </output>
          <StepButton label={`Add one more ${item.name}`} onClick={() => onChange(item.id, quantity + 1)} disabled={quantity >= 50}>
            +
          </StepButton>
        </div>
      )}
    </li>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="border-theme grid size-tap place-items-center rounded-theme bg-surface text-xl font-bold transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

function OrderBar({
  count,
  estimate,
  status,
  onPlace,
  onDismiss,
}: {
  count: number;
  estimate: number;
  status: Status;
  onPlace: () => void;
  onDismiss: () => void;
}) {
  if (status.kind === "placed") {
    return (
      <div role="status" className="border-theme fixed inset-x-0 bottom-0 border-0 border-t bg-surface">
        <div className="mx-auto flex max-w-(--t-max) items-center justify-between gap-4 p-pad">
          <p>
            <span className="display block text-xl">Order sent to the kitchen</span>
            <span className="text-sm text-muted">Reference {status.publicRef}</span>
            {status.statusToken ? (
              <a href={`/o/${status.statusToken}`} className="mt-1 inline-flex min-h-tap items-center font-semibold text-accent underline underline-offset-4">
                Track my order
              </a>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="border-theme min-h-tap rounded-theme px-4 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Order more
          </button>
        </div>
      </div>
    );
  }
  if (count === 0) return null;

  return (
    <div className="border-theme fixed inset-x-0 bottom-0 border-0 border-t bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-(--t-max) p-pad">
        {status.kind === "error" && (
          <p role="alert" className="mb-2 rounded-theme bg-highlight p-3 text-sm text-on-highlight">
            {status.message}
          </p>
        )}
        <button
          type="button"
          onClick={onPlace}
          disabled={status.kind === "sending"}
          className="flex min-h-14 w-full items-center justify-between gap-4 rounded-theme bg-accent px-5 font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span>{status.kind === "sending" ? "Sending…" : `Place order · ${count} ${count === 1 ? "item" : "items"}`}</span>
          <span className="tabular-nums">{formatCents(estimate)}</span>
        </button>
      </div>
    </div>
  );
}
