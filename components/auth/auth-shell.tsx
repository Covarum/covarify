import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { Brand } from "@/components/site/site-shell";

export function AuthShell({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return <main className="auth-page">
    <section className="auth-story" aria-label="Covarify">
      <div className="auth-story-top"><Brand variant="light" /><span className="auth-beta-badge"><LockKeyhole size={13} />Founder beta</span></div>
      <div className="auth-story-copy"><span className="auth-orbit" aria-hidden="true"><i /><i /><i /></span><p className="eyebrow plain"><Sparkles size={13} />Your private financial workspace</p><h2>Clarity begins with a secure place to return to.</h2><p>Covarify keeps your financial story calm, connected, and ready for the decisions ahead.</p></div>
      <p className="auth-trust-note">Protected access · Private by design · Production connections remain disabled</p>
    </section>
    <section className="auth-panel">
      <div className="auth-panel-inner"><Link className="auth-back" href="/"><ArrowLeft size={15} />Back to Covarify</Link><div className="auth-heading"><p className="eyebrow plain">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{children}{footer && <div className="auth-footer">{footer}</div>}</div>
    </section>
  </main>;
}

export function AuthNotice({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  return <div className={`auth-notice auth-notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function AuthLoading({ label = "Preparing your secure workspace" }: { label?: string }) {
  return <main className="auth-loading"><Image className="auth-loading-symbol" src="/covarify-symbol.svg" alt="" width={96} height={83} /><span className="auth-spinner" aria-hidden="true" /><p>{label}…</p></main>;
}
