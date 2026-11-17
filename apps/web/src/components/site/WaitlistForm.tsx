"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { newIdempotencyKey } from "../../lib/idempotency-key.ts";
import {
  CONTACT_METHODS, DAILY_VOLUMES, FEATURES, fieldErrors, IMPROVEMENTS, KITCHEN_SYSTEMS, ORDERING_METHODS, PAYMENT_METHODS, POS_SYSTEMS,
  POSITIONS, QR_USE, RESTAURANT_TYPES, STEP_KEYS, steps, TIMELINES, YES_NO_MAYBE,
} from "../../lib/waitlist-schema.ts";
import { Arrow } from "./Chrome.tsx";

type Field = {
  name: string; label: string; kind: "text" | "email" | "tel" | "number" | "select" | "radio" | "checks" | "area";
  options?: readonly string[]; required?: boolean; full?: boolean; hint?: string; auto?: string; showIf?: (v: Values) => boolean;
};
type Values = Record<string, string | string[]>;

const FORM: { title: string; intro: string; fields: Field[] }[] = [
  { title: "Restaurant information", intro: "The basics about your restaurant.", fields: [
    { name: "restaurantName", label: "Restaurant name", kind: "text", required: true, auto: "organization", full: true },
    { name: "restaurantType", label: "Restaurant type", kind: "select", options: RESTAURANT_TYPES, required: true },
    { name: "city", label: "Location / city", kind: "text", required: true, auto: "address-level2" },
    { name: "locations", label: "Number of physical locations", kind: "number", required: true },
    { name: "tablesCount", label: "Approximate number of tables", kind: "number", required: true },
    { name: "seatingCapacity", label: "Approximate seating capacity", kind: "number" },
    { name: "website", label: "Restaurant website", kind: "text", auto: "url", hint: "example.co.za" },
    { name: "social", label: "Instagram or social media", kind: "text", full: true },
  ] },
  { title: "Contact information", intro: "Who should we speak to?", fields: [
    { name: "contactName", label: "Your full name", kind: "text", required: true, auto: "name" },
    { name: "contactPosition", label: "Position at the restaurant", kind: "select", options: POSITIONS, required: true },
    { name: "email", label: "Business email address", kind: "email", required: true, auto: "email" },
    { name: "phone", label: "Phone number", kind: "tel", required: true, auto: "tel", hint: "For example 0821234567" },
    { name: "preferredContact", label: "Preferred contact method", kind: "radio", required: true, options: CONTACT_METHODS, full: true },
    { name: "bestTime", label: "Best time to contact", kind: "text", full: true, hint: "For example: weekdays before 11:00" },
  ] },
  { title: "Current operations", intro: "How your restaurant runs today.", fields: [
    { name: "posSystem", label: "What point-of-sale (POS) system does your restaurant currently use?", kind: "select", options: POS_SYSTEMS, required: true, full: true },
    { name: "posOther", label: "Which POS system?", kind: "text", required: true, full: true, showIf: (v) => v.posSystem === "Other" },
    { name: "orderingMethod", label: "How do customers currently place orders?", kind: "radio", required: true, options: ORDERING_METHODS, full: true },
    { name: "usesQr", label: "Do you currently use QR-code menus or ordering?", kind: "radio", required: true, options: QR_USE, full: true },
    { name: "kitchenSystem", label: "How does the kitchen receive orders?", kind: "radio", required: true, options: KITCHEN_SYSTEMS, full: true },
    { name: "paymentHandling", label: "How do you currently handle payments?", kind: "checks", options: PAYMENT_METHODS, full: true },
    { name: "dailyVolume", label: "Approximately how many customers do you serve daily?", kind: "select", required: true, options: DAILY_VOLUMES, full: true },
  ] },
  { title: "What you need", intro: "Tell us where SORA could help most.", fields: [
    { name: "improvements", label: "What would you most like SORA to improve?", kind: "checks", options: IMPROVEMENTS, full: true },
    { name: "featureInterests", label: "Which SORA features interest you most?", kind: "checks", options: FEATURES, full: true },
    { name: "biggestChallenge", label: "What is the biggest operational challenge your restaurant currently faces?", kind: "area", full: true },
    { name: "requests", label: "Is there anything specific you would like SORA to offer?", kind: "area", full: true },
  ] },
  { title: "Final details", intro: "Timing and next steps.", fields: [
    { name: "testTimeline", label: "How soon would you be interested in testing SORA?", kind: "radio", required: true, options: TIMELINES, full: true },
    { name: "openToDemo", label: "Would you be open to an initial demonstration?", kind: "radio", required: true, options: YES_NO_MAYBE, full: true },
    { name: "pilotInterest", label: "Would you be willing to participate in a pilot programme?", kind: "radio", required: true, options: YES_NO_MAYBE, full: true },
    { name: "comments", label: "Any additional comments?", kind: "area", full: true },
  ] },
];
const REVIEW = FORM.length;
const EMPTY: Values = Object.fromEntries(FORM.flatMap((s) => s.fields.map((f) => [f.name, f.kind === "checks" ? [] : ""])));

