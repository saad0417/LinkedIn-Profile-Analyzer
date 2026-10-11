"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { nav, site } from "@/lib/site";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[1.15rem] leading-none tracking-tight sm:text-[1.3rem] ${className}`}>
      {site.name.toLowerCase()}
      <span className="text-accent">.</span>
    </span>
  );
}

const menuLinks = [...nav, { href: "/how-it-works", label: "How scoring works" }];

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

  // Close the menu whenever the route changes.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

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
          <nav aria-label="Main" className="hidden items-center gap-0.5 text-[0.9rem] lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`rounded-full px-3 py-2 transition-colors hover:bg-white/60 hover:text-ink ${
                  pathname === item.href ? "text-ink" : "text-ink-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
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
              aria-current={pathname === item.href ? "page" : undefined}
              style={{ transitionDelay: open ? `${60 + i * 35}ms` : "0ms" }}
              className={`flex items-center justify-between rounded-[var(--radius)] px-4 py-3.5 text-[1rem] transition-all duration-300 hover:bg-ink/5 ${
                open ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
              } ${pathname === item.href ? "bg-ink/[0.06] font-medium" : ""} ${i === nav.length ? "mt-1 border-t border-[var(--glass-line)] text-ink-muted" : ""}`}
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
