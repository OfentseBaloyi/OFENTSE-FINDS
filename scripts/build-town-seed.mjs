// Builds src/data/towns.generated.json from real sources:
//   - coordinates + province: Nominatim (OpenStreetMap), throttled to 1 request/second
//   - description + cover photo: Wikipedia REST summary + Wikimedia Commons licence metadata
//
// Usage: node scripts/build-town-seed.mjs
// Re-run when you add towns to TOWN_LIST below. Nothing is invented: if a source has no
// data for a town, the field is left empty and the app falls back gracefully.

import { writeFile } from "node:fs/promises";

const UA = "OFENTSE-FINDS/0.1 (town seed builder; https://github.com/)";

// [display name, Nominatim query, optional explicit Wikipedia title]
const TOWN_LIST = [
  ["Mabopane", "Mabopane, Gauteng"],
  ["Soshanguve", "Soshanguve, Gauteng"],
  ["Ga-Rankuwa", "Ga-Rankuwa, Gauteng"],
  ["Pretoria", "Pretoria, Gauteng"],
  ["Johannesburg", "Johannesburg, Gauteng"],
  ["Midrand", "Midrand, Gauteng"],
  ["Centurion", "Centurion, Gauteng", "Centurion, Gauteng"],
  ["Rustenburg", "Rustenburg, North West"],
  ["Polokwane", "Polokwane, Limpopo"],
  ["Durban", "Durban, KwaZulu-Natal"],
  ["Cape Town", "Cape Town, Western Cape"],
  ["Akasia", "Akasia, Gauteng"],
  ["Hammanskraal", "Hammanskraal, Gauteng"],
  ["Winterveldt", "Winterveldt, Gauteng"],
  ["Mamelodi", "Mamelodi, Gauteng"],
  ["Atteridgeville", "Atteridgeville, Gauteng"],
  ["Hatfield", "Hatfield, Pretoria", "Hatfield, Pretoria"],
  ["Soweto", "Soweto, Gauteng"],
  ["Sandton", "Sandton, Gauteng"],
  ["Randburg", "Randburg, Gauteng"],
  ["Roodepoort", "Roodepoort, Gauteng"],
  ["Tembisa", "Tembisa, Gauteng"],
  ["Alexandra", "Alexandra, Gauteng", "Alexandra, Gauteng"],
  ["Diepsloot", "Diepsloot, Gauteng"],
  ["Kempton Park", "Kempton Park, Gauteng"],
  ["Benoni", "Benoni, Gauteng"],
  ["Boksburg", "Boksburg, Gauteng"],
  ["Germiston", "Germiston, Gauteng"],
  ["Krugersdorp", "Krugersdorp, Gauteng"],
  ["Vereeniging", "Vereeniging, Gauteng"],
  ["Brits", "Brits, North West", "Brits, North West"],
  ["Hartbeespoort", "Hartbeespoort, North West"],
  ["Mahikeng", "Mahikeng, North West"],
  ["Potchefstroom", "Potchefstroom, North West"],
  ["Klerksdorp", "Klerksdorp, North West"],
  ["Thohoyandou", "Thohoyandou, Limpopo"],
  ["Tzaneen", "Tzaneen, Limpopo"],
  ["Mbombela", "Mbombela, Mpumalanga"],
  ["eMalahleni", "eMalahleni, Mpumalanga"],
  ["Pietermaritzburg", "Pietermaritzburg, KwaZulu-Natal"],
  ["Umhlanga", "Umhlanga, KwaZulu-Natal"],
  ["Stellenbosch", "Stellenbosch, Western Cape"],
  ["Khayelitsha", "Khayelitsha, Western Cape"],
  ["George", "George, Western Cape", "George, South Africa"],
  ["Gqeberha", "Gqeberha, Eastern Cape"],
  ["East London", "East London, Eastern Cape"],
  ["Mthatha", "Mthatha, Eastern Cape"],
  ["Bloemfontein", "Bloemfontein, Free State"],
  ["Kimberley", "Kimberley, Northern Cape", "Kimberley, Northern Cape"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");

async function getJson(url, attempt = 0) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) {
    if (attempt < 4) {
      await sleep(1500 * (attempt + 1));
      return getJson(url, attempt + 1);
    }
    console.warn(`   HTTP ${res.status} for ${url}`);
    return null;
  }
  return res.json();
}

