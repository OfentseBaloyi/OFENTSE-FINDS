import { detectSelection, type Selection } from "@/lib/categories";
import { normalizeText } from "@/lib/utils";

export type ParsedQuery = {
  selection: Selection | null;
  /** town/suburb text after "in" / "near" / "around" */
  townText: string | null;
  nearMe: boolean;
  /** what's left to match against place names, e.g. "sushi" in "sushi in Sandton" */
  keyword: string | null;
};

const FILLER = new Set(["the", "a", "an", "best", "good", "find", "me", "some", "any", "places", "place", "spot", "spots", "local", "nearby", "near", "open", "now", "cheap", "for", "to", "of", "and", "where", "is", "are", "what"]);

/**
 * Understands searches like:
 *  "Kota in Mabopane", "Mechanic in Soshanguve", "Car wash near Ga-Rankuwa",
 *  "Things to do in Pretoria", "Pharmacy near me", "Restaurants in Midrand".
 */
export function parseSearchQuery(raw: string): ParsedQuery {
  const text = raw.trim().slice(0, 200);
  if (!text) return { selection: null, townText: null, nearMe: false, keyword: null };

  let what = text;
  let townText: string | null = null;
  let nearMe = false;

  if (/\b(near|around|close to)\s+me\b|\bnearby\b|\bnear by\b/i.test(text)) {
    nearMe = true;
    what = text.replace(/\b(near|around|close to)\s+me\b|\bnearby\b|\bnear by\b/gi, " ");
  } else {
    // split on the LAST " in / near / around / at " so "things to do in pretoria" works
    const m = /^(.*)\s(?:in|near|around|at|close to)\s+([^]+)$/i.exec(text);
    if (m && m[2].trim().length >= 2) {
      what = m[1];
      townText = m[2].trim();
    }
  }

  const detected = detectSelection(what);
  let rest = ` ${normalizeText(what)} `;
  if (detected) rest = rest.replace(` ${detected.matched} `, " ");
  const keyword = rest
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join(" ")
    .trim();

  return {
    selection: detected?.selection ?? null,
    townText,
    nearMe,
    keyword: keyword || null,
  };
}
