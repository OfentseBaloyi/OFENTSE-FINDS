import "server-only";
import { CATEGORIES, classifyTags, type Category } from "@/lib/categories";
import type { OsmFilter } from "@/data/categories";
import { createLimiter, memo } from "@/lib/cache";
import { cachedFetch } from "@/lib/server/disk-cache";
import { safeHttpUrl } from "@/lib/utils";
import type { Place } from "@/lib/types";

// OpenStreetMap place data via the Overpass API.
// Usage policy: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
// We keep requests low by: caching every query for 12h (in memory + on disk, served stale for up
// to 30 days if Overpass is down), de-duplicating in-flight requests, a circuit breaker,
// allowing at most 2 concurrent queries, and capping radius + result counts.

const ENDPOINTS = (process.env.OVERPASS_URLS ?? "https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.private.coffee/api/interpreter")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TTL = 12 * 60 * 60 * 1000;
const limit = createLimiter(2);

export const OSM_USER_AGENT = `OFENTSE-FINDS/0.1 (+${process.env.OSM_CONTACT ?? "https://github.com"})`;

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

function filterToOverpass(f: OsmFilter, requireName: boolean): string {
  let out = "";
  for (const [k, v] of Object.entries(f.tags)) {
    if (v === true) out += `["${esc(k)}"]`;
    else if (v.length === 1) out += `["${esc(k)}"="${esc(v[0])}"]`;
    else out += `["${esc(k)}"~"^(${v.map(esc).join("|")})$"]`;
  }
  for (const [k, pattern] of Object.entries(f.regex ?? {})) out += `["${esc(k)}"~"${esc(pattern)}",i]`;
  if (requireName && !f.regex?.name && !("name" in f.tags)) out += `["name"]`;
  return out;
}

/** Unnamed places aren't useful to browse, except ATMs (named by operator/brand). */
const NAME_OPTIONAL = new Set(["atms"]);

/**
 * Area-first query: collect every *named* feature in the circle once (`.n`), then filter that
 * small set by tags. Much lighter on the Overpass server than one spatial scan per tag filter.
 */
export function buildAroundQuery(categories: Category[], lat: number, lng: number, radiusM: number, max: number): string {
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(6)},${lng.toFixed(6)})`;
  const clauses = new Set<string>();
  for (const c of categories) {
    for (const f of c.osm) {
      if (NAME_OPTIONAL.has(c.slug)) clauses.add(`nwr${filterToOverpass(f, false)}${around};`);
      else clauses.add(`nwr.n${filterToOverpass(f, false)};`);
    }
  }
  return `[out:json][timeout:25];nwr${around}["name"]->.n;(${[...clauses].join("")});out center tags ${max};`;
}

async function runQuery(query: string): Promise<OsmElement[]> {
  // fresh for 12h; if Overpass is down, serve results up to 30 days old rather than nothing
  return cachedFetch(`overpass:${query}`, TTL, 30 * 24 * 60 * 60 * 1000, () => runQueryLive(query));
}

// Circuit breaker: when every mirror is failing, stop hammering them (and stop making visitors
// wait) for a short cool-down. Cached results are still served during the cool-down.
const breaker = globalThis as unknown as { __ofOverpassDownUntil?: number };
const COOL_DOWN_MS = 60_000;

async function runQueryLive(query: string): Promise<OsmElement[]> {
  if ((breaker.__ofOverpassDownUntil ?? 0) > Date.now()) throw new Error("Overpass cooling down after recent failures");
  try {
    const elements = await tryEndpoints(query);
    breaker.__ofOverpassDownUntil = 0;
    return elements;
  } catch (e) {
    breaker.__ofOverpassDownUntil = Date.now() + COOL_DOWN_MS;
    throw e;
  }
}

async function tryEndpoints(query: string): Promise<OsmElement[]> {
  let lastError: unknown = null;
  const started = Date.now();
  for (const endpoint of ENDPOINTS) {
    if (Date.now() - started > 25_000) break; // don't keep a visitor waiting on every mirror
    try {
      const res = await limit(() =>
        fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": OSM_USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(15_000),
          cache: "no-store", // cached by memo() + disk cache instead
        }),
      );
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status} from ${new URL(endpoint).host}`);
        continue; // 429/504 → try the next mirror
      }
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      if (json.remark && /runtime error|timed out/i.test(json.remark) && !json.elements?.length) {
        lastError = new Error(`Overpass: ${json.remark}`);
        continue;
      }
      return json.elements ?? [];
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("OpenStreetMap data is unavailable");
}

