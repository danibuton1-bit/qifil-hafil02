import { describe, expect, it } from "vitest";
import { botInput, botTarget } from "./bot";
import { levelAt } from "./game";
const body = (x: number, y = 600) => ({ x, y, vx: 0, vy: 0, onGround: true });
describe("solo bot", () => {
  it("walks toward the player", () => {
    const L = levelAt(1);
    expect(botInput(body(100), body(400), L, []).right).toBe(true);
  });
  it("goes to the bridge button when the player is near a bridge", () => {
    const L = levelAt(4);
    const br = L.bridges[0]!;
    expect(br).toBeDefined();
    expect(botTarget(body(0), body(br.x - 100), L, [0])).toBe(br.x - 50 - 20);
  });
});
