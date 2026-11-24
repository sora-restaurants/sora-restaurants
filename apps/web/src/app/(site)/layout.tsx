import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import type { ReactNode } from "react";
import { Footer, Nav } from "../../components/site/Chrome.tsx";
import { siteFonts } from "../site-fonts.ts";
import { SITE_URL } from "../../lib/site-url.ts";
import "../site.css";

const description = "Restaurant technology for sit-down restaurants in South Africa: QR table ordering, a live kitchen screen, call-a-waiter and owner tools that help your staff, not replace them.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "SORA: QR ordering and restaurant technology", template: "%s · SORA" },
  description,
  openGraph: { type: "website", siteName: "SORA", title: "SORA: your restaurant, reimagined", description, locale: "en_ZA" },
  twitter: { card: "summary_large_image" },
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`site ${siteFonts}`}>
      <Nav />
      <main>{children}</main>
      <Footer />
      <Analytics />
    </div>
  );
}
