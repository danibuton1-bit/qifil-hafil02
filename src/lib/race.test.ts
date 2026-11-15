import { describe, it, expect } from "vitest";
import { ease, fitZoom, leader, netColor } from "./race";

describe("network colour", () => {
  it("blue when good, yellow when fair, red when bad", () => {
    expect(netColor(80)).toBe("biru");
    expect(netColor(200)).toBe("kuning");
    expect(netColor(600)).toBe("merah");
    expect(netColor(null)).toBe("merah");
  });
});

describe("drone camera", () => {
  it("moves smoothly, not in one jump", () => {
    const n = ease(0, 100);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(100);
  });
  it("zoom out fits the whole level", () => {
    expect(fitZoom(3840, 1280)).toBeCloseTo(1 / 3);
    expect(fitZoom(800, 1280)).toBe(1);
  });
  it("follows key holder first, then the furthest player", () => {
    expect(leader([{ x: 900, key: false }, { x: 300, key: true }])).toBe(1);
    expect(leader([{ x: 200, key: false }, { x: 700, key: false }])).toBe(1);
    expect(leader([])).toBe(-1);
  });
});

import { raceMap, ghostSpeed, caught } from "./race";
describe("hantu & 3 jalur", () => {
  it("hantu diam 3 detik lalu makin cepat", () => {
    expect(ghostSpeed(2000)).toBe(0);
    expect(ghostSpeed(3000)).toBe(2);
    expect(ghostSpeed(60000)).toBeGreaterThan(ghostSpeed(10000));
  });
  it("pemain tertangkap jika hantu menyusul", () => {
    expect(caught(500, 480)).toBe(true);
    expect(caught(500, 520)).toBe(false);
  });
  it("kunci dan pintu di titik temu akhir, jalur tengah buntu", () => {
    const m = raceMap(1);
    expect(m.key.x).toBeGreaterThan(m.wall.x);
    expect(m.door.x).toBeGreaterThan(m.key.x);
    expect(m.spikes.length).toBeGreaterThan(0);
  });
});
