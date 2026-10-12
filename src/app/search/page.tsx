import type { Metadata } from "next";
import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Explorer, type ExplorerArea } from "@/components/explorer/explorer";
import { NearMeLocator } from "@/components/near-me-locator";
import { SearchBar } from "@/components/search-bar";
import { TownCard } from "@/components/town-card";
import { EmptyState, SectionHeading } from "@/components/ui";
import { parseSelection, selectionLabel, selectionValue, type Selection } from "@/lib/categories";
import { isInSouthAfrica } from "@/lib/geo";
import { getPlaces } from "@/lib/places";
import type { SortKey } from "@/lib/ranking";
import { parseSearchQuery } from "@/lib/search-parse";
import { getFeaturedTowns, getKnownTowns, getNearbyTowns, getNearestTown, getTownBySlug, resolveTownText } from "@/lib/towns";
import type { Town } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 200);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = one((await searchParams).q);
  return { title: q ? `“${q}”` : "Search", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawQ = one(sp.q) ?? "";
  const parsed = parseSearchQuery(rawQ);

  // explicit params win over what we parsed from the sentence
  const explicitCategory = one(sp.category);
  const selection: Selection = explicitCategory ? parseSelection(explicitCategory) : (parsed.selection ?? { kind: "all" });
  const keyword = parsed.keyword ?? "";
  const sortParam = one(sp.sort);
  const sort: SortKey = sortParam === "nearest" || sortParam === "rating" || sortParam === "reviews" ? sortParam : parsed.nearMe ? "nearest" : "recommended";

  const known = await getKnownTowns();
  const townOptions = known.map((t) => ({ slug: t.slug, name: t.name, province: t.province })).sort((a, b) => a.name.localeCompare(b.name));

  // ── work out WHERE ────────────────────────────────────────────────
  const lat = Number(one(sp.lat));
  const lng = Number(one(sp.lng));
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && one(sp.lat) !== undefined && isInSouthAfrica(lat, lng);
  const wantsNearMe = parsed.nearMe || one(sp.near) === "me";

  let town: Town | null = null;
  let whereText: string | null = null;
  if (!hasPoint) {
    const townSlug = one(sp.town);
    whereText = one(sp.where) ?? parsed.townText;
    if (townSlug) town = await getTownBySlug(townSlug).catch(() => null);
    else if (whereText) town = await resolveTownText(whereText).catch(() => null);
  }

  // "near me" without coordinates yet → ask the browser
  if (!hasPoint && !town && wantsNearMe) {
    return (
      <div className="container-page pt-10">
        <NearMeLocator category={selectionValue(selection)} keyword={keyword} />
      </div>
    );
  }

  // nothing to search around yet → picker
  if (!hasPoint && !town) {
    const featured = await getFeaturedTowns();
    return (
      <div className="container-page pt-10 sm:pt-14">
        <p className="eyebrow">Search</p>
        <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">{selection.kind !== "all" ? `Find ${selectionLabel(selection).toLowerCase()}` : "What are you looking for?"}</h1>
        <p className="mt-3 max-w-xl text-muted">Try a sentence like “Kota in Mabopane”, “Mechanic in Soshanguve” or “Pharmacy near me”.</p>
        <SearchBar towns={townOptions} variant="inline" defaultCategory={selectionValue(selection) ?? ""} defaultKeyword={keyword} className="mt-8" />
        {whereText && (
          <EmptyState icon={<MapPinOff className="h-5 w-5" />} title={`We couldn't find “${whereText}”`} className="mt-8">
            Check the spelling, or try the name of a nearby town or suburb. OFENTSE-FINDS currently covers South Africa.
          </EmptyState>
        )}
        <section className="pt-12">
          <SectionHeading title="Or pick a popular town" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.slice(0, 8).map((t) => (
              <TownCard key={t.slug} town={t} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── search ────────────────────────────────────────────────────────
  let area: ExplorerArea;
  let fixedParams: Record<string, string>;
  let basePath = "/search";
  let nearby: Array<{ slug: string; name: string }> = [];
  let heading: string;

  if (hasPoint) {
    const nearest = await getNearestTown(lat, lng);
    const label = nearest && nearest.distanceKm < 8 ? `your area (near ${nearest.name})` : "your area";
    area = { kind: "point", label, latitude: lat, longitude: lng, radiusKm: 3 };
    fixedParams = { lat: lat.toFixed(4), lng: lng.toFixed(4) };
    if (nearest) nearby = (await getNearbyTowns(nearest, 4)).map((t) => ({ slug: t.slug, name: t.name }));
    heading = `${selectionLabel(selection)} near you`;
  } else {
    const t = town!;
    area = { kind: "town", slug: t.slug, name: t.name, latitude: t.latitude, longitude: t.longitude, radiusKm: t.radiusKm };
    fixedParams = { town: t.slug };
    nearby = (await getNearbyTowns(t, 4)).map((x) => ({ slug: x.slug, name: x.name }));
    heading = `${selectionLabel(selection)} in ${t.name}`;
    basePath = "/search";
  }

  const result = await getPlaces(
    { latitude: area.latitude, longitude: area.longitude, radiusKm: area.radiusKm, townSlug: area.kind === "town" ? area.slug : undefined },
    selection,
  );

  return (
    <div className="container-page pt-8">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{rawQ ? `Results for “${rawQ}”` : "Search results"}</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{heading}</h1>
          {keyword && <p className="mt-1 text-sm text-muted">Filtered by “{keyword}”</p>}
        </div>
        {area.kind === "town" && (
          <Link href={`/towns/${area.slug}`} className="text-sm font-semibold text-teal-700 hover:underline">
            About {area.name} →
          </Link>
        )}
      </div>
      <Explorer
        key={`${JSON.stringify(fixedParams)}|${selectionValue(selection)}|${keyword}`}
        area={area}
        initialSelection={selectionValue(selection)}
        initialResult={result}
        initialKeyword={keyword}
        initialSort={sort}
        initialOpenNow={one(sp.open) === "1"}
        basePath={basePath}
        fixedParams={fixedParams}
        nearbyTowns={nearby}
      />
    </div>
  );
}
