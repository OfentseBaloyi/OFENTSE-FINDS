import OpeningHours from "opening_hours";

// Opening hours come from the OSM `opening_hours` tag (or a listing's own value). We only
// claim "Open now" / "Closed" when the value parses cleanly; otherwise we show the raw text.

const SA = { lat: -26.2, lon: 28.05, address: { country_code: "za", state: "" } };

/** A Date whose *local* fields equal the current wall-clock time in South Africa. */
export function nowInSouthAfrica(): Date {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

const cache = new Map<string, OpeningHours | null>();

function parse(value: string | null | undefined): OpeningHours | null {
  if (!value) return null;
  if (cache.has(value)) return cache.get(value)!;
  let oh: OpeningHours | null = null;
  try {
    oh = new OpeningHours(value, SA, { mode: 0, tag_key: "opening_hours", map_value: false, warnings_severity: 4, locale: "en" } as never);
  } catch {
    oh = null;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(value, oh);
  return oh;
}

export type OpenState = { status: "open" | "closed" | "unknown"; label: string; nextChange: Date | null };

const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function hasReliableHours(value: string | null | undefined): boolean {
  return parse(value) !== null;
}

export function getOpenState(value: string | null | undefined, now: Date = nowInSouthAfrica()): OpenState {
  const oh = parse(value);
  if (!oh) return { status: "unknown", label: value ? "Hours listed" : "Hours unknown", nextChange: null };
  try {
    if (oh.getUnknown(now)) return { status: "unknown", label: "Hours vary", nextChange: null };
    const open = oh.getState(now);
    const next = oh.getNextChange(now) ?? null;
    let when = "";
    if (next) {
      const sameDay = next.toDateString() === now.toDateString();
      when = sameDay ? ` · ${open ? "closes" : "opens"} ${fmtTime(next)}` : ` · ${open ? "closes" : "opens"} ${DAYS[next.getDay()]} ${fmtTime(next)}`;
    }
    return { status: open ? "open" : "closed", label: `${open ? "Open now" : "Closed"}${when}`, nextChange: next };
  } catch {
    return { status: "unknown", label: "Hours listed", nextChange: null };
  }
}

/** Mon..Sun lines like "08:00–17:00" for the current week, or null when not parseable. */
export function weeklySchedule(value: string | null | undefined, now: Date = nowInSouthAfrica()): Array<{ day: string; text: string; isToday: boolean }> | null {
  const oh = parse(value);
  if (!oh) return null;
  try {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
      const intervals = oh.getOpenIntervals(from, to).filter(([, , unknown]) => !unknown);
      const text = intervals.length
        ? intervals
            .map(([a, b]) => {
              const end = b.getTime() >= to.getTime() ? "24:00" : fmtTime(b);
              return a.getTime() === from.getTime() && end === "24:00" ? "Open 24 hours" : `${fmtTime(a)}–${end}`;
            })
            .join(", ")
        : "Closed";
      rows.push({ day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], text, isToday: from.toDateString() === now.toDateString() });
    }
    return rows;
  } catch {
    return null;
  }
}