const TYPE_PREFIX = { node: "n", way: "w", relation: "r" } as const;
const PREFIX_TYPE = { n: "node", w: "way", r: "relation" } as const;

export function osmPlaceId(type: OsmElement["type"], id: number) {
  return `osm-${TYPE_PREFIX[type]}${id}`;
}

export function parseOsmPlaceId(placeId: string): { type: OsmElement["type"]; id: number } | null {
  const m = /^osm-([nwr])(\d{1,15})$/.exec(placeId);
  return m ? { type: PREFIX_TYPE[m[1] as "n" | "w" | "r"], id: Number(m[2]) } : null;
}

function buildAddress(t: Record<string, string>): string | null {
  if (t["addr:full"]) return t["addr:full"];
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const parts = [street, t["addr:suburb"], t["addr:city"] ?? t["addr:town"] ?? t["addr:place"], t["addr:postcode"]].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(", ") : null;
}

function imageFromTags(t: Record<string, string>): string | null {
  const img = safeHttpUrl(t.image);
  if (img && /\.(jpe?g|png|webp)(\?|$)/i.test(img)) return img;
  return null;
}

function displayName(t: Record<string, string>, category: Category | undefined): string | null {
  if (t.name) return t.name;
  const org = t.brand ?? t.operator;
  if (org && category?.slug === "atms") return `${org} ATM`;
  if (category?.slug === "atms") return "ATM";
  return null;
}

export function elementToPlace(el: OsmElement, candidates: Category[] = CATEGORIES): Place | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null; // never invent coordinates
  const category = classifyTags(tags, candidates);
  const name = displayName(tags, category);
  if (!name) return null;
  return {
    id: osmPlaceId(el.type, el.id),
    name,
    categorySlug: category?.slug ?? null,
    latitude: lat,
    longitude: lon,
    address: buildAddress(tags),
    phone: tags.phone ?? tags["contact:phone"] ?? tags.mobile ?? tags["contact:mobile"] ?? null,
    website: safeHttpUrl(tags.website ?? tags["contact:website"] ?? tags.url),
    email: tags.email ?? tags["contact:email"] ?? null,
    openingHours: tags.opening_hours ?? null,
    description: tags.description ?? null,
    cuisine: tags.cuisine ? tags.cuisine.replace(/_/g, " ").replace(/;/g, ", ") : null,
    imageUrl: imageFromTags(tags),
    source: "osm",
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    verified: false,
    rating: null, // OpenStreetMap has no ratings — we never make them up
    reviewCount: null,
    townSlug: null,
    createdAt: null,
  };
}

// Places we've already loaded in a list, so detail pages work instantly (and during outages).
const index = ((globalThis as unknown as { __ofPlaceIndex?: Map<string, Place> }).__ofPlaceIndex ??= new Map());
function remember(p: Place) {
  index.set(p.id, p);
  if (index.size > 20_000) index.delete(index.keys().next().value!);
}

export async function fetchOsmPlacesAround(opts: {
  categories: Category[];
  lat: number;
  lng: number;
  radiusKm: number;
  max?: number;
}): Promise<Place[]> {
  const radiusM = Math.min(Math.max(opts.radiusKm, 0.5), 15) * 1000;
  const max = Math.min(opts.max ?? 400, 600);
  const query = buildAroundQuery(opts.categories, opts.lat, opts.lng, radiusM, max);
  const elements = await memo(`overpass:${query}`, TTL, () => runQuery(query));
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const el of elements) {
    const p = elementToPlace(el, opts.categories);
    if (!p || !p.categorySlug || seen.has(p.id)) continue;
    seen.add(p.id);
    remember(p);
    places.push({ ...p });
  }
  return places;
}

export async function fetchOsmPlaceById(placeId: string): Promise<Place | null> {
  const ref = parseOsmPlaceId(placeId);
  if (!ref) return null;
  const known = index.get(placeId);
  if (known) return { ...known };
  const query = `[out:json][timeout:15];${ref.type}(${ref.id});out center tags 1;`;
  const elements = await memo(`overpass:${query}`, TTL, () => runQuery(query));
  return elements[0] ? elementToPlace(elements[0]) : null;
}
