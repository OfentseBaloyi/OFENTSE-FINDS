"use client";

import { useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { categoryColor, getCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * Shows a place's real photo when one exists. Otherwise — or if the photo fails to load — a
 * category illustration, never a stock photo that could be mistaken for the actual place.
 */
export function PlaceImage({
  src, categorySlug, alt, className, iconClassName = "h-9 w-9", showLabel = false,
}: {
  src: string | null;
  categorySlug: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const color = categoryColor(categorySlug);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote images from arbitrary hosts
      <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn("object-cover", className)} />
    );
  }

  return (
    <div className={cn("relative grid place-items-center overflow-hidden", className)} style={{ backgroundColor: `${color}14` }} role="img" aria-label={`${getCategory(categorySlug)?.name ?? "Place"} — no photo available`}>
      <div className="fallback-pattern absolute inset-0 opacity-[0.13]" style={{ color }} />
      <div className="relative flex flex-col items-center gap-1.5" style={{ color }}>
        <CategoryIcon slug={categorySlug} className={iconClassName} strokeWidth={1.6} />
        {showLabel && <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{getCategory(categorySlug)?.name ?? "Place"}</span>}
      </div>
    </div>
  );
}
