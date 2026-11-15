import type { Metadata } from "next";
import { Counter } from "../../../components/site/Counter.tsx";
import { WaitlistForm } from "../../../components/site/WaitlistForm.tsx";
import { interestCount } from "../../../lib/interest-counter.ts";

export const metadata: Metadata = {
  title: "Join the restaurant waitlist",
  description: "Tell us about your restaurant and join the SORA waitlist. SORA is preparing to welcome its first restaurant partners.",
};
// The indicator changes at midnight in Johannesburg, so the page is rendered per request, not frozen at build time.
export const dynamic = "force-dynamic";

export default function WaitlistPage() {
  return (
    <div className="wrap wl">
      <div className="wl__side">
        <span className="eyebrow">Restaurant waitlist</span>
        <h1>Be first in line.</h1>
        <p className="lead">SORA is preparing to welcome its first restaurant partners. Tell us about your business and join the waitlist.</p>
        <div className="counter">
          <span className="eyebrow">Launch interest indicator</span>
          <Counter value={interestCount()} />
          <p>Join the growing list of restaurants interested in SORA.</p>
          <p className="counter__note">This figure is illustrative. It is a simulated indicator of launch interest, not a verified count of registered restaurants.</p>
        </div>
      </div>
      <WaitlistForm />
    </div>
  );
}
