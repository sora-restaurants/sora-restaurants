/** Demo reviews for the live demo. Keyed by a simple hash of the dish name so the same item always shows the same data. */

export type DemoReview = {
  author: string;
  rating: number;
  text: string;
  date: string;
};

const AUTHORS = ["Thandi M.", "Sipho K.", "Aisha R.", "Johan P.", "Lerato N.", "David S.", "Naledi T.", "Pieter V.", "Zanele D.", "Michael B."];

const COMMENTS = [
  "Absolutely delicious. Will definitely order this again.",
  "Perfect portion and the flavours were spot on.",
  "Came out piping hot and looked exactly like the photo.",
  "A bit rich for me but my partner loved it.",
  "Best one I've had in a while. Highly recommend.",
  "Great value and the presentation was lovely.",
  "Ordered this twice this week. No regrets.",
  "Light and fresh. Perfect for sharing.",
  "The sauce is incredible. Don't skip it.",
  "Solid choice. Exactly what I was craving.",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function demoReviewsFor(name: string): { rating: number; count: number; reviews: DemoReview[]; badge?: "Most liked" | "Must experience" } {
  const h = hash(name.toLowerCase());
  const rating = 3.8 + (h % 12) / 10; // 3.8 – 4.9
  const count = 8 + (h % 47);
  const reviews: DemoReview[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = (h + i * 17) % COMMENTS.length;
    reviews.push({
      author: AUTHORS[(h + i) % AUTHORS.length],
      rating: Math.min(5, Math.round(rating + (i % 2 === 0 ? 0.2 : -0.3))),
      text: COMMENTS[idx],
      date: `${(h % 28) + 1} Oct`,
    });
  }
  let badge: "Most liked" | "Must experience" | undefined;
  if (rating >= 4.7) badge = "Most liked";
  else if (rating >= 4.4) badge = "Must experience";
  return { rating: Math.round(rating * 10) / 10, count, reviews, badge };
}
