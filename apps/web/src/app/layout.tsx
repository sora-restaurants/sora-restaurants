import { Barlow, Barlow_Condensed, Cormorant_Garamond, Manrope, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { ButtonHaptics } from "../components/ButtonHaptics";
import "./globals.css";

// Every theme's faces are exposed as CSS variables; the active theme picks its pair (globals.css).
// preload: false so a phone only downloads the files its restaurant's theme actually renders.
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-cormorant", preload: false });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", preload: false });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", preload: false });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-barlow-condensed", preload: false });
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-barlow", preload: false });

export const metadata = {
  title: "Restaurant SaaS",
  // iPhone Safari otherwise turns order codes, prices and times into tap-to-call links before React loads,
  // which breaks hydration and makes numbers on the menu and kitchen board tappable by accident.
  formatDetection: { telephone: false, date: false, address: false, email: false },
};
export const viewport = { width: "device-width", initialScale: 1 };

const fontVariables = [cormorant, sourceSerif, manrope, barlowCondensed, barlow].map((f) => f.variable).join(" ");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning applies to these two tags only: phone translators, dark modes and extensions
    // add attributes here before React loads. Mismatches anywhere inside the page are still reported.
    <html lang="en-ZA" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning><ButtonHaptics />{children}</body>
    </html>
  );
}
