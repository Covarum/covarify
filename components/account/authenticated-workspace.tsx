import Link from "next/link";
import { ArrowRight, CircleUserRound, LayoutDashboard, LockKeyhole, MessageCircle, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/site/site-shell";
import { signOut } from "@/app/auth/actions";

const navigation = [
  { label: "Money Picture", icon: LayoutDashboard, href: "#money-picture", active: true },
  { label: "Decision Studio", icon: Sparkles, href: "#decision-studio" },
  { label: "Talk to Covarify", icon: MessageCircle, href: "#talk-to-covarify" },
  { label: "Settings", icon: Settings, href: "#settings" },
];

export function AuthenticatedWorkspace({ firstName, email, greeting }: { firstName: string; email: string; greeting: string }) {
  return <div className="workspace-page">
    <header className="workspace-header"><div className="workspace-header-inner"><Brand /><nav className="workspace-nav" aria-label="Workspace navigation">{navigation.map(({ label, icon: Icon, href, active }) => <Link key={label} href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}><Icon size={17} /><span>{label}</span></Link>)}</nav><div className="workspace-profile"><div><span>{email}</span><small>Founder workspace</small></div><CircleUserRound size={29} aria-hidden="true" /><form action={signOut}><button type="submit">Sign out</button></form></div></div></header>
    <main className="workspace-main">
      <section className="workspace-welcome"><div><p className="eyebrow plain"><Sparkles size={13} />Private founder workspace</p><h1>{greeting}, {firstName}.</h1><p>Your financial story stays connected.</p></div><span className="workspace-status"><ShieldCheck size={16} />Secure session</span></section>
      <section className="workspace-grid" id="money-picture">
        <article className="workspace-connection-card"><div className="connection-visual" aria-hidden="true"><span className="orbit-ring orbit-ring-one" /><span className="orbit-ring orbit-ring-two" /><span className="orbit-core"><LockKeyhole size={23} /></span></div><div className="connection-copy"><p className="card-kicker">Money Picture · Ready when you are</p><h2>Bring your financial life into focus.</h2><p>Your first secure account connection will begin your Money Picture—organizing balances, cash flow, and the context behind your next decision in one calm view.</p><Link className="workspace-connect" href="/connect"><span>Review connection readiness</span><ArrowRight size={17} /></Link><p className="workspace-gate"><LockKeyhole size={13} />Internal beta gate · Connections are not enabled yet</p></div></article>
        <aside className="workspace-side-card"><div><p className="card-kicker">Your next chapter</p><h3>The foundation is in place.</h3><p>Your secure profile is active. The account connection step remains intentionally gated while final production safeguards are completed.</p></div><div className="workspace-checks"><span><i>1</i>Secure founder access</span><span><i>2</i>Private Money Picture</span><span className="is-muted"><i>3</i>First controlled connection</span></div></aside>
      </section>
      <section className="workspace-preview-row"><article id="decision-studio"><span><Sparkles size={18} /></span><div><small>Decision Studio</small><h3>Turn possibilities into clear choices.</h3><p>Available after your Money Picture is established.</p></div></article><article id="talk-to-covarify"><span><MessageCircle size={18} /></span><div><small>Talk to Covarify</small><h3>Ask in plain language.</h3><p>Your financial context will make every conversation more useful.</p></div></article><article id="settings"><span><Settings size={18} /></span><div><small>Settings</small><h3>Your access, your preferences.</h3><p><Link href="/account/delete">Review or delete your account</Link></p></div></article></section>
    </main>
  </div>;
}
