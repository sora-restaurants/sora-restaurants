import type { Metadata } from "next";
import { WaitlistForm } from "../../../components/site/WaitlistForm.tsx";

export const metadata: Metadata = {
  alternates: { canonical: "/waitlist" },
  title: "Book a demonstration",
  description: "Tell us about your restaurant to book a SORA demonstration and hear about the Founding Restaurant Programme for sit-down restaurants in South Africa.",
};

export default function WaitlistPage() {
  return (
    <div className="wrap wl">
      <div className="wl__side">
        <span className="eyebrow">Enquire</span>
        <h1>Book a demonstration.</h1>
        <p className="lead">Leave your restaurant and contact details. We will contact you to arrange a demonstration and talk through the Founding Restaurant Programme.</p>
        <p className="dim">Founding restaurants join on a discounted, paid introductory partnership. The price is set around your restaurant’s needs and agreed with you in writing before any paid service begins. Sending an enquiry commits you to nothing.</p>
      </div>
      <WaitlistForm />
    </div>
  );
}
