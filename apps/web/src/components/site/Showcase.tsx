"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

export type Tab = { id: string; label: string; title: string; text: string; ui: ReactNode };

/** The product showcase tabs. Arrow keys move between tabs, as a tab list should. */
export function Showcase({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  };
  const tab = tabs[active];
  return (
    <div data-reveal>
      <div className="tabs" role="tablist" aria-label="SORA interfaces" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={i === active} aria-controls="showcase-panel" tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="show" id="showcase-panel" role="tabpanel" aria-labelledby={`tab-${tab.id}`}>
        <div className="show__copy">
          <span className="eyebrow">Product demonstration · sample data</span>
          <h3 style={{ fontSize: "clamp(24px, 3vw, 36px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{tab.title}</h3>
          <p className="dim">{tab.text}</p>
        </div>
        <div className="show__ui" key={tab.id}>{tab.ui}</div>
      </div>
    </div>
  );
}
