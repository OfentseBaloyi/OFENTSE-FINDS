"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useFavourites } from "@/lib/client-store";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FavouriteButton({ place, variant = "icon", className }: { place: Place; variant?: "icon" | "button"; className?: string }) {
  const { isFavourite, toggle } = useFavourites();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const saved = mounted && isFavourite(place.id);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(place);
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition",
          saved ? "border-orange bg-orange-soft text-orange-600" : "border-line bg-paper text-ink hover:border-ink/30",
          className,
        )}
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${place.name} from favourites` : `Save ${place.name} to favourites`}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-paper/95 text-ink shadow-card transition hover:scale-105",
        saved && "text-orange-600",
        className,
      )}
    >
      <Heart className={cn("h-[18px] w-[18px]", saved && "fill-current")} />
    </button>
  );
}
