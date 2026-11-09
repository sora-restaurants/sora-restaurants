import os from "node:os";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

// Local demo hub: the Table 4 QR code, the kitchen link, the test logins. Never served in production.
export const dynamic = "force-dynamic";
export const metadata = { title: "Sora demo" };

const TABLE_PATH = "/t/demo-table-4-token";

const LOGINS = [
  { who: "Kitchen, Demo Bistro", email: "kitchen@demo.test", password: "demo-kitchen-pass", note: "Use this one" },
  { who: "Kitchen, Other Grill", email: "kitchen@other.test", password: "other-kitchen-pass", note: "Must NOT see Demo Bistro's orders" },
  { who: "Owner, Demo Bistro", email: "owner@demo.test", password: "demo-owner-pass", note: "Owner dashboard (QR orders only)" },
  { who: "Waiter, Demo Bistro", email: "waiter@demo.test", password: "demo-waiter-pass", note: "Waiter screen yes, kitchen board no" },
];

const TRY = [
  "Scan the QR with your phone, add a few items, tap Place order.",
  "Watch the ticket appear on the kitchen board within a few seconds.",
  "Tap Start, then Ready, then Served. It should move across and disappear.",
  "On a new ticket, tap ✕ Reject once (it only arms), then again to confirm.",
  "Tap Place order twice fast: only one ticket should appear.",
  "In a private window, sign in as Other Grill: Demo Bistro's tickets must not show.",
  "Sign in as the waiter: the board should say there is no kitchen access.",
  "On the menu, tap Call waiter. It appears on the waiter screen; tap On my way to clear it.",
  "After ordering, tap Track my order and watch it change as the kitchen moves the ticket.",
];

/** Address a phone on the same Wi-Fi can reach this computer at. */
function lanAddress() {
  return Object.values(os.networkInterfaces())
    .flat()
    .find((a) => a && a.family === "IPv4" && !a.internal && /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a.address))?.address;
}

export default async function DemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const ip = lanAddress();
  const phoneUrl = ip ? `http://${ip}:3000${TABLE_PATH}` : null;
  const qrSvg = phoneUrl ? await QRCode.toString(phoneUrl, { type: "svg", margin: 1, width: 280 }) : null;

  return (
    <main className="min-h-dvh bg-[oklch(97%_0.01_80)] px-4 py-8 font-[family-name:var(--font-manrope)] text-[oklch(18%_0.02_260)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header>
          <p className="text-sm font-bold uppercase tracking-wide text-[oklch(45%_0.02_260)]">Local demo · test data only</p>
          <h1 className="text-4xl font-extrabold">Try Sora</h1>
        </header>

        <section className="grid gap-6 rounded-2xl border-2 border-current bg-white p-6 sm:grid-cols-[auto_1fr] sm:items-center">
          {qrSvg ? (
            // Generated locally from our own URL above, not user input.
            <div className="mx-auto w-[280px]" aria-label="QR code for Table 4" role="img" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : null}
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-extrabold">1. Be the customer at Table 4</h2>
            {phoneUrl ? (
              <p>
                Scan this with your phone camera (same Wi-Fi as this computer), or type{" "}
                <span className="break-all font-mono font-bold">{phoneUrl}</span>
              </p>
            ) : (
              <p>No Wi-Fi address found, so use this computer.</p>
            )}
            <a href={TABLE_PATH} target="_blank" className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-current px-5 font-bold">
              Open the menu on this computer
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border-2 border-current bg-white p-6">
          <h2 className="text-2xl font-extrabold">2. Be the kitchen</h2>
          <a href="/kitchen" target="_blank" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[oklch(18%_0.02_260)] px-5 text-lg font-bold text-white">
            Open the kitchen board
          </a>
          <a href="/waiter" target="_blank" className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-current px-5 font-bold">
            Open the waiter screen (sign in as the waiter)
          </a>
          <a href="/owner" target="_blank" className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-current px-5 font-bold">
            Open the owner dashboard (sign in as the owner)
          </a>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-current">
                  <th className="py-2 pr-3">Sign in as</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Password</th>
                  <th className="py-2">What should happen</th>
                </tr>
              </thead>
              <tbody>
                {LOGINS.map((l) => (
                  <tr key={l.email} className="border-b border-[oklch(85%_0.01_260)] align-top">
                    <td className="py-2 pr-3 font-bold">{l.who}</td>
                    <td className="py-2 pr-3 font-mono">{l.email}</td>
                    <td className="py-2 pr-3 font-mono">{l.password}</td>
                    <td className="py-2">{l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border-2 border-current bg-white p-6">
          <h2 className="text-2xl font-extrabold">3. Things to try</h2>
          <ol className="list-decimal space-y-2 pl-6">
            {TRY.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p className="text-sm text-[oklch(45%_0.02_260)]">
            Write down anything confusing, slow or broken. Fresh test data: stop the demo, then run <span className="font-mono">pnpm demo --reset</span>.
          </p>
        </section>
      </div>
    </main>
  );
}
