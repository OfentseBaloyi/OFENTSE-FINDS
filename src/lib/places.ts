import "server-only";
import { getDbBusinesses, getDbBusinessById, getDbBusinessesNear } from "@/lib/db";
import { distanceKm } from "@/lib/geo";
import { selectionCategories, type Selection } from "@/lib/categories";
import { fetchOsmPlaceById, fetchOsmPlacesAround } from "@/lib/providers/overpass";
import type { Place, PlacesResult } from "@/lib/types";

// The places data-provider layer. Each provider returns `Place` objects with real coordinates;
// this module merges them, de-duplicates and annotates distance. Add another provider (e.g. a
// commercial Places API) by fetching it here alongside OSM and merging the same way.

type Area = { latitude: number; longitude: number; radiusKm: number; townSlug?: string };

const OSM_BUSY_WARNING = "OpenStreetMap's free map-data service is busy, so only our own listings are shown. Try again in a minute for the full picture.";
const OSM_BUSY_ERROR = "OpenStreetMap's free map-data service is overloaded right now, so we can't load places. This usually clears within a few minutes.";

export async function getPlaces(area: Area, selection: Selection, opts: { max?: number } = {}): Promise<PlacesResult> {
  const categories = selectionCategories(selection);
  // Browsing "everything" in a city would return thousands of points — keep it to the centre.
  const radiusKm = selection.kind === "all" ? Math.min(area.radiusKm, 2.5) : area.radiusKm;
  const slugs = selection.kind === "all" ? undefined : categories.map((c) => c.slug);

  const [osm, db] = await Promise.allSettled([
    fetchOsmPlacesAround({ categories, lat: area.latitude, lng: area.longitude, radiusKm, max: opts.max ?? 400 }),
    area.townSlug
      ? getDbBusinesses({ townSlug: area.townSlug, categorySlugs: slugs })
      : getDbBusinessesNear(area.latitude, area.longitude, radiusKm, slugs),
  ]);

  const warnings: string[] = [];
  if (osm.status === "rejected") {
    console.warn("[places] OSM failed:", osm.reason instanceof Error ? osm.reason.message : osm.reason);
    warnings.push(OSM_BUSY_WARNING);
  }
  const dbPlaces = db.status === "fulfilled" ? db.value : [];
  const osmPlaces = osm.status === "fulfilled" ? osm.value : [];

  if (osm.status === "rejected" && dbPlaces.length === 0) {
    return { places: [], warnings: [], error: OSM_BUSY_ERROR };
  }

  return { places: mergePlaces(dbPlaces, osmPlaces, area), warnings, error: null };
}

/** Supabase listings win over the OSM record they mirror; then annotate distance. */
export function mergePlaces(dbPlaces: Place[], osmPlaces: Place[], center: { latitude: number; longitude: number }): Place[] {
  const mirrored = new Set(dbPlaces.map((p) => p.sourcePlaceId).filter(Boolean));
  const merged = [...dbPlaces, ...osmPlaces.filter((p) => !mirrored.has(p.id))];
  for (const p of merged) p.distanceKm = distanceKm(center.latitude, center.longitude, p.latitude, p.longitude);
  return merged.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

export async function getPlaceById(id: string): Promise<Place | null> {
  if (id.startsWith("sb-")) return getDbBusinessById(id.slice(3));
  if (id.startsWith("osm-")) return fetchOsmPlaceById(id);
  return null;
}
