import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.covarify.com"),
  title: { default: "Covarify | Financial Clarity", template: "%s | Covarify" },
  description: "We help you understand your financial life.",
  applicationName: "Covarify",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/brand/covarify-primary.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: "https://www.covarify.com",
    siteName: "Covarify",
    title: "Covarify | Financial Clarity",
    description: "We help you understand your financial life.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Covarify — Financial Clarity" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Covarify | Financial Clarity",
    description: "We help you understand your financial life.",
    images: ["/og-image.png"],
  },
  appleWebApp: { title: "Covarify" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
