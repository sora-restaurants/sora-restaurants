"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  label: string;
  disabled?: boolean;
  onConfirm: () => void;
};

/** Slide-to-confirm with a liquid-glass track, in the spirit of Apple's frosted controls. */
export function SlideToConfirm({ label, disabled = false, onConfirm }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const start = useRef(0);
  const origin = useRef(0);

  const max = useCallback(() => {
    const el = track.current;
    if (!el) return 0;
    return Math.max(0, el.clientWidth - 64);
  }, []);

  const finish = useCallback(
    (next: number) => {
      const limit = max();
      if (limit > 0 && next >= limit * 0.85) {
        setX(limit);
        setDone(true);
        onConfirm();
      } else {
        setX(0);
      }
      setDragging(false);
    },
    [max, onConfirm],
  );

  return (
    <div
      ref={track}
      className={`liquid-track relative h-16 w-full select-none overflow-hidden rounded-full ${disabled ? "opacity-60" : ""}`}
      onPointerDown={(event) => {
        if (disabled || done) return;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        start.current = event.clientX;
        origin.current = x;
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!dragging || disabled || done) return;
        const next = Math.min(max(), Math.max(0, origin.current + event.clientX - start.current));
        setX(next);
      }}
      onPointerUp={(event) => finish(Math.min(max(), Math.max(0, origin.current + event.clientX - start.current)))}
      onPointerCancel={() => finish(x)}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold tracking-wide text-ink/70">
        {done ? "Confirmed" : label}
      </div>
      <div
        className="liquid-knob absolute top-1 left-1 grid size-14 place-items-center rounded-full text-lg"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 280ms cubic-bezier(.2,.8,.2,1)" }}
        aria-hidden="true"
      >
        →
      </div>
    </div>
  );
}