/** "…/commons/thumb/9/95/File.jpg/3840px-File.jpg" and "…/commons/6/6b/File.jpg" -> "File.jpg" */
function commonsFileName(src) {
  const parts = new URL(src).pathname.split("/");
  const i = parts.indexOf("thumb");
  return decodeURIComponent(i >= 0 ? parts[i + 3] : parts[parts.length - 1]);
}

function radiusFor(type) {
  if (type === "city") return 9;
  if (type === "town") return 5;
  return 3.5; // suburb, township, quarter, neighbourhood, village
}

function kindFor(type) {
  if (type === "city") return "city";
  if (type === "town") return "town";
  return "suburb";
}

const BAD_IMAGE = /(\.svg$|map|locator|location|flag|coat[_ ]of[_ ]arms|logo|seal|emblem)/i;

async function wikiFor(name, province, explicit) {
  const candidates = explicit ? [explicit] : [name, `${name}, ${province}`, `${name}, South Africa`];
  for (const title of candidates) {
    const j = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
    await sleep(600);
    if (!j || j.type === "disambiguation" || !j.extract) continue;
    if (!/South Africa/i.test(j.extract) && !(province && j.extract.includes(province))) continue;
    const sentences = j.extract.match(/[^.!?]+[.!?]+/g) ?? [j.extract];
    const description = sentences.slice(0, 2).join("").trim();
    let cover = null;
    const src = j.originalimage?.source;
    if (src) {
      const file = commonsFileName(src);
      if (!BAD_IMAGE.test(file)) cover = await commonsImage(file);
    }
    return { wikiTitle: j.title, description, wikiUrl: j.content_urls?.desktop?.page ?? null, cover };
  }
  return null;
}

async function commonsImage(file) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.search = new URLSearchParams({
    action: "query", titles: `File:${file}`, prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: "1600", format: "json",
  }).toString();
  const j = await getJson(u);
  await sleep(600);
  const info = j && Object.values(j.query.pages)[0]?.imageinfo?.[0];
  if (!info) return null;
  const m = info.extmetadata ?? {};
  const strip = (v) => (v ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return {
    url: info.thumburl ?? info.url,
    license: strip(m.LicenseShortName?.value) || null,
    credit: strip(m.Artist?.value) || null,
    sourceUrl: info.descriptionurl,
  };
}

const out = [];
for (const [name, query, explicitWiki] of TOWN_LIST) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({ q: query, countrycodes: "za", format: "jsonv2", limit: "1", addressdetails: "1" }).toString();
  const r = (await getJson(u))?.[0];
  await sleep(1100); // Nominatim usage policy: max 1 request/second
  if (!r) {
    console.warn(`!! No geocode result for ${name}`);
    continue;
  }
  const province = r.address?.state ?? null;
  const wiki = await wikiFor(name, province, explicitWiki);
  const town = {
    slug: slugify(name),
    name,
    province,
    latitude: Number(Number(r.lat).toFixed(6)),
    longitude: Number(Number(r.lon).toFixed(6)),
    kind: kindFor(r.type),
    radiusKm: radiusFor(r.type),
    osm: { type: r.osm_type, id: r.osm_id },
    description: wiki?.description ?? null,
    wikiTitle: wiki?.wikiTitle ?? null,
    wikiUrl: wiki?.wikiUrl ?? null,
    cover: wiki?.cover ?? null,
  };
  out.push(town);
  console.log(`${town.name.padEnd(18)} ${town.latitude},${town.longitude} ${town.kind} ${province} wiki=${!!wiki} cover=${!!town.cover}`);
}

await writeFile(new URL("../src/data/towns.generated.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote ${out.length} towns.`);
