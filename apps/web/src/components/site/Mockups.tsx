import QRCode from "qrcode";
import type { ReactNode } from "react";

// The product pictures on the marketing site. All sample data; every use sits under a "product demonstration" label.

const DEMO_URL = "https://sora-restaurants.vercel.app/t/staging-demo-table-1";

/** A real, scannable QR code (it opens the live demo), drawn as one path. */
export function Qr({ className }: { className?: string }) {
  const { size, data } = QRCode.create(DEMO_URL, { errorCorrectionLevel: "M" }).modules;
  let d = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
  return (
    <svg className={className} viewBox={`-1 -1 ${size + 2} ${size + 2}`} role="img" aria-label="QR code that opens the SORA demo menu" shapeRendering="crispEdges">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

export const Chip = ({ on, children }: { on?: boolean; children: ReactNode }) => <span className={`chip${on ? " chip--on" : ""}`}><i />{children}</span>;

const MENU: [string, string, number?][] = [["Boerewors roll", "R85", 2], ["Chips, large", "R45", 1], ["Malva pudding", "R60"], ["Rooibos iced tea", "R35"]];

export function MenuItems({ soldOut }: { soldOut?: string }) {
  return (
    <>
      {MENU.map(([name, price, qty]) => (
        <div key={name} className={`item${name === soldOut ? " is-out" : ""}`}>
          <span><b>{name}</b><br /><small>{name === soldOut ? "Sold out" : price}</small></span>
          {qty && name !== soldOut ? <span className="qty">{qty}</span> : null}
        </div>
      ))}
    </>
  );
}

export function TableTent() {
  return (
    <div className="tent" data-reveal>
      <b>Scan to order</b>
      <Qr />
      <small className="mono">TABLE 7</small>
    </div>
  );
}

/** The hero phone. Its screen plays the loop: scan, the menu with an order, "order sent". */
export function HeroPhone() {
  return (
    <div className="phone loop" aria-hidden="true">
      <div className="loop__scan">
        <span className="mono">Point your camera at the code</span>
        <div className="loop__qr"><Qr /><i className="loop__beam" /></div>
      </div>
      <div className="phone__top"><b>The Corner Table</b><small>Table 7</small></div>
      <div className="phone__body">
        <MenuItems />
        <div className="bar" style={{ visibility: "hidden" }}>.</div>
        <div className="bar loop__sent"><span>Order sent</span><span>R215</span></div>
      </div>
    </div>
  );
}

export function Ticket({ table, lines, age, children }: { table: string; lines: string; age: string; children?: ReactNode }) {
  return (
    <div className="ticket">
      <header><b>{table}</b>{children ?? <small>{age}</small>}</header>
      <small>{lines}</small>
    </div>
  );
}

/** The kitchen dashboard. In the hero, table 7's ticket arrives and turns ready as the phone's loop plays. */
export function KitchenBoard({ live }: { live?: boolean }) {
  return (
    <div className={`ui board${live ? " loop" : ""}`} aria-hidden={live ? "true" : undefined}>
      <div className="board__bar"><b>Kitchen</b><small>The Corner Table</small><span style={{ marginLeft: "auto" }}><Chip on>Live</Chip></span></div>
      <div className="board__cols">
        <div className="board__col">
          <small>New</small>
          <div className={live ? "loop__new" : undefined}>
            <Ticket table="Table 7" lines="2 × Boerewors roll · 1 × Chips, large" age="now">
              {live ? <span className="loop__state"><Chip on>New</Chip><Chip>Ready</Chip></span> : <Chip on>New</Chip>}
            </Ticket>
          </div>
          <Ticket table="Table 3" lines="1 × Bunny chow · 2 × Lager" age="2 min" />
        </div>
        <div className="board__col">
          <small>Preparing</small>
          <Ticket table="Table 12" lines="2 × Lamb chops · 1 × Pap · 2 × Salad" age="6 min" />
          <Ticket table="Table 9" lines="1 × Rump steak, medium" age="8 min" />
        </div>
        <div className="board__col">
          <small>Ready</small>
          <Ticket table="Table 5" lines="1 × Malva pudding · 2 × Coffee" age="12 min" />
        </div>
      </div>
    </div>
  );
}

export function OrderTracker({ step = 2 }: { step?: number }) {
  const names = ["Sent", "Accepted", "Preparing", "Ready"];
  return (
    <div className="ui" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><b>Order A7-0412</b><small>Table 7</small></div>
      <div className="track">{names.map((n, i) => <span key={n} className={i <= step ? "on" : ""} />)}</div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><small>{names[step]}</small><small>R215</small></div>
    </div>
  );
}

export function GuestPhone() {
  return (
    <div className="phone phone--full">
      <div className="phone__top"><b>The Corner Table</b><small>Table 7</small></div>
      <div className="phone__body">
        <MenuItems soldOut="Malva pudding" />
        <div className="bar"><span>Send order</span><span>R215</span></div>
        <div className="item"><span>Call a waiter</span><small>Table 7</small></div>
      </div>
    </div>
  );
}

export function WaiterPanel() {
  return (
    <div className="ui">
      <div className="board__bar"><b>Floor</b><small>Waiter view</small></div>
      <div className="rows">
        <div><span><b>Table 4 is calling</b><br /><small>Just now</small></span><Chip on>Answer</Chip></div>
        <div><span><b>Table 11 is calling</b><br /><small>2 min ago</small></span><Chip on>Answer</Chip></div>
        <div><span><b>Table 9 · unpaid</b><br /><small>R265 · pay after the meal</small></span><Chip>Mark paid</Chip></div>
        <div><span><b>Table 2 · unpaid</b><br /><small>R170 · pay after the meal</small></span><Chip>Mark paid</Chip></div>
        <div><span className="k">Table 6 answered · 5 min ago</span></div>
      </div>
    </div>
  );
}

export function OwnerDash() {
  const hours = [18, 30, 52, 76, 100, 88, 60, 34];
  return (
    <div className="ui">
      <div className="board__bar"><b>Owner dashboard</b><small>Today</small></div>
      <div className="kpis">
        <div><b>86</b><small>QR orders</small></div>
        <div><b>R18 430</b><small>Order value</small></div>
        <div><b>R214</b><small>Average order</small></div>
      </div>
      <div style={{ padding: 16, display: "grid", gap: 8 }}>
        <small>Orders by hour</small>
        <div className="bars">{hours.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><small>17:00</small><small>20:00</small><small>Now</small></div>
      </div>
      <div className="rows" style={{ borderTop: "1px solid var(--line)" }}>
        <div><span>Boerewors roll</span><small>31 ordered</small></div>
        <div><span>Lamb chops</span><small>22 ordered</small></div>
      </div>
    </div>
  );
}
