"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Clock, List, LocateFixed, Map as MapIcon, MapPin, RotateCcw, Search, SearchX, X } from "lucide-react";
import { CategoryIcon, Icon } from "@/components/category-icon";
import { FavouriteButton } from "@/components/favourite-button";
import { OpenBadge } from "@/components/open-badge";
import { PlaceImage } from "@/components/place-image";
import { EmptyState, Notice } from "@/components/ui";
import { CATEGORY_GROUPS, categoriesInGroup, getCategory, parseSelection, selectionLabel, selectionValue, type Selection } from "@/lib/categories";
import { distanceKm, formatDistance } from "@/lib/geo";
import { getOpenState, hasReliableHours, nowInSouthAfrica } from "@/lib/hours";
import { SORT_LABELS, sortPlaces, type SortKey } from "@/lib/ranking";
import type { Place, PlacesResult } from "@/lib/types";
import { cn, normalizeText } from "@/lib/utils";

const PlacesMap = dynamic(() => import("@/components/explorer/places-map"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center bg-sand text-sm text-muted">Loading map…</div>,
});

export type ExplorerArea =
  | { kind: "town"; slug: string; name: string; latitude: number; longitude: number; radiusKm: number }
  | { kind: "point"; label: string; latitude: number; longitude: number; radiusKm: number };

type Props = {
  area: ExplorerArea;
  initialSelection: string | null;
  initialResult: PlacesResult;
  initialKeyword?: string;
  initialSort?: SortKey;
  initialOpenNow?: boolean;
  /** path the URL is kept in sync with, e.g. /towns/mabopane */
  basePath: string;
  /** params that must stay in the URL (e.g. lat/lng on /search) */
  fixedParams?: Record<string, string>;
  nearbyTowns?: Array<{ slug: string; name: string }>;
};

const PAGE = 40;
const DISTANCES = [1, 2, 5, 10];

