import Link from "next/link";
import { POS_SYSTEMS, STATUS_LABELS, STATUSES } from "../../lib/waitlist-schema.ts";
import { requireAdmin } from "../../server/admin-session.ts";
import { waitlistDb } from "../../server/waitlist-deps.ts";
import { listApplications, waitlistStats, type Application, type Stats } from "../../server/waitlist.ts";
import { signOut } from "./actions.ts";

const day = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" });

function Meter({ title, rows, empty }: { title: string; rows: { label: string; n: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="card">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="dim" style={{ marginTop: 10, fontSize: 14 }}>{empty}</p> : (
        <div className="meter">{rows.map((r) => [<span key={r.label}>{r.label}</span>, <b key={`${r.label}n`}>{r.n}</b>, <i key={`${r.label}b`} style={{ width: `${(r.n / max) * 100}%` }} />])}</div>
      )}
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const { q = "", status = "", city = "", pos = "" } = await searchParams;
  let stats: Stats, rows: Application[];
  try {
    const db = waitlistDb();
    [stats, rows] = await Promise.all([waitlistStats(db), listApplications(db, { q, status, city, pos })]);
  } catch (error) {
    console.error("admin dashboard could not load", error);
    return <main className="wrap adm"><p className="alert" role="alert">The database could not be reached. Check DATABASE_URL and that the waitlist migration has been applied.</p></main>;
  }
  const filtered = !!(q || status || city || pos);
  const query = new URLSearchParams({ q, status, city, pos }).toString();

  return (
    <main className="wrap adm">
      <div className="adm__top">
        <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}><span className="brand">SORA</span><span className="dim">Waitlist applications</span></div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn btn--ghost btn--sm" href={`/admin/export?${query}`}>Export CSV</a>
          <form action={signOut}><button className="btn btn--ghost btn--sm" type="submit">Sign out</button></form>
        </div>
      </div>

      <div className="stats" aria-label="Application statistics, counted from saved applications">
        {([["Total applications", stats.total], ["New", stats.fresh], ["Contacted", stats.contacted], ["Approved", stats.approved], ["Pilot candidates", stats.pilotCandidates]] as const)
          .map(([label, n]) => <div key={label}><b>{n}</b><small className="dim">{label}</small></div>)}
      </div>

      <div className="panels">
        <Meter title="Most used POS systems" rows={stats.pos} empty="No applications yet." />
        <Meter title="Most requested features" rows={stats.features} empty="No applications yet." />
        <Meter title="Applications, last 30 days" rows={stats.byDay.map((d) => ({ label: day.format(new Date(`${d.day}T12:00:00+02:00`)), n: d.n }))} empty="None in the last 30 days." />
      </div>

      <form className="filters" method="get" role="search" aria-label="Filter applications">
        <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Restaurant, person, email, reference" /></div>
        <div className="field"><label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></div>
        <div className="field"><label htmlFor="city">Location</label>
          <select id="city" name="city" defaultValue={city}><option value="">All</option>{stats.cities.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="pos">POS</label>
          <select id="pos" name="pos" defaultValue={pos}><option value="">All</option>{POS_SYSTEMS.map((p) => <option key={p}>{p}</option>)}</select></div>
        <button className="btn" type="submit">Apply</button>
        {filtered ? <Link className="btn btn--ghost" href="/admin">Clear</Link> : <span />}
      </form>

      {rows.length === 0 ? (
        <div className="card empty">
          <h3>{filtered ? "No applications match these filters." : "No applications yet."}</h3>
          <p>{filtered ? "Clear the filters to see every application." : "When a restaurant applies at /waitlist, it appears here."}</p>
        </div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Restaurant</th><th>Contact</th><th>Location</th><th>POS</th><th>Pilot</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link className="link" href={`/admin/${r.id}`}><b>{r.restaurant_name}</b></Link><br /><small className="dim mono">{r.reference}</small></td>
                  <td>{r.contact_name}<br /><small className="dim">{r.email}</small></td>
                  <td>{r.city}</td>
                  <td>{r.pos_system === "Other" ? r.pos_other : r.pos_system}</td>
                  <td>{r.pilot_interest ?? "—"}</td>
                  <td><span className={`chip${r.status === "new" ? " chip--on" : ""}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{day.format(new Date(r.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dim" style={{ fontSize: 13 }}>Showing {rows.length} of {stats.total} saved applications. These are real records; the public page's interest indicator is simulated and unrelated to them.</p>
    </main>
  );
}
