import { describe, expect, it } from "vitest";

import { editDistance, rankFunctions, score } from "./fuzzy";
import { testRegistry } from "./testRegistry";

describe("fuzzy", () => {
  it("orders exact > prefix > typo > subsequence", () => {
    expect(score("GP", "GP")).toBeGreaterThan(score("G", "GP"));
    expect(score("G", "GP")).toBeGreaterThan(score("GPP", "GP"));
    expect(score("GPP", "GP")).toBeGreaterThan(score("WL", "WATCHLIST"));
    expect(score("ZZ", "GP")).toBe(0);
  });

  it("counts transpositions as one edit", () => {
    expect(editDistance("DSE", "DES")).toBe(1);
    expect(editDistance("HELPP", "HELP")).toBe(1);
    expect(editDistance("ABC", "XYZ")).toBe(3);
  });

  it("ranks functions", () => {
    expect(rankFunctions("DSE", testRegistry.functions)[0]?.code).toBe("DES");
  });
});