export function Explorer({ area, initialSelection, initialResult, initialKeyword = "", initialSort = "recommended", initialOpenNow = false, basePath, fixedParams, nearbyTowns = [] }: Props) {
  const [selection, setSelection] = useState<Selection>(() => parseSelection(initialSelection));
  const [result, setResult] = useState<PlacesResult>(initialResult);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [openNow, setOpenNow] = useState(initialOpenNow);
  const [maxKm, setMaxKm] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [now, setNow] = useState<Date | null>(null);
  const [fetchKey, setFetchKey] = useState(() => `${selectionValue(parseSelection(initialSelection))}`);
  const firstRender = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(nowInSouthAfrica());
    const t = setInterval(() => setNow(nowInSouthAfrica()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── data loading when the category changes ─────────────────────────
  const load = useCallback(
    async (sel: Selection, signal?: AbortSignal) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (area.kind === "town") params.set("town", area.slug);
      else {
        params.set("lat", area.latitude.toFixed(5));
        params.set("lng", area.longitude.toFixed(5));
        params.set("radius", String(area.radiusKm));
      }
      const v = selectionValue(sel);
      if (v) params.set("category", v);
      try {
        const res = await fetch(`/api/places?${params}`, { signal });
        const json = (await res.json()) as PlacesResult;
        if (!res.ok && !json.error) throw new Error("Request failed");
        setResult(json);
        setFetchKey(`${v}`);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setResult({ places: [], warnings: [], error: "We couldn't load places just now. Check your connection and try again." });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [area],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const ctrl = new AbortController();
    setSelectedId(null);
    setVisible(PAGE);
    load(selection, ctrl.signal);
    return () => ctrl.abort();
  }, [selection, load]);

  // ── keep the URL shareable ─────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(fixedParams);
      const v = selectionValue(selection);
      if (v) params.set("category", v);
      if (keyword.trim()) params.set("q", keyword.trim());
      if (sort !== "recommended") params.set("sort", sort);
      if (openNow) params.set("open", "1");
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", `${basePath}${qs ? `?${qs}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
  }, [selection, keyword, sort, openNow, basePath, fixedParams]);

  // ── filtering + sorting (client-side, on the loaded set) ───────────
  const distanceOf = useCallback(
    (p: Place) => (userLoc ? distanceKm(userLoc.latitude, userLoc.longitude, p.latitude, p.longitude) : p.distanceKm),
    [userLoc],
  );

  const hoursCount = useMemo(() => result.places.filter((p) => hasReliableHours(p.openingHours)).length, [result.places]);
  const hasRatings = useMemo(() => result.places.some((p) => p.rating != null), [result.places]);

  const filtered = useMemo(() => {
    const q = normalizeText(keyword);
    let list = result.places;
    if (q) {
      const words = q.split(" ");
      list = list.filter((p) => {
        const hay = normalizeText([p.name, p.cuisine, p.address, p.description, getCategory(p.categorySlug)?.name].filter(Boolean).join(" "));
        return words.every((w) => hay.includes(w));
      });
    }
    if (openNow && now) list = list.filter((p) => hasReliableHours(p.openingHours) && getOpenState(p.openingHours, now).status === "open");
    if (maxKm != null) list = list.filter((p) => (distanceOf(p) ?? Infinity) <= maxKm);
    return sortPlaces(list, sort, distanceOf);
  }, [result.places, keyword, openNow, now, maxKm, sort, distanceOf]);

  const shown = filtered.slice(0, visible);

  // when a marker is clicked, bring its row into view
  const onMarkerSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      const idx = filtered.findIndex((p) => p.id === id);
      if (idx >= visible) setVisible(idx + 10);
      requestAnimationFrame(() => {
        const el = listRef.current?.querySelector(`[data-place-id="${CSS.escape(id)}"]`);
        if (el && window.matchMedia("(min-width: 1024px)").matches) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [filtered, visible],
  );

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setSort("nearest");
        setLocating(false);
      },
      (err) => {
        setGeoError(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "We couldn't get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const activeGroup = selection.kind === "group" ? selection.group.slug : selection.kind === "category" ? selection.category.group : null;
  const placeName = area.kind === "town" ? area.name : area.label;
  const anyFilter = keyword.trim() !== "" || openNow || maxKm != null;
  const resetFilters = () => {
    setKeyword("");
    setOpenNow(false);
    setMaxKm(null);
  };

  return (
    <div className="relative">
      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="z-[1000] -mx-4 border-b lg:sticky lg:top-16 border-line bg-ivory/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Category">
          <Chip active={selection.kind === "all"} onClick={() => setSelection({ kind: "all" })}>
            Everything
          </Chip>
          {CATEGORY_GROUPS.map((g) => (
            <Chip key={g.slug} active={activeGroup === g.slug} color={g.color} onClick={() => setSelection({ kind: "group", group: g })}>
              <Icon name={g.icon} className="h-4 w-4" />
              {g.shortName}
            </Chip>
          ))}
        </div>
        {activeGroup && (
          <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {categoriesInGroup(activeGroup).map((c) => {
              const on = selection.kind === "category" && selection.category.slug === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setSelection(on ? { kind: "group", group: CATEGORY_GROUPS.find((g) => g.slug === activeGroup)! } : { kind: "category", category: c })}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                    on ? "border-ink bg-ink text-white" : "border-line bg-paper text-ink-2 hover:border-ink/30",
                  )}
                >
                  <CategoryIcon slug={c.slug} className="h-3.5 w-3.5" />
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setVisible(PAGE);
              }}
              placeholder={`Filter ${selectionLabel(selection).toLowerCase()} by name…`}
              aria-label="Filter results by keyword"
              maxLength={80}
              className="h-10 w-full rounded-lg border border-line bg-paper pl-9 pr-8 text-sm outline-none focus:border-teal-600"
            />
            {keyword && (
              <button type="button" onClick={() => setKeyword("")} aria-label="Clear keyword" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 sm:contents">
          <label className="sr-only" htmlFor="ex-sort">Sort by</label>
          <select
            id="ex-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 shrink-0 rounded-lg border border-line bg-paper px-3 text-sm font-medium outline-none focus:border-teal-600"
          >
            <option value="recommended">{SORT_LABELS.recommended}</option>
            <option value="nearest">{userLoc ? "Nearest to you" : area.kind === "town" ? "Nearest to centre" : "Nearest"}</option>
            <option value="rating" disabled={!hasRatings}>
              {SORT_LABELS.rating}
              {!hasRatings ? " (no ratings yet)" : ""}
            </option>
            <option value="reviews" disabled={!hasRatings}>
              {SORT_LABELS.reviews}
              {!hasRatings ? " (no reviews yet)" : ""}
            </option>
          </select>

          <label className="sr-only" htmlFor="ex-dist">Distance</label>
          <select
            id="ex-dist"
            value={maxKm ?? ""}
            onChange={(e) => setMaxKm(e.target.value ? Number(e.target.value) : null)}
            className="h-10 shrink-0 rounded-lg border border-line bg-paper px-3 text-sm font-medium outline-none focus:border-teal-600"
          >
            <option value="">Any distance</option>
            {DISTANCES.map((d) => (
              <option key={d} value={d}>
                Within {d} km
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOpenNow((o) => !o)}
            aria-pressed={openNow}
            disabled={hoursCount === 0 && !openNow}
            title={hoursCount === 0 ? "None of these places have published opening hours" : `${hoursCount} of ${result.places.length} places publish opening hours`}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
              openNow ? "border-emerald bg-emerald-soft text-emerald-600" : "border-line bg-paper text-ink-2 hover:border-ink/30",
            )}
          >
            <Clock className="h-4 w-4" aria-hidden />
            Open now
          </button>

          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition",
              userLoc ? "border-[#2563eb]/40 bg-[#2563eb]/10 text-[#1d4ed8]" : "border-line bg-paper text-ink-2 hover:border-ink/30",
            )}
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
            {locating ? "Locating…" : userLoc ? "Using your location" : "Near me"}
          </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 text-[13px] text-muted">
          <p aria-live="polite">
            {loading ? (
              "Loading places…"
            ) : (
              <>
                <span className="font-semibold text-ink">{filtered.length}</span> {filtered.length === 1 ? "place" : "places"} · {selectionLabel(selection)} in {placeName}
                {openNow && hoursCount > 0 && <span> · only places with published hours</span>}
              </>
            )}
          </p>
          <div className="flex shrink-0 rounded-lg border border-line bg-paper p-0.5 lg:hidden" role="group" aria-label="View">
            <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold", view === "list" ? "bg-ink text-white" : "text-ink-2")}>
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button type="button" onClick={() => setView("map")} aria-pressed={view === "map"} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold", view === "map" ? "bg-ink text-white" : "text-ink-2")}>
              <MapIcon className="h-3.5 w-3.5" /> Map
            </button>
          </div>
        </div>
        {geoError && <p className="mt-1 text-xs text-[#b4452b]">{geoError}</p>}
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(360px,440px)_1fr]">
        <div ref={listRef} className={cn("min-w-0", view === "map" && "hidden lg:block")}>
          {result.warnings.map((w) => (
            <Notice key={w} tone="warn" className="mb-3">
              {w}
            </Notice>
          ))}

          {loading ? (
            <ListSkeleton />
          ) : result.error ? (
            <EmptyState
              icon={<RotateCcw className="h-5 w-5" />}
              title="Places didn't load"
              actions={
                <button type="button" onClick={() => load(selection)} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900">
                  Try again
                </button>
              }
            >
              {result.error}
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<SearchX className="h-5 w-5" />} title={`No ${selectionLabel(selection).toLowerCase()} found${anyFilter ? " with these filters" : ""}`}>
              <p>
                {anyFilter
                  ? "Try loosening your filters."
                  : `We couldn't find any mapped ${selectionLabel(selection).toLowerCase()} around ${placeName} yet. Local places are often missing from open map data — you can help fix that.`}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {anyFilter && (
                  <button type="button" onClick={resetFilters} className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white">
                    Clear filters
                  </button>
                )}
                {selection.kind === "category" && (
                  <button type="button" onClick={() => setSelection({ kind: "group", group: CATEGORY_GROUPS.find((g) => g.slug === selection.category.group)! })} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink">
                    Show all {CATEGORY_GROUPS.find((g) => g.slug === selection.category.group)!.shortName.toLowerCase()}
                  </button>
                )}
                {nearbyTowns.slice(0, 3).map((t) => {
                  const v = selectionValue(selection);
                  return (
                    <Link key={t.slug} href={`/towns/${t.slug}${v ? `?category=${encodeURIComponent(v)}` : ""}`} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink">
                      Try {t.name}
                    </Link>
                  );
                })}
                <Link href="/list-your-business" className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-semibold text-teal-700">
                  Add a place
                </Link>
              </div>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
              {shown.map((p) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  distance={distanceOf(p)}
                  distanceSuffix={userLoc ? "from you" : area.kind === "town" ? "from centre" : "away"}
                  active={p.id === selectedId}
                  onHover={setHoveredId}
                  onShowOnMap={(id) => {
                    setSelectedId(id);
                    setView("map");
                  }}
                />
              ))}
            </ul>
          )}

          {!loading && filtered.length > visible && (
            <button type="button" onClick={() => setVisible((v) => v + PAGE)} className="mt-3 w-full rounded-lg border border-line bg-paper py-3 text-sm font-semibold text-ink hover:border-ink/30">
              Show more ({filtered.length - visible} left)
            </button>
          )}

          {!loading && result.places.length > 0 && (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Places come from{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
                OpenStreetMap
              </a>{" "}
              contributors and businesses listed on OFENTSE-FINDS. <BadgeCheck className="inline h-3.5 w-3.5 text-orange-600" aria-hidden /> Verified means the listing was reviewed by our team. “Recommended” puts verified listings first, then the places with the most complete information.
            </p>
          )}
        </div>

        <div className={cn("relative lg:block", view === "list" && "hidden")}>
          <div className="relative h-[calc(100dvh-15rem)] min-h-[420px] overflow-hidden rounded-xl border border-line lg:sticky lg:top-[13.5rem] lg:h-[calc(100dvh-15rem)]">
            <PlacesMap
              places={filtered}
              center={area}
              zoom={area.kind === "town" && area.radiusKm > 6 ? 12 : 14}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onMarkerSelect}
              userLocation={userLoc}
              distanceOf={distanceOf}
              fitKey={`${fetchKey}|${userLoc ? "u" : ""}`}
              className="h-full w-full"
            />
            {loading && (
              <div className="absolute inset-0 z-[500] grid place-items-center bg-ivory/50 backdrop-blur-[1px]">
                <span className="rounded-full bg-paper px-4 py-2 text-sm font-semibold shadow-card">Loading places…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* mobile floating toggle */}
      <button
        type="button"
        onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
        className="fixed bottom-5 left-1/2 z-[1050] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lift lg:hidden"
      >
        {view === "list" ? <MapIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}
        {view === "list" ? "Show map" : "Show list"}
      </button>
    </div>
  );
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
        active ? "border-teal-800 bg-teal-800 text-white" : "border-line bg-paper text-ink-2 hover:border-ink/30",
      )}
    >
      {children}
    </button>
  );
}

