"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  label: string;
  disabled?: boolean;
  onConfirm: () => Promise<boolean> | boolean;
};

/** Slide-to-confirm. Success is shown only after onConfirm resolves true. */
export function SlideToConfirm({ label, disabled = false, onConfirm }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const start = useRef(0);
  const origin = useRef(0);
  const busy = useRef(false);

  const max = useCallback(() => {
    const el = track.current;
    if (!el) return 0;
    return Math.max(0, el.clientWidth - 64);
  }, []);

  const submit = useCallback(async () => {
    if (disabled || done || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const ok = await onConfirm();
      if (ok) setDone(true);
      else setX(0);
    } catch {
      setX(0);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [disabled, done, onConfirm]);

  const finish = useCallback(
    (next: number) => {
      const limit = max();
      setDragging(false);
      if (limit > 0 && next >= limit * 0.85) {
        setX(limit);
        void submit();
      } else {
        setX(0);
      }
    },
    [max, submit],
  );

  return (
    <div className="space-y-2">
      <div
        ref={track}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={done ? 100 : Math.round((x / Math.max(max(), 1)) * 100)}
        aria-label={label}
        aria-disabled={disabled || pending || done}
        tabIndex={disabled ? -1 : 0}
        className={`liquid-track relative h-16 w-full select-none overflow-hidden rounded-full ${disabled || pending ? "opacity-70" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void submit();
          }
        }}
        onPointerDown={(event) => {
          if (disabled || done || pending) return;
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          start.current = event.clientX;
          origin.current = x;
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!dragging || disabled || done || pending) return;
          setX(Math.min(max(), Math.max(0, origin.current + event.clientX - start.current)));
        }}
        onPointerUp={(event) => finish(Math.min(max(), Math.max(0, origin.current + event.clientX - start.current)))}
        onPointerCancel={() => finish(x)}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold tracking-wide text-ink/70">
          {done ? "Confirmed" : pending ? "Confirming…" : label}
        </div>
        <div
          className="liquid-knob absolute top-1 left-1 grid size-14 place-items-center rounded-full text-lg"
          style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 280ms cubic-bezier(.2,.8,.2,1)" }}
          aria-hidden="true"
        >
          →
        </div>
      </div>
      <button
        type="button"
        className="min-h-tap w-full rounded-theme border border-line/50 text-sm font-semibold"
        disabled={disabled || pending || done}
        onClick={() => void submit()}
      >
        {pending ? "Confirming…" : "Confirm with keyboard"}
      </button>
    </div>
  );
}
