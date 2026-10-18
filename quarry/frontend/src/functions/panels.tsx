import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import { LatencyBadge, type Latency } from "../components/LatencyBadge";
import type { FunctionSpec, Registry } from "../terminal/types";

export interface PanelProps {
  args: string[];
  registry: Registry;
  run: (command: string) => void;
}

function CommandLink({ cmd, run }: { cmd: string; run: (c: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => run(cmd)}
      className="min-h-8 rounded border border-edge bg-head px-2 font-mono text-xs text-cyan hover:border-cyan"
    >
      {cmd}
    </button>
  );
}

export function WelcomePanel({ run }: PanelProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="m-0 font-mono text-lg font-bold tracking-[3px] text-amber">QUARRY</h2>
        <p className="m-0 text-soft">
          Type a command in the bar above, or tap one below. Format:{" "}
          <span className="font-mono text-bright">&lt;SECURITY&gt; &lt;FUNCTION&gt; [args]</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {["HELP", "STAT", "KEYS", "VOD LN DES", "AAPL US GP 1Y", "WEI", "ECO UK"].map((c) => (
          <CommandLink key={c} cmd={c} run={run} />
        ))}
      </div>
      <p className="m-0 text-xs text-dim">
        Phase 0: the shell, command line and layouts are live. Market data arrives in Phase 1.
      </p>
    </div>
  );
}

