"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MenuItem } from "./types.ts";
import { QUICK_FILTERS, matchesFilter, matchesQuery, type QuickFilter } from "./donna-demo.ts";
import { entriesOf, minutesNow, servedNow, walk, type Category, type Entry, type MenuLayout, type MenuNode } from "./menu-layout.ts";

type Props = {
  /** The whole layout; blocks past their serving time are hidden here, using the restaurant's clock. */
  layout: MenuLayout;
  timeZone: string;
  popular: MenuItem[];
  formatCents: (cents: number) => string;
  renderCard: (item: MenuItem, category: Category, index: number) => ReactNode;
};

const count = (n: MenuNode) => { const k = entriesOf(n).length; return `${k} ${n.kind === "drink" ? (k === 1 ? "drink" : "drinks") : (k === 1 ? "dish" : "dishes")}`; };

/** "?at=09:30" shows the menu as it looks at that time, for demos and previews. */
function clockOverride(): number | null {
  if (typeof window === "undefined") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get("at") ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Large menus (Donna's has ~350 dishes) open on a screen of glass blocks instead of one long scroll. A block holds
 * smaller blocks (Mains > Pizza) or a list of dishes. A pinned search and quick filters search the whole menu.
 */
export function MenuBrowser({ layout: full, timeZone, popular, formatCents, renderCard }: Props) {
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<QuickFilter | null>(null);
  const [minutes, setMinutes] = useState(() => minutesNow(timeZone));
  const top = useRef<HTMLDivElement | null>(null);
  const pendingScroll = useRef<string | null>(null);

  // Breakfast and other timed blocks disappear on their own once their serving time passes.
  useEffect(() => {
    const tick = () => setMinutes(clockOverride() ?? minutesNow(timeZone));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [timeZone]);

  // The phone's Back button goes up one block instead of leaving the menu.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setPath((e.state as { menuPath?: string[] } | null)?.menuPath ?? []);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const target = pendingScroll.current;
    pendingScroll.current = null;
    if (target) document.getElementById(target)?.scrollIntoView({ block: "center" });
    else if (top.current && window.scrollY > top.current.offsetTop) window.scrollTo({ top: top.current.offsetTop });
  }, [path, quick]);

  const layout = servedNow(full, minutes);
  const all = walk(layout);
  const byId = new Map(all.map((x) => [x.node.id, x]));
  const opened = path.length > 0 ? byId.get(path[path.length - 1]) ?? null : null;

  const go = (next: string[], scrollTo?: string) => {
    pendingScroll.current = scrollTo ?? null;
    setQuery("");
    setQuick(null);
    const current = (history.state as { menuPath?: string[] } | null)?.menuPath ?? [];
    // Going up: step back through history so the phone's Back button stays in step.
    if (next.length < current.length && current.slice(0, next.length).join("/") === next.join("/")) { history.go(next.length - current.length); return; }
    history.pushState({ ...(history.state ?? {}), menuPath: next }, "");
    setPath(next);
  };
  const openNode = (id: string, scrollTo?: string) => { const x = byId.get(id); if (x) go([...x.trail.map((t) => t.id), id], scrollTo); };

  const searching = query.trim().length > 0 || quick !== null;
  const leaves = all.filter((x) => !x.node.children);
  const results = searching
    ? leaves.map(({ node, trail }) => ({ node, trail, entries: (node.entries ?? []).filter(({ item, category }) => {
        const where = `${trail.map((t) => t.name).join(" ")} ${node.name} ${category.name}`;
        return (!quick || matchesFilter(quick, item, category.name)) && (!query.trim() || matchesQuery(query, item, where));
      }) })).filter((g) => g.entries.length > 0)
    : [];
  const resultCount = results.reduce((n, g) => n + g.entries.length, 0);
  const where = new Map(leaves.flatMap(({ node }) => (node.entries ?? []).map((e) => [e.item.id, node.id] as const)));
  const shownPopular = popular.filter((i) => where.has(i.id));
  const food = layout.groups.some((g) => g.label === "Eat");
  const drink = layout.groups.some((g) => g.label === "Drink");

  const blocks = (nodes: MenuNode[]) => (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {nodes.map((n) => {
        const photo = entriesOf(n).find((e) => e.item.imageUrl)?.item.imageUrl;
        return (
          <li key={n.id}>
            <button type="button" onClick={() => openNode(n.id)} className="section-block focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {photo && <img src={photo} alt="" loading="lazy" />}
              <span className="glass">
                <span className="display block text-base leading-tight text-ink">{n.name}</span>
                <span className="text-xs font-semibold text-muted">{n.children && n.showAs === "blocks" ? `${n.children.length} sections · ` : ""}{count(n)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  const dishes = (entries: Entry[]) => <ul className="menu-grid">{entries.map(({ item, category }, i) => renderCard(item, category, i))}</ul>;

  return (
    <div ref={top}>
      <div className="sticky top-0 z-20 -mx-pad border-b border-line/50 bg-bg/80 px-pad pb-2 pt-3 backdrop-blur-xl">
        <label className="relative block">
          <span className="sr-only">Search the menu</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes, drinks, ingredients" className="search-box glass text-ink placeholder:text-muted" enterKeyHint="search" />
        </label>
        <div className="-mx-pad mt-2 flex gap-2 overflow-x-auto px-pad pb-1" role="group" aria-label="Quick filters">
          {opened && !searching && <button type="button" onClick={() => go(path.slice(0, -1))} className="filter-chip glass text-ink"><span aria-hidden="true">‹</span> {opened.trail[opened.trail.length - 1]?.name ?? "All sections"}</button>}
          {QUICK_FILTERS.map((f) => <button key={f.id} type="button" aria-pressed={quick === f.id} onClick={() => setQuick(quick === f.id ? null : f.id)} className="filter-chip glass text-ink">{f.label}</button>)}
        </div>
      </div>

      {searching ? (
        <section aria-live="polite" className="pt-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="display text-xl">{resultCount === 0 ? "Nothing matches yet" : `${resultCount} ${resultCount === 1 ? "match" : "matches"}`}</h2>
            <button type="button" onClick={() => { setQuery(""); setQuick(null); }} className="text-sm font-bold text-accent">Clear</button>
          </div>
          {resultCount === 0 && <p className="text-sm text-muted">Try another word, or clear the filter to see every section.</p>}
          {results.map(({ node, trail, entries }) => (
            <div key={node.id} className="mb-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">{[...trail.map((t) => t.name), node.name].join(" · ")}</p>
              {dishes(entries)}
            </div>
          ))}
        </section>
      ) : opened ? (
        <section aria-labelledby="open-section" className="pt-5">
          {opened.trail.length > 0 && <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-accent">{opened.trail.map((t) => t.name).join(" · ")}</p>}
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="open-section" className="display text-3xl leading-none">{opened.node.name}</h2>
            <span className="text-sm text-muted">{count(opened.node)}</span>
          </div>
          {opened.node.children && opened.node.showAs === "blocks" ? blocks(opened.node.children)
            : opened.node.children ? (
              <>
                <div className="-mx-pad mb-4 flex gap-2 overflow-x-auto px-pad pb-1" role="group" aria-label={`Jump to part of ${opened.node.name}`}>
                  {opened.node.children.map((c) => <a key={c.id} href={`#g-${c.id}`} className="filter-chip glass text-ink">{c.name}</a>)}
                </div>
                {opened.node.children.map((c) => (
                  <div key={c.id} id={`g-${c.id}`} className="mb-7 scroll-mt-32">
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">{c.name}</h3>
                    {dishes(entriesOf(c))}
                  </div>
                ))}
              </>
            ) : dishes(opened.node.entries ?? [])}
          {(() => {
            const siblings = opened.trail.length > 0 ? opened.trail[opened.trail.length - 1].children ?? [] : layout.groups.flatMap((g) => g.nodes);
            const next = siblings[siblings.findIndex((s) => s.id === opened.node.id) + 1];
            const up = opened.trail[opened.trail.length - 1];
            return (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => go(path.slice(0, -1))} className="glass min-h-14 rounded-theme px-4 text-left font-bold">‹ {up ? up.name : "All sections"}</button>
                {next && <button type="button" onClick={() => go([...path.slice(0, -1), next.id])} className="glass min-h-14 rounded-theme px-4 text-right font-bold">Next: {next.name} ›</button>}
              </div>
            );
          })()}
        </section>
      ) : (
        <>
          {shownPopular.length > 0 && (
            <section aria-labelledby="popular-tonight" className="pt-5">
              <h2 id="popular-tonight" className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent"><span className="inline-block size-2 animate-pulse rounded-full bg-cta" aria-hidden="true" />Popular tonight</h2>
              <ul className="-mx-pad flex snap-x gap-3 overflow-x-auto px-pad pb-2">
                {shownPopular.map((item) => (
                  <li key={item.id} className="snap-start">
                    <button type="button" onClick={() => openNode(where.get(item.id)!, `d-${item.id}`)} className="glass flex w-40 flex-col overflow-hidden rounded-theme text-left">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-24 w-full object-cover" /> : <span className="h-24 w-full bg-cta/30" />}
                      <span className="px-3 pb-3 pt-2"><span className="line-clamp-1 block text-sm font-bold">{item.name}</span><span className="text-sm font-bold text-price">{formatCents(item.priceCents)}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {layout.groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="pt-6">
              {food && drink && <h2 className="display mb-3 text-2xl">{group.label}</h2>}
              {blocks(group.nodes)}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
