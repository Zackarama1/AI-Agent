export type Latency = "realtime" | "delayed_15m" | "eod" | "indicative";

const LABEL: Record<Latency, string> = {
  realtime: "RT",
  delayed_15m: "15M",
  eod: "EOD",
  indicative: "IND",
};

const TONE: Record<Latency, string> = {
  realtime: "border-cyan text-cyan",
  delayed_15m: "border-amber text-amber",
  eod: "border-dim text-soft",
  indicative: "border-violet text-violet",
};

/** Data-age badge shown next to every value. Text, not colour alone, carries the meaning. */
export function LatencyBadge({ latency, venue }: { latency: Latency; venue?: string | null }) {
  return (
    <span
      className={`inline-block rounded-sm border px-1 font-mono text-[10px] leading-4 ${TONE[latency]}`}
      title={`${latency}${venue ? ` · ${venue} only` : ""}`}
    >
      {LABEL[latency]}
      {venue ? ` · ${venue}` : ""}
    </span>
  );
}
