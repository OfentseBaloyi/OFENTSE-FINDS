import "server-only";
import { memo } from "@/lib/cache";
import { createServerSupabase, isMissingTableError, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Place, Town, TownKind } from "@/lib/types";
import { safeHttpUrl } from "@/lib/utils";

export type DbStatus = "ok" | "not_migrated" | "unreachable" | "unconfigured";

export function getDbStatus(): Promise<DbStatus> {
  if (!isSupabaseConfigured) return Promise.resolve("unconfigured");
  return memo("db:status", 60_000, async () => {
    const sb = createServerSupabase()!;
    try {
      const { error } = await sb.from("towns").select("id", { head: true, count: "exact" }).limit(1);
      if (!error) return "ok" as const;
      return isMissingTableError(error) ? ("not_migrated" as const) : ("unreachable" as const);
    } catch {
      return "unreachable" as const;
    }
  });
}

type TownRow = {
  id: string;
  name: string;
  slug: string;
  province: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_km: number | null;
  kind: string | null;
  cover_image_url: string | null;
  cover_image_credit: string | null;
  cover_image_license: string | null;
  cover_image_source_url: string | null;
  wiki_url: string | null;
};

function rowToTown(r: TownRow): Town {
  const kind = (["city", "town", "suburb"].includes(r.kind ?? "") ? r.kind : "town") as TownKind;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    province: r.province,
    latitude: r.latitude,
    longitude: r.longitude,
    kind,
    radiusKm: Number(r.radius_km ?? 5),
    description: r.description,
    wikiUrl: r.wiki_url,
    cover: r.cover_image_url
      ? { url: r.cover_image_url, credit: r.cover_image_credit, license: r.cover_image_license, sourceUrl: r.cover_image_source_url }
      : null,
    source: "database",
  };
}

/** All towns stored in Supabase (empty when migrations haven't run). Cached for 5 minutes. */
export function getDbTowns(): Promise<Town[]> {
  if (!isSupabaseConfigured) return Promise.resolve([]);
  return memo("db:towns", 5 * 60_000, async () => {
    const sb = createServerSupabase()!;
    const { data, error } = await sb.from("towns").select("*").order("name").limit(2000);
    if (error) {
      if (!isMissingTableError(error)) console.warn("[db] towns:", error.message);
      return [];
    }
    return (data as TownRow[]).map(rowToTown);
  });
}

type BusinessRow = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  image_url: string | null;
  opening_hours: string | null;
  source: string | null;
  source_place_id: string | null;
  verification_status: string;
  rating: number | null;
  review_count: number | null;
  created_at: string;
  category: { slug: string } | null;
  town: { slug: string } | null;
};

const BUSINESS_SELECT =
  "id,name,description,address,latitude,longitude,phone,email,website_url,image_url,opening_hours,source,source_place_id,verification_status,rating,review_count,created_at,category:categories(slug),town:towns(slug)";

function osmUrlFromPlaceId(id: string): string | null {
  const m = /^osm-([nwr])(\d+)$/.exec(id);
  if (!m) return null;
  const type = { n: "node", w: "way", r: "relation" }[m[1] as "n" | "w" | "r"];
  return `https://www.openstreetmap.org/${type}/${m[2]}`;
}

function rowToPlace(r: BusinessRow): Place | null {
  if (r.latitude == null || r.longitude == null) return null; // listings without real coordinates can't go on the map
  return {
    id: `sb-${r.id}`,
    name: r.name,
    categorySlug: r.category?.slug ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    address: r.address,
    phone: r.phone,
    website: safeHttpUrl(r.website_url),
    email: r.email,
    openingHours: r.opening_hours,
    description: r.description,
    cuisine: null,
    imageUrl: safeHttpUrl(r.image_url),
    source: "supabase",
    sourceUrl: r.source === "osm" && r.source_place_id ? osmUrlFromPlaceId(r.source_place_id) : null,
    sourcePlaceId: r.source_place_id,
    verified: r.verification_status === "verified",
    rating: r.rating,
    reviewCount: r.review_count,
    townSlug: r.town?.slug ?? null,
    createdAt: r.created_at,
  };
}

type BusinessQuery = {
  townSlug?: string;
  categorySlugs?: string[];
  verifiedOnly?: boolean;
  order?: "recent" | "name";
  limit?: number;
};

/** Listings stored in Supabase. Returns [] (not an error) when the tables don't exist yet. */
export async function getDbBusinesses(q: BusinessQuery): Promise<Place[]> {
  if (!isSupabaseConfigured) return [];
  return memo(`db:biz:${JSON.stringify(q)}`, 60_000, async () => {
    const sb = createServerSupabase()!;
    let select = BUSINESS_SELECT;
    if (q.townSlug) select = select.replace("town:towns(slug)", "town:towns!inner(slug)");
    if (q.categorySlugs?.length) select = select.replace("category:categories(slug)", "category:categories!inner(slug)");
    let query = sb.from("businesses").select(select).neq("verification_status", "suspended");
    if (q.townSlug) query = query.eq("town.slug", q.townSlug);
    if (q.categorySlugs?.length) query = query.in("category.slug", q.categorySlugs);
    if (q.verifiedOnly) query = query.eq("verification_status", "verified");
    query = q.order === "recent" ? query.order("created_at", { ascending: false }) : query.order("name");
    const { data, error } = await query.limit(q.limit ?? 300);
    if (error) {
      if (!isMissingTableError(error)) console.warn("[db] businesses:", error.message);
      return [];
    }
    return (data as unknown as BusinessRow[]).map(rowToPlace).filter((p): p is Place => p !== null);
  });
}

/** Listings near a point (used for "near me"). Bounding-box filter in SQL, exact distance later. */
export async function getDbBusinessesNear(lat: number, lng: number, radiusKm: number, categorySlugs?: string[]): Promise<Place[]> {
  if (!isSupabaseConfigured) return [];
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return memo(`db:near:${lat.toFixed(3)},${lng.toFixed(3)},${radiusKm},${categorySlugs?.join("|")}`, 60_000, async () => {
    const sb = createServerSupabase()!;
    let select = BUSINESS_SELECT;
    if (categorySlugs?.length) select = select.replace("category:categories(slug)", "category:categories!inner(slug)");
    let query = sb
      .from("businesses")
      .select(select)
      .neq("verification_status", "suspended")
      .gte("latitude", lat - dLat)
      .lte("latitude", lat + dLat)
      .gte("longitude", lng - dLng)
      .lte("longitude", lng + dLng);
    if (categorySlugs?.length) query = query.in("category.slug", categorySlugs);
    const { data, error } = await query.limit(300);
    if (error) {
      if (!isMissingTableError(error)) console.warn("[db] businesses near:", error.message);
      return [];
    }
    return (data as unknown as BusinessRow[]).map(rowToPlace).filter((p): p is Place => p !== null);
  });
}

export async function getDbBusinessById(uuid: string): Promise<Place | null> {
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(uuid)) return null;
  const sb = createServerSupabase()!;
  const { data, error } = await sb
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("id", uuid)
    .neq("verification_status", "suspended")
    .maybeSingle();
  if (error || !data) return null;
  return rowToPlace(data as unknown as BusinessRow);
}
