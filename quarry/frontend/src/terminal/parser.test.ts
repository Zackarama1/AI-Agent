import { describe, expect, it } from "vitest";

import { applyCompletion, completions, parse } from "./parser";
import { testRegistry } from "./testRegistry";

const p = (s: string) => parse(s, testRegistry);

describe("parse", () => {
  it("parses security + function + args", () => {
    const r = p("aapl us gp 1y");
    expect(r).toMatchObject({
      kind: "ok",
      fn: { code: "GP" },
      security: { ticker: "AAPL", market: "US" },
      args: ["1Y"],
      canonical: "AAPL US GP 1Y",
    });
  });

  it("parses market + sector suffixes", () => {
    expect(p("VOD LN EQ DES")).toMatchObject({
      kind: "ok",
      security: { ticker: "VOD", market: "LN", sector: "EQ" },
      canonical: "VOD LN EQ DES",
    });
  });

  it("parses sector-only securities like FX", () => {
    expect(p("GBPUSD CUR GP 5D")).toMatchObject({
      kind: "ok",
      security: { ticker: "GBPUSD", sector: "CUR" },
      fn: { code: "GP" },
      args: ["5D"],
    });
  });

  it("defaults a bare security to DES", () => {
    expect(p("VOD LN")).toMatchObject({ kind: "ok", fn: { code: "DES" }, canonical: "VOD LN DES" });
  });

  it("parses function-first commands", () => {
    expect(p("ECO UK")).toMatchObject({ kind: "ok", fn: { code: "ECO" }, args: ["UK"] });
    expect(p("WEI")).toMatchObject({ kind: "ok", fn: { code: "WEI" }, canonical: "WEI" });
  });

  it("treats a function-code ticker followed by a suffix as a security", () => {
    expect(p("HP US DES")).toMatchObject({
      kind: "ok",
      security: { ticker: "HP", market: "US" },
      fn: { code: "DES" },
    });
    expect(p("HP")).toMatchObject({ kind: "error" }); // HP alone needs a security
  });

  it("explains a security function used without a security", () => {
    const r = p("GP");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.suggestions).toContain("AAPL US GP");
  });

  it("handles unknown commands gracefully with suggestions", () => {
    const r = p("HELPP");
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.message).toMatch(/Unknown command/);
      expect(r.suggestions).toContain("HELP");
    }
  });

  it("reports an unknown function after a security", () => {
    const r = p("VOD LN XYZ");
    expect(r).toMatchObject({ kind: "error", message: 'Unknown function "XYZ".' });
  });

  it("asks for a suffix when a ticker has none", () => {
    expect(p("VOD DES")).toMatchObject({ kind: "error" });
  });

  it("returns empty for blank input", () => {
    expect(p("   ")).toEqual({ kind: "empty" });
  });

  it("rejects junk tokens", () => {
    expect(p("$$$").kind).toBe("error");
  });
});

describe("completions", () => {
  it("suggests security functions after a security", () => {
    const codes = completions("VOD LN G", testRegistry).map((f) => f.code);
    expect(codes[0]).toBe("GP");
    expect(codes).not.toContain("WEI");
  });

  it("suggests top-level functions for the first token", () => {
    expect(completions("WE", testRegistry).map((f) => f.code)).toContain("WEI");
  });

  it("applies a completion by replacing the current token", () => {
    expect(applyCompletion("VOD LN G", "GP")).toBe("VOD LN GP ");
    expect(applyCompletion("VOD LN ", "DES")).toBe("VOD LN DES ");
  });
});
