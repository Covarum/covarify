import Image from "next/image";
import Link from "next/link";

export function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link className={`brand ${footer ? "brand-footer" : ""}`} href="/" aria-label="Covarify home">
      <span className="brand-logo-frame">
        <Image
          className="brand-logo"
          src="/brand/covarify-primary.svg"
          alt="Covarify - Financial Clarity"
          width={1080}
          height={1080}
          priority={!footer}
        />
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return <header className="site-header shell"><Brand /><Link className="button button-small" href="/early-access">Early Access</Link></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="shell footer-grid"><div><Brand footer /><p>Financial Clarity</p><p>From Complexity to Confidence.</p></div><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/terms">Terms</Link></nav><a href="mailto:security@covarify.com">security@covarify.com</a></div><div className="shell copyright">© {new Date().getFullYear()} Covarify. Built quietly, with intention.</div></footer>;
}
