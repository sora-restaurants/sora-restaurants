import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site-url.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/waitlist", "/privacy"].map((path) => ({ url: `${SITE_URL}${path}` }));
}
