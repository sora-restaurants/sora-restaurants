import type { Metadata } from "next";
import { WaitlistForm } from "../../../components/site/WaitlistForm.tsx";

export const metadata: Metadata = {
  title: "Join the restaurant waitlist",
  description: "Tell us about your restaurant and join the SORA waitlist. SORA is preparing to welcome its first restaurant partners.",
};

export default function WaitlistPage() {
  return (
    <div className="wrap wl">
      <div className="wl__side">
        <span className="eyebrow">Restaurant waitlist</span>
        <h1>Be first in line.</h1>
        <p className="lead">Leave your restaurant and contact details. We will contact you to discuss a demonstration and whether a pilot suits your restaurant.</p>
        <p className="dim">The 2026 pilot is free for sit-down restaurants. Pricing for future paid plans is being finalised and will be agreed before any paid service begins.</p>
      </div>
      <WaitlistForm />
    </div>
  );
}
