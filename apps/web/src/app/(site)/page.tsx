import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Arrow, EMAIL } from "../../components/site/Chrome.tsx";
import { Chip, DEMO_URL, GuestPhone, HeroPhone, KitchenBoard, MenuItems, OrderTracker, OwnerDash, Qr, TableTent, Ticket, WaiterPanel } from "../../components/site/Mockups.tsx";
import { Showcase, type Tab } from "../../components/site/Showcase.tsx";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const STEPS: { n: string; title: string; text: string; art: ReactNode }[] = [
  { n: "01", title: "Scan", text: "The guest scans the code on their table. No app to download, no account to create.",
    art: <div style={{ maxWidth: 130 }}><Qr /></div> },
  { n: "02", title: "Order", text: "They browse your menu on their own phone and send the order when they are ready.",
    art: <div className="ui" style={{ padding: 10, display: "grid", gap: 6 }}><MenuItems /></div> },
  { n: "03", title: "Prepare", text: "The order lands on the kitchen screen exactly as chosen. Staff move it from new to ready.",
    art: <div style={{ display: "grid", gap: 8 }}><Ticket table="Table 7" lines="2 × Boerewors roll · 1 × Chips, large" age="now"><Chip on>New</Chip></Ticket><Ticket table="Table 12" lines="2 × Lamb chops · 1 × Pap" age="6 min"><Chip>Preparing</Chip></Ticket></div> },
  { n: "04", title: "Serve", text: "The guest's phone follows the order to the table. Your waiter brings it out.",
    art: <OrderTracker step={3} /> },
];

const TABS: Tab[] = [
  { id: "guest", label: "Guests", title: "Order when they are ready, not when a waiter is free", ui: <GuestPhone />,
    points: ["Your full menu on their own phone, with sold-out dishes marked", "Another round or dessert is one tap away", "A live status shows when the order is accepted, cooking and ready"] },
  { id: "kitchen", label: "Kitchen", title: "Every order, clearly written, the moment it is sent", ui: <KitchenBoard />,
    points: ["No handwriting to decode and no dockets to carry", "New, preparing and ready, at a glance", "If the connection drops, the screen reconnects and catches up by itself"] },
  { id: "waiter", label: "Waiters", title: "Know which table needs you, and why", ui: <WaiterPanel />,
    points: ["Calls from tables appear in one list, cleared with a tap", "Tables still to pay are listed with the amount", "Fewer trips just to take orders, more time with guests"] },
  { id: "owner", label: "Owners", title: "See tonight's service while it is happening", ui: <OwnerDash />,
    points: ["Orders, order value and average order through SORA", "Busiest hours and best-selling dishes", "Mark a dish sold out from your phone and guests see it as sold out"] },
];

const COMPARE: [string, string, string][] = [
  ["Placing an order", "Guests wait for a menu, then wait again for someone to take the order.", "Guests order from their phone as soon as they sit down."],
  ["Reaching the kitchen", "A handwritten docket is carried to the pass.", "The order appears on the kitchen screen, exactly as the guest chose it."],
  ["A second round", "Depends on catching a busy waiter's eye.", "One tap from the table."],
  ["A dish runs out", "Guests order it and the waiter returns with bad news.", "Switch it off and it shows as sold out on every phone."],
  ["Asking for help", "Waving across the room.", "Call a waiter. Staff see which table is asking."],
  ["How the night went", "Found out at close, from the till.", "Orders and value by the hour, on the owner dashboard."],
];

