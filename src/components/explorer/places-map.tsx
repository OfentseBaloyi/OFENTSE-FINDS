"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "leaflet";
import "leaflet.markercluster";
import { createElement, useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ICONS } from "@/components/category-icon";
import { categoryColor, categoryIcon, getCategory } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import type { Place } from "@/lib/types";
import { escapeHtml } from "@/lib/utils";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

const svgCache = new Map<string, string>();
function iconSvg(name: string) {
  let svg = svgCache.get(name);
  if (!svg) {
    const C = ICONS[name] ?? ICONS["map-pin"];
    svg = renderToStaticMarkup(createElement(C, { strokeWidth: 2.25 }));
    svgCache.set(name, svg);
  }
  return svg;
}

function markerIcon(p: Place, active: boolean) {
  const color = categoryColor(p.categorySlug);
  return L.divIcon({
    className: "",
    html: `<div class="of-marker${p.verified ? " is-verified" : ""}${active ? " is-active" : ""}" style="--c:${color}">${iconSvg(categoryIcon(p.categorySlug))}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });
}

function popupHtml(p: Place, distanceKm: number | undefined) {
  const cat = getCategory(p.categorySlug)?.name ?? "Place";
  const dist = formatDistance(distanceKm);
  return `<div style="padding:14px 16px 12px">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${categoryColor(p.categorySlug)}">${escapeHtml(cat)}${p.verified ? ' · <span style="color:#cf6f06">Verified</span>' : ""}</p>
    <p style="margin:4px 0 0;font-family:var(--font-display);font-size:16px;font-weight:700;line-height:1.25;color:#17201e">${escapeHtml(p.name)}</p>
    ${p.address ? `<p style="margin:4px 0 0;font-size:12px;color:#66716e">${escapeHtml(p.address)}</p>` : ""}
    ${dist ? `<p style="margin:4px 0 0;font-size:12px;color:#66716e">${dist} away</p>` : ""}
    <a href="/places/${encodeURIComponent(p.id)}" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#0f6560">View details →</a>
  </div>`;
}

export type PlacesMapProps = {
  places: Place[];
  center: { latitude: number; longitude: number };
  zoom?: number;
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  distanceOf?: (p: Place) => number | undefined;
  /** change to force re-fitting bounds (e.g. new category) */
  fitKey?: string;
  cluster?: boolean;
  className?: string;
  interactive?: boolean;
};

export default function PlacesMap({
  places, center, zoom = 14, selectedId, hoveredId, onSelect, userLocation, distanceOf, fitKey, cluster = true, className, interactive = true,
}: PlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.MarkerClusterGroup | L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const placesById = useRef(new Map<string, Place>());
  const userLayerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const distanceRef = useRef(distanceOf);
  onSelectRef.current = onSelect;
  distanceRef.current = distanceOf;

  // create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.latitude, center.longitude],
      zoom,
      zoomControl: false,
      scrollWheelZoom: interactive,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      attributionControl: true,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION, crossOrigin: true }).addTo(map);
    map.attributionControl.setPrefix(false);
    mapRef.current = map;

    // When the map starts hidden (mobile list view) it has no size; re-fit once it's revealed.
    let wasHidden = containerRef.current.clientWidth === 0;
    const ro = new ResizeObserver((entries) => {
      const visible = entries[0].contentRect.width > 0;
      map.invalidateSize();
      if (visible && wasHidden) fitRef.current();
      wasHidden = !visible;
    });
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (re)build markers when the place list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current?.remove();
    markersRef.current.clear();
    placesById.current = new Map(places.map((p) => [p.id, p]));

    const layer = cluster
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 48,
          spiderfyOnMaxZoom: true,
          chunkedLoading: true,
          iconCreateFunction: (c) => {
            const n = c.getChildCount();
            const size = n < 10 ? 36 : n < 50 ? 42 : 50;
            return L.divIcon({ html: `<div class="of-cluster" style="width:${size}px;height:${size}px">${n}</div>`, className: "", iconSize: [size, size] });
          },
        })
      : L.layerGroup();

    for (const p of places) {
      const m = L.marker([p.latitude, p.longitude], { icon: markerIcon(p, false), title: p.name, alt: p.name, riseOnHover: true, keyboard: true });
      m.bindPopup(() => popupHtml(p, distanceRef.current?.(p)), { closeButton: true, autoPanPadding: [24, 24] });
      m.on("click", () => onSelectRef.current?.(p.id));
      layer.addLayer(m);
      markersRef.current.set(p.id, m);
    }
    layer.addTo(map);
    layerRef.current = layer;
  }, [places, cluster]);

  // fit to results when the data set (not just filtering) changes
  const fitRef = useRef<() => void>(() => {});
  fitRef.current = () => {
    const map = mapRef.current;
    if (!map || !containerRef.current?.clientWidth) return;
    const pts = places.map((p) => L.latLng(p.latitude, p.longitude));
    if (userLocation) pts.push(L.latLng(userLocation.latitude, userLocation.longitude));
    if (pts.length === 0) map.setView([center.latitude, center.longitude], zoom);
    else if (pts.length === 1) map.setView(pts[0], 16);
    else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  };
  useEffect(() => {
    fitRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, places.length === 0]);

  // highlight selected / hovered marker (only touch markers whose state changed)
  const activeRef = useRef(new Set<string>());
  useEffect(() => {
    const next = new Set([selectedId, hoveredId].filter((x): x is string => Boolean(x)));
    const changed = new Set([...activeRef.current, ...next]);
    for (const id of changed) {
      const m = markersRef.current.get(id);
      const p = placesById.current.get(id);
      if (!m || !p) continue;
      const isActive = next.has(id);
      if (isActive === activeRef.current.has(id) && !isActive) continue;
      m.setIcon(markerIcon(p, isActive));
      m.setZIndexOffset(isActive ? 1000 : 0);
    }
    activeRef.current = next;
  }, [selectedId, hoveredId, places]);

  // pan to the selected place and open its preview
  useEffect(() => {
    if (!selectedId) return;
    const m = markersRef.current.get(selectedId);
    const layer = layerRef.current;
    if (!m || !layer) return;
    if ("zoomToShowLayer" in layer) (layer as L.MarkerClusterGroup).zoomToShowLayer(m, () => m.openPopup());
    else m.openPopup();
  }, [selectedId]);

  // user location dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userLayerRef.current?.remove();
    if (userLocation) {
      userLayerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: L.divIcon({ className: "", html: '<div class="of-user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        title: "You are here",
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [userLocation]);

  return <div ref={containerRef} className={className} role="region" aria-label="Map of places" />;
}
