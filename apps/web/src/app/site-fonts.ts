import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", preload: false });

/** Class names that expose the marketing site's two faces as CSS variables (site.css). */
export const siteFonts = `${geist.variable} ${mono.variable}`;
