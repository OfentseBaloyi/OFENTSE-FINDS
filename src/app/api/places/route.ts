import { NextResponse, type NextRequest } from "next/server";
import { parseSelection } from "@/lib/categories";
import { rateLimit } from "@/lib/cache";
import { isInSouthAfrica } from "@/lib/geo";
import { getPlaces } from "@/lib/places";
import { clientIp } from "@/lib/server/request";
import { getTownBySlug } from "@/lib/towns";

export async function GET(req: NextRequest) {
  if (!rateLimit(`places:${await clientIp()}`, 40, 60_000)) {
    return NextResponse.json({ places: [], warnings: [], error: "You're searching very quickly — please wait a moment and try again." }, { status: 429 });
  }

  const sp = req.nextUrl.searchParams;
  const selection = parseSelection(sp.get("category"));
  const townSlug = sp.get("town");

  let area: { latitude: number; longitude: number; radiusKm: number; townSlug?: string } | null = null;
  if (townSlug) {
    const town = await getTownBySlug(townSlug).catch(() => null);
    if (!town) return NextResponse.json({ places: [], warnings: [], error: "We couldn't find that town." }, { status: 404 });
    area = { latitude: town.latitude, longitude: town.longitude, radiusKm: town.radiusKm, townSlug: town.slug };
  } else {
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const radius = Math.min(Math.max(Number(sp.get("radius")) || 3, 0.5), 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInSouthAfrica(lat, lng)) {
      return NextResponse.json({ places: [], warnings: [], error: "OFENTSE-FINDS currently covers South Africa only." }, { status: 400 });
    }
    area = { latitude: lat, longitude: lng, radiusKm: radius };
  }

  const result = await getPlaces(area, selection);
  return NextResponse.json(result, {
    status: result.error ? 503 : 200,
    headers: {
      "Cache-Control": result.error ? "no-store" : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      // Netlify's CDN ignores query strings by default — without this every town/category shares one cached answer
      "Netlify-Vary": "query",
    },
  });
}
