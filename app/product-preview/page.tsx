import type { Metadata } from "next";
import { ArrowRight, CircleDollarSign, Compass, Layers3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "Product Preview", robots: { index: false, follow: false } };
// TODO: Add password protection or authentication before sharing sensitive demo content.
const concepts = [{ icon: Layers3, title: "Bring the picture together", body: "Organize income, bills, debt, goals, and the decisions competing for your attention." }, { icon: Compass, title: "See what matters first", body: "Turn scattered financial details into a clear view of priorities and tradeoffs." }, { icon: CircleDollarSign, title: "Make the next move", body: "Move forward with a practical step shaped around your current financial picture." }];

export default function ProductPreviewPage() {
  return <main><SiteHeader /><section className="preview-hero shell"><p className="eyebrow plain">Private product preview</p><h1>Financial clarity,<br />built around decisions.</h1><p>Covarify is an early-stage financial clarity platform designed to help people understand their full picture — and identify what matters first.</p><Link className="button button-primary" href="/first-win">View a sample First Win <ArrowRight size={17} /></Link></section><section className="concept-grid shell">{concepts.map(({icon: Icon, ...item}) => <article key={item.title}><Icon size={22} /><h2>{item.title}</h2><p>{item.body}</p></article>)}</section><section className="connection-panel shell"><ShieldCheck size={25} /><div><p className="eyebrow plain">Designed with choice in mind</p><h2>Connected when helpful. Manual when preferred.</h2><p>Future versions may support secure account connection through Plaid. Manual input may also be available, so users can choose what they provide and how they build their picture.</p></div></section><section className="preview-note shell"><p>Covarify is in early development and private beta. Product capabilities, account connection, and the experience shown here are concepts subject to change.</p></section><SiteFooter /></main>;
}
