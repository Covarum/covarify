import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/first-win", "/product-preview"] }], sitemap: "https://covarify.com/sitemap.xml" }; }
