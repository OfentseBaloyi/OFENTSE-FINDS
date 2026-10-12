import { CATEGORIES, CATEGORY_GROUPS, type Category, type CategoryGroup, type CategoryGroupSlug, type OsmFilter } from "@/data/categories";
import { normalizeText } from "@/lib/utils";

export { CATEGORIES, CATEGORY_GROUPS };
export type { Category, CategoryGroup, CategoryGroupSlug };

const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));
const groupBySlug = new Map(CATEGORY_GROUPS.map((g) => [g.slug, g]));

export function getCategory(slug: string | null | undefined): Category | undefined {
  return slug ? bySlug.get(slug) : undefined;
}

export function getGroup(slug: string | null | undefined): CategoryGroup | undefined {
  return slug ? groupBySlug.get(slug as CategoryGroupSlug) : undefined;
}

export function categoriesInGroup(group: CategoryGroupSlug): Category[] {
  return CATEGORIES.filter((c) => c.group === group);
}

export function groupOfCategory(slug: string | null | undefined): CategoryGroup | undefined {
  return getGroup(getCategory(slug)?.group);
}

/** Colour used for markers/accents for a category slug (falls back to deep teal). */
export function categoryColor(slug: string | null | undefined): string {
  return groupOfCategory(slug)?.color ?? "#0F4F4C";
}

export function categoryIcon(slug: string | null | undefined): string {
  return getCategory(slug)?.icon ?? "map-pin";
}

/**
 * A "selection" is what the user filters by: a single category slug, a whole group
 * (`group:food`) or everything (null).
 */
export type Selection = { kind: "all" } | { kind: "group"; group: CategoryGroup } | { kind: "category"; category: Category };

export function parseSelection(value: string | null | undefined): Selection {
  if (!value) return { kind: "all" };
  if (value.startsWith("group:")) {
    const group = getGroup(value.slice(6));
    return group ? { kind: "group", group } : { kind: "all" };
  }
  const category = getCategory(value);
  if (category) return { kind: "category", category };
  const group = getGroup(value);
  return group ? { kind: "group", group } : { kind: "all" };
}

export function selectionValue(sel: Selection): string | null {
  if (sel.kind === "all") return null;
  if (sel.kind === "group") return `group:${sel.group.slug}`;
  return sel.category.slug;
}

export function selectionLabel(sel: Selection): string {
  if (sel.kind === "all") return "Everything";
  if (sel.kind === "group") return sel.group.name;
  return sel.category.name;
}

export function selectionCategories(sel: Selection): Category[] {
  if (sel.kind === "all") return CATEGORIES;
  if (sel.kind === "group") return categoriesInGroup(sel.group.slug);
  return [sel.category];
}

// ── matching OSM tags ──────────────────────────────────────────────────

const regexCache = new Map<string, RegExp>();
function re(src: string): RegExp {
  let r = regexCache.get(src);
  if (!r) {
    r = new RegExp(src, "i");
    regexCache.set(src, r);
  }
  return r;
}

function filterMatches(f: OsmFilter, tags: Record<string, string>): boolean {
  for (const [k, v] of Object.entries(f.tags)) {
    const actual = tags[k];
    if (actual === undefined) return false;
    if (v !== true && !v.includes(actual)) return false;
  }
  for (const [k, pattern] of Object.entries(f.regex ?? {})) {
    const actual = tags[k];
    if (actual === undefined || !re(pattern).test(actual)) return false;
  }
  return true;
}

/** First category (in registry order) whose filters match, restricted to `candidates`. */
export function classifyTags(tags: Record<string, string>, candidates: Category[] = CATEGORIES): Category | undefined {
  // keep registry order so specific categories win over generic ones
  const allowed = new Set(candidates.map((c) => c.slug));
  return CATEGORIES.find((c) => allowed.has(c.slug) && c.osm.some((f) => filterMatches(f, tags)));
}

// ── natural-language category detection ────────────────────────────────

const GROUP_KEYWORDS: Array<[CategoryGroupSlug, string[]]> = [
  ["lifestyle", ["things to do", "what to do", "fun things", "places to visit", "activities", "entertainment"]],
  ["food", ["food", "places to eat", "where to eat", "eat"]],
  ["automotive", ["car", "cars", "automotive", "vehicle"]],
  ["shopping", ["shopping", "shops", "stores"]],
  ["services", ["services", "essential services"]],
];

/**
 * Finds the best category or group mentioned in free text. Returns the matched phrase so
 * the caller can strip it from the keyword. Longest phrase wins ("car wash" beats "car").
 */
export function detectSelection(text: string): { selection: Selection; matched: string } | null {
  const t = ` ${normalizeText(text)} `;
  let best: { selection: Selection; matched: string } | null = null;
  const consider = (phrase: string, selection: Selection) => {
    const p = normalizeText(phrase);
    if (!p) return;
    if (t.includes(` ${p} `) && (!best || p.length > best.matched.length)) best = { selection, matched: p };
  };
  for (const c of CATEGORIES) {
    consider(c.name, { kind: "category", category: c });
    for (const k of c.keywords) consider(k, { kind: "category", category: c });
  }
  for (const [g, words] of GROUP_KEYWORDS) {
    const group = getGroup(g)!;
    for (const w of words) consider(w, { kind: "group", group });
  }
  // "things to do" is better served by attractions than the whole lifestyle group
  const found = best as { selection: Selection; matched: string } | null;
  if (found && found.selection.kind === "group" && /things to do|what to do|places to visit/.test(found.matched)) {
    return { selection: { kind: "category", category: getCategory("tourist-attractions")! }, matched: found.matched };
  }
  return found;
}
