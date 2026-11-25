"use client";

import { type FormEvent, useState } from "react";
import type { StaffAuth } from "./staff-auth.ts";

// Shared by the kitchen board and the waiter screen.
export function SignIn({ auth, title = "Kitchen sign in" }: { auth: StaffAuth; title?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const failure = await auth.signIn(String(form.get("email")), String(form.get("password")));
    setBusy(false);
    setError(failure);
  }

  const field = "min-h-16 w-full border-4 border-white bg-black px-4 text-2xl text-white";
  return (
    <Screen>
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-4 text-left">
        <h1 className="text-4xl uppercase">{title}</h1>
        {auth.mode === "dev" ? (
          <p className="border-4 border-[oklch(82%_0.17_78)] p-3 text-xl text-[oklch(82%_0.17_78)]">
            Local demo login. Seeded staff accounts only.
          </p>
        ) : null}
        <label className="flex flex-col gap-2 text-xl uppercase">
          Email
          <input name="email" type="email" autoComplete="username" required className={field} />
        </label>
        <label className="flex flex-col gap-2 text-xl uppercase">
          Password
          <input name="password" type="password" autoComplete="current-password" required className={field} />
        </label>
        {error ? (
          <p role="alert" className="bg-[oklch(55%_0.22_28)] p-3 text-xl">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="min-h-16 bg-white text-3xl uppercase text-black disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Screen>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[oklch(13%_0_0)] p-6 text-center font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-white">
      {children}
    </main>
  );
}
