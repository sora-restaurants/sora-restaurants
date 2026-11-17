import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow } from "../../components/site/Chrome.tsx";
import { Chip, HeroPhone, KitchenBoard, MenuItems, OrderTracker, Qr, TableTent, Ticket } from "../../components/site/Mockups.tsx";

const STEPS: { n: string; title: string; text: string; art: ReactNode }[] = [
  { n: "01", title: "Scan", text: "Customers scan the QR code placed at their table. No application downloads or account creation required.",
    art: <div style={{ maxWidth: 130 }}><Qr /></div> },
  { n: "02", title: "Order", text: "Customers browse the restaurant's menu and submit their orders directly from their phones.",
    art: <div className="ui" style={{ padding: 10, display: "grid", gap: 6 }}><MenuItems /></div> },
  { n: "03", title: "Prepare", text: "Orders appear instantly on the restaurant's kitchen dashboard, allowing staff to manage preparation and update order statuses.",
    art: <div style={{ display: "grid", gap: 8 }}><Ticket table="Table 7" lines="2 × Boerewors roll · 1 × Chips, large" age="now"><Chip on>New</Chip></Ticket><Ticket table="Table 12" lines="2 × Lamb chops · 1 × Pap" age="6 min"><Chip>Preparing</Chip></Ticket></div> },
  { n: "04", title: "Serve", text: "Customers follow their orders, request waiter assistance, and pay according to the restaurant's payment configuration.",
    art: <div style={{ display: "grid", gap: 8 }}><OrderTracker step={3} /><div className="ui item"><span>Call a waiter</span><Chip on>Sent</Chip></div></div> },
];

const Row = ({ a, b }: { a: ReactNode; b: ReactNode }) => <div className="ui item" style={{ borderRadius: 6 }}><span>{a}</span>{b}</div>;
const FEATURES: { title: string; text: string; art: ReactNode }[] = [
  { title: "Live Kitchen Dashboard", text: "Kitchen staff receive and manage incoming orders.", art: <Ticket table="Table 3" lines="1 × Bunny chow · 2 × Lager" age=""><Chip on>New</Chip></Ticket> },
  { title: "Waiter Assistance", text: "Customers request help without leaving their seats.", art: <Row a={<b>Table 4 is calling</b>} b={<Chip on>Answer</Chip>} /> },
  { title: "Flexible Payments", text: "Restaurants choose between pay-before-service and pay-after-service policies.", art: <div style={{ display: "grid", gap: 6 }}><Row a="Pay before service" b={<span className="switch on" />} /><Row a="Pay after service" b={<span className="switch" />} /></div> },
  { title: "Menu Management", text: "Edit menus, update products, and mark unavailable items as sold out.", art: <div style={{ display: "grid", gap: 6 }}><Row a="Lamb chops" b={<Chip>Sold out</Chip>} /><Row a="Rump steak" b={<Chip on>Available</Chip>} /></div> },
];

const BENEFITS = ["No commission on orders.", "No app for guests to download.", "Works on your existing phones and screens.", "On-site setup and staff training."];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero__copy">
            <span className="eyebrow">Built for the next generation of restaurants.</span>
            <h1>Your restaurant.<br /><span className="dim">Reimagined.</span></h1>
            <p className="lead">SORA brings ordering, kitchen operations, and table service together in one seamless QR-powered experience.</p>
            <div className="hero__cta">
              <Link className="btn" href="/waitlist">Join the Restaurant Waitlist <Arrow /></Link>
              <a className="btn btn--ghost" href="#features">Explore SORA</a>
            </div>
          </div>
          <div className="stage" role="img" aria-label="Product demonstration with sample data: a guest scans the QR code on table 7, orders on their phone, and the order appears on the kitchen dashboard and turns ready.">
            <span className="mono stage__note">Product demonstration · sample data</span>
            <TableTent />
            <HeroPhone />
            <KitchenBoard live />
          </div>
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <div className="head" data-reveal><span className="eyebrow">What SORA does</span><h2>Ordering, kitchen and service in one system.</h2>
            <p className="lead">SORA runs alongside the way you already work, next to your existing POS.</p></div>
          <ul className="feats">
            {FEATURES.map((f) => (
              <li className="feat" key={f.title} data-reveal>
                <div className="feat__art" aria-hidden="true">{f.art}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
          <ul className="benefits" style={{ marginTop: 40 }}>
            {BENEFITS.map((b, i) => <li key={b} data-reveal><span>{String(i + 1).padStart(2, "0")}</span>{b}</li>)}
          </ul>
          <hr className="rule" style={{ marginTop: "clamp(56px, 8vw, 104px)" }} />
        </div>
      </section>

      <section id="how" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="head" data-reveal><span className="eyebrow">How SORA works</span><h2>From the table to the kitchen in four steps.</h2></div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li className="step" key={s.n} data-reveal>
                <span className="step__n">{s.n}</span>
                <h3 style={{ fontSize: 26, letterSpacing: "-0.03em" }}>{s.title}</h3>
                <p className="dim" style={{ fontSize: 15 }}>{s.text}</p>
                <div className="step__art" aria-hidden="true">{s.art}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cta dark">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>The future of your restaurant starts here.</h2>
            <p className="lead">Join the SORA restaurant waitlist and be among the first to explore a simpler way to manage table ordering.</p>
          </div>
          <Link className="btn" href="/waitlist">Join the Waitlist <Arrow /></Link>
        </div>
      </section>
    </>
  );
}
