"use client";

import { useEffect, useMemo, useState } from "react";
import { type StaffAuth, staffAuth } from "./staff-auth.ts";
import { Screen, SignIn } from "./StaffSignIn.tsx";

// One sign-in for every staff screen; each portal still checks the account's role on the server.
const PORTALS = [
  { href: "/owner", title: "Owner", text: "Tables, QR codes, menu and today's orders." },
  { href: "/kitchen", title: "Kitchen", text: "Live order board for the kitchen: food only." },
  { href: "/bar", title: "Bar", text: "Live order board for the bar: drinks only." },
  { href: "/waiter", title: "Waiter", text: "Table calls and unpaid tables." },
];

export function StaffHome() {
  const auth = useMemo(staffAuth, []);
  if (!auth) return <Screen>Staff sign-in is not configured.</Screen>;
  return <StaffSession auth={auth} />;
}

function StaffSession({ auth }: { auth: StaffAuth }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { const refresh = () => auth.getToken().then(setToken); refresh(); return auth.onChange(refresh); }, [auth]);

  if (token === undefined) return <Screen>Loading…</Screen>;
  if (!token) return <SignIn auth={auth} />;
  return (
    <main className="min-h-dvh bg-[#0a0a0a] p-6 font-[family-name:var(--font-geist)] text-white">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Choose a screen</h1>
          <button type="button" onClick={() => void auth.signOut()} className="min-h-12 rounded-[4px] border border-[#262626] px-4 text-sm">Sign out</button>
        </div>
        <ul className="grid gap-3">
          {PORTALS.map((p) => (
            <li key={p.href}>
              <a href={p.href} className="block rounded-[4px] border border-[#262626] bg-[#151515] p-5 hover:border-white focus-visible:outline-2 focus-visible:outline-white">
                <span className="block text-2xl font-semibold">{p.title} →</span>
                <span className="mt-1 block text-[#9b9b9b]">{p.text}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-[#9b9b9b]">You stay signed in on this device for every screen. A screen your account can&apos;t use says so.</p>
      </div>
    </main>
  );
}