export function HelpPanel({ args, registry, run }: PanelProps) {
  const code = args[0];
  const one = code ? registry.functions.find((f) => f.code === code) : undefined;
  if (one) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <h2 className="m-0 font-mono text-base text-amber">
          {one.code} <span className="font-sans text-bright">{one.title}</span>
        </h2>
        <p className="m-0">{one.summary}</p>
        <p className="m-0 text-dim">
          {one.needs_security ? `Usage: <SECURITY> ${one.code}` : `Usage: ${one.code}`}
          {one.args.length ? ` [${one.args.join(" ")}]` : ""} ·{" "}
          {one.available ? "available now" : `arrives in Phase ${one.phase}`}
        </p>
        <div>
          <CommandLink cmd="HELP" run={run} />
        </div>
      </div>
    );
  }
  const groups = new Map<string, FunctionSpec[]>();
  for (const f of registry.functions) groups.set(f.group, [...(groups.get(f.group) ?? []), f]);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-3">
      {[...groups].map(([group, fns]) => (
        <section key={group}>
          <h3 className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-dim">
            {group}
          </h3>
          <ul className="m-0 list-none p-0">
            {fns.map((f) => (
              <li key={f.code}>
                <button
                  type="button"
                  onClick={() => run(`HELP ${f.code}`)}
                  className="flex min-h-7 w-full items-baseline gap-2 border-b border-rule bg-transparent px-0 text-left text-ink"
                >
                  <span className="w-11 shrink-0 font-mono font-bold text-amber">{f.code}</span>
                  <span className="truncate">{f.title}</span>
                  <span
                    className={`ml-auto shrink-0 font-mono text-[10px] ${f.available ? "text-up" : "text-dim"}`}
                  >
                    {f.available ? "LIVE" : `P${f.phase}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const KEYS: [string, string][] = [
  ["Ctrl/⌘ K or /", "Focus the command line"],
  ["Enter", "Open command in the focused panel"],
  ["Shift + Enter", "Open command in a new panel"],
  ["Tab", "Complete the function code"],
  ["↑ / ↓", "Command history / suggestions"],
  ["Esc", "Leave the command line"],
  ["F1", "HELP"],
  ["Ctrl 1–9", "Focus panel 1–9"],
  ["Ctrl L", "Cycle the focused panel's link colour"],
  ["Ctrl S", "Save workspace"],
  ["?", "This cheat sheet"],
];
const GESTURES: [string, string][] = [
  ["Tap a function chip", "Run it for the current security"],
  ["Swipe the top bar ← →", "Switch workspace"],
  ["Tap a pane", "Focus it (amber border)"],
  ["1 / 2 / 3 buttons", "Number of panes"],
  ["Charts (Phase 1)", "Pinch to zoom · drag to pan · touch and hold for crosshair"],
];

export function KeysPanel() {
  const table = (rows: [string, string][]) => (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-rule">
            <td className="w-48 py-1 pr-3 font-mono text-bright">{k}</td>
            <td className="py-1 text-soft">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 p-4">
      <section>
        <h3 className="m-0 mb-2 text-[11px] uppercase tracking-wider text-dim">Keyboard</h3>
        {table(KEYS)}
      </section>
      <section>
        <h3 className="m-0 mb-2 text-[11px] uppercase tracking-wider text-dim">iPad touch</h3>
        {table(GESTURES)}
      </section>
    </div>
  );
}

const STATE_TONE: Record<string, string> = {
  connected: "text-up",
  idle: "text-up",
  degraded: "text-amber",
  error: "text-down",
  unconfigured: "text-dim",
  disabled: "text-dim",
};

export function StatPanel() {
  const status = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 15_000 });
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 10_000 });
  if (status.isError) {
    return (
      <p className="m-0 p-4 text-down">Cannot reach the QUARRY API. Is the backend running?</p>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap gap-4 font-mono text-xs">
        {Object.entries(health.data?.checks ?? {}).map(([k, ok]) => (
          <span key={k}>
            <span className={ok ? "text-up" : "text-down"}>●</span> {k}
          </span>
        ))}
        <span className="text-dim">
          mode {status.data?.mode ?? "…"} · base {status.data?.base_currency ?? "…"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="text-left text-dim">
              <th scope="col" className="py-1 pr-3 font-normal">
                Provider
              </th>
              <th scope="col" className="py-1 pr-3 font-normal">
                State
              </th>
              <th scope="col" className="py-1 pr-3 font-normal">
                Data
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-normal">
                Used today
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-normal">
                Stream cap
              </th>
              <th scope="col" className="py-1 font-normal">
                Tier
              </th>
            </tr>
          </thead>
          <tbody>
            {status.data?.providers.map((p) => (
              <tr
                key={p.id}
                className="border-t border-rule"
                title={p.attribution_text ?? undefined}
              >
                <td className="py-1 pr-3 text-bright">{p.display_name}</td>
                <td className={`py-1 pr-3 ${STATE_TONE[p.state] ?? ""}`}>{p.state}</td>
                <td className="py-1 pr-3">
                  <LatencyBadge latency={p.latency_class as Latency} />
                </td>
                <td className={`py-1 pr-3 text-right ${p.budget_warning ? "text-amber" : ""}`}>
                  {p.used_today}
                  {p.daily_limit ? `/${p.daily_limit}` : ""}
                </td>
                <td className="py-1 pr-3 text-right">{p.ws_symbol_cap ?? "—"}</td>
                <td className={`py-1 ${p.cost_tier === "paid" ? "text-amber" : "text-soft"}`}>
                  {p.cost_tier}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[11px] text-dim">
        "unconfigured" = API key not set on the server. Paid sources stay disabled until approved.
        Attribution text shows on hover.
      </p>
    </div>
  );
}

export function PlannedPanel({ fn }: { fn: FunctionSpec }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <h2 className="m-0 font-mono text-base text-amber">
        {fn.code} <span className="font-sans text-bright">{fn.title}</span>
      </h2>
      <p className="m-0">{fn.summary}</p>
      <p className="m-0 text-dim">Arrives in Phase {fn.phase}.</p>
    </div>
  );
}

export function ErrorPanel({
  message,
  suggestions,
  run,
}: {
  message: string;
  suggestions: string[];
  run: (c: string) => void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 p-4">
      <p className="m-0 text-bright">{message}</p>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-dim">Did you mean</span>
          {suggestions.map((s) => (
            <CommandLink key={s} cmd={s} run={run} />
          ))}
        </div>
      )}
      <div>
        <CommandLink cmd="HELP" run={run} />
      </div>
    </div>
  );
}
