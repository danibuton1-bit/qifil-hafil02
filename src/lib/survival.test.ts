import { describe, expect, it } from "vitest";
import { bridgeOpen, caughtMoving, glassPattern, SURVIVAL_MAX, tugResult, tugStep } from "./survival";

describe("survival rules", () => {
  it("has 10 levels", () => expect(SURVIVAL_MAX).toBe(10));
  it("timed bridge stays open 4 seconds after one press", () => {
    expect(bridgeOpen(1000, 4900)).toBe(true);
    expect(bridgeOpen(1000, 5000)).toBe(false);
    expect(bridgeOpen(null, 10)).toBe(false);
  });
  it("glass pattern is the same for the same seed", () => expect(glassPattern(4)).toEqual(glassPattern(4)));
  it("tug ends when the rope reaches a cliff", () => {
    expect(tugResult(tugStep(0.99, 1, 0))).toBe("win");
    expect(tugResult(tugStep(-0.99, 0, 0.05))).toBe("lose");
    expect(tugResult(0)).toBeNull();
  });
  it("red light only catches movers after the grace time", () => {
    expect(caughtMoving(true, 300, 5)).toBe(false);
    expect(caughtMoving(true, 500, 5)).toBe(true);
    expect(caughtMoving(true, 500, 0)).toBe(false);
    expect(caughtMoving(false, 900, 5)).toBe(false);
  });
});
