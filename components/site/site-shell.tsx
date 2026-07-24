import Link from "next/link";
import Image from "next/image";

export function Brand({ variant = "primary" }: { variant?: "primary" | "light" }) {
  const src = variant === "light" ? "/covarify-primary-light.svg" : "/covarify-primary-horizontal.svg";
  return <Link className={`brand brand-${variant}`} href="/" aria-label="Covarify home"><Image className="brand-logo" src={src} alt="Covarify — Financial Clarity" width={832} height={212} priority /></Link>;
}

export function SiteHeader() {
  return <header className="site-header shell"><Brand /><Link className="button button-small" href="/early-access">Early Access</Link></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="shell footer-grid"><div className="footer-brand"><Brand variant="light" /><p>From Complexity to Confidence.</p></div><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/terms">Terms</Link></nav><a className="footer-security" href="mailto:security@covarify.com"><span>Security</span>security@covarify.com</a></div><div className="shell copyright">© {new Date().getFullYear()} Covarify. Built quietly, with intention.</div></footer>;
}
