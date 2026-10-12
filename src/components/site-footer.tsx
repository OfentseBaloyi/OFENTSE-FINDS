import Link from "next/link";
import { LogoArtwork } from "@/components/brand/logo";
import { CATEGORY_GROUPS } from "@/lib/categories";

const TOWN_LINKS = [
  ["mabopane", "Mabopane"], ["soshanguve", "Soshanguve"], ["ga-rankuwa", "Ga-Rankuwa"], ["pretoria", "Pretoria"],
  ["johannesburg", "Johannesburg"], ["durban", "Durban"], ["cape-town", "Cape Town"],
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-night text-white/75">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <LogoArtwork className="-ml-3 w-56" />
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-white/60">
            A South African guide to the food spots, services, shops and hidden gems right around you.
          </p>
        </div>
        <FooterCol title="Towns" links={[...TOWN_LINKS.map(([s, n]) => [`/towns/${s}`, n] as const), ["/towns", "All towns →"]]} />
        <FooterCol title="Categories" links={[...CATEGORY_GROUPS.map((g) => [`/categories#${g.slug}`, g.shortName] as const), ["/discover", "Hidden gems"]]} />
        <FooterCol
          title="OFENTSE-FINDS"
          links={[
            ["/list-your-business", "List your business"],
            ["/favourites", "Your favourites"],
            ["/about", "About our data"],
            ["/admin", "Admin"],
          ]}
        />
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} OFENTSE-FINDS. Discover more. Right around you.</p>
          <p>
            Map data ©{" "}
            <a className="underline-offset-2 hover:text-white hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap contributors
            </a>{" "}
            · Town info from Wikipedia
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div>
      <h2 className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.14em] text-mint">{title}</h2>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
