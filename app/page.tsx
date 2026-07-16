import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/site-shell";
import "@/styles/mobile-home.css";

const sections = [
  {
    eyebrow: "A clearer view",
    title: "Your money picture should not feel like a puzzle.",
    body: <>Income. Bills. Debt. Goals. Timing. Tradeoffs. Life.<br /><br />The hard part is not always knowing the numbers. It is knowing what matters first.<br /><br />Covarify is being built for the moments when you need clarity, not another spreadsheet.</>,
  },
  {
    eyebrow: "Financial clarity",
    title: "Not another budgeting app.",
    body: <>Covarify is not being built to judge your spending or bury you in charts.<br /><br />It is being built to help you understand your financial picture, identify what needs attention, and move forward with more confidence.</>,
    statement: <>Covarify is not a financial data company.<br />It is a financial decision company.</>,
  },
  {
    eyebrow: "Built for real life",
    title: "For people carrying more financial complexity than anyone can see.",
    body: <>Covarify is being designed for real life: changing income, debt pressure, family obligations, goals, emergencies, and decisions that never seem to arrive one at a time.</>,
  },
];

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <section className="hero shell">
        <div className="hero-orb" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> Private beta opening soon</p>
          <h1>Financial clarity<br />is coming.</h1>
          <p className="hero-lede">Covarify is building a calmer, clearer way to understand your money — and what to do next.</p>
          <p className="hero-support">Most financial tools show you more data. Covarify is being built to help you make better decisions.</p>
          <Link className="button button-primary" href="/early-access">Request Early Access <ArrowRight size={17} /></Link>
          <p className="microcopy">Private beta opening soon.</p>
        </div>
        <div className="clarity-card" aria-label="Covarify concept preview">
          <div className="card-top"><span>YOUR NEXT MOVE</span><span className="status-dot" /></div>
          <div className="clarity-icon"><Check size={24} /></div>
          <p className="card-kicker">CLARITY, NOT MORE NOISE</p>
          <h2>Know what matters first.</h2>
          <p>A calm, considered view of your financial picture — shaped around the decision in front of you.</p>
          <div className="soft-lines"><i /><i /><i /></div>
        </div>
      </section>

      <div className="section-list">
        {sections.map((section, index) => (
          <section className={`content-section shell ${index % 2 ? "content-reverse" : ""}`} key={section.title}>
            <div><p className="eyebrow plain">{section.eyebrow}</p><h2>{section.title}</h2></div>
            <div className="section-body"><p>{section.body}</p>{section.statement && <blockquote>{section.statement}</blockquote>}</div>
          </section>
        ))}
      </div>

      <section className="cta-panel shell">
        <div><p className="eyebrow plain">By invitation</p><h2>Early access will be limited.</h2><p>Join the list to be notified when the first private beta opens.</p></div>
        <Link className="button button-light" href="/early-access">Request Early Access <ArrowRight size={17} /></Link>
      </section>

      <section className="trust shell">
        <div><p className="eyebrow plain">Our approach</p><h2>Quiet by design.<br />Clear by intention.</h2></div>
        <div><p>Covarify is in early development. The first version is focused on financial clarity, planning support, and helping users identify a practical next step.</p><p className="disclaimer">Covarify does not replace legal, tax, investment, or individualized financial advice.</p></div>
      </section>
      <SiteFooter />
    </main>
  );
}