function PlaceRow({
  place, distance, distanceSuffix, active, onHover, onShowOnMap,
}: {
  place: Place;
  distance: number | undefined;
  distanceSuffix: string;
  active: boolean;
  onHover: (id: string | null) => void;
  onShowOnMap: (id: string) => void;
}) {
  const category = getCategory(place.categorySlug);
  return (
    <li
      data-place-id={place.id}
      onMouseEnter={() => onHover(place.id)}
      onMouseLeave={() => onHover(null)}
      className={cn("relative flex gap-3 p-3 transition hover:bg-sand/50", active && "bg-orange-soft/60")}
    >
      <PlaceImage src={place.imageUrl} categorySlug={place.categorySlug} alt="" className="h-[84px] w-[84px] shrink-0 rounded-lg" iconClassName="h-7 w-7" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-teal-700">
              {category?.name ?? "Place"}
              {place.verified && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-orange-600">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
                </span>
              )}
            </p>
            <h3 className="truncate font-display text-[15px] font-bold leading-snug text-ink">
              <Link href={`/places/${place.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                {place.name}
              </Link>
            </h3>
          </div>
          <FavouriteButton place={place} className="relative z-10 h-8 w-8 shadow-none ring-1 ring-line" />
        </div>
        {place.address && <p className="mt-0.5 truncate text-[13px] text-muted">{place.address}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {distance != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {formatDistance(distance)} {distanceSuffix}
            </span>
          )}
          <OpenBadge hours={place.openingHours} quiet />
          {place.rating != null && place.reviewCount != null && (
            <span>
              ★ {place.rating.toFixed(1)} ({place.reviewCount})
            </span>
          )}
          <button type="button" onClick={() => onShowOnMap(place.id)} className="relative z-10 font-semibold text-teal-700 hover:underline">
            Show on map
          </button>
        </div>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper" aria-busy="true" aria-label="Loading places">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex gap-3 p-3">
          <div className="skeleton h-[84px] w-[84px] shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
