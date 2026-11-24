// Emails for a new waitlist application: an alert to the Sora team and a confirmation to the applicant.
// Off unless RESEND_API_KEY, RECEIPT_FROM and WAITLIST_ALERT_TO are all set. A failed email never fails the application.

export type Mail = { to: string; subject: string; text: string };
export type SendMail = (mail: Mail) => Promise<void>;

export function waitlistMails(app: { reference: string; restaurantName: string; contactName: string; email: string; city: string }, alertTo: string): Mail[] {
  return [
    {
      to: alertTo,
      subject: `New waitlist application: ${app.restaurantName} (${app.reference})`,
      text: `${app.restaurantName} in ${app.city} enquired about SORA.\nContact: ${app.contactName} <${app.email}>\nReference: ${app.reference}\n\nOpen /admin to review it.`,
    },
    {
      to: app.email,
      subject: `Your SORA enquiry (${app.reference})`,
      text: `Hi ${app.contactName},\n\nThanks for your enquiry about SORA for ${app.restaurantName}. Your reference is ${app.reference}.\nWe will contact you soon to arrange a demonstration and discuss the Founding Restaurant Programme.\n\nThe Sora team`,
    },
  ];
}

export function resendSender(env: NodeJS.ProcessEnv = process.env): { send: SendMail; alertTo: string } | null {
  const { RESEND_API_KEY: key, RECEIPT_FROM: from, WAITLIST_ALERT_TO: alertTo } = env;
  if (!key || !from || !alertTo) return null;
  return {
    alertTo,
    send: async (m) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: m.to, subject: m.subject, text: m.text }),
      });
      if (!res.ok) throw new Error(`Resend answered ${res.status}`);
    },
  };
}

/** Sends both emails; logs failures and never throws. */
export async function notifyNewApplication(app: Parameters<typeof waitlistMails>[0], sender = resendSender()): Promise<void> {
  if (!sender) return;
  const results = await Promise.allSettled(waitlistMails(app, sender.alertTo).map(sender.send));
  for (const r of results) if (r.status === "rejected") console.error("waitlist email failed", r.reason);
}
