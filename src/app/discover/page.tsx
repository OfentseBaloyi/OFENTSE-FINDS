import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { PlaceCard } from "@/components/place-card";
import { ButtonLink, EmptyState, Notice, SectionHeading } from "@/components/ui";
import { getCategory, parseSelection } from "@/lib/categories";
import { getPlaces } from "@/lib/places";
import { topPlaces } from "@/lib/ranking";
import { getKnownTowns, getTownBySlug } from "@/lib/towns";

export const metadata: Metadata = {
  title: "Discover",
  description: "Hidden gems, attractions, parks, nightlife and things to do around South African towns.",
};

export const dynamic = "force-dynamic";

const SECTIONS = ["hidden-gems", "tourist-attractions", "parks", "entertainment", "bars-nightlife", "events"] as const;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ town?: string }> }) {
  const { town: townParam } = await searchParams;
  const slug = townParam || process.env.FEATURED_TOWN || "pretoria";
  const [town, known] = await Promise.all([getTownBySlug(slug).catch(() => null), getKnownTowns()]);
  const options = [...known].sort((a, b) => a.name.localeCompare(b.name));

  const result = town
    ? await getPlaces({ latitude: town.latitude, longitude: town.longitude, radiusKm: town.radiusKm, townSlug: town.slug }, parseSelection("group:lifestyle"))
    : null;

  return (
    <div className="container-page pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Discover</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Things to do{town ? ` around ${town.name}` : ""}.
          </h1>
          <p className="mt-3 max-w-xl text-muted">Heritage sites, viewpoints, parks, venues and nightlife — the places that give a town its character.</p>
        </div>
        <form method="get" action="/discover" className="flex gap-2">
          <label htmlFor="discover-town" className="sr-only">Town</label>
          <select id="discover-town" name="town" defaultValue={town?.slug ?? ""} className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 text-sm font-medium sm:w-56">
            {options.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="h-11 rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900">Go</button>
        </form>
      </div>

      {!town ? (
        <EmptyState icon={<Compass className="h-5 w-5" />} title="Pick a town to discover" className="mt-10" />
      ) : result?.error ? (
        <EmptyState icon={<Compass className="h-5 w-5" />} title="Discovery is taking a break" className="mt-10" actions={<ButtonLink href={`/discover?town=${town.slug}`}>Try again</ButtonLink>}>
          {result.error}
        </EmptyState>
      ) : (
        <>
          {result?.warnings.map((w) => (
            <Notice key={w} tone="warn" className="mt-8">
              {w}
            </Notice>
          ))}
          {SECTIONS.map((slug) => {
            const cat = getCategory(slug)!;
            const places = topPlaces((result?.places ?? []).filter((p) => p.categorySlug === slug), 4);
            if (places.length === 0) return null;
            return (
              <section key={slug} className="pt-16">
                <SectionHeading
                  eyebrow={cat.name}
                  title={cat.description.replace(/\.$/, "").split(". ")[0]}
                  action={{ href: `/towns/${town.slug}?category=${slug}#explore`, label: `All ${cat.name.toLowerCase()} on the map` }}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {places.map((p) => (
                    <PlaceCard key={p.id} place={p} />
                  ))}
                </div>
              </section>
            );
          })}
          {(result?.places.length ?? 0) === 0 && (
            <EmptyState icon={<CategoryIcon slug="hidden-gems" className="h-5 w-5" />} title={`Nothing mapped around ${town.name} yet`} className="mt-10" actions={<ButtonLink href="/list-your-business" variant="secondary">Suggest a place</ButtonLink>}>
              Open map data is still thin in many neighbourhoods. Know a spot? Add it.
            </EmptyState>
          )}
        </>
      )}
    </div>
  );
}
