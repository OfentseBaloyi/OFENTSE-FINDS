"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { ButtonLink, EmptyState } from "@/components/ui";
import { categoryColor, getCategory } from "@/lib/categories";
import { useFavourites } from "@/lib/client-store";
import type { Place } from "@/lib/types";

const PlacesMap = dynamic(() => import("@/components/explorer/places-map"), { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-none" /> });

export function FavouritesView() {
  const { favourites, remove } = useFavourites();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const asPlaces: Place[] = useMemo(
    () =>
      favourites.map((f) => ({
        ...f,
        phone: null, website: null, email: null, openingHours: null, description: null, cuisine: null, imageUrl: null,
        source: f.id.startsWith("sb-") ? "supabase" : "osm", sourceUrl: null, rating: null, reviewCount: null, createdAt: null,
      })),
    [favourites],
  );

  if (!mounted) {
    return (
      <div className="mt-8 space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
    );
  }

  if (favourites.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-5 w-5" />}
        title="No favourites yet"
        className="mt-10"
        actions={
          <>
            <ButtonLink href="/towns">Explore towns</ButtonLink>
            <ButtonLink href="/discover" variant="secondary">Find hidden gems</ButtonLink>
          </>
        }
      >
        Tap the heart on any place to keep it here for later.
      </EmptyState>
    );
  }

  const center = { latitude: asPlaces[0].latitude, longitude: asPlaces[0].longitude };

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <ul className="divide-y divide-line self-start overflow-hidden rounded-xl border border-line bg-paper">
        {favourites.map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3" onMouseEnter={() => setSelected(f.id)}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${categoryColor(f.categorySlug)}18`, color: categoryColor(f.categorySlug) }}>
              <CategoryIcon slug={f.categorySlug} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/places/${f.id}`} className="block truncate font-semibold text-ink hover:underline">
                {f.name}
              </Link>
              <p className="truncate text-[13px] text-muted">
                {getCategory(f.categorySlug)?.name ?? "Place"}
                {f.address ? ` · ${f.address}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => remove(f.id)} aria-label={`Remove ${f.name}`} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand hover:text-[#b4452b]">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="h-[420px] overflow-hidden rounded-xl border border-line lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
        <PlacesMap places={asPlaces} center={center} selectedId={selected} onSelect={setSelected} fitKey={String(asPlaces.length)} cluster={asPlaces.length > 25} className="h-full w-full" />
      </div>
    </div>
  );
}
