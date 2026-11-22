import "server-only";

const MAX_TEXT = 3500;

/** Escape Telegram HTML so user text cannot inject tags or break formatting. */
export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function clip(value: string, max = 240): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Send a plain HTML message. No-ops if secrets are unset. Never throws. */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const body = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) console.error("telegram notify failed", res.status);
  } catch (error) {
    console.error("telegram notify failed", error instanceof Error ? error.message : "unknown");
  }
}

export function waitlistAlert(fields: {
  restaurantName: string;
  city?: string | null;
  contactName: string;
  email: string;
  phone: string;
  reference: string;
}): string {
  return [
    "<b>New waitlist application</b>",
    `Restaurant: ${escapeTelegramHtml(clip(fields.restaurantName))}`,
    fields.city ? `City: ${escapeTelegramHtml(clip(fields.city))}` : null,
    `Contact: ${escapeTelegramHtml(clip(fields.contactName))}`,
    `Email: ${escapeTelegramHtml(clip(fields.email))}`,
    `Phone: ${escapeTelegramHtml(clip(fields.phone))}`,
    `Reference: ${escapeTelegramHtml(fields.reference)}`,
  ].filter(Boolean).join("\n");
}
