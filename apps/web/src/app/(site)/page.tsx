import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow } from "../../components/site/Chrome.tsx";
import { Chip, GuestPhone, HeroPhone, KitchenBoard, MenuItems, OrderTracker, OwnerDash, Qr, TableTent, Ticket, WaiterPanel } from "../../components/site/Mockups.tsx";
import { Showcase } from "../../components/site/Showcase.tsx";

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
  { title: "QR Table Ordering", text: "Customers order directly from their tables.", art: <div style={{ display: "flex", gap: 12, alignItems: "center" }}><div style={{ width: 76, flex: "none" }}><Qr /></div><span className="mono">TABLE 7<br />SCAN TO ORDER</span></div> },
  { title: "Live Kitchen Dashboard", text: "Kitchen staff receive and manage incoming orders.", art: <Ticket table="Table 3" lines="1 × Bunny chow · 2 × Lager" age=""><Chip on>New</Chip></Ticket> },
  { title: "Real-Time Order Tracking", text: "Customers can follow orders as they progress.", art: <OrderTracker step={2} /> },
  { title: "Waiter Assistance", text: "Customers request help without leaving their seats.", art: <Row a={<b>Table 4 is calling</b>} b={<Chip on>Answer</Chip>} /> },
  { title: "Payment Workflow", text: "The demo shows payment confirmation. Staff can record collection at the restaurant. Online checkout is simulated and makes no real charge.", art: <div style={{ display: "grid", gap: 6 }}><Row a="Pay at the restaurant" b={<span className="switch on" />} /><Row a="Online payment demo" b={<Chip>Simulated</Chip>} /></div> },
  { title: "Menu Management", text: "Edit menus, update products, and mark unavailable items as sold out.", art: <div style={{ display: "grid", gap: 6 }}><Row a="Lamb chops" b={<Chip>Sold out</Chip>} /><Row a="Rump steak" b={<Chip on>Available</Chip>} /></div> },
  { title: "Restaurant Analytics", text: "Understand QR ordering activity through a dedicated dashboard.", art: <div className="bars" style={{ height: 84 }}>{[20, 34, 52, 80, 100, 86, 58, 30].map((h, i) => <i key={i} className={i < 2 ? "lo" : ""} style={{ height: `${h}%` }} />)}</div> },
  { title: "Works With Existing Devices", text: "Use current phones, tablets, and screens without specialised ordering hardware.", art: <div style={{ display: "flex", gap: 10, alignItems: "end", justifyContent: "center" }}>{[[26, 48], [62, 50], [88, 60]].map(([w, h]) => <span key={w} style={{ width: w, height: h, border: "1.5px solid var(--ink)", borderRadius: 5, background: "var(--paper)" }} />)}</div> },
];

const BENEFITS = ["Guests can order while waiters help other tables.", "No compulsory app download for customers.", "Guests send their selections directly to the kitchen.", "Staff and guests can follow the same order status.", "Sold-out items can be removed from ordering.", "Designed for sit-down restaurants."];

const TABS = [
  { id: "guest", label: "Guest ordering", title: "The menu, on the guest's own phone", text: "A guest scans the table's code, picks dishes and sends the order. Sold-out items are marked, and a waiter is one tap away.", ui: <GuestPhone /> },
  { id: "kitchen", label: "Kitchen", title: "Every table's order on one screen", text: "New orders arrive as they are sent. Staff move each one through preparation to ready, and the guest's phone follows along.", ui: <KitchenBoard /> },
  { id: "waiter", label: "Waiter", title: "Calls and unpaid tables, in one list", text: "Waiters see which table asked for help and which tables still have to pay, and clear each with a tap.", ui: <WaiterPanel /> },
  { id: "owner", label: "Owner", title: "QR ordering activity at a glance", text: "Owners see how many orders came through SORA, what they were worth and when the room was busiest.", ui: <OwnerDash /> },
];

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
              <a className="btn btn--ghost" href="#how">Explore SORA</a>
            </div>
            <p className="dim" style={{ fontSize: 14 }}>Now inviting restaurant pilot enquiries. Pricing is being finalised, and all fees will be agreed before a pilot.</p>
          </div>
          <div className="stage" role="img" aria-label="Product demonstration with sample data: a guest scans the QR code on table 7, orders on their phone, and the order appears on the kitchen dashboard and turns ready.">
            <span className="mono stage__note">Product demonstration · sample data</span>
            <TableTent />
            <HeroPhone />
            <KitchenBoard live />
          </div>
        </div>
      </section>

      <section id="how">
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

      <section id="features" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <hr className="rule" style={{ marginBottom: "clamp(72px, 10vw, 136px)" }} />
          <div className="head" data-reveal><span className="eyebrow">Explore the prototype</span><h2>Ordering and service, together.</h2><p className="lead">Try the working ordering demo. The interface previews below use sample data. Online payment processing and direct POS integrations are planned.</p><a className="link" href="https://sora-restaurants.vercel.app/t/staging-demo-table-1">Try the guest ordering demo →</a></div>
          <ul className="feats">
            {FEATURES.map((f) => (
              <li className="feat" key={f.title} data-reveal>
                <div className="feat__art" aria-hidden="true">{f.art}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="restaurants" className="dark">
        <div className="wrap">
          <div className="head" data-reveal><span className="eyebrow">For restaurants</span><h2>Built around your restaurant.</h2>
            <p className="lead">SORA runs alongside the way you already work, on devices you already own.</p></div>
          <ul className="benefits">
            {BENEFITS.map((b, i) => <li key={b} data-reveal><span>{String(i + 1).padStart(2, "0")}</span>{b}</li>)}
          </ul>
          <p className="dim" style={{ marginTop: 32, fontSize: 14, maxWidth: "60ch" }}>SORA sends QR orders to its own kitchen screen. Staff must also enter those orders in the restaurant’s existing POS for billing and reconciliation. Direct POS integration is planned. During a pilot, we will check this extra step with your staff before using SORA in service.</p>
        </div>
      </section>

      <section id="product">
        <div className="wrap">
          <div className="head" data-reveal><span className="eyebrow">Product showcase</span><h2>One system, four views.</h2></div>
          <Showcase tabs={TABS} />
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
