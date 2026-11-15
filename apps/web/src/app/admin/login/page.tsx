import { redirect } from "next/navigation";
import { adminConfigured } from "../../../server/admin-auth.ts";
import { isAdmin } from "../../../server/admin-session.ts";
import { LoginForm } from "../../../components/site/AdminForms.tsx";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="login">
      <div style={{ display: "grid", gap: 24, width: "min(100%, 380px)" }}>
        <span className="brand">SORA</span>
        <h1 style={{ fontSize: 40 }}>Admin sign-in</h1>
        {adminConfigured()
          ? <LoginForm />
          : <p className="alert">Admin sign-in is not set up on this server. Set ADMIN_PASSWORD (12 characters or more) and ADMIN_SESSION_SECRET (32 or more), then restart.</p>}
      </div>
    </main>
  );
}
