import { describe, expect, it } from "vitest";
import { SPIN_COST, STARTING_DIAMONDS, canSpin, validGift } from "./economy";
describe("economy", () => {
  it("new players start with 200 diamonds", () => expect(STARTING_DIAMONDS).toBe(200));
  it("one spin costs 20 diamonds", () => { expect(SPIN_COST).toBe(20); expect(canSpin(19)).toBe(false); expect(canSpin(20)).toBe(true); });
  it("gift must be positive whole number", () => { expect(validGift(0)).toBe(false); expect(validGift(-5)).toBe(false); expect(validGift(1.5)).toBe(false); expect(validGift(500)).toBe(true); });
});
