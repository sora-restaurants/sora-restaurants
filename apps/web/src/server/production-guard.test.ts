import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config.ts";
import { assertNoDevLoginInProduction } from "./dev-staff-login.ts";

afterEach(() => vi.unstubAllEnvs());

describe("dev staff login can never reach production", () => {
  for (const flag of ["DEV_STAFF_LOGIN", "NEXT_PUBLIC_DEV_STAFF_LOGIN", "DEV_STAFF_LOGIN_SECRET", "DEV_SIMULATED_PAYMENTS"]) {
    it(`a production build refuses to start when ${flag} is set`, () => {
      vi.stubEnv(flag, "1");
      expect(() => nextConfig(PHASE_PRODUCTION_BUILD)).toThrow(/dev staff login/i);
      expect(() => nextConfig(PHASE_PRODUCTION_SERVER)).toThrow(/dev staff login/i);
    });
  }

  it("the dev server is allowed to use it", () => {
    vi.stubEnv("DEV_STAFF_LOGIN", "1");
    expect(() => nextConfig(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
  });

  it("a production build without the flags is fine", () => {
    expect(() => nextConfig(PHASE_PRODUCTION_BUILD)).not.toThrow();
  });

  it("the server refuses to run in production with the flag set", () => {
    expect(() => assertNoDevLoginInProduction({ NODE_ENV: "production", DEV_STAFF_LOGIN: "1" })).toThrow(/dev staff login/i);
    expect(() => assertNoDevLoginInProduction({ NODE_ENV: "development", DEV_STAFF_LOGIN: "1" })).not.toThrow();
  });
});
