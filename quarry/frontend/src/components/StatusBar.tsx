import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { SaveState } from "../workspace/persistence";

interface Venue {
  city: string;
  tz: string;
  /** Regular session in local time [open, close] as minutes past midnight, Mon-Fri. */
  sessions?: [number, number][];
}

// Holiday calendars arrive in Phase 1; until then badges ignore public holidays.
const VENUES: Venue[] = [
  { city: "London", tz: "Europe/London", sessions: [[8 * 60, 16 * 60 + 30]] },
  { city: "New York", tz: "America/New_York", sessions: [[9 * 60 + 30, 16 * 60]] },
  {
    city: "Tokyo",
    tz: "Asia/Tokyo",
    sessions: [
      [9 * 60, 11 * 60 + 30],
      [12 * 60 + 30, 15 * 60 + 30],
    ],
  },
  { city: "UTC", tz: "UTC" },
];

export function localParts(
  now: Date,
  tz: string,
): { hhmm: string; minutes: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const h = Number(get("hour"));
  const m = Number(get("minute"));
  return { hhmm: `${get("hour")}:${get("minute")}`, minutes: h * 60 + m, weekday: get("weekday") };
}

export function isOpen(now: Date, v: Venue): boolean | null {
  if (!v.sessions) return null;
  const { minutes, weekday } = localParts(now, v.tz);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return v.sessions.some(([o, c]) => minutes >= o && minutes < c);
}

function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Clocks({ compact = false }: { compact?: boolean }) {
  const now = useNow();
  return (
    <div className="flex gap-3 font-mono text-xs" aria-label="World clocks">
      {VENUES.map((v) => {
        const open = isOpen(now, v);
        return (
          <div key={v.city} className="flex flex-col items-end leading-tight">
            <span className="text-[10px] uppercase text-dim">
              {compact ? v.city.slice(0, 3) : v.city}
            </span>
            <span className="text-bright">
              {localParts(now, v.tz).hhmm}{" "}
              {open !== null && (
                <span className={`text-[10px] ${open ? "text-up" : "text-dim"}`}>
                  {open ? "OPEN" : "CLSD"}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const DOT: Record<string, string> = {
  connected: "text-up",
  idle: "text-up",
  degraded: "text-amber",
  error: "text-down",
  unconfigured: "text-dim",
  disabled: "text-dim",
};

export function StatusBar({ saveState }: { saveState: SaveState }) {
  const status = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 15_000 });
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 10_000 });
  const providers = status.data?.providers.filter((p) => p.state !== "disabled") ?? [];
  const configured = providers.filter((p) => p.state !== "unconfigured");

  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge bg-bar px-3 py-1.5 font-mono text-[11px] text-dim">
      <span>
        <span className={health.data?.status === "ok" ? "text-up" : "text-down"}>●</span>{" "}
        {health.isError ? "API offline" : health.data?.status === "ok" ? "System OK" : "Degraded"}
      </span>
      {configured.map((p) => (
        <span key={p.id} title={p.last_error ?? p.state}>
          <span className={p.budget_warning ? "text-amber" : DOT[p.state]}>●</span> {p.display_name}
          {p.daily_limit ? (
            <span className="text-soft">
              {" "}
              {p.used_today}/{p.daily_limit}
            </span>
          ) : null}
        </span>
      ))}
      {status.isSuccess && configured.length === 0 && (
        <span>No data providers configured yet: add API keys (see STAT)</span>
      )}
      <span className="ml-auto">AI spend: — (Phase 4)</span>
      <span aria-live="polite">
        Layout: {saveState === "offline" ? "saved locally (server offline)" : saveState}
      </span>
    </footer>
  );
}
