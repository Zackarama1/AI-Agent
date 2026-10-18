import type { ComponentType } from "react";

import { parse } from "../terminal/parser";
import type { Registry } from "../terminal/types";
import {
  ErrorPanel,
  HelpPanel,
  KeysPanel,
  PlannedPanel,
  StatPanel,
  WelcomePanel,
  type PanelProps,
} from "./panels";

/** Shipped function implementations. A code missing here renders its "arrives in" card. */
const IMPLEMENTED: Record<string, ComponentType<PanelProps>> = {
  HELP: HelpPanel,
  KEYS: KeysPanel,
  STAT: StatPanel,
};

export function panelTitle(command: string, registry: Registry): string {
  const r = parse(command, registry);
  if (r.kind === "empty") return "QUARRY";
  if (r.kind === "error") return command || "Error";
  return r.canonical;
}

export function FunctionView({
  command,
  registry,
  run,
}: {
  command: string;
  registry: Registry;
  run: (c: string) => void;
}) {
  if (registry.functions.length === 0) {
    return <p className="m-0 p-4 text-dim">Loading function registry…</p>;
  }
  const r = parse(command, registry);
  if (r.kind === "empty") return <WelcomePanel args={[]} registry={registry} run={run} />;
  if (r.kind === "error") {
    return <ErrorPanel message={r.message} suggestions={r.suggestions} run={run} />;
  }
  const Impl = IMPLEMENTED[r.fn.code];
  if (!Impl) return <PlannedPanel fn={r.fn} />;
  return <Impl args={r.args} registry={registry} run={run} />;
}
