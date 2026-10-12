"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

/** Click or drag to place the pin. The admin confirms real coordinates before publishing. */
export default function PinPicker({
  value, center, onChange,
}: {
  value: { lat: number; lng: number } | null;
  center: { lat: number; lng: number };
  onChange: (v: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: [center.lat, center.lng], zoom: 14 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([value.lat, value.lng], {
        draggable: true,
        icon: L.divIcon({ className: "", html: '<div class="of-marker is-verified" style="--c:#0f6560"></div>', iconSize: [34, 34], iconAnchor: [17, 34] }),
      }).addTo(map);
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current!.getLatLng();
        onChangeRef.current({ lat: ll.lat, lng: ll.lng });
      });
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
  }, [value]);

  useEffect(() => {
    if (!value) mapRef.current?.setView([center.lat, center.lng], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  return <div ref={ref} className="h-64 w-full rounded-lg border border-line" />;
}
