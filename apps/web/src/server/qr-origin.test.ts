import { describe, expect, it } from "vitest";
import { qrOrigin } from "./owner-operations";

describe("QR code address", () => {
  it("uses the live site, not an old deployment link the portal was opened on", () => {
    expect(qrOrigin("https://sora-restaurants-abc123-sora-8818.vercel.app/api/owner", { VERCEL_PROJECT_PRODUCTION_URL: "sora-restaurants.vercel.app" }))
      .toBe("https://sora-restaurants.vercel.app");
  });
  it("lets QR_BASE_URL pick a custom domain", () => {
    expect(qrOrigin("https://x.vercel.app/api/owner", { QR_BASE_URL: "https://order.example.com/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }))
      .toBe("https://order.example.com");
  });
  it("falls back to the request's own address locally", () => {
    expect(qrOrigin("http://localhost:3000/api/owner", {})).toBe("http://localhost:3000");
  });
});
