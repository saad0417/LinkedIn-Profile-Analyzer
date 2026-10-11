import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-20 sm:py-28">
      <div className="glass-strong max-w-2xl p-8 sm:p-12">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-tight sm:text-[3rem]">This page did not parse.</h1>
        <p className="mt-4 text-ink-muted">The link may be old, or the page may have moved.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Go to the checker
          </Link>
          <Link href="/guides" className="btn btn-secondary">
            Read the guides
          </Link>
        </div>
      </div>
    </div>
  );
}
