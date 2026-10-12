"use client";

import { useEffect, useState } from "react";
import { weeklySchedule } from "@/lib/hours";
import { cn } from "@/lib/utils";

export function WeeklyHours({ hours }: { hours: string }) {
  const [rows, setRows] = useState<ReturnType<typeof weeklySchedule> | undefined>(undefined);
  useEffect(() => setRows(weeklySchedule(hours)), [hours]);

  if (rows === undefined) return <div className="skeleton mt-3 h-32" />;
  if (rows === null) {
    // value didn't parse — show it as published rather than guessing
    return <p className="mt-2 break-words font-mono text-[13px] text-ink-2">{hours}</p>;
  }
  return (
    <table className="mt-3 w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.day} className={cn(r.isToday && "font-semibold text-ink")}>
            <th scope="row" className="w-14 py-1 text-left font-medium text-muted">
              {r.day}
            </th>
            <td className={cn("py-1 text-ink-2", r.text === "Closed" && "text-muted")}>{r.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
