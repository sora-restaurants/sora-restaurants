"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** How the kitchen tablet signs staff in: Supabase Auth, or the local-demo dev login. Same interface either way. */
export type StaffAuth = {
  mode: "supabase" | "dev";
  getToken(): Promise<string | null>;
  /** Resolves to an error message, or null on success. */
  signIn(email: string, password: string): Promise<string | null>;
  onChange(listener: () => void): () => void;
};

const BAD_LOGIN = "That email and password did not match.";

function supabaseAuth(url: string, anonKey: string): StaffAuth {
  let client: SupabaseClient | undefined;
  // Created on first use in the browser, never at import, so a build without env vars still succeeds.
  const supabase = () => (client ??= createClient(url, anonKey));
  return {
    mode: "supabase",
    getToken: async () => (await supabase().auth.getSession()).data.session?.access_token ?? null,
    signIn: async (email, password) => ((await supabase().auth.signInWithPassword({ email, password })).error ? BAD_LOGIN : null),
    onChange: (listener) => {
      const { data } = supabase().auth.onAuthStateChange(() => listener());
      return () => data.subscription.unsubscribe();
    },
  };
}

// Dev tokens live only in this tab (sessionStorage) and expire after 12 hours on the server.
const DEV_KEY = "sora-dev-staff-token";
function devAuth(): StaffAuth {
  const listeners = new Set<() => void>();
  return {
    mode: "dev",
    getToken: async () => sessionStorage.getItem(DEV_KEY),
    signIn: async (email, password) => {
      const res = await fetch("/api/dev/staff-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return BAD_LOGIN;
      sessionStorage.setItem(DEV_KEY, (await res.json()).token);
      listeners.forEach((l) => l());
      return null;
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** null when neither sign-in method is configured. */
export function staffAuth(): StaffAuth | null {
  // NEXT_PUBLIC_ values are inlined at build time; a production build with this set is refused (next.config.ts).
  if (process.env.NEXT_PUBLIC_DEV_STAFF_LOGIN === "1") return devAuth();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? supabaseAuth(url, key) : null;
}
