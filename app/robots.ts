import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/first-win", "/product-preview", "/plaid-sandbox"] }], sitemap: "https://www.covarify.com/sitemap.xml" }; }
