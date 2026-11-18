"use client";

import { useActionState, useEffect, useState } from "react";
import { saveApplication, signIn } from "../../app/admin/actions.ts";
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
  const [ready, setReady] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [currentNotes, setCurrentNotes] = useState(notes);
  useEffect(() => setReady(true), []);
  return (
    <form action={action} className="card" style={{ display: "grid", gap: 20 }}>
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} disabled={!ready || pending}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>
      </div>
      <div className="field">
        <label htmlFor="notes">Internal notes</label>
        <textarea id="notes" name="notes" value={currentNotes} onChange={(event) => setCurrentNotes(event.target.value)} disabled={!ready || pending} maxLength={5000} style={{ minHeight: 180 }} />
        <small className="dim">Only SORA administrators see these.</small>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <button className="btn" type="submit" disabled={pending || !ready}>{pending ? "Saving…" : "Save"}</button>
        <span role="status" className="dim">{message}</span>
      </div>
    </form>
  );
}
