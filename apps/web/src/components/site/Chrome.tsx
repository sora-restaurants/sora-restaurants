"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export const EMAIL = "Sora.administration@gmail.com";
const LINKS: [string, string][] = [["Home", "/"], ["How It Works", "/#how"], ["Features", "/#features"], ["For Restaurants", "/#restaurants"], ["Contact", "/#contact"]];

export const Arrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 7h11M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const close = () => setOpen(false);
  return (
    <header className={`nav${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`}>
      <div className="wrap nav__bar">
        <Link className="brand" href="/" onClick={close}>SORA</Link>
        <nav className="nav__links" aria-label="Main">{LINKS.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</nav>
        <Link className="btn btn--sm nav__cta" href="/waitlist" onClick={close}>Join Waitlist</Link>
        <button ref={toggle} className="nav__toggle" type="button" aria-label="Menu" aria-expanded={open} aria-controls="nav-sheet" onClick={() => setOpen(!open)}><i /><i /></button>
      </div>
      <div className="nav__sheet" id="nav-sheet" inert={!open}>
        <div><div className="wrap">
          {LINKS.map(([label, href]) => <Link key={label} href={href} onClick={close}>{label}</Link>)}
        </div></div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot" id="contact">
      <div className="wrap">
        <div className="foot__grid">
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <span className="brand">SORA</span>
            <p className="dim">Smarter ordering. Better restaurant experiences.</p>
          </div>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/#features">Features</Link></li>
            <li><Link href="/#how">How It Works</Link></li>
            <li><Link href="/waitlist">Join Waitlist</Link></li>
            <li><Link href="/privacy">Privacy Policy</Link></li>
          </ul>
          <ul>
            <li className="dim">Contact</li>
            <li><a href={`mailto:${EMAIL}`} style={{ color: "var(--ink)", overflowWrap: "anywhere" }}>{EMAIL}</a></li>
            <li className="dim">South Africa</li>
          </ul>
        </div>
        <div className="foot__legal"><span>© {new Date().getFullYear()} SORA</span><span>Interface previews on this site show sample data.</span></div>
      </div>
    </footer>
  );
}
