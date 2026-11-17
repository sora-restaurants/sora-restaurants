"use client";

import { useRef, useState, type PointerEvent } from "react";

export function SlideToPay({ amount, pending, onConfirm }: {
  amount: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const gesture = useRef<{ id: number; start: number; travel: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const current = gesture.current;
    if (current?.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    setOffset(0);
    if (!cancelled && event.clientX - current.start >= current.travel * 0.85) onConfirm();
  }

  return (
    <div className="payment-slide">
      <span aria-hidden="true">{pending ? "Confirming…" : `Slide to pay ${amount}`}</span>
      <button
        type="button"
        data-custom-haptics
        className="payment-slide-thumb"
        aria-label={`Confirm payment of ${amount}`}
        disabled={pending}
        data-dragging={dragging}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || pending) return;
          const thumb = event.currentTarget;
          const travel = (thumb.parentElement?.clientWidth ?? 0) - thumb.offsetWidth - 12;
          if (travel <= 0) return;
          thumb.setPointerCapture(event.pointerId);
          gesture.current = { id: event.pointerId, start: event.clientX, travel };
          setDragging(true);
          navigator.vibrate?.(8);
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (current?.id === event.pointerId) {
            setOffset(Math.max(0, Math.min(current.travel, event.clientX - current.start)));
          }
        }}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
        onClick={(event) => { if (event.detail === 0) onConfirm(); }}
      >
        <span aria-hidden="true">{pending ? "…" : "→"}</span>
      </button>
    </div>
  );
}