const NOW = ["QR ordering at every table", "Live kitchen screen", "Order tracking on the guest's phone", "Call a waiter", "Pay now or pay after the meal, set per restaurant, with staff marking bills paid", "Menu editing and a sold-out switch", "Owner dashboard", "Runs on the phones, tablets and screens you already have"];
const NEXT = ["Direct POS integration. For now SORA runs next to your till, which stays as it is.", "Online card payment. The pay-now flow is built; no real payment gateway is connected yet."];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero__copy">
            <span className="eyebrow">Restaurant technology for South Africa</span>
            <h1>Your restaurant.<br /><span className="dim">Reimagined.</span></h1>
            <p className="lead">Guests order from their table on their own phone. Orders go straight to the kitchen screen. A waiter is one tap away. Your team spends less time running orders and more time on hospitality.</p>
            <div className="hero__cta">
              <Link className="btn" href="/waitlist">Book a demonstration <Arrow /></Link>
              <a className="btn btn--ghost" href={DEMO_URL}>Try the guest demo</a>
            </div>
          </div>
          <div className="stage" role="img" aria-label="Product demonstration with sample data: a guest scans the QR code on table 7, orders on their phone, and the order appears on the kitchen screen and turns ready.">
            <span className="mono stage__note">Product demonstration · sample data</span>
            <TableTent />
            <HeroPhone />
            <KitchenBoard live />
          </div>
        </div>
      </section>

      <section id="how">
        <div className="wrap">
          <div className="head" data-reveal><span className="eyebrow">How it works</span><h2>From the table to the kitchen in four steps.</h2></div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li className="step" key={s.n} data-reveal>
                <span className="step__n">{s.n}</span>
                <h3>{s.title}</h3>
                <p className="dim">{s.text}</p>
                <div className="step__art" aria-hidden="true">{s.art}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="product" className="tight">
        <div className="wrap">
          <div className="head" data-reveal><span className="eyebrow">The product</span><h2>One system. Everyone in the room.</h2><p className="lead">The same order connects the guest, the kitchen, the floor and the owner. These are SORA's own screens, shown with sample data.</p></div>
          <Showcase tabs={TABS} />
        </div>
      </section>

      <section id="staff" className="dark">
        <div className="wrap split">
          <div className="head" data-reveal>
            <span className="eyebrow">Waiter assistance</span>
            <h2>SORA does not replace your waiters. It gives them time back.</h2>
          </div>
          <ol className="numbered" data-reveal>
            <li><span>01</span><p><strong>Less running.</strong> Taking orders and carrying dockets is handled, so one waiter can look after more tables properly.</p></li>
            <li><span>02</span><p><strong>Help when it is wanted.</strong> Guests tap “Call a waiter” and the floor sees which table, instead of guessing who is waving.</p></li>
            <li><span>03</span><p><strong>The human part stays human.</strong> The welcome, the recommendation, the check-in at the table. That is still your team.</p></li>
          </ol>
        </div>
      </section>

      <section id="why">
        <div className="wrap">
          <div className="head" data-reveal><span className="eyebrow">Why SORA</span><h2>Compared with traditional ordering.</h2></div>
          <div className="compare" role="table" aria-label="Traditional ordering compared with SORA">
            <div className="compare__row compare__head" role="row"><span role="columnheader"><span className="sr">Moment</span></span><span role="columnheader">Traditional</span><span role="columnheader">With SORA</span></div>
            {COMPARE.map(([moment, before, after]) => (
              <div className="compare__row" role="row" key={moment} data-reveal>
                <strong role="rowheader">{moment}</strong>
                <span role="cell" className="dim"><em>Traditional: </em>{before}</span>
                <span role="cell"><em>With SORA: </em>{after}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="tight">
        <div className="wrap split">
          <div className="head" data-reveal><span className="eyebrow">What is included</span><h2>Built and working today.</h2><p className="lead">We only list what SORA does now. What is still being built is marked as such.</p></div>
          <div data-reveal>
            <ul className="checks">{NOW.map((f) => <li key={f}>{f}</li>)}</ul>
            <p className="mono checks__label">In development</p>
            <ul className="checks checks--later">{NEXT.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        </div>
      </section>

      <section id="founding" className="dark">
        <div className="wrap split">
          <div className="head" data-reveal>
            <span className="eyebrow">Founding Restaurant Programme</span>
            <h2>Be one of the first restaurants on SORA.</h2>
            <p className="lead">We are working with a small group of sit-down restaurants to launch SORA. Founding restaurants join on a discounted, paid introductory partnership. The price is set around your restaurant and agreed with you in writing before any paid service starts.</p>
            <Link className="btn" href="/waitlist">Become a founding restaurant <Arrow /></Link>
          </div>
          <ol className="numbered" data-reveal>
            <li><span>01</span><p><strong>Introductory pricing.</strong> A reduced rate for founding restaurants, agreed up front.</p></li>
            <li><span>02</span><p><strong>Set up with you.</strong> Your menu, tables and QR codes, prepared together before your first service.</p></li>
            <li><span>03</span><p><strong>A direct line.</strong> You speak to the people building SORA, and your feedback shapes what comes next.</p></li>
          </ol>
        </div>
      </section>

      <section id="contact">
        <div className="wrap contact">
          <div className="head" data-reveal>
            <span className="eyebrow">Contact</span>
            <h2>See SORA in your restaurant.</h2>
            <p className="lead">Send a short enquiry and we will arrange a demonstration. Or email us directly at <a className="link" href={`mailto:${EMAIL}`} style={{ color: "var(--ink)", overflowWrap: "anywhere" }}>{EMAIL}</a>.</p>
            <div className="hero__cta">
              <Link className="btn" href="/waitlist">Send an enquiry <Arrow /></Link>
              <a className="btn btn--ghost" href={`mailto:${EMAIL}?subject=${encodeURIComponent("SORA demonstration")}`}>Email SORA</a>
            </div>
          </div>
          <a className="contact__qr" href={DEMO_URL} data-reveal>
            <Qr />
            <span className="mono">Scan to try the guest menu</span>
          </a>
        </div>
      </section>
    </>
  );
}
