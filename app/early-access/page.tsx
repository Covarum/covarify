import type { Metadata } from "next";
import { EarlyAccessForm } from "@/components/site/early-access-form";
import { SiteFooter, SiteHeader } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "Early Access", description: "Request access to the Covarify private beta." };

export default function EarlyAccessPage() {
  return <main><SiteHeader /><section className="form-layout shell"><div className="form-copy"><p className="eyebrow plain">Private beta</p><h1>A clearer next move starts here.</h1><p>Tell us a little about what clarity would mean for you. Early access will be offered in small groups as Covarify develops.</p><div className="privacy-note">Your answers help us shape the first experience. We will never sell your information.</div></div><EarlyAccessForm /></section><SiteFooter /></main>;
}
