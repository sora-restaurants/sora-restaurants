"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, adminConfigured, loginAllowed, newSession, passwordMatches, SESSION_HOURS } from "../../server/admin-auth.ts";
import { requireAdmin } from "../../server/admin-session.ts";
import { prodDeps } from "../../server/prod-deps.ts";
import { updateApplication } from "../../server/waitlist.ts";

export async function signIn(_: string, form: FormData): Promise<string> {
  if (!adminConfigured()) return "Admin sign-in is not set up on this server. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET.";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!loginAllowed(ip, Date.now())) return "Too many attempts. Wait 15 minutes and try again.";
  if (!passwordMatches(String(form.get("password") ?? ""))) return "That password is not right.";
  (await cookies()).set(ADMIN_COOKIE, newSession(Date.now()), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: SESSION_HOURS * 3600,
  });
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

export async function saveApplication(_: string, form: FormData): Promise<string> {
  await requireAdmin();
  const id = String(form.get("id"));
  const saved = await updateApplication(prodDeps().db, id, String(form.get("status")), String(form.get("notes") ?? ""));
  if (!saved) return "Could not save. Reload the page and try again.";
  revalidatePath("/admin");
  return "Saved.";
}
