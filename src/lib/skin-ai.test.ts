import { describe, expect, it } from "vitest";
import { cleanAiSkins } from "./skin-ai";

describe("AI skin cleanup", () => {
  it("keeps valid skins and uppercases colors", () => {
    const r = cleanAiSkins({ skins: [{ name: "Naga Api", body: "#ff3b30", hat: "#ffd700", rarity: "Legendary" }] });
    expect(r).toEqual([{ name: "Naga Api", body: "#FF3B30", hat: "#FFD700", rarity: "legendary", story: "" }]);
  });
  it("drops skins with bad colors and defaults unknown rarity to common", () => {
    const r = cleanAiSkins({ skins: [{ name: "X", body: "red", hat: "#000000" }, { name: "Y", body: "#111111", hat: "#222222", rarity: "mythic" }] });
    expect(r.map((s) => s.name)).toEqual(["Y"]);
    expect(r[0]?.rarity).toBe("common");
  });
  it("never returns more skins than asked", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ name: `S${i}`, body: "#111111", hat: "#222222" }));
    expect(cleanAiSkins({ skins: many }, 3)).toHaveLength(3);
  });
});
