const NBSP = " ";

/**
 * Integer cents to South African rands: "R 1 285,00". Written by hand, not with Intl, because each phone
 * browser ships its own en-ZA locale data; any difference from the server's text breaks React hydration.
 */
export function formatRand(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}R${NBSP}${rands},${String(abs % 100).padStart(2, "0")}`;
}
