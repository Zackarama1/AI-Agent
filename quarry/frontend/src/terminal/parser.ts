import { rankFunctions } from "./fuzzy";
import type { FunctionSpec, ParseResult, Registry, Security } from "./types";

/** Function opened when a security is entered without one, e.g. "VOD LN". */
export const DEFAULT_SECURITY_FUNCTION = "DES";

const TICKER = /^[A-Z0-9][A-Z0-9.\-/]{0,19}$/;

export function tokenize(input: string): string[] {
  return input.trim().toUpperCase().split(/\s+/).filter(Boolean);
}

/**
 * Parse terminal commands of the form
 *   <FUNCTION> [args]                          WEI · ECO UK · HELP GP
 *   <TICKER> [MARKET] [SECTOR] [FUNCTION] [args]   VOD LN DES · AAPL US EQ GP 1Y · GBPUSD CUR GP 5D
 *
 * A first token that is both a function code and a ticker (e.g. "HP") is read as a
 * security when the next token is a market or sector suffix ("HP US DES").
 */
export function parse(input: string, registry: Registry): ParseResult {
  const tokens = tokenize(input);
  if (tokens.length === 0) return { kind: "empty" };

  const byCode = new Map(registry.functions.map((f) => [f.code, f]));
  const isSuffix = (t: string | undefined): boolean =>
    t !== undefined && (t in registry.market_suffixes || t in registry.sector_suffixes);

  const [first, ...rest] = tokens as [string, ...string[]];
  const firstFn = byCode.get(first);

  if (firstFn && !isSuffix(rest[0])) {
    if (firstFn.needs_security) {
      return {
        kind: "error",
        message: `${firstFn.code} needs a security first, e.g. "AAPL US ${firstFn.code}".`,
        suggestions: [`AAPL US ${firstFn.code}`, `VOD LN ${firstFn.code}`],
      };
    }
    return ok(firstFn, undefined, rest);
  }

  if (!TICKER.test(first)) {
    return unknown(first, registry.functions);
  }

  const security: Security = { ticker: first };
  let i = 0;
  const market = rest[i];
  if (market !== undefined && market in registry.market_suffixes) {
    security.market = market;
    i += 1;
  }
  const sector = rest[i];
  if (sector !== undefined && sector in registry.sector_suffixes) {
    security.sector = sector;
    i += 1;
  }
  if (!security.market && !security.sector) {
    // A lone unknown token: most likely a mistyped function code.
    if (rest.length === 0) return unknown(first, registry.functions);
    return {
      kind: "error",
      message: `"${first}" needs a market or sector suffix, e.g. "${first} US" or "${first} LN".`,
      suggestions: [
        `${first} US ${rest[0] ?? DEFAULT_SECURITY_FUNCTION}`,
        `${first} LN ${rest[0] ?? DEFAULT_SECURITY_FUNCTION}`,
      ],
    };
  }

  const fnToken = rest[i];
  if (fnToken === undefined) {
    return ok(byCode.get(DEFAULT_SECURITY_FUNCTION)!, security, []);
  }
  const fn = byCode.get(fnToken);
  if (!fn) {
    const prefix = securityText(security);
    return {
      kind: "error",
      message: `Unknown function "${fnToken}".`,
      suggestions: rankFunctions(
        fnToken,
        registry.functions.filter((f) => f.needs_security),
        4,
      ).map((f) => `${prefix} ${f.code}`),
    };
  }
  return ok(fn, security, rest.slice(i + 1));
}

export function securityText(s: Security): string {
  return [s.ticker, s.market, s.sector].filter(Boolean).join(" ");
}

function ok(fn: FunctionSpec, security: Security | undefined, args: string[]): ParseResult {
  const canonical = [security ? securityText(security) : "", fn.code, ...args]
    .filter(Boolean)
    .join(" ");
  return security
    ? { kind: "ok", fn, security, args, canonical }
    : { kind: "ok", fn, args, canonical };
}

function unknown(token: string, fns: FunctionSpec[]): ParseResult {
  return {
    kind: "error",
    message: `Unknown command "${token}". Try HELP for the function list.`,
    suggestions: rankFunctions(token, fns, 4).map((f) => f.code),
  };
}

/**
 * Autocomplete for the token being typed: function codes when the user could be
 * typing one, given what precedes it.
 */
export function completions(input: string, registry: Registry): FunctionSpec[] {
  const endsWithSpace = /\s$/.test(input);
  const tokens = tokenize(input);
  const current = endsWithSpace ? "" : (tokens.at(-1) ?? "");
  const before = endsWithSpace ? tokens : tokens.slice(0, -1);
  const afterSecurity =
    before.length > 0 &&
    before.some((t) => t in registry.market_suffixes || t in registry.sector_suffixes);
  const pool = registry.functions.filter((f) =>
    afterSecurity ? f.needs_security : before.length === 0,
  );
  if (pool.length === 0) return [];
  if (!current) return afterSecurity ? pool.slice(0, 8) : [];
  return rankFunctions(current, pool);
}

/** Replace the token being typed with `code` (Tab completion). */
export function applyCompletion(input: string, code: string): string {
  const head = /\s$/.test(input) ? input : input.replace(/\S+$/, "");
  return `${head}${code} `;
}
