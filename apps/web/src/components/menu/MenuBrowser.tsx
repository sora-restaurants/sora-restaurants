"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MenuItem, TableMenu } from "./types.ts";
import { QUICK_FILTERS, isDrinkSection, matchesFilter, matchesQuery, type QuickFilter } from "./donna-demo.ts";

type Category = TableMenu["categories"][number];
type Props = {
  categories: Category[];
  popular: { item: MenuItem; categoryId: string }[];
  formatCents: (cents: number) => string;
  renderCard: (item: MenuItem, category: Category, index: number) => ReactNode;
};

/**
 * Large menus (Donna's has ~350 dishes in 22 sections) open on a screen of glass section blocks instead of one
 * long scroll. A pinned search and quick filters search the whole menu; tapping a block shows only that section.
 */
export function MenuBrowser({ categories, popular, formatCents, renderCard }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<QuickFilter | null>(null);
  const top = useRef<HTMLDivElement | null>(null);
  const pendingScroll = useRef<string | null>(null);

  // The phone's Back button returns to the section blocks instead of leaving the menu.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setOpenId((e.state as { section?: string } | null)?.section ?? null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const target = pendingScroll.current;
    pendingScroll.current = null;
    if (target) document.getElementById(target)?.scrollIntoView({ block: "center" });
    else if (top.current && window.scrollY > top.current.offsetTop) window.scrollTo({ top: top.current.offsetTop });
  }, [openId, quick]);

  const open = (id: string | null, scrollTo?: string) => {
    pendingScroll.current = scrollTo ?? null;
    setQuery("");
    setQuick(null);
    if (id) history.pushState({ section: id }, "");
    else if ((history.state as { section?: string } | null)?.section) { history.back(); return; }
    setOpenId(id);
  };

  const searching = query.trim().length > 0 || quick !== null;
  const opened = categories.find((c) => c.id === openId) ?? null;
  const results = searching
    ? categories.map((c) => ({ category: c, items: c.items.filter((i) => (!quick || matchesFilter(quick, i, c.name)) && (!query.trim() || matchesQuery(query, i, c.name))) })).filter((g) => g.items.length > 0)
    : [];
  const resultCount = results.reduce((n, g) => n + g.items.length, 0);
  const food = categories.filter((c) => !isDrinkSection(c.name));
  const drinks = categories.filter((c) => isDrinkSection(c.name));

  return (
    <div ref={top}>
      <div className="sticky top-0 z-20 -mx-pad border-b border-line/50 bg-bg/80 px-pad pb-2 pt-3 backdrop-blur-xl">
        <label className="relative block">
          <span className="sr-only">Search the menu</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes, drinks, ingredients" className="search-box glass text-ink placeholder:text-muted" enterKeyHint="search" />
        </label>
        <div className="-mx-pad mt-2 flex gap-2 overflow-x-auto px-pad pb-1" role="group" aria-label="Quick filters">
          {opened && !searching && <button type="button" onClick={() => open(null)} className="filter-chip glass text-ink"><span aria-hidden="true">‹</span> All sections</button>}
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
          {results.map(({ category, items }) => (
            <div key={category.id} className="mb-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">{category.name}</p>
              <ul className="menu-grid">{items.map((item, i) => renderCard(item, category, i))}</ul>
            </div>
          ))}
        </section>
      ) : opened ? (
        <section aria-labelledby="open-section" className="pt-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="open-section" className="display text-3xl leading-none">{opened.name}</h2>
            <span className="text-sm text-muted">{opened.items.length} {isDrinkSection(opened.name) ? "drinks" : "dishes"}</span>
          </div>
          <ul className="menu-grid">{opened.items.map((item, i) => renderCard(item, opened, i))}</ul>
          {(() => {
            const next = categories[categories.indexOf(opened) + 1];
            return (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => open(null)} className="glass min-h-14 rounded-theme px-4 text-left font-bold">‹ All sections</button>
                {next && <button type="button" onClick={() => open(next.id)} className="glass min-h-14 rounded-theme px-4 text-right font-bold">Next: {next.name} ›</button>}
              </div>
            );
          })()}
        </section>
      ) : (
        <>
          {popular.length > 0 && (
            <section aria-labelledby="popular-tonight" className="pt-5">
              <h2 id="popular-tonight" className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent"><span className="inline-block size-2 animate-pulse rounded-full bg-cta" aria-hidden="true" />Popular tonight</h2>
              <ul className="-mx-pad flex snap-x gap-3 overflow-x-auto px-pad pb-2">
                {popular.map(({ item, categoryId }) => (
                  <li key={item.id} className="snap-start">
                    <button type="button" onClick={() => open(categoryId, `d-${item.id}`)} className="glass flex w-40 flex-col overflow-hidden rounded-theme text-left">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-24 w-full object-cover" /> : <span className="h-24 w-full bg-cta/30" />}
                      <span className="px-3 pb-3 pt-2"><span className="line-clamp-1 block text-sm font-bold">{item.name}</span><span className="text-sm font-bold text-price">{formatCents(item.priceCents)}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {[{ label: "Eat", list: food }, { label: "Drink", list: drinks }].filter((g) => g.list.length > 0).map((group) => (
            <section key={group.label} aria-label={group.label} className="pt-6">
              {food.length > 0 && drinks.length > 0 && <h2 className="display mb-3 text-2xl">{group.label}</h2>}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.list.map((c) => {
                  const photo = c.items.find((i) => i.imageUrl)?.imageUrl;
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => open(c.id)} className="section-block focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        {photo && <img src={photo} alt="" loading="lazy" />}
                        <span className="glass">
                          <span className="display block text-base leading-tight text-ink">{c.name}</span>
                          <span className="text-xs font-semibold text-muted">{c.items.length} {isDrinkSection(c.name) ? "drinks" : "dishes"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
