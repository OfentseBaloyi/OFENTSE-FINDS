import "server-only";
import { createThrottle, memo } from "@/lib/cache";
import { isInSouthAfrica } from "@/lib/geo";
import { cachedFetch } from "@/lib/server/disk-cache";
import { OSM_USER_AGENT } from "@/lib/providers/overpass";
import type { TownKind } from "@/lib/types";

// Geocoding via Nominatim. Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// max 1 request/second, identify the app, cache results, and NO autocomplete-as-you-type.
// We only call Nominatim when a user submits a town we don't already know, or when an admin
// looks up an address — never per keystroke.

const BASE = "https://nominatim.openstreetmap.org";
const TTL = 7 * 24 * 60 * 60 * 1000;
const throttle = createThrottle(1100);

type NominatimResult = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type: string;
  addresstype?: string;
  address?: Record<string, string>;
};

async function search(params: Record<string, string>): Promise<NominatimResult[]> {
  const url = new URL(`${BASE}/search`);
  url.search = new URLSearchParams({ format: "jsonv2", countrycodes: "za", addressdetails: "1", ...params }).toString();
  return memo(`nominatim:${url}`, TTL, () =>
    cachedFetch(`nominatim:${url}`, 30 * TTL, 90 * TTL, () => throttle(async () => {
      const res = await fetch(url, {
        headers: { "User-Agent": OSM_USER_AGENT, Accept: "application/json", "Accept-Language": "en" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      return (await res.json()) as NominatimResult[];
    })),
  );
}

const SETTLEMENT_TYPES = new Set(["city", "town", "village", "suburb", "township", "quarter", "neighbourhood", "hamlet", "locality", "municipality", "borough", "city_district", "residential"]);

export type GeocodedTown = {
  name: string;
  province: string | null;
  latitude: number;
  longitude: number;
  kind: TownKind;
  radiusKm: number;
  displayName: string;
};

export async function geocodeTown(query: string): Promise<GeocodedTown | null> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return null;
  const results = await search({ q, limit: "5" });
  const r =
    results.find((x) => SETTLEMENT_TYPES.has(x.addresstype ?? x.type) || x.category === "place") ??
    results.find((x) => x.category === "boundary");
  if (!r) return null;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!isInSouthAfrica(lat, lng)) return null;
  const type = r.addresstype ?? r.type;
  const kind: TownKind = type === "city" ? "city" : type === "town" || type === "municipality" ? "town" : "suburb";
  return {
    name: r.name || r.display_name.split(",")[0],
    province: r.address?.state ?? null,
    latitude: lat,
    longitude: lng,
    kind,
    radiusKm: kind === "city" ? 9 : kind === "town" ? 5 : 3.5,
    displayName: r.display_name,
  };
}

export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number; displayName: string } | null> {
  const q = address.trim().slice(0, 200);
  if (q.length < 4) return null;
  const r = (await search({ q, limit: "1" }))[0];
  if (!r) return null;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!isInSouthAfrica(lat, lng)) return null;
  return { latitude: lat, longitude: lng, displayName: r.display_name };
}
