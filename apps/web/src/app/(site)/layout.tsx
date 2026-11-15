import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer, Nav } from "../../components/site/Chrome.tsx";
import { siteFonts } from "../site-fonts.ts";
import "../site.css";

const description = "SORA brings ordering, kitchen operations and table service together in one QR-powered experience for sit-down restaurants in South Africa.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://sora-restaurants.vercel.app"),
  title: { default: "SORA: QR table ordering for restaurants", template: "%s · SORA" },
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
    </div>
  );
}
