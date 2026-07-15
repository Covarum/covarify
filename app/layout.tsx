import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://covarify.com"),
  title: { default: "Covarify | Financial Clarity", template: "%s | Covarify" },
  description: "A calmer, clearer way to understand your money — and what to do next.",
  openGraph: { title: "Covarify | Financial Clarity", description: "From Complexity to Confidence.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
