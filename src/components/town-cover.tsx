import type { Town } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Town photo from Wikimedia Commons when one exists. Towns without a suitable photo get a
 * branded topographic panel rather than a photo of somewhere else.
 */
export function TownCover({ town, className, eager = false }: { town: Pick<Town, "name" | "cover" | "slug">; className?: string; eager?: boolean }) {
  if (town.cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnails are already sized
      <img
        src={town.cover.url}
        alt={`${town.name}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn("object-cover", className)}
      />
    );
  }
  // deterministic variation per town so a grid of fallbacks doesn't look identical
  const seed = [...town.slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rot = (seed % 7) * 13;
  return (
    <div className={cn("relative overflow-hidden bg-teal-800", className)} aria-hidden>
      <svg className="absolute inset-0 h-full w-full text-mint/25" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="currentColor" strokeWidth="1.2" transform={`rotate(${rot} 200 150)`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <ellipse key={i} cx={210 + (seed % 40)} cy={140} rx={30 + i * 26} ry={18 + i * 17} />
          ))}
        </g>
        <path d="M0 230 C 80 210, 140 250, 220 228 S 340 200, 400 222 L400 300 L0 300Z" fill="#0a3533" opacity="0.7" />
      </svg>
      <div className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-orange shadow-[0_0_0_5px_rgb(239_138_23/0.25)]" />
    </div>
  );
}

export function CoverCredit({ town, className }: { town: Pick<Town, "cover">; className?: string }) {
  if (!town.cover) return null;
  const { credit, license, sourceUrl } = town.cover;
  return (
    <a
      href={sourceUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("text-[11px] text-white/70 underline-offset-2 hover:text-white hover:underline", className)}
    >
      Photo: {credit ? credit.slice(0, 60) : "Wikimedia Commons"}
      {license ? ` · ${license}` : ""}
    </a>
  );
}
