import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { return ["", "/early-access", "/privacy", "/security", "/terms"].map((path) => ({ url: `https://covarify.com${path}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: path === "" ? 1 : 0.6 })); }
