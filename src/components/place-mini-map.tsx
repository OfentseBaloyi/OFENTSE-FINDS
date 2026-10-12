"use client";

import dynamic from "next/dynamic";
import type { Place } from "@/lib/types";

const PlacesMap = dynamic(() => import("@/components/explorer/places-map"), { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-none" /> });

export function PlaceMiniMap({ place }: { place: Place }) {
  return (
    <div className="h-64 w-full">
      <PlacesMap places={[place]} center={place} zoom={16} cluster={false} fitKey={place.id} className="h-full w-full" />
    </div>
  );
}
