import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { TownCard } from "@/components/town-card";
import { SectionHeading } from "@/components/ui";
import { getFeaturedTowns, getKnownTowns } from "@/lib/towns";

export const metadata: Metadata = {
  title: "Explore towns",
  description: "Browse South African towns, townships, suburbs and cities on OFENTSE-FINDS.",
};

export const dynamic = "force-dynamic";

export default async function TownsPage() {
  const [all, featured] = await Promise.all([getKnownTowns(), getFeaturedTowns()]);
  const options = all.map((t) => ({ slug: t.slug, name: t.name, province: t.province })).sort((a, b) => a.name.localeCompare(b.name));

  const byProvince = new Map<string, typeof all>();
  for (const t of [...all].sort((a, b) => a.name.localeCompare(b.name))) {
    const p = t.province ?? "Other";
    byProvince.set(p, [...(byProvince.get(p) ?? []), t]);
  }
  const provinces = [...byProvince.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="container-page pt-10 sm:pt-14">
      <p className="eyebrow">Explore towns</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">Every neighbourhood has its spots.</h1>
      <p className="mt-3 max-w-xl text-muted">Choose a town below or search for any town or suburb in South Africa — not just the ones listed here.</p>
      <SearchBar towns={options} variant="inline" className="mt-8" />

      <section className="pt-14">
        <SectionHeading eyebrow="Popular towns" title="Popular places to start" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((t) => (
            <TownCard key={t.slug} town={t} />
          ))}
        </div>
      </section>

      <section className="pt-16">
        <SectionHeading eyebrow="A–Z" title="All towns by province" description="Can't see yours? Type it into the search above and we'll find it." />
        <div className="columns-1 gap-8 sm:columns-2 lg:columns-3">
          {provinces.map(([province, towns]) => (
            <div key={province} className="mb-8 break-inside-avoid">
              <h2 className="mb-2 border-b border-line pb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-teal-700">{province}</h2>
              <ul className="grid grid-cols-2 gap-x-4">
                {towns.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/towns/${t.slug}`} className="block py-1.5 text-[15px] text-ink-2 hover:text-teal-700 hover:underline">
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
