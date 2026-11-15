import { describe, expect, it } from "vitest";
import { applyHit, canStart, MAX_PLAYERS, TARGET, winner } from "./bayone";

describe("bay one rules", () => {
  it("first to 30 points wins", () => {
    expect(TARGET).toBe(30);
    expect(winner({ a: 29, b: 10 })).toBeNull();
    expect(winner({ a: 30, b: 10 })).toBe("a");
  });
  it("player dies when HP hits 0", () => {
    expect(applyHit(100, 34)).toEqual({ hp: 66, dead: false });
    expect(applyHit(20, 34)).toEqual({ hp: 0, dead: true });
  });
  it("needs 2-5 players, all READY", () => {
    expect(MAX_PLAYERS).toBe(5);
    expect(canStart([{ ready: true }])).toBe(false);
    expect(canStart([{ ready: true }, { ready: false }])).toBe(false);
    expect(canStart([{ ready: true }, { ready: true }])).toBe(true);
    expect(canStart(Array(6).fill({ ready: true }))).toBe(false);
  });
});
