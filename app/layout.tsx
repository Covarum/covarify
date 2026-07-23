import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/brand.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://covarify.com"),
  title: { default: "Covarify | Financial Clarity", template: "%s | Covarify" },
  description: "A calmer, clearer way to understand your money - and what to do next.",
  applicationName: "Covarify",
  icons: {
    icon: [{ url: "/brand/covarify-primary.svg", type: "image/svg+xml" }],
    shortcut: "/brand/covarify-primary.svg",
    apple: "/brand/covarify-primary.svg",
  },
  openGraph: {
    title: "Covarify | Financial Clarity",
    description: "From Complexity to Confidence.",
    type: "website",
    images: [{ url: "/brand/covarify-primary.svg", width: 1080, height: 1080, alt: "Covarify - Financial Clarity" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Covarify | Financial Clarity",
    description: "From Complexity to Confidence.",
    images: ["/brand/covarify-primary.svg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
