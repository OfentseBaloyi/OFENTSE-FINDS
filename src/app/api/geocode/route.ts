import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/cache";
import { geocodeAddress } from "@/lib/providers/nominatim";
import { clientIp } from "@/lib/server/request";

// Address lookup used by the admin approval screen. Results are suggestions only — an admin
// confirms the pin on the map before a listing is published.
export async function GET(req: NextRequest) {
  if (!rateLimit(`geocode:${await clientIp()}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many lookups — wait a minute." }, { status: 429 });
  }
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (address.length < 4 || address.length > 200) return NextResponse.json({ error: "Enter a longer address." }, { status: 400 });
  try {
    const result = await geocodeAddress(address);
    if (!result) return NextResponse.json({ error: "No match found. Place the pin manually." }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "The address service is unavailable right now." }, { status: 503 });
  }
}
