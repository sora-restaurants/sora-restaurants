import { ImageResponse } from "next/og";

export const alt = "SORA: your restaurant, reimagined";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0a0a0a", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72 }}>
        <div style={{ fontSize: 28, letterSpacing: 10, fontWeight: 700 }}>SORA</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, letterSpacing: -5, lineHeight: 1, fontWeight: 600 }}>Your restaurant.</div>
          <div style={{ fontSize: 104, letterSpacing: -5, lineHeight: 1, fontWeight: 600, color: "#8a8a8a" }}>Reimagined.</div>
        </div>
        <div style={{ fontSize: 26, color: "#9b9b9b" }}>QR table ordering for sit-down restaurants in South Africa</div>
      </div>
    ),
    size,
  );
}
