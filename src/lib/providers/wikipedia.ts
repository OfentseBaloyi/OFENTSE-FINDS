import "server-only";
import { memo } from "@/lib/cache";
import { OSM_USER_AGENT } from "@/lib/providers/overpass";
import type { ImageCredit } from "@/lib/types";

// Town descriptions and cover photos from Wikipedia / Wikimedia Commons (CC-licensed).
// Only used for towns that aren't in our seed data; results are cached for a week.

const TTL = 7 * 24 * 60 * 60 * 1000;
const BAD_IMAGE = /(\.svg$|map|locator|location|flag|coat[_ ]of[_ ]arms|logo|seal|emblem)/i;

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { "User-Agent": OSM_USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function commonsFileName(src: string): string {
  const parts = new URL(src).pathname.split("/");
  const i = parts.indexOf("thumb");
  return decodeURIComponent(i >= 0 ? parts[i + 3] : parts[parts.length - 1]);
}

async function commonsImage(file: string): Promise<ImageCredit | null> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1600", format: "json" }).toString();
  type R = { query: { pages: Record<string, { imageinfo?: Array<{ thumburl?: string; url: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }> }> } };
  const j = await getJson<R>(u.toString());
  const info = j && Object.values(j.query.pages)[0]?.imageinfo?.[0];
  if (!info) return null;
  const strip = (v?: string) => (v ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
  return {
    url: info.thumburl ?? info.url,
    license: strip(info.extmetadata?.LicenseShortName?.value),
    credit: strip(info.extmetadata?.Artist?.value),
    sourceUrl: info.descriptionurl,
  };
}

export type TownWiki = { description: string; wikiUrl: string | null; cover: ImageCredit | null };

export function getTownWiki(name: string, province: string | null): Promise<TownWiki | null> {
  return memo(`wiki:${name}|${province}`, TTL, async () => {
    const candidates = [name, province ? `${name}, ${province}` : null, `${name}, South Africa`].filter(Boolean) as string[];
    for (const title of candidates) {
      type S = { type: string; title: string; extract?: string; originalimage?: { source: string }; content_urls?: { desktop?: { page?: string } } };
      const j = await getJson<S>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
      if (!j || j.type === "disambiguation" || !j.extract) continue;
      if (!/South Africa/i.test(j.extract) && !(province && j.extract.includes(province))) continue;
      const sentences = j.extract.match(/[^.!?]+[.!?]+/g) ?? [j.extract];
      const src = j.originalimage?.source;
      const file = src ? commonsFileName(src) : null;
      const cover = file && !BAD_IMAGE.test(file) ? await commonsImage(file) : null;
      return { description: sentences.slice(0, 2).join("").trim(), wikiUrl: j.content_urls?.desktop?.page ?? null, cover };
    }
    return null;
  });
}
