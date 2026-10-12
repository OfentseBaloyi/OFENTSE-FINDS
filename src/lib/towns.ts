import "server-only";
import seed from "@/data/towns.generated.json";
import { memo } from "@/lib/cache";
import { getDbTowns } from "@/lib/db";
import { distanceKm } from "@/lib/geo";
import { geocodeTown } from "@/lib/providers/nominatim";
import { getTownWiki } from "@/lib/providers/wikipedia";
import type { Town, TownKind } from "@/lib/types";
import { normalizeText, slugify } from "@/lib/utils";

type SeedTown = (typeof seed)[number];

const SEED_TOWNS: Town[] = (seed as SeedTown[]).map((t) => ({
  slug: t.slug,
  name: t.name,
  province: t.province,
  latitude: t.latitude,
  longitude: t.longitude,
  kind: t.kind as TownKind,
  radiusKm: t.radiusKm,
  description: t.description,
  wikiUrl: t.wikiUrl,
  cover: t.cover,
  source: "seed",
}));

/** The towns featured across the site, in display order. */
export const FEATURED_TOWN_SLUGS = ["mabopane", "soshanguve", "ga-rankuwa", "pretoria", "johannesburg", "midrand", "centurion", "rustenburg", "polokwane", "durban", "cape-town"];

/** Seed towns overlaid with anything stored in Supabase (database wins). */
export async function getKnownTowns(): Promise<Town[]> {
  const db = await getDbTowns();
  const bySlug = new Map(SEED_TOWNS.map((t) => [t.slug, t]));
  for (const t of db) {
    const s = bySlug.get(t.slug);
    // keep seed photo/description if the DB row doesn't have them
    bySlug.set(t.slug, { ...s, ...t, cover: t.cover ?? s?.cover ?? null, description: t.description ?? s?.description ?? null, wikiUrl: t.wikiUrl ?? s?.wikiUrl ?? null });
  }
  return [...bySlug.values()];
}

export async function getFeaturedTowns(): Promise<Town[]> {
  const all = await getKnownTowns();
  return FEATURED_TOWN_SLUGS.map((s) => all.find((t) => t.slug === s)).filter((t): t is Town => Boolean(t));
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Resolves a town by slug: known towns first, then geocoding (so any South African town or
 * suburb works, not just the seed list). Geocoded towns get a Wikipedia description/photo
 * when one exists.
 */
export async function getTownBySlug(slug: string): Promise<Town | null> {
  if (!SLUG_RE.test(slug) || slug.length > 80) return null;
  const known = (await getKnownTowns()).find((t) => t.slug === slug);
  if (known) return known;
  return memo(`town:geo:${slug}`, 24 * 60 * 60 * 1000, async () => {
    const g = await geocodeTown(slug.replace(/-/g, " "));
    if (!g) return null;
    const wiki = await getTownWiki(g.name, g.province).catch(() => null);
    return {
      slug,
      name: g.name,
      province: g.province,
      latitude: g.latitude,
      longitude: g.longitude,
      kind: g.kind,
      radiusKm: g.radiusKm,
      description: wiki?.description ?? null,
      wikiUrl: wiki?.wikiUrl ?? null,
      cover: wiki?.cover ?? null,
      source: "geocoded",
    } satisfies Town;
  });
}

/** Local-only matching for autocomplete (no external calls per keystroke). */
export function matchKnownTowns(towns: Town[], query: string, limit = 8): Town[] {
  const q = normalizeText(query);
  if (!q) return [];
  const qCompact = q.replace(/ /g, "");
  const scored = towns
    .map((t) => {
      const n = normalizeText(t.name);
      const compact = n.replace(/ /g, "");
      let score = -1;
      if (n === q || compact === qCompact) score = 100;
      else if (n.startsWith(q) || compact.startsWith(qCompact)) score = 80;
      else if (n.split(" ").some((w) => w.startsWith(q))) score = 60;
      else if (compact.includes(qCompact)) score = 40;
      else if (normalizeText(t.province ?? "").startsWith(q)) score = 10;
      return { t, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name));
  return scored.slice(0, limit).map((x) => x.t);
}

/**
 * Turns free text ("Ga Rankuwa", "Hatfield, Pretoria") into a town: exact local match first,
 * then a single geocoding request.
 */
export async function resolveTownText(text: string): Promise<Town | null> {
  const clean = text.trim().slice(0, 100);
  if (!clean) return null;
  const known = await getKnownTowns();
  const best = matchKnownTowns(known, clean, 1)[0];
  if (best && normalizeText(best.name).replace(/ /g, "") === normalizeText(clean).replace(/ /g, "")) return best;
  const g = await geocodeTown(clean).catch(() => null);
  if (!g) return best ?? null;
  const slug = slugify(g.name);
  const existing = known.find((t) => t.slug === slug);
  if (existing) return existing;
  return getTownBySlug(slug).then((t) => t ?? null);
}

export async function getNearbyTowns(town: Pick<Town, "slug" | "latitude" | "longitude">, limit = 6): Promise<Array<Town & { distanceKm: number }>> {
  const all = await getKnownTowns();
  return all
    .filter((t) => t.slug !== town.slug)
    .map((t) => ({ ...t, distanceKm: distanceKm(town.latitude, town.longitude, t.latitude, t.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export async function getNearestTown(lat: number, lng: number): Promise<(Town & { distanceKm: number }) | null> {
  const all = await getKnownTowns();
  let best: (Town & { distanceKm: number }) | null = null;
  for (const t of all) {
    const d = distanceKm(lat, lng, t.latitude, t.longitude);
    if (!best || d < best.distanceKm) best = { ...t, distanceKm: d };
  }
  return best;
}
