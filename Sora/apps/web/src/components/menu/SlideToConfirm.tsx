"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  label: string;
  disabled?: boolean;
  onConfirm: () => Promise<boolean> | boolean;
};

const THRESHOLD = 0.86;

/** Premium slide-to-confirm. Success is shown only after onConfirm resolves true. */
export function SlideToConfirm({ label, disabled = false, onConfirm }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const start = useRef(0);
  const origin = useRef(0);
  const busy = useRef(false);

  const max = useCallback(() => {
    const el = track.current;
    if (!el) return 0;
    return Math.max(0, el.clientWidth - 68);
  }, []);

  const progress = max() > 0 ? Math.min(1, x / max()) : 0;
  const near = progress >= 0.72;

  const haptic = (ms: number) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  };

  const submit = useCallback(async () => {
    if (disabled || done || busy.current) return;
    busy.current = true;
    setFailed(false);
    setPending(true);
    haptic(12);
    try {
      const ok = await onConfirm();
      if (ok) {
        setDone(true);
        haptic(18);
      } else {
        setX(0);
        setFailed(true);
      }
    } catch {
      setX(0);
      setFailed(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [disabled, done, onConfirm]);

  const finish = useCallback(
    (next: number) => {
      const limit = max();
      setDragging(false);
      if (limit > 0 && next >= limit * THRESHOLD) {
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
        aria-valuenow={done ? 100 : Math.round(progress * 100)}
        aria-label={label}
        aria-disabled={disabled || pending || done}
        tabIndex={disabled ? -1 : 0}
        className={`liquid-track relative h-16 w-full select-none overflow-hidden rounded-full ${disabled ? "opacity-60" : ""} ${near && !done ? "liquid-near" : ""} ${done ? "liquid-done" : ""} ${failed ? "liquid-failed" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void submit();
          }
          if (event.key === "ArrowRight") setX((value) => Math.min(max(), value + 24));
          if (event.key === "ArrowLeft") setX((value) => Math.max(0, value - 24));
        }}
        onPointerDown={(event) => {
          if (disabled || done || pending) return;
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          start.current = event.clientX;
          origin.current = x;
          setDragging(true);
          setFailed(false);
        }}
        onPointerMove={(event) => {
          if (!dragging || disabled || done || pending) return;
          setX(Math.min(max(), Math.max(0, origin.current + event.clientX - start.current)));
        }}
        onPointerUp={(event) => finish(Math.min(max(), Math.max(0, origin.current + event.clientX - start.current)))}
        onPointerCancel={() => finish(x)}
      >
        <div className="liquid-fill" style={{ width: `${Math.max(18, progress * 100)}%` }} aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold tracking-wide text-ink/80">
          {done ? "Confirmed" : pending ? "Confirming…" : failed ? "Try again" : label}
        </div>
        <div
          className={`liquid-knob absolute top-1 left-1 grid size-14 place-items-center rounded-full text-lg ${pending ? "liquid-spin" : ""}`}
          style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 320ms cubic-bezier(.2,.8,.2,1)" }}
          aria-hidden="true"
        >
          {done ? "✓" : pending ? "" : "→"}
        </div>
      </div>
      <button
        type="button"
        className="min-h-tap w-full rounded-full border border-white/40 bg-white/30 text-sm font-semibold backdrop-blur-md"
        disabled={disabled || pending || done}
        onClick={() => void submit()}
      >
        {pending ? "Confirming…" : done ? "Confirmed" : "Confirm with keyboard"}
      </button>
    </div>
  );
}
