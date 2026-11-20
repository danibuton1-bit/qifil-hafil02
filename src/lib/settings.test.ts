import { describe, expect, it } from "vitest";
import { cleanSettings, DEFAULT_SETTINGS, nextVideo } from "./settings";

describe("audio settings", () => {
  it("defaults to everything on when nothing is saved", () => {
    expect(cleanSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.video && DEFAULT_SETTINGS.music && DEFAULT_SETTINGS.sfx).toBe(true);
  });
  it("keeps a player's choice to turn lobby video sound off", () => {
    expect(cleanSettings({ video: false }).video).toBe(false);
  });
  it("clamps video volume between 0 and 1", () => {
    expect(cleanSettings({ videoVol: 5 }).videoVol).toBe(1);
    expect(cleanSettings({ videoVol: -1 }).videoVol).toBe(0);
  });
});

describe("lobby video playlist", () => {
  it("plays every uploaded video in order and loops back to the first", () => {
    expect(nextVideo(0, 3)).toBe(1);
    expect(nextVideo(2, 3)).toBe(0);
    expect(nextVideo(0, 0)).toBe(-1);
  });
});
