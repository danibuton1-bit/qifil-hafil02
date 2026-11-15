import { describe, it, expect } from "vitest";
import { step, usernameToEmail, isValidUsername, PH, H, hazardCheck, SHIELD_MS } from "./game";

const idle = { left: false, right: false, up: false, down: false };

describe("game rules", () => {
  it("login uses name only, mapped to a private address", () => {
    expect(usernameToEmail(" Qifil ")).toBe("qifil@qifilhafil.app");
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("hafil_01")).toBe(true);
  });
  it("player lands on top of the partner", () => {
    const partner = { x: 100, y: 600, w: 40, h: 40 };
    let b = { x: 100, y: 500, vx: 0, vy: 0, onGround: false };
    for (let i = 0; i < 60; i++) b = step(b, idle, [partner]);
    expect(b.y).toBe(600 - PH);
    expect(b.onGround).toBe(true);
  });
});

import { levelAt, MAX_LEVEL, MAX_GAP, JUMP, GRAVITY, SPEED, GY, BOX, BOX_WALL } from "./game";
describe("levels", () => {
  const reach = (JUMP * JUMP) / (2 * GRAVITY);
  it("there are 100 levels and later ones are longer", () => {
    expect(MAX_LEVEL).toBe(100);
    expect(levelAt(100).width).toBeGreaterThan(levelAt(1).width);
    expect(levelAt(1).width).toBeGreaterThan(2500);
  });
  it("every hole can be jumped across", () => {
    const airFrames = (2 * -JUMP) / GRAVITY;
    for (let n = 1; n <= MAX_LEVEL; n++)
      for (const p of levelAt(n).pits.filter((p) => p.w <= MAX_GAP)) expect(p.w).toBeLessThan(SPEED * airFrames - 20);
  });
  it("every block is climbable by one character (tall blocks have a helper step)", () => {
    for (let n = 1; n <= MAX_LEVEL; n++) {
      const tops = levelAt(n).platforms.map((p) => GY - p.y);
      for (const p of levelAt(n).platforms) {
        const h = GY - p.y;
        if (h <= reach - 20) continue;
        if (h === BOX_WALL) continue; // box stage: climbed with the pink/blue boxes
        // a tall block must have a helper step directly before it at half its height
        const helper = levelAt(n).platforms.find((q) => q.x + q.w === p.x && GY - q.y === h / 2);
        expect(helper).toBeDefined();
      }
    }
  });
});

describe("box stage", () => {
  const reach = (JUMP * JUMP) / (2 * GRAVITY);
  it("wooden block is too tall to jump but reachable from a box", () => {
    expect(BOX_WALL).toBeGreaterThan(reach);
    expect(BOX_WALL).toBeLessThan(reach + BOX - 10);
  });
});

describe("boxes and bridges", () => {
  it("levels have pink and blue boxes and bridge holes too wide to jump", () => {
    const all = Array.from({ length: MAX_LEVEL }, (_, i) => levelAt(i + 1));
    const boxes = all.flatMap((l) => l.boxes);
    expect(boxes.some((b) => b.color === "pink")).toBe(true);
    expect(boxes.some((b) => b.color === "biru")).toBe(true);
    const br = all.flatMap((l) => l.bridges);
    expect(br.length).toBeGreaterThan(0);
    for (const b of br) expect(b.w).toBeGreaterThan(MAX_GAP);
  });
});

describe("respawn protection", () => {
  const spike = [{ x: 200, y: GY - 16, w: 40, h: 16 }];
  const onSpike = { x: 200, y: GY - PH, vx: 0, vy: 0, onGround: true };

  it("spikes kill a normal player", () => {
    expect(hazardCheck(onSpike, spike, false)).toEqual({ dead: true, cause: "spike" });
  });
  it("spikes cannot kill a player who is still protected", () => {
    expect(hazardCheck(onSpike, spike, true)).toEqual({ dead: false });
  });
  it("falling out of the world still puts a protected player back", () => {
    expect(hazardCheck({ x: 200, y: H + 10, vx: 0, vy: 0, onGround: false }, spike, true))
      .toEqual({ dead: true, cause: "fall" });
  });
  it("safe ground is not a hazard", () => {
    expect(hazardCheck({ x: 80, y: 560, vx: 0, vy: 0, onGround: true }, spike, false)).toEqual({ dead: false });
  });
  it("protection lasts about 2.5 seconds", () => {
    expect(SHIELD_MS).toBe(2500);
  });
});

import { nextIndex, clampVolume } from "./music";
describe("game music", () => {
  it("moves to the next song and wraps after the last", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 0)).toBe(-1);
  });
  it("keeps volume between 0 and 100%", () => {
    expect(clampVolume(1.3)).toBe(1);
    expect(clampVolume(-0.1)).toBe(0);
    expect(clampVolume(0.6 - 0.1)).toBe(0.5);
  });
});

import { needsSeek } from "./music";
describe("music sync", () => {
  it("follows the host only when more than 1 second apart", () => {
    expect(needsSeek(10, 10.8)).toBe(false);
    expect(needsSeek(10, 11.5)).toBe(true);
  });
});
