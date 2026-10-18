import { beforeEach, describe, expect, it } from "vitest";

import { testRegistry as reg } from "../terminal/testRegistry";
import { defaultSnapshot, isSnapshot, relink, useWorkspace } from "./store";

const s = () => useWorkspace.getState();

beforeEach(() => {
  s().load({
    version: 1,
    panels: [
      { id: "a", command: "AAPL US DES", link: "amber" },
      { id: "b", command: "AAPL US GP 1Y", link: "amber" },
      { id: "c", command: "AAPL US HP", link: "cyan" },
      { id: "d", command: "WEI", link: "amber" },
    ],
    focusedId: "a",
    paneCount: 2,
  });
});

describe("workspace store", () => {
  it("Enter replaces the focused panel's command with the canonical form", () => {
    s().openCommand("vod ln des", reg);
    expect(s().panels.a!.command).toBe("VOD LN DES");
    expect(s().order).toHaveLength(4);
  });

  it("Shift+Enter opens a new focused panel", () => {
    const id = s().openCommand("WEI", reg, { newPanel: true });
    expect(s().order.at(-1)).toBe(id);
    expect(s().focusedId).toBe(id);
  });

  it("propagates a new security to panels in the same link group only", () => {
    s().openCommand("VOD LN DES", reg);
    expect(s().panels.b!.command).toBe("VOD LN GP 1Y");
    expect(s().panels.c!.command).toBe("AAPL US HP"); // different group
    expect(s().panels.d!.command).toBe("WEI"); // not security-based
  });

  it("keeps unknown commands so the panel can explain them", () => {
    s().openCommand("blah", reg);
    expect(s().panels.a!.command).toBe("BLAH");
  });

  it("closes panels and moves focus", () => {
    s().closePanel("a");
    expect(s().order).toEqual(["b", "c", "d"]);
    expect(s().focusedId).toBe("b");
  });

  it("cycles link colours", () => {
    s().cycleLink("a");
    expect(s().panels.a!.link).toBe("cyan");
  });

  it("round-trips through a snapshot", () => {
    s().cycleLink("c");
    const snap = s().snapshot();
    expect(isSnapshot(snap)).toBe(true);
    s().load(defaultSnapshot());
    s().load(snap);
    expect(s().panels.c!.link).toBe("violet");
    expect(s().order).toEqual(["a", "b", "c", "d"]);
  });

  it("rejects malformed snapshots", () => {
    expect(isSnapshot({ version: 2, panels: [] })).toBe(false);
    expect(isSnapshot({ version: 1, panels: [{ id: 1 }] })).toBe(false);
  });

  it("relink keeps function and args", () => {
    expect(relink("AAPL US GP 1Y", "GBPUSD CUR", reg)).toBe("GBPUSD CUR GP 1Y");
    expect(relink("WEI", "VOD LN", reg)).toBeNull();
  });
});
