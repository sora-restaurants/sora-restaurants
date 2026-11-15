import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "../../../components/site/AdminForms.tsx";
import { requireAdmin } from "../../../server/admin-session.ts";
import { prodDeps } from "../../../server/prod-deps.ts";
import { getApplication } from "../../../server/waitlist.ts";

const when = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" });

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const a = await getApplication(prodDeps().db, (await params).id);
  if (!a) notFound();

  const list = (v: string[]) => (v.length ? v.join(", ") : null);
  const groups: [string, [string, string | number | null][]][] = [
    ["Restaurant", [["Type", a.restaurant_type], ["Location", a.city], ["Locations", a.locations], ["Tables", a.tables_count], ["Seating", a.seating_capacity], ["Website", a.website], ["Social", a.social]]],
    ["Contact", [["Name", a.contact_name], ["Position", a.contact_position], ["Email", a.email], ["Phone", a.phone], ["Prefers", a.preferred_contact], ["Best time", a.best_time]]],
    ["Operations", [["POS", a.pos_system === "Other" ? `Other: ${a.pos_other}` : a.pos_system], ["Orders taken by", a.ordering_method], ["Uses QR", a.uses_qr], ["Kitchen", a.kitchen_system], ["Payments", list(a.payment_handling)], ["Daily customers", a.daily_volume]]],
    ["Needs", [["Wants to improve", list(a.improvements)], ["Interested in", list(a.feature_interests)], ["Biggest challenge", a.biggest_challenge], ["Requests", a.requests]]],
    ["Next steps", [["Testing timeline", a.test_timeline], ["Open to a demo", a.open_to_demo], ["Pilot programme", a.pilot_interest], ["Comments", a.comments]]],
    ["Record", [["Reference", a.reference], ["Submitted", when.format(new Date(a.created_at))], ["Consent given", when.format(new Date(a.consent_at))], ["Last updated", when.format(new Date(a.updated_at))]]],
  ];

  return (
    <main className="wrap adm">
      <div className="adm__top"><Link className="link" href="/admin">← All applications</Link><span className="mono dim">{a.reference}</span></div>
      <h1 style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>{a.restaurant_name}</h1>
      <div className="detail">
        <div style={{ display: "grid", gap: 28 }}>
          {groups.map(([title, rows]) => (
            <section key={title} style={{ padding: 0 }}>
              <h3 style={{ marginBottom: 8 }}>{title}</h3>
              <dl className="review">
                {rows.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd style={{ whiteSpace: "pre-wrap" }}>
                    {k === "Email" ? <a className="link" href={`mailto:${v}`}>{v}</a> : k === "Phone" ? <a className="link" href={`tel:${v}`}>{v}</a> : v ?? <span className="dim">Not given</span>}
                  </dd></div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <ReviewForm id={a.id} status={a.status} notes={a.admin_notes} />
      </div>
    </main>
  );
}
