import Image from "next/image";
import Link from "next/link";

export function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      className={`brand ${footer ? "brand-footer" : ""}`}
      href="/"
      aria-label="Covarify home"
      style={footer ? { background: "#fff", borderRadius: 12, padding: "8px 10px" } : undefined}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: footer ? 210 : "clamp(178px, 22vw, 230px)",
          aspectRatio: "828.09 / 207.335",
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <Image
          src="/brand/covarify-primary.svg"
          alt=""
          width={1080}
          height={1080}
          priority={!footer}
          style={{
            position: "absolute",
            width: "130.42%",
            height: "auto",
            maxWidth: "none",
            left: "-15.21%",
            top: "-210.45%",
          }}
        />
      </span>
      <span className="sr-only">Covarify - Financial Clarity</span>
    </Link>
  );
}

export function SiteHeader() {
  return <header className="site-header shell"><Brand /><Link className="button button-small" href="/early-access">Early Access</Link></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="shell footer-grid"><div><Brand footer /><p>Financial Clarity</p><p>From Complexity to Confidence.</p></div><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/terms">Terms</Link></nav><a href="mailto:security@covarify.com">security@covarify.com</a></div><div className="shell copyright">© {new Date().getFullYear()} Covarify. Built quietly, with intention.</div></footer>;
}
