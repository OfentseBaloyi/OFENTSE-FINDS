import type { Place } from "@/lib/types";

export type SortKey = "recommended" | "nearest" | "rating" | "reviews";

export const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  nearest: "Nearest",
  rating: "Highest rated",
  reviews: "Most reviewed",
};

/**
 * "Recommended" is transparent and never invented: verified listings first, then places with
 * the most complete, useful information (contact details, hours, photo), then proximity.
 * Ratings only count when a real rating source supplied them.
 */
export function recommendationScore(p: Place): number {
  let s = 0;
  if (p.verified) s += 100;
  if (p.phone) s += 10;
  if (p.website) s += 8;
  if (p.openingHours) s += 10;
  if (p.imageUrl) s += 8;
  if (p.address) s += 6;
  if (p.description) s += 4;
  if (p.rating != null && p.reviewCount != null && p.reviewCount >= 3) s += p.rating * 3;
  s -= Math.min(p.distanceKm ?? 0, 15) * 1.5;
  return s;
}

export function sortPlaces(places: Place[], sort: SortKey, distanceOf: (p: Place) => number | undefined): Place[] {
  const list = [...places];
  switch (sort) {
    case "nearest":
      return list.sort((a, b) => (distanceOf(a) ?? Infinity) - (distanceOf(b) ?? Infinity));
    case "rating":
      return list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "reviews":
      return list.sort((a, b) => (b.reviewCount ?? -1) - (a.reviewCount ?? -1));
    default:
      return list.sort((a, b) => recommendationScore(b) - recommendationScore(a));
  }
}

export function topPlaces(places: Place[], n: number): Place[] {
  return sortPlaces(places, "recommended", (p) => p.distanceKm).slice(0, n);
}
