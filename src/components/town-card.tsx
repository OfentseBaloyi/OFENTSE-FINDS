import Link from "next/link";
import { MapPin } from "lucide-react";
import { TownCover } from "@/components/town-cover";
import { formatDistance } from "@/lib/geo";
import type { Town } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TownCard({ town, distanceKm, size = "md", className }: { town: Town; distanceKm?: number; size?: "md" | "lg"; className?: string }) {
  return (
    <Link
      href={`/towns/${town.slug}`}
      className={cn("group relative block overflow-hidden rounded-xl bg-teal-900 text-white", size === "lg" ? "aspect-[4/5] sm:aspect-[3/4]" : "aspect-[4/3]", className)}
    >
      <TownCover town={town} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(6_35_33/0.88),rgb(6_35_33/0.15)_55%,transparent)]" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint">{town.province ?? "South Africa"}</p>
        <h3 className="mt-0.5 font-display text-xl font-bold leading-tight">{town.name}</h3>
        {distanceKm != null && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/80">
            <MapPin className="h-3 w-3" aria-hidden /> {formatDistance(distanceKm)} away
          </p>
        )}
      </div>
    </Link>
  );
}
