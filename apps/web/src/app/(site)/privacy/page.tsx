import type { Metadata } from "next";
import { EMAIL } from "../../../components/site/Chrome.tsx";

export const metadata: Metadata = { title: "Privacy policy", description: "How SORA collects, uses and protects personal information under POPIA." };

export default function PrivacyPage() {
  return (
    <div className="wrap prose">
      <span className="eyebrow">Last updated 15 November 2026</span>
      <h1>Privacy policy</h1>
      <p className="alert"><b>Draft for legal review.</b> This policy has not yet been reviewed by a legal professional. It must be reviewed, and SORA&rsquo;s registered details and Information Officer added, before launch.</p>
      <p>SORA is a restaurant technology business in South Africa. This policy explains what personal information we collect through this website, why, and the rights you have under the Protection of Personal Information Act 4 of 2013 (POPIA).</p>

      <h2>What we collect</h2>
      <p>When you apply to the restaurant waitlist we collect what you type into the form:</p>
      <ul>
        <li>your restaurant&rsquo;s name, type, location and size, and its website or social media if you give them;</li>
        <li>your name, position, business email address and phone number, and how you prefer to be contacted;</li>
        <li>how the restaurant operates today: its point-of-sale system, ordering, kitchen and payment methods;</li>
        <li>what you would like SORA to help with, and your interest in a demonstration or pilot.</li>
      </ul>
      <p>To stop spam we also keep a scrambled (hashed) form of the internet address the form was sent from. We do not store the address itself, and this site sets no advertising or tracking cookies.</p>

      <h2>Why we collect it</h2>
      <p>We use this information only to assess your application, to contact you about SORA, and to plan which restaurants we work with first. We collect it with your consent, which you give by ticking the box on the form.</p>

      <h2>Who sees it</h2>
      <p>Only SORA&rsquo;s own administrators. We do not sell your information or share it for marketing. It is stored with the hosting and database providers we use to run this website, which may process it on servers outside South Africa under their own data-protection terms.</p>

      <h2>How long we keep it</h2>
      <p>We keep an application for as long as we are considering working with the restaurant, and delete it when you ask us to or when it is no longer needed.</p>

      <h2>Your rights</h2>
      <p>You may ask us what information we hold about you, ask us to correct or delete it, withdraw your consent, or object to how we use it. Email <a className="link" href={`mailto:${EMAIL}`}>{EMAIL}</a> and we will respond. You may also complain to the Information Regulator of South Africa.</p>

      <h2>Security</h2>
      <p>Applications are sent over an encrypted connection and kept in a database that only SORA&rsquo;s server can read. Access to the administration area requires a sign-in.</p>

      <h2>Contact</h2>
      <p>Questions about this policy: <a className="link" href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
    </div>
  );
}
