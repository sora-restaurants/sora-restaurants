"use client";

import { useActionState } from "react";
import { removeApplication, saveApplication, signIn } from "../../app/admin/actions.ts";
import { STATUS_LABELS, STATUSES } from "../../lib/waitlist-schema.ts";

export function LoginForm() {
  const [message, action, pending] = useActionState(signIn, "");
  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required aria-describedby={message ? "login-err" : undefined} />
        {message ? <p className="err" id="login-err" role="alert">{message}</p> : null}
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function ReviewForm({ id, status, notes }: { id: string; status: string; notes: string }) {
  const [message, action, pending] = useActionState(saveApplication, "");
  return (
    <form action={action} className="card" style={{ display: "grid", gap: 20 }}>
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>
      </div>
      <div className="field">
        <label htmlFor="notes">Internal notes</label>
        <textarea id="notes" name="notes" defaultValue={notes} maxLength={5000} style={{ minHeight: 180 }} />
        <small className="dim">Only SORA administrators see these.</small>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <span role="status" className="dim">{message}</span>
      </div>
    </form>
  );
}

export function DeleteForm({ id, name }: { id: string; name: string }) {
  const [message, action, pending] = useActionState(removeApplication, "");
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`Delete the application from ${name}? This cannot be undone.`)) e.preventDefault(); }} style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn--ghost" type="submit" disabled={pending}>{pending ? "Deleting…" : "Delete application"}</button>
      <span role="status" className="dim">{message}</span>
    </form>
  );
}
