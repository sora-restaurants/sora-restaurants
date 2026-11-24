import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteFonts } from "../site-fonts.ts";
import "../site.css";

export const metadata: Metadata = { title: "SORA admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={`site ${siteFonts}`}>{children}</div>;
}
