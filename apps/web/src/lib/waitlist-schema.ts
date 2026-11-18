import { z } from "zod";

// One source for the form's options, the server's validation and the admin's labels. No server-only imports: the form uses it too.

export const RESTAURANT_TYPES = ["Casual dining", "Fine dining", "Café / coffee shop", "Family restaurant", "Bar / pub with table service", "Fast casual", "Other"] as const;
export const POSITIONS = ["Owner", "General manager", "Restaurant manager", "Operations manager", "Other"] as const;
export const CONTACT_METHODS = ["Email", "Phone call", "WhatsApp"] as const;
export const POS_SYSTEMS = ["GAAP", "Pilot POS", "Lightspeed", "iKhokha", "Yoco", "Oracle MICROS / Simphony", "Other", "No POS system", "Not sure"] as const;
export const ORDERING_METHODS = ["Waiters take orders at the table", "Customers order at the counter", "A mix of both", "Other"] as const;
export const QR_USE = ["No", "Yes, QR menus only", "Yes, QR ordering"] as const;
export const KITCHEN_SYSTEMS = ["Printed tickets", "Digital kitchen display", "Handwritten dockets", "Not sure"] as const;
export const PAYMENT_METHODS = ["Card machine at the table", "Pay at the till", "Cash", "Online or in-app payment"] as const;
export const DAILY_VOLUMES = ["Fewer than 50", "50 to 150", "150 to 300", "More than 300", "Not sure"] as const;
export const IMPROVEMENTS = ["Reduce waiter workload", "Faster table ordering", "Improve kitchen communication", "Reduce ordering mistakes", "Improve customer experience", "Reduce walk-outs / unpaid orders", "Better restaurant analytics", "Easier menu management", "Better coordination between staff", "Other"] as const;
export const FEATURES = ["QR table ordering", "Live kitchen dashboard", "Order tracking", "Waiter call system", "Menu management", "Payment options", "Analytics dashboard", "Future POS integrations"] as const;
export const TIMELINES = ["As soon as possible", "Within 1 to 3 months", "Within 3 to 6 months", "Just exploring for now"] as const;
export const YES_NO_MAYBE = ["Yes", "Maybe", "No"] as const;

export const STATUSES = ["new", "under_review", "contacted", "demo_scheduled", "approved", "rejected", "onboarded"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = {
  new: "New", under_review: "Under Review", contacted: "Contacted", demo_scheduled: "Demo Scheduled",
  approved: "Approved", rejected: "Rejected", onboarded: "Onboarded",
};

// Control characters are dropped (tabs and line breaks kept in long answers); React escapes the rest on output.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
const text = (max: number, message: string) => z.string().transform(clean).pipe(z.string().min(1, message).max(max, `Keep this under ${max} characters.`));
const optional = (max: number) => z.string().transform(clean).pipe(z.string().max(max, `Keep this under ${max} characters.`)).optional().default("");
const pick = <T extends readonly [string, ...string[]]>(options: T, message: string) => z.enum(options, { errorMap: () => ({ message }) });
const optionalPick = <T extends readonly [string, ...string[]]>(options: T) => z.union([z.enum(options), z.literal("")]).optional().default("");
const many = <T extends readonly [string, ...string[]]>(options: T) => z.array(z.enum(options)).max(options.length).optional().default([]);
const count = (max: number, message: string) =>
  z.string().optional().default("").transform(clean).pipe(z.string().regex(/^\d{0,6}$/, message))
    .transform((s) => (s === "" ? "" : Number(s))).refine((n) => n === "" || (n >= 1 && n <= max), message);

/** Accepts 082 123 4567, +27 82 123 4567 and other international numbers; stores +27821234567. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s().-]/g, "");
  if (/^0[1-8]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^\+27[1-8]\d{8}$/.test(digits)) return digits;
  if (/^\+(?!27)\d{8,15}$/.test(digits)) return digits;
  return null;
}

const url = optional(200).refine((v) => v === "" || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#]\S*)?$/i.test(v), "Write a web address, like example.co.za.");

export const steps = {
  restaurant: z.object({
    restaurantName: text(120, "Write the name of your restaurant."),
    restaurantType: pick(RESTAURANT_TYPES, "Choose the type of restaurant."),
    city: text(80, "Write the city or town the restaurant is in."),
    locations: count(500, "Write a whole number, like 1."),
    tablesCount: count(2000, "Write a whole number, like 24."),
    seatingCapacity: count(20000, "Write a whole number, like 80."),
    website: url,
    social: optional(120),
  }),
  contact: z.object({
    contactName: text(120, "Write your full name."),
    contactPosition: pick(POSITIONS, "Choose your position.").optional().default("Other"),
    email: z.string().optional().default("").transform((s) => clean(s).toLowerCase()).pipe(z.union([z.literal(""), z.string().email("Write an email address with an @, like name@restaurant.co.za.").max(254)])),
    phone: z.string().optional().default("").transform((s, ctx) => {
      if (clean(s) === "") return "";
      const phone = normalisePhone(s);
      if (!phone) { ctx.addIssue({ code: "custom", message: "Write a phone number, like 082 123 4567 or +27 82 123 4567." }); return z.NEVER; }
      return phone;
    }),
    preferredContact: optionalPick(CONTACT_METHODS),
    bestTime: optional(80),
  }).superRefine((v, ctx) => {
    if (!v.email && !v.phone) ctx.addIssue({ code: "custom", path: ["email"], message: "Add an email address or phone number so we can contact you." });
  }),
  operations: z.object({
    posSystem: pick(POS_SYSTEMS, "Choose your POS system, or “Not sure”.").optional().default("Not sure"),
    posOther: optional(80),
    orderingMethod: optionalPick(ORDERING_METHODS),
    usesQr: optionalPick(QR_USE),
    kitchenSystem: optionalPick(KITCHEN_SYSTEMS),
    paymentHandling: many(PAYMENT_METHODS),
    dailyVolume: optionalPick(DAILY_VOLUMES),
  }).superRefine((v, ctx) => {
    if (v.posSystem === "Other" && !v.posOther) ctx.addIssue({ code: "custom", path: ["posOther"], message: "Write the name of your POS system." });
  }),
  needs: z.object({
    improvements: many(IMPROVEMENTS),
    featureInterests: many(FEATURES),
    biggestChallenge: optional(2000),
    requests: optional(2000),
  }),
  final: z.object({
    testTimeline: optionalPick(TIMELINES),
    openToDemo: optionalPick(YES_NO_MAYBE),
    pilotInterest: optionalPick(YES_NO_MAYBE),
    comments: optional(2000),
  }),
};
export const STEP_KEYS = ["restaurant", "contact", "operations", "needs", "final"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

const answers = steps.restaurant.and(steps.contact).and(steps.operations).and(steps.needs).and(steps.final);
export type Answers = z.infer<typeof answers>;

export const submissionSchema = answers.and(z.object({
  consent: z.literal(true, { errorMap: () => ({ message: "Tick the box to agree before you submit." }) }),
  submissionKey: z.string().regex(/^[a-f0-9]{32}$/),
  // Bot checks: a field people never see, and how long the form was open.
  companyUrl: z.string().max(200).optional().default(""),
  elapsedMs: z.number().int().nonnegative(),
}));

/** { field: first message } from a failed parse. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}
