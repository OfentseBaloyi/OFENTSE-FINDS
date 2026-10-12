import Link from "next/link";
import { MapPin } from "lucide-react";
import { FavouriteButton } from "@/components/favourite-button";
import { OpenBadge } from "@/components/open-badge";
import { PlaceImage } from "@/components/place-image";
import { VerifiedBadge } from "@/components/ui";
import { getCategory } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import type { Place } from "@/lib/types";

/** Vertical card for homepage/discovery rails. */
export function PlaceCard({ place, distanceLabel = "from centre" }: { place: Place; distanceLabel?: string }) {
  const category = getCategory(place.categorySlug);
  const distance = formatDistance(place.distanceKm);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-paper transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden">
        <PlaceImage src={place.imageUrl} categorySlug={place.categorySlug} alt={place.name} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" showLabel />
        <FavouriteButton place={place} className="absolute right-3 top-3" />
        {place.verified && <VerifiedBadge className="absolute left-3 top-3 shadow-card" />}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-semibold text-teal-700">
          {category?.name ?? "Place"}
          {place.cuisine && <span className="font-normal text-muted"> · {place.cuisine}</span>}
        </p>
        <h3 className="font-display text-[1.05rem] font-bold leading-snug text-ink">
          <Link href={`/places/${place.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {place.name}
          </Link>
        </h3>
        {place.address && <p className="line-clamp-1 text-[13px] text-muted">{place.address}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted">
          {distance && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {distance} {distanceLabel}
            </span>
          )}
          <OpenBadge hours={place.openingHours} quiet />
        </div>
      </div>
    </article>
  );
}
