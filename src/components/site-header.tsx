"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Menu, Search, X } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/towns", label: "Explore Towns" },
  { href: "/categories", label: "Categories" },
  { href: "/discover", label: "Discover" },
  { href: "/search", label: "Search" },
  { href: "/favourites", label: "Favourites" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-[1100] border-b border-line/80 bg-ivory/92 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="mr-auto rounded-md lg:mr-6" aria-label="OFENTSE-FINDS home">
          <LogoLockup compactOnMobile />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-[14px] font-medium text-ink-2 transition hover:bg-sand hover:text-ink",
                isActive(item.href) && "text-ink after:mx-auto after:mt-0.5 after:block after:h-0.5 after:w-4 after:rounded after:bg-orange",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link href="/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-sand lg:hidden">
            <Search className="h-5 w-5" />
          </Link>
          <Link href="/favourites" aria-label="Favourites" className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-sand lg:hidden">
            <Heart className="h-5 w-5" />
          </Link>
          <Link
            href="/list-your-business"
            className="hidden rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 sm:inline-flex"
          >
            List Your Business
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-sand lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-16 z-[1100] overflow-y-auto bg-ivory lg:hidden">
          <nav aria-label="Mobile" className="container-page flex flex-col py-4">
            {NAV.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ animationDelay: `${i * 30}ms` }}
                className={cn(
                  "animate-fade-up border-b border-line py-4 font-display text-2xl font-bold text-ink",
                  isActive(item.href) && "text-teal-700",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/list-your-business" className="mt-6 rounded-lg bg-orange px-4 py-3.5 text-center font-semibold text-teal-950">
              List Your Business
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
