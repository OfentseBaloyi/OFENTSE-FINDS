"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LocateFixed, MapPinOff } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

/** Asks the browser for the visitor's location, then reloads /search with coordinates. */
export function NearMeLocator({ category, keyword }: { category: string | null; keyword: string }) {
  const router = useRouter();
  const [state, setState] = useState<"asking" | "denied" | "error" | "unsupported">("asking");

  const ask = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState("unsupported");
      return;
    }
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = new URLSearchParams({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4), sort: "nearest" });
        if (category) p.set("category", category);
        if (keyword) p.set("q", keyword);
        router.replace(`/search?${p}`);
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  }, [category, keyword, router]);

  useEffect(() => ask(), [ask]);

  if (state === "asking") {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <span className="relative grid h-16 w-16 place-items-center rounded-full bg-teal-100 text-teal-700">
          <span className="absolute inset-0 animate-ping rounded-full bg-teal-100" />
          <LocateFixed className="relative h-7 w-7" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">Finding places near you…</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">Your browser will ask to share your location. We only use it for this search and never store it.</p>
      </div>
    );
  }

  return (
    <EmptyState
      icon={<MapPinOff className="h-5 w-5" />}
      title={state === "denied" ? "Location access is off" : "We couldn't get your location"}
      className="mt-10"
      actions={
        <>
          <button type="button" onClick={ask} className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white">
            Try again
          </button>
          <ButtonLink href={`/search${category ? `?category=${encodeURIComponent(category)}` : ""}`} variant="secondary">
            Choose a town instead
          </ButtonLink>
        </>
      }
    >
      {state === "denied"
        ? "Allow location for this site in your browser settings, or search by town instead."
        : state === "unsupported"
          ? "Your browser doesn't support location. Search by town instead."
          : "Your device didn't return a location in time."}
    </EmptyState>
  );
}
