import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { assertNoDevLoginInProduction } from "./src/server/dev-staff-login.ts";

export default function config(phase: string): NextConfig {
  // A production build or server with any dev-login setting fails here, before anything is compiled or served.
  assertNoDevLoginInProduction(process.env, phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER);

  return {
    // Dev only: lets a phone or tablet on the same private Wi-Fi load the dev server's scripts (pnpm dev:lan).
    allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
    // No other site may frame these pages (clickjacking); no MIME sniffing; full URLs never leak to other sites.
    async headers() {
      return [{
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      }];
    },
  };
}
