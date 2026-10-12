"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Place } from "@/lib/types";

// Favourites and "last town" live in the visitor's browser (no account needed). Every access
// is wrapped in try/catch because storage can be unavailable (private mode, blocked cookies).

export type FavouritePlace = Pick<Place, "id" | "name" | "categorySlug" | "latitude" | "longitude" | "address" | "verified"> & {
  townSlug: string | null;
  savedAt: string;
};

const FAV_KEY = "ofentse-finds:favourites:v1";
const TOWN_KEY = "ofentse-finds:last-town:v1";
const EVENT = "ofentse-finds:storage";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep working in memory for this page view */
  }
  snapshots.delete(key);
  window.dispatchEvent(new Event(EVENT));
}

// useSyncExternalStore needs referentially stable snapshots
const snapshots = new Map<string, { raw: string | null; value: unknown }>();
function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = snapshots.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  const value = raw ? read<T>(key, fallback) : fallback;
  snapshots.set(key, { raw, value });
  return value;
}

function subscribe(cb: () => void) {
  const onStorage = (e: Event) => {
    if (e instanceof StorageEvent) snapshots.clear();
    cb();
  };
  window.addEventListener(EVENT, onStorage);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onStorage);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: FavouritePlace[] = [];

export function useFavourites() {
  const favourites = useSyncExternalStore(subscribe, () => snapshot<FavouritePlace[]>(FAV_KEY, EMPTY), () => EMPTY);
  const isFavourite = useCallback((id: string) => favourites.some((f) => f.id === id), [favourites]);
  const toggle = useCallback((place: Place | FavouritePlace) => {
    const current = read<FavouritePlace[]>(FAV_KEY, []);
    if (current.some((f) => f.id === place.id)) {
      write(FAV_KEY, current.filter((f) => f.id !== place.id));
      return false;
    }
    const fav: FavouritePlace = {
      id: place.id,
      name: place.name,
      categorySlug: place.categorySlug,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      verified: place.verified,
      townSlug: place.townSlug ?? null,
      savedAt: new Date().toISOString(),
    };
    write(FAV_KEY, [fav, ...current].slice(0, 200));
    return true;
  }, []);
  const remove = useCallback((id: string) => write(FAV_KEY, read<FavouritePlace[]>(FAV_KEY, []).filter((f) => f.id !== id)), []);
  return { favourites, isFavourite, toggle, remove };
}

export type LastTown = { slug: string; name: string };

export function useLastTown(): LastTown | null {
  return useSyncExternalStore(subscribe, () => snapshot<LastTown | null>(TOWN_KEY, null), () => null);
}

export function rememberTown(town: LastTown) {
  const current = read<LastTown | null>(TOWN_KEY, null);
  if (current?.slug !== town.slug) write(TOWN_KEY, { slug: town.slug, name: town.name });
}
