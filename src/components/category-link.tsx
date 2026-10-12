"use client";

import Link from "next/link";
import { Icon } from "@/components/category-icon";
import { useLastTown } from "@/lib/client-store";
import { cn } from "@/lib/utils";

/** Links to the category in the visitor's last town when we know it, otherwise to /search. */
export function CategoryLink({
  value, name, description, icon, color, emphasis = false,
}: {
  value: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  emphasis?: boolean;
}) {
  const lastTown = useLastTown();
  const href = lastTown
    ? `/towns/${lastTown.slug}?category=${encodeURIComponent(value)}#explore`
    : `/search?category=${encodeURIComponent(value)}`;

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full items-start gap-3 rounded-xl border border-line bg-paper p-4 transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-card",
        emphasis && "border-transparent bg-sand",
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{name}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{description}</span>
        {lastTown && <span className="mt-1.5 block text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">In {lastTown.name} →</span>}
      </span>
    </Link>
  );
}
