import type { FunctionSpec, Registry } from "./types";

const fn = (code: string, needs_security: boolean, phase = 1): FunctionSpec => ({
  code,
  title: code,
  phase,
  group: "Test",
  needs_security,
  args: [],
  summary: `${code} summary`,
  available: phase === 0,
});

/** Small registry for unit tests (the real one is served by /api/functions). */
export const testRegistry: Registry = {
  functions: [
    fn("DES", true),
    fn("GP", true),
    fn("GIP", true),
    fn("HP", true),
    fn("WEI", false),
    fn("ECO", false, 2),
    fn("WL", false),
    fn("HELP", false, 0),
    fn("KEYS", false, 0),
    fn("STAT", false, 0),
  ],
  market_suffixes: { US: "United States", LN: "London" },
  sector_suffixes: { EQ: "Equity", CUR: "Currency", IX: "Index" },
};
