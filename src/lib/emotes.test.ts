import { describe, it, expect } from "vitest";
import { ALL_EMOTES, DEFAULT_LOADOUT, toggleLoadout, cleanLoadout } from "./emotes";

describe("emotes", () => {
  it("has 10 new emotes on top of the 3 originals, 2 dark", () => {
    expect(ALL_EMOTES.length).toBe(13);
    expect(ALL_EMOTES.filter((e) => e.dark).length).toBe(2);
    expect(ALL_EMOTES.filter((e) => e.scope === "all").length).toBe(1);
    expect(ALL_EMOTES.filter((e) => e.scope === "duo").length).toBe(1);
  });
  it("lobby holds at most 7", () => {
    expect(DEFAULT_LOADOUT.length).toBe(7);
    expect(toggleLoadout(DEFAULT_LOADOUT, "cry")).toEqual(DEFAULT_LOADOUT);
    const six = toggleLoadout(DEFAULT_LOADOUT, "love");
    expect(six.length).toBe(6);
    expect(toggleLoadout(six, "dark")).toContain("dark");
  });
  it("cleans bad saved data", () => {
    expect(cleanLoadout(["x", "dark", "dark"])).toEqual(["dark"]);
    expect(cleanLoadout(null)).toEqual(DEFAULT_LOADOUT);
  });
});
