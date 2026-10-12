"use client";

import { useEffect, useState } from "react";
import { getOpenState, type OpenState } from "@/lib/hours";
import { cn } from "@/lib/utils";

/** Computed on the client (in SA time) so the server-rendered HTML never shows a stale state. */
export function OpenBadge({ hours, className, quiet = false }: { hours: string | null; className?: string; quiet?: boolean }) {
  const [state, setState] = useState<OpenState | null>(null);
  useEffect(() => {
    setState(getOpenState(hours));
    const t = setInterval(() => setState(getOpenState(hours)), 60_000);
    return () => clearInterval(t);
  }, [hours]);

  if (!hours || !state) return null;
  if (state.status === "unknown" && quiet) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        state.status === "open" ? "text-emerald-600" : state.status === "closed" ? "text-[#b4452b]" : "text-muted",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", state.status === "open" ? "bg-emerald" : state.status === "closed" ? "bg-[#b4452b]" : "bg-muted")} />
      {state.label}
    </span>
  );
}
