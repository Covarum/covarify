import Link from "next/link";

export function Brand() {
  return <Link className="brand" href="/" aria-label="Covarify home"><span className="brand-mark"><i /><i /><i /></span><span>covarify</span></Link>;
}

export function SiteHeader() {
  return <header className="site-header shell"><Brand /><Link className="button button-small" href="/early-access">Early Access</Link></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="shell footer-grid"><div><Brand /><p>Financial Clarity</p><p>From Complexity to Confidence.</p></div><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/terms">Terms</Link></nav><a href="mailto:security@covarify.com">security@covarify.com</a></div><div className="shell copyright">© {new Date().getFullYear()} Covarify. Built quietly, with intention.</div></footer>;
}
