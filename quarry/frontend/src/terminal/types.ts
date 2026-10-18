export interface FunctionSpec {
  code: string;
  title: string;
  phase: number;
  group: string;
  needs_security: boolean;
  args: string[];
  summary: string;
  available: boolean;
}

export interface Registry {
  functions: FunctionSpec[];
  market_suffixes: Record<string, string>;
  sector_suffixes: Record<string, string>;
}

export interface Security {
  ticker: string;
  market?: string;
  sector?: string;
}

export type ParseResult =
  | {
      kind: "ok";
      fn: FunctionSpec;
      security?: Security;
      args: string[];
      /** Normalised command text, e.g. "VOD LN EQ DES". */
      canonical: string;
    }
  | { kind: "empty" }
  | { kind: "error"; message: string; suggestions: string[] };
