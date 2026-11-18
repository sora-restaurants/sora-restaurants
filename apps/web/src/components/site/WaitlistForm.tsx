"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { newIdempotencyKey } from "../../lib/idempotency-key.ts";
import { fieldErrors, RESTAURANT_TYPES, submissionSchema } from "../../lib/waitlist-schema.ts";

const EMPTY = { restaurantName: "", restaurantType: "", city: "", contactName: "", email: "", phone: "" };
const LABELS = {
  restaurantName: "Restaurant name", restaurantType: "Restaurant type", city: "City or town",
  contactName: "Your name", email: "Email address", phone: "Phone number",
};

export function WaitlistForm() {
  const [values, setValues] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [done, setDone] = useState<{ reference: string; restaurantName: string } | null>(null);
  const key = useRef("");
  const opened = useRef(0);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { opened.current = Date.now(); key.current = newIdempotencyKey(); }, []);
  useEffect(() => { if (done) heading.current?.focus(); }, [done]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const payload = { ...values, consent, submissionKey: key.current, companyUrl: trap, elapsedMs: Date.now() - opened.current };
    const parsed = submissionSchema.safeParse(payload);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      document.getElementById(`f-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setErrors({});
    setFailure("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.reference && body.restaurantName) { setDone(body); return; }
      if (body.fields) setErrors(body.fields);
      setFailure(body.error ?? "We could not save your enquiry. Please try again. Your answers are still here.");
    } catch {
      setFailure("We could not reach SORA. Check your connection and try again. Your answers are still here.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (done) return (
    <div className="card done" role="status">
      <h2 ref={heading} tabIndex={-1}>You’re on the list.</h2>
      <p>We received your enquiry for {done.restaurantName}. We will contact you to discuss a demonstration and pilot availability.</p>
      <div className="ref"><span className="dim">Your reference</span><b>{done.reference}</b></div>
      <Link className="btn" href="/">Return to the homepage</Link>
    </div>
  );

  return (
    <form className="card" onSubmit={submit} noValidate aria-labelledby="wl-heading">
      <h2 id="wl-heading" style={{ fontSize: "clamp(26px, 3vw, 36px)" }}>Tell us where to reach you.</h2>
      <p className="dim" style={{ margin: "12px 0 24px" }}>Add an email address or phone number. We can discuss your POS and restaurant setup during the follow-up.</p>
      <div className="fields">
        {Object.entries(LABELS).map(([name, label]) => {
          const field = name as keyof typeof EMPTY;
          const id = `f-${name}`;
          const contact = name === "email" || name === "phone";
          const common = {
            id, name, value: values[field], "aria-required": !contact, "aria-invalid": !!errors[name],
            "aria-describedby": errors[name] ? `${id}-err` : undefined,
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
              setValues((current) => ({ ...current, [name]: event.target.value }));
              setErrors((current) => ({ ...current, [name]: "" }));
            },
          };
          return <div className={`field${name === "restaurantName" ? " full" : ""}`} key={name}>
            <label htmlFor={id}>{label}{contact ? <em> (email or phone required)</em> : null}</label>
            {name === "restaurantType" ? (
              <select {...common}><option value="">Choose…</option>{RESTAURANT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            ) : <input {...common} type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
              autoComplete={{ restaurantName: "organization", contactName: "name", city: "address-level2", email: "email", phone: "tel" }[name] ?? "off"}
              maxLength={name === "email" ? 254 : 120} />}
            {errors[name] ? <p className="err" id={`${id}-err`}>{errors[name]}</p> : null}
          </div>;
        })}
      </div>
      <label className="hp" aria-hidden="true">Company URL<input tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} /></label>
      <label className="consent" style={{ marginTop: 24 }}>
        <input id="f-consent" type="checkbox" checked={consent} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "consent-err" : undefined} onChange={(event) => setConsent(event.target.checked)} />
        <span>I agree that SORA may store these details and contact me about my enquiry. I can ask for correction or deletion. Read the <Link className="link" href="/privacy" target="_blank">privacy notice</Link>.</span>
      </label>
      {errors.consent ? <p className="err" id="consent-err">{errors.consent}</p> : null}
      {failure ? <p className="alert" role="alert">{failure} You can also <a className="link" href="mailto:Sora.administration@gmail.com">email SORA</a>.</p> : null}
      <div className="form__nav"><span className="dim" style={{ fontSize: 14 }}>Free to join.</span><button className="btn" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Submitting…" : "Join the waitlist"}</button></div>
    </form>
  );
}
