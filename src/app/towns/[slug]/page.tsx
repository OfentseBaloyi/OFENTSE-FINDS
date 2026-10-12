import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, ExternalLink, Landmark } from "lucide-react";
import { Icon } from "@/components/category-icon";
import { Explorer } from "@/components/explorer/explorer";
import { PlaceCard } from "@/components/place-card";
import { RememberTown } from "@/components/remember-town";
import { TownCard } from "@/components/town-card";
import { CoverCredit, TownCover } from "@/components/town-cover";
import { CardSkeletonRow, SectionHeading } from "@/components/ui";
import { CATEGORY_GROUPS, parseSelection, selectionValue } from "@/lib/categories";
import { getPlaces } from "@/lib/places";
import { topPlaces, type SortKey } from "@/lib/ranking";
import { getNearbyTowns, getTownBySlug } from "@/lib/towns";
import type { Town } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const town = await getTownBySlug(slug).catch(() => null);
  if (!town) return { title: "Town not found" };
  return {
    title: `Discover ${town.name}`,
    description: `Food spots, mechanics, car washes, shops, attractions and hidden gems in ${town.name}${town.province ? `, ${town.province}` : ""} — on an interactive map.`,
    openGraph: town.cover ? { images: [{ url: town.cover.url }] } : undefined,
  };
}

function fallbackDescription(town: Town) {
  const where = town.province ? `in ${town.province}` : "in South Africa";
  return town.kind === "city"
    ? `${town.name} is a city ${where}. Explore its food spots, services, shops and places to visit below.`
    : `${town.name} is a ${town.kind === "suburb" ? "neighbourhood" : "town"} ${where}. Explore what's around you below.`;
}

export default async function TownPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const town = await getTownBySlug(slug).catch(() => null);
  if (!town) notFound();

  const selection = parseSelection(one(sp.category));
  const sortParam = one(sp.sort);
  const sort: SortKey = sortParam === "nearest" || sortParam === "rating" || sortParam === "reviews" ? sortParam : "recommended";

  const [result, nearby] = await Promise.all([
    getPlaces({ latitude: town.latitude, longitude: town.longitude, radiusKm: town.radiusKm, townSlug: town.slug }, selection),
    getNearbyTowns(town, 6),
  ]);

  return (
    <>
      <RememberTown slug={town.slug} name={town.name} />

      {/* ── Cover ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-teal-900 text-white">
        <TownCover town={town} eager className="absolute inset-0 -z-20 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(6_35_33/0.92),rgb(6_35_33/0.55)_60%,rgb(6_35_33/0.35))]" />
        <div className="container-page pb-10 pt-10 sm:pb-14 sm:pt-16">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-white/70">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link href="/towns" className="hover:text-white">Towns</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-white">{town.name}</span>
          </nav>
          <p className="eyebrow mt-6 !text-mint">{[town.province, "South Africa"].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-none sm:text-6xl">{town.name}</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-base">
            {town.description ?? fallbackDescription(town)}
            {town.wikiUrl && (
              <a href={town.wikiUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-white/60 underline-offset-2 hover:text-white hover:underline">
                Wikipedia <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </p>

          <div className="no-scrollbar -mx-4 mt-7 flex gap-2 overflow-x-auto px-4">
            {CATEGORY_GROUPS.map((g) => (
              <Link
                key={g.slug}
                href={`/towns/${town.slug}?category=group:${g.slug}#explore`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition hover:bg-white hover:text-ink"
              >
                <Icon name={g.icon} className="h-4 w-4" />
                {g.shortName}
              </Link>
            ))}
          </div>
        </div>
        <CoverCredit town={town} className="absolute bottom-2 right-3" />
      </section>

      {/* ── Map + results ─────────────────────────────────────── */}
      <section id="explore" className="container-page scroll-mt-16">
        <Explorer
          key={`${town.slug}|${selectionValue(selection)}`}
          area={{ kind: "town", slug: town.slug, name: town.name, latitude: town.latitude, longitude: town.longitude, radiusKm: town.radiusKm }}
          initialSelection={selectionValue(selection)}
          initialResult={result}
          initialKeyword={one(sp.q) ?? ""}
          initialSort={sort}
          initialOpenNow={one(sp.open) === "1"}
          basePath={`/towns/${town.slug}`}
          nearbyTowns={nearby.map((t) => ({ slug: t.slug, name: t.name }))}
        />
      </section>

      {/* ── Landmarks ─────────────────────────────────────────── */}
      <Suspense
        fallback={
          <section className="container-page pt-20">
            <div className="skeleton mb-6 h-8 w-80 max-w-full" />
            <CardSkeletonRow />
          </section>
        }
      >
        <Landmarks town={town} />
      </Suspense>

      {/* ── Nearby towns ──────────────────────────────────────── */}
      {nearby.length > 0 && (
        <section className="container-page pt-20">
          <SectionHeading eyebrow="Nearby" title={`Towns and suburbs near ${town.name}`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {nearby.map((t) => (
              <TownCard key={t.slug} town={t} distanceKm={t.distanceKm} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

async function Landmarks({ town }: { town: Town }) {
  const result = await getPlaces(
    { latitude: town.latitude, longitude: town.longitude, radiusKm: town.radiusKm, townSlug: town.slug },
    parseSelection("group:lifestyle"),
  );
  const picks = topPlaces(
    result.places.filter((p) => ["tourist-attractions", "hidden-gems", "parks", "entertainment"].includes(p.categorySlug ?? "")),
    4,
  );
  if (picks.length === 0) return null;
  return (
    <section className="container-page pt-20">
      <SectionHeading
        eyebrow="Popular local places"
        title={`Landmarks & places to visit in ${town.name}`}
        description="Attractions, parks, heritage sites and entertainment."
        action={{ href: `/towns/${town.slug}?category=group:lifestyle#explore`, label: "All lifestyle places" }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map((p) => (
          <PlaceCard key={p.id} place={p} />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Landmark className="h-3.5 w-3.5" aria-hidden /> Chosen by how complete their information is, not by paid placement.
      </p>
    </section>
  );
}
