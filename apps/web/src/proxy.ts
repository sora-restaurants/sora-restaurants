import { NextResponse } from "next/server";

// The marketing-site deployment (SORA_SITE_ONLY=1) serves only the website, waitlist and /admin;
// the ordering app's pages and APIs answer 404 there so they are not a second, unwatched attack surface.
export function proxy() {
  return process.env.SORA_SITE_ONLY === "1" ? new NextResponse(null, { status: 404 }) : NextResponse.next();
}

export const config = {
  matcher: [
    "/kitchen/:path*", "/owner/:path*", "/menu-admin/:path*", "/waiter/:path*", "/t/:path*", "/o/:path*",
    "/pay/:path*", "/preview/:path*", "/demo/:path*",
    "/api/((?!waitlist$).*)",
  ],
};