export function WaitlistForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [done, setDone] = useState<{ reference: string; restaurantName: string } | null>(null);
  const key = useRef("");
  const opened = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => { opened.current = Date.now(); key.current = newIdempotencyKey(); }, []);
  // Each new step (and the result) starts at its heading, for keyboard and screen-reader users; not on first load.
  useEffect(() => { if (first.current) { first.current = false; return; } heading.current?.focus(); }, [step, done]);

  const set = (name: string, value: string | string[]) => { setValues((v) => ({ ...v, [name]: value })); setErrors((e) => ({ ...e, [name]: "" })); };
  const visible = (i: number) => FORM[i].fields.filter((f) => !f.showIf || f.showIf(values));

  const check = (i: number): boolean => {
    const parsed = steps[STEP_KEYS[i]].safeParse(values);
    const found = parsed.success ? {} : fieldErrors(parsed.error);
    setErrors(found);
    const bad = Object.keys(found)[0];
    if (bad) requestAnimationFrame(() => document.getElementById(`f-${bad}`)?.focus());
    return !bad;
  };
  const next = () => { if (check(step)) { setFailure(""); setStep(step + 1); } };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!consent) { setErrors({ consent: "Tick the box to agree before you submit." }); document.getElementById("f-consent")?.focus(); return; }
    setBusy(true); setFailure("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, consent: true, submissionKey: key.current, companyUrl: trap, elapsedMs: Date.now() - opened.current }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) { setDone(body); return; }
      if (body.fields) {
        setErrors(body.fields);
        const at = FORM.findIndex((s) => s.fields.some((f) => body.fields[f.name]));
        if (at >= 0) setStep(at);
      }
      setFailure(body.error ?? "Something went wrong. Try again in a moment.");
    } catch {
      setFailure("We could not reach SORA. Check your connection and try again; your answers are still here.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card done" role="status">
        <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="36" cy="36" r="33" /><path d="M23 37l9 9 18-20" /></svg>
        <h2 ref={heading} tabIndex={-1} style={{ outline: 0 }}>You&rsquo;re on the list.</h2>
        <p className="lead">Thank you for your interest in SORA. We&rsquo;ve received your restaurant application and will be in touch as we prepare for our first restaurant partnerships.</p>
        <div className="ref"><span className="dim">{done.restaurantName}</span><b>{done.reference}</b><small className="dim">Your reference number. Keep it for your records.</small></div>
        <Link className="btn" href="/">Return to the homepage</Link>
      </div>
    );
  }

  const total = REVIEW + 1;
  return (
    <form className="card" onSubmit={submit} noValidate aria-labelledby="wl-step">
      <span className="eyebrow">Step {step + 1} of {total}</span>
      <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label="Application progress">
        {Array.from({ length: total }, (_, i) => <i key={i} className={i <= step ? "on" : ""} />)}
      </div>
      <h2 id="wl-step" ref={heading} tabIndex={-1} style={{ fontSize: "clamp(26px, 3vw, 36px)", outline: 0 }}>{step < REVIEW ? FORM[step].title : "Review and submit"}</h2>
      <p className="dim" style={{ margin: "8px 0 28px" }}>{step < REVIEW ? FORM[step].intro : "Check your answers. You can go back to change anything."}</p>

      {step < REVIEW ? (
        <div className="fields" key={step}>
          {visible(step).map((f) => <Input key={f.name} f={f} value={values[f.name]} error={errors[f.name]} set={set} />)}
        </div>
      ) : (
        <div key="review" style={{ display: "grid", gap: 24 }}>
          <dl className="review">
            {FORM.flatMap((s, i) => visible(i)).filter((f) => values[f.name].length > 0).map((f) => (
              <div key={f.name}><dt>{f.label}</dt><dd>{Array.isArray(values[f.name]) ? (values[f.name] as string[]).join(", ") : values[f.name]}</dd></div>
            ))}
          </dl>
          <div>
            <label className="consent">
              <input id="f-consent" type="checkbox" checked={consent} aria-invalid={!!errors.consent} aria-describedby="consent-note"
                onChange={(e) => { setConsent(e.target.checked); setErrors({}); }} />
              <span id="consent-note">I agree that SORA may store the information above and use it to assess this application and to contact the restaurant about SORA.
                It is not sold or used for anything else, and I can ask for it to be corrected or deleted at any time. See the <Link className="link" href="/privacy" target="_blank">privacy policy</Link>.</span>
            </label>
            {errors.consent ? <p className="err" style={{ marginTop: 8 }}>{errors.consent}</p> : null}
          </div>
        </div>
      )}

      <label className="hp" aria-hidden="true">Company URL<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
      {failure ? <p className="alert" role="alert">{failure}</p> : null}

      <div className="form__nav">
        {step > 0 ? <button type="button" className="btn btn--ghost" onClick={() => { setErrors({}); setStep(step - 1); }} disabled={busy}>Back</button> : <span />}
        {step < REVIEW
          ? <button type="button" className="btn" onClick={next}>{step === REVIEW - 1 ? "Review answers" : "Continue"} <Arrow /></button>
          : <button type="submit" className="btn" disabled={busy} aria-busy={busy}>{busy ? "Submitting…" : "Submit application"}</button>}
      </div>
    </form>
  );
}

