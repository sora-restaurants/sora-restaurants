import type { ReactNode } from "react";

export const metadata = { title: "Restaurant SaaS" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  );
}
