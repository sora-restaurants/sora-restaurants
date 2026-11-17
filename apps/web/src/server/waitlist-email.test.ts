import { describe, expect, it, vi } from "vitest";
import { type Mail, notifyNewApplication, resendSender } from "./waitlist-email.ts";

const app = { reference: "SORA-ABC234", restaurantName: "Die Blou Deur", contactName: "Thandi", email: "thandi@example.com", city: "Stellenbosch" };

describe("waitlist emails", () => {
  it("is off unless the key, sender and alert address are all set", () => {
    expect(resendSender({ RESEND_API_KEY: "k", RECEIPT_FROM: "a@b.c" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(resendSender({ RESEND_API_KEY: "k", RECEIPT_FROM: "a@b.c", WAITLIST_ALERT_TO: "team@b.c" } as unknown as NodeJS.ProcessEnv)).not.toBeNull();
  });

  it("alerts the team and confirms to the applicant, and a failure never throws", async () => {
    const sent: Mail[] = [];
    await notifyNewApplication(app, { alertTo: "team@sora.example", send: async (m) => void sent.push(m) });
    expect(sent.map((m) => m.to)).toEqual(["team@sora.example", "thandi@example.com"]);
    expect(sent[1].text).toContain("SORA-ABC234");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyNewApplication(app, { alertTo: "t@x", send: async () => { throw new Error("down"); } })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
