import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "Early Access", description: "Request access to the Covarify private beta." };

export default function EarlyAccessPage() {
  return <main><SiteHeader /><section className="form-layout shell"><div className="form-copy"><p className="eyebrow plain">Private beta</p><h1>A clearer next move starts here.</h1><p>Tell us a little about what clarity would mean for you. Early access will be offered in small groups as Covarify develops.</p><div className="privacy-note">Your answers help us shape the first experience. We will never sell your information.</div></div>
    {/* TODO: Connect this form to a secure server-side submission endpoint before launch. */}
    <form className="access-form"><label>Name<input name="name" autoComplete="name" required placeholder="Your name" /></label><label>Email<input type="email" name="email" autoComplete="email" required placeholder="you@example.com" /></label><label>Biggest financial stress right now<textarea name="stress" rows={4} placeholder="What feels hardest to see clearly?" /></label><label>What would clarity help you decide?<textarea name="decision" rows={4} placeholder="The decision in front of you" /></label><button className="button button-primary" type="submit">Request Early Access <ArrowRight size={17} /></button><p className="form-fineprint">Private beta · Limited availability · No obligation</p></form>
  </section><SiteFooter /></main>;
}
