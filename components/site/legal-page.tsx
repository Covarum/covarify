import { SiteFooter, SiteHeader } from "./site-shell";

export function LegalPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: { title: string; body: React.ReactNode }[] }) {
  return <main><SiteHeader /><article className="legal shell"><p className="eyebrow plain">{eyebrow}</p><h1>{title}</h1><p className="legal-intro">{intro}</p><div className="legal-sections">{sections.map((section) => <section key={section.title}><h2>{section.title}</h2><div>{section.body}</div></section>)}</div></article><SiteFooter /></main>;
}
