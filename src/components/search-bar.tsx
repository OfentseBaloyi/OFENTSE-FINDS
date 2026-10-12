"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { ArrowRight, LocateFixed, MapPin, Search, Tag } from "lucide-react";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/categories";
import { useLastTown } from "@/lib/client-store";
import { cn, normalizeText } from "@/lib/utils";

export type TownOption = { slug: string; name: string; province: string | null };

/**
 * Town input autocompletes against towns we already know (no external request per keystroke,
 * per the Nominatim usage policy). Unknown towns are geocoded once, on submit, by /search.
 */
export function SearchBar({
  towns, defaultTown = "", defaultCategory = "", defaultKeyword = "", variant = "hero", className,
}: {
  towns: TownOption[];
  defaultTown?: string;
  defaultCategory?: string;
  defaultKeyword?: string;
  variant?: "hero" | "inline";
  className?: string;
}) {
  const router = useRouter();
  const lastTown = useLastTown();
  const [town, setTown] = useState(defaultTown);
  const [category, setCategory] = useState(defaultCategory);
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = normalizeText(town);
    if (!q) return towns.slice(0, 6);
    const compact = q.replace(/ /g, "");
    return towns
      .map((t) => {
        const n = normalizeText(t.name);
        const score = n.startsWith(q) || n.replace(/ /g, "").startsWith(compact) ? 2 : n.includes(q) || n.replace(/ /g, "").includes(compact) ? 1 : 0;
        return { t, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
      .slice(0, 7)
      .map((x) => x.t);
  }, [town, towns]);

  function go(townText: string) {
    setSubmitting(true);
    const exact = towns.find((t) => normalizeText(t.name).replace(/ /g, "") === normalizeText(townText).replace(/ /g, ""));
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (exact && !keyword.trim()) {
      router.push(`/towns/${exact.slug}${params.size ? `?${params}` : ""}`);
      return;
    }
    if (exact) params.set("town", exact.slug);
    else if (townText.trim()) params.set("where", townText.trim());
    if (keyword.trim()) params.set("q", keyword.trim());
    router.push(`/search?${params}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    const townText = town.trim() || lastTown?.name || "";
    if (!townText && !keyword.trim() && !category) {
      inputRef.current?.focus();
      return;
    }
    go(townText);
  }

  function choose(t: TownOption) {
    setTown(t.name);
    setOpen(false);
  }

  const hero = variant === "hero";

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={cn(
        "relative grid gap-2 rounded-2xl bg-paper p-2 text-ink",
        hero ? "shadow-lift md:grid-cols-[1.25fr_1fr_1fr_auto]" : "border border-line md:grid-cols-[1.25fr_1fr_1fr_auto]",
        className,
      )}
    >
      {/* Town */}
      <div className="relative">
        <label htmlFor={`${listId}-town`} className="absolute left-11 top-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Town or suburb
        </label>
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-700" aria-hidden />
        <input
          ref={inputRef}
          id={`${listId}-town`}
          value={town}
          onChange={(e) => {
            setTown(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!open || !suggestions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter" && town && suggestions[active] && normalizeText(suggestions[active].name) !== normalizeText(town)) {
              e.preventDefault();
              choose(suggestions[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={lastTown ? lastTown.name : "e.g. Mabopane"}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          className="h-14 w-full rounded-xl bg-transparent pb-1.5 pl-11 pr-3 pt-5 text-[15px] font-medium outline-none placeholder:text-muted/70 hover:bg-sand/60 focus:bg-sand/60"
        />
        {open && suggestions.length > 0 && (
          <ul id={`${listId}-list`} role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lift">
            {!town && <li className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Popular towns</li>}
            {suggestions.map((t, i) => (
              <li
                key={t.slug}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(t);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm", i === active && "bg-sand")}
              >
                <MapPin className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                <span className="font-medium">{t.name}</span>
                {t.province && <span className="ml-auto text-xs text-muted">{t.province}</span>}
              </li>
            ))}
            {town.trim().length > 2 && !suggestions.some((s) => normalizeText(s.name) === normalizeText(town)) && (
              <li className="border-t border-line px-4 py-2 text-xs text-muted">Press Explore to search all of South Africa for “{town.trim()}”</li>
            )}
          </ul>
        )}
      </div>

      {/* Category */}
      <div className="relative">
        <label htmlFor={`${listId}-cat`} className="absolute left-11 top-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Category
        </label>
        <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-700" aria-hidden />
        <select
          id={`${listId}-cat`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-14 w-full appearance-none rounded-xl bg-transparent pb-1.5 pl-11 pr-8 pt-5 text-[15px] font-medium outline-none hover:bg-sand/60 focus:bg-sand/60"
        >
          <option value="">Everything</option>
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.slug} label={g.name}>
              <option value={`group:${g.slug}`}>All {g.shortName.toLowerCase()}</option>
              {CATEGORIES.filter((c) => c.group === g.slug).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </div>

      {/* Keyword */}
      <div className="relative">
        <label htmlFor={`${listId}-kw`} className="absolute left-11 top-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Keyword <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-700" aria-hidden />
        <input
          id={`${listId}-kw`}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="kota, tyres, braids…"
          maxLength={80}
          className="h-14 w-full rounded-xl bg-transparent pb-1.5 pl-11 pr-3 pt-5 text-[15px] font-medium outline-none placeholder:text-muted/70 hover:bg-sand/60 focus:bg-sand/60"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-orange px-6 text-[15px] font-bold text-teal-950 transition hover:bg-[#f39a33] active:scale-[0.98] disabled:opacity-70"
      >
        {submitting ? "Exploring…" : "Explore"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      {hero && (
        <button
          type="button"
          onClick={() => {
            const p = new URLSearchParams({ near: "me" });
            if (category) p.set("category", category);
            if (keyword.trim()) p.set("q", keyword.trim());
            router.push(`/search?${p}`);
          }}
          className="inline-flex items-center gap-1.5 justify-self-start px-2 pb-1 text-[13px] font-semibold text-teal-700 hover:underline md:col-span-4"
        >
          <LocateFixed className="h-4 w-4" aria-hidden />
          Use my location instead
        </button>
      )}
    </form>
  );
}
