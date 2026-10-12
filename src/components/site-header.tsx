"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { nav, site } from "@/lib/site";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[1.35rem] leading-none sm:text-[1.6rem] ${className}`}>
      {site.name.toLowerCase()}
      <span className="text-accent">.</span>
    </span>
  );
}

const menuLinks = [...nav, { href: "/how-it-works", label: "How scoring works" }];

/** Which nav item a path belongs to (subpages light up their parent). */
function activeFor(path: string): string | null {
  if (path === "/" || path.startsWith("/results") || path.startsWith("/improve")) return "/";
  return nav.find((n) => n.href !== "/" && (path === n.href || path.startsWith(`${n.href}/`)))?.href ?? null;
}

/**
 * A floating glass capsule, in the spirit of the iOS tab bar. Once the page
 * scrolls, a frosted band fills the strip behind it so content never shows
 * around the capsule's rounded corners.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Set on click so the pill moves immediately, before the new page has loaded.
  const [pending, setPending] = useState<string | null>(null);

  // Close the menu (and settle the pending pill) whenever the route changes.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setPending(null);
  }
  const active = pending ?? activeFor(pathname);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 px-2 pt-2 sm:px-6 sm:pt-4">
        {/* Frosted band behind the capsule, shown once the page has scrolled. */}
        <div
          aria-hidden="true"
          className={`header-band pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+20px)] transition-opacity duration-300 ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="glass-strong relative mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-2 !rounded-full pl-4 pr-1.5 sm:gap-3 sm:pl-6 sm:pr-2">
          <Link href="/" aria-label={`${site.name} home`} className="shrink-0">
            <Wordmark />
          </Link>
          <DesktopNav active={active} onPick={setPending} />
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href="/#check"
              className="btn btn-primary !px-3.5 !py-2 !text-[0.8rem] sm:!px-4 sm:!py-2.5 sm:!text-[0.86rem]"
            >
              <span className="sm:hidden">Check resume</span>
              <span className="hidden sm:inline">Check my resume</span>
            </Link>
            <button
              ref={buttonRef}
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((o) => !o)}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/70 lg:hidden"
            >
              <span className="sr-only">Menu</span>
              <span aria-hidden="true" className="relative block h-3.5 w-[18px]">
                <span
                  className={`absolute left-0 top-0 h-[1.6px] w-full rounded-full bg-ink transition-transform duration-300 ${
                    open ? "translate-y-[6px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[6px] h-[1.6px] w-full rounded-full bg-ink transition-opacity duration-200 ${
                    open ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[12px] h-[1.6px] w-full rounded-full bg-ink transition-transform duration-300 ${
                    open ? "-translate-y-[6px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu: a frosted glass panel; the page behind stays visible. */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* Invisible: only catches taps outside the panel to close it. */}
        <div onClick={() => setOpen(false)} className="absolute inset-0" />
        <nav
          id={menuId}
          aria-label="Main"
          className={`menu-panel absolute right-2 top-[76px] w-[min(20rem,calc(100vw-1rem))] origin-top-right p-2 transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] sm:right-6 sm:top-[88px] ${
            open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-95 opacity-0"
          }`}
        >
          {menuLinks.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              aria-current={activeFor(pathname) === item.href ? "page" : undefined}
              style={{ transitionDelay: open ? `${60 + i * 35}ms` : "0ms" }}
              className={`flex items-center justify-between rounded-[var(--radius)] px-4 py-3.5 text-[1rem] transition-all duration-300 hover:bg-ink/5 active:scale-[0.97] ${
                open ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
              } ${activeFor(pathname) === item.href ? "nav-pill font-medium" : ""} ${i === nav.length ? "mt-1 border-t border-[var(--glass-line)] text-ink-muted" : ""}`}
            >
              {item.label}
              <span aria-hidden="true" className="text-ink-faint">
                →
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

/**
 * Desktop links with a glass "lens" behind the current page. The lens slides
 * to the clicked item with a soft spring and a brief stretch, like the iOS tab
 * bar; items press in slightly when tapped.
 */
function DesktopNav({ active, onPick }: { active: string | null; onPick: (href: string) => void }) {
  const navRef = useRef<HTMLElement>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const [morph, setMorph] = useState(0);
  const last = useRef<string | null>(null);

  const measure = useCallback(() => {
    const el = active ? links.current.get(active) : null;
    setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  }, [active]);

  useLayoutEffect(() => {
    measure();
    if (last.current !== null && last.current !== active) setMorph((m) => m + 1);
    last.current = active;
    // Only animate after the first placement, so the pill doesn't fly in on load.
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, [active, measure]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure]);

  return (
    <nav ref={navRef} aria-label="Main" className="relative hidden items-center gap-0.5 text-[0.9rem] lg:flex">
      <span
        aria-hidden="true"
        className={`nav-pill pointer-events-none absolute inset-y-0 left-0 ${morph % 2 ? "nav-pill-morph-a" : morph ? "nav-pill-morph-b" : ""} ${
          animate ? "nav-pill-animate" : ""
        }`}
        style={{
          translate: `${pill?.x ?? 0}px 0`,
          width: pill?.w ?? 0,
          opacity: pill ? 1 : 0,
        }}
      />
      {nav.map((item) => (
        <Link
          key={item.href}
          ref={(el) => {
            if (el) links.current.set(item.href, el);
            else links.current.delete(item.href);
          }}
          href={item.href}
          onClick={() => onPick(item.href)}
          aria-current={active === item.href ? "page" : undefined}
          className={`relative rounded-full px-3.5 py-2 transition-[color,scale] duration-200 ease-out hover:text-ink active:scale-[0.96] ${
            active === item.href ? "font-medium text-ink" : "text-ink-muted"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
