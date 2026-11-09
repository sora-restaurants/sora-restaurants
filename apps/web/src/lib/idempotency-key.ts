/**
 * 128 random bits as hex. Uses crypto.getRandomValues, not crypto.randomUUID: randomUUID only exists on secure
 * pages (HTTPS or localhost), and a phone testing on Wi-Fi opens the app over plain http.
 */
export function newIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
