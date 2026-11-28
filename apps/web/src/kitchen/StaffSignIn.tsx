"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { ColorModeToggle, useColorMode } from "../components/ColorModeToggle.tsx";
import type { StaffAuth } from "./staff-auth.ts";

// The one staff sign-in, in the owner dashboard's Sora look: shared by the portal picker, owner, kitchen, bar and waiter screens (one account, one session per browser).
export const STAFF_COLOR_KEY = "sora-staff-color-mode";
export const EYEBROW = "text-xs font-black uppercase tracking-[0.18em] text-[#C45C26]";

/** Owner-dashboard page shell, with its light/dark tokens and toggle. Pass a function to place the toggle yourself. */
export function Shell({ children, center = false }: { children: ReactNode | ((toggle: ReactNode) => ReactNode); center?: boolean }) {
  const { mode, toggle } = useColorMode(STAFF_COLOR_KEY);
  const button = <ColorModeToggle mode={mode} onToggle={toggle} className="border-[var(--owner-border)]" />;
  return (
    <main data-mode={mode} className={`owner-shell min-h-dvh bg-[var(--owner-bg)] px-3 py-4 font-[family-name:var(--font-manrope)] text-[var(--owner-text)] sm:px-6 ${center ? "owner-login grid place-items-center" : ""}`}>
      <div className={`mx-auto w-full ${center ? "max-w-md" : "max-w-5xl"}`}>
        {typeof children === "function" ? children(button) : <><div className="mb-2 flex justify-end">{button}</div>{children}</>}
      </div>
    </main>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <Shell center><p className="rounded-3xl bg-[var(--owner-surface)] p-6 text-center text-xl font-bold shadow-sm">{children}</p></Shell>;
}

/** The owner sign-in card, worded for the staff screen it guards. */
export function SignIn({ auth, title = "SORA staff sign in", demo = "kitchen@demo.test / demo-kitchen-pass" }: { auth: StaffAuth; title?: string; demo?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(await auth.signIn(String(form.get("email")), String(form.get("password"))));
    setBusy(false);
  }
  const field = "mt-2 min-h-14 w-full rounded-xl border border-[var(--owner-border)] bg-white px-4 text-[#1C1917] caret-[#1C1917]";
  return (
    <Shell center>
      <form onSubmit={submit} className="w-full space-y-4 rounded-3xl bg-[var(--owner-surface)] p-6 text-left shadow-xl sm:p-8">
        <h1 className="text-4xl font-black">{title}</h1>
        <p className="text-sm text-[var(--owner-muted)]">One login for the owner, kitchen, bar and waiter screens.</p>
        {auth.mode === "dev" && <p className="rounded-xl bg-[#F5DFC1] p-3 text-sm text-[#70420F]">Local demo: {demo}</p>}
        <label className="block font-bold">Email<input name="email" type="email" autoComplete="username" required className={field} /></label>
        <label className="block font-bold">Password<input name="password" type="password" autoComplete="current-password" required className={field} /></label>
        {error && <p role="alert" className="rounded-xl bg-[#F5DFC1] p-3 text-[#70420F]">{error}</p>}
        <button disabled={busy} className="min-h-14 w-full rounded-xl bg-[#C45C26] font-black text-white">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </Shell>
  );
}
