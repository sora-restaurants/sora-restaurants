import type { Metadata } from "next";
import { EMAIL } from "../../../components/site/Chrome.tsx";

export const metadata: Metadata = { title: "Website privacy notice", description: "What SORA collects when you enquire about a restaurant demonstration or pilot, and how to contact us about your information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <div className="wrap prose">
      <span className="eyebrow">Last updated 18 November 2026</span>
      <h1>Website privacy notice</h1>
      <p>SORA is a project developing QR ordering tools for restaurants in South Africa. This notice covers enquiries submitted through this website. For questions about your information, contact the SORA team at <a className="link" href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
      <h2>Information you provide</h2>
      <p>The waitlist asks for your restaurant’s name, type and city, your name, and an email address or phone number. You choose whether to provide both contact methods. Earlier versions of the form also asked for restaurant size, your role, POS and service methods, feature interests and pilot preferences. We may still hold those answers if you submitted them.</p>
      <h2>How we use it</h2>
      <p>With your consent, we use your enquiry to contact you about a demonstration or pilot and assess whether SORA suits your restaurant. Joining the waitlist does not commit you to a purchase. We do not sell enquiry information or use it for unrelated marketing.</p>
      <h2>Hosting and access</h2>
      <p>The website runs on Vercel and applications are stored in Supabase. These providers process information to operate their services, and processing may take place outside South Africa. SORA administrators review enquiries through a password-protected dashboard. Enquiry records are restricted from public database access.</p>
      <h2>Technical information and cookies</h2>
      <p>While you fill in the waitlist, your browser keeps a draft in the current tab so a refresh does not lose your answers. You can clear the draft using “Clear saved details” on the form. A successful submission removes the draft.</p>
      <p>To limit spam, the application stores a salted hash of the internet address used to submit an enquiry, together with its submission time. Vercel may process connection addresses and request logs to deliver and protect the website. The admin area uses a session cookie for sign-in. The application does not set advertising cookies.</p>
      <h2>Keeping and deleting information</h2>
      <p>We keep enquiries while considering a restaurant for demonstrations or pilots and while following up with it. You can ask us to stop contacting you, correct your details or delete your enquiry by emailing <a className="link" href={`mailto:${EMAIL}`}>{EMAIL}</a>. We may ask for information to confirm the request relates to you before sharing or changing an enquiry.</p>
      <h2>Your choices</h2>
      <p>You can choose to email SORA instead of submitting this form. You can withdraw your consent to future contact and request access to your enquiry. You may also raise a privacy concern with South Africa’s Information Regulator.</p>
      <h2>Contact</h2>
      <p>Email the SORA team at <a className="link" href={`mailto:${EMAIL}`}>{EMAIL}</a> for enquiries about this notice or your information.</p>
    </div>
  );
}