function Input({ f, value, error, set }: { f: Field; value: string | string[]; error?: string; set: (name: string, value: string | string[]) => void }) {
  const id = `f-${f.name}`;
  const described = [error ? `${id}-err` : "", f.hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  const label = <>{f.label}{f.required ? null : <em> (optional)</em>}</>;
  const foot = <>{f.hint ? <small className="dim" id={`${id}-hint`}>{f.hint}</small> : null}{error ? <p className="err" id={`${id}-err`}>{error}</p> : null}</>;
  const cls = `field${f.full ? " full" : ""}`;
  const common = { id, name: f.name, "aria-invalid": !!error, "aria-describedby": described, "aria-required": f.required };

  if (f.kind === "radio" || f.kind === "checks") {
    const many = f.kind === "checks";
    const picked = (o: string) => (many ? (value as string[]).includes(o) : value === o);
    const toggle = (o: string) => set(f.name, many ? (picked(o) ? (value as string[]).filter((x) => x !== o) : [...(value as string[]), o]) : picked(o) ? "" : o);
    return (
      <fieldset className={cls} aria-describedby={described}>
        <legend>{f.label}{many ? <em> (choose any)</em> : f.required ? null : <em> (optional)</em>}</legend>
        <div className="opts">
          {f.options!.map((o, i) => (
            <label className="opt" key={o}>
              {/* Single choices are checkboxes too, so a choice can be undone; only one stays ticked. */}
              <input type="checkbox" id={i === 0 ? id : undefined} name={f.name} checked={picked(o)} onChange={() => toggle(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {foot}
      </fieldset>
    );
  }
  return (
    <div className={cls}>
      <label htmlFor={id}>{label}</label>
      {f.kind === "select" ? (
        <select {...common} value={value as string} onChange={(e) => set(f.name, e.target.value)}>
          <option value="">Choose…</option>
          {f.options!.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : f.kind === "area" ? (
        <textarea {...common} value={value as string} maxLength={2000} onChange={(e) => set(f.name, e.target.value)} />
      ) : (
        <input {...common} type={f.kind === "number" ? "text" : f.kind} inputMode={f.kind === "number" ? "numeric" : undefined} autoComplete={f.auto ?? "off"}
          value={value as string} onChange={(e) => set(f.name, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
      )}
      {foot}
    </div>
  );
}
