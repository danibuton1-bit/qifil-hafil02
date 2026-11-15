// Tournament race rules: everyone races the same level alone, first to grab the key and reach the door wins.
import { BOX, GY, PH, type Level, type Rect } from "./game";

/** Network quality colour from round-trip time: blue good, yellow fair, red bad. */
export const netColor = (ms: number | null | undefined) =>
  ms == null || ms >= 400 ? "merah" : ms >= 150 ? "kuning" : "biru";
export const NET_HEX = { biru: "#3B82F6", kuning: "#FACC15", merah: "#EF4444" } as const;

/** Cinematic easing: move a fraction of the way toward the target each frame. */
export const ease = (cur: number, target: number, k = 0.08) => cur + (target - cur) * k;

/** Zoom that fits the whole level width on screen ("seisi ruangan"). */
export const fitZoom = (levelWidth: number, screenW: number) => Math.min(1, screenW / levelWidth);

/** Index of the race leader: key holders first, then furthest right. */
export function leader(ps: { x: number; key: boolean }[]): number {
  let best = -1;
  ps.forEach((p, i) => {
    const b = ps[best];
    if (!b || (p.key && !b.key) || (p.key === b.key && p.x > b.x)) best = i;
  });
  return best;
}

/** Solid ground for a race: bridges are always out, boxes become a fixed step in front of their wooden block. */
export function raceSolids(l: Level): Rect[] {
  const s: Rect[] = [...l.platforms];
  for (const b of l.bridges) s.push({ x: b.x, y: GY, w: b.w, h: 20 });
  for (const b of l.boxes) if (b.color === "pink") s.push({ x: b.x + 300 - BOX, y: GY - BOX, w: BOX, h: BOX });
  return s;
}

export type RaceMap = { width: number; spawn: [number, number]; solids: Rect[]; spikes: Rect[]; key: { x: number; y: number }; door: { x: number; y: number }; wall: Rect };

/** Race arena with 3 lanes that split after the start:
 *  bottom = easy (safe but must climb stairs at the end), top = hard (spikes, narrow pads, straight to finish),
 *  middle = dead end (a wall blocks it, you must turn back). Hard and easy meet at the finish with key + door. */
export function raceMap(level: number): RaceMap {
  const solids: Rect[] = [{ x: 0, y: GY, w: 3700, h: 80 }];
  const spikes: Rect[] = [];
  // fork: thin step, then middle shelf, block up to the top lane
  solids.push({ x: 380, y: 570, w: 80, h: 16 });
  solids.push({ x: 500, y: 500, w: 1430, h: 20 }); // middle lane (dead end)
  solids.push({ x: 600, y: 430, w: 60, h: 70 });
  const wall = { x: 1900, y: 380, w: 30, h: 120 };
  solids.push(wall);
  // hard top lane: narrow pads with gaps, spikes on some pads
  const off = (level * 37) % 60;
  for (let x = 700, i = 0; x < 3050; x += 230, i++) {
    const w = Math.min(150, 3050 - x);
    solids.push({ x, y: 360, w, h: 20 });
    if (i % 2 === 1 && w >= 120) spikes.push({ x: x + 40 + (off % 40), y: 346, w: 28, h: 14 });
  }
  // easy bottom lane: little safe bumps, then stairs up to the finish
  for (let x = 900; x < 2800; x += 420) solids.push({ x, y: GY - 28, w: 50, h: 28 });
  solids.push({ x: 2950, y: 570, w: 60, h: 16 }, { x: 3020, y: 500, w: 60, h: 16 }, { x: 3090, y: 430, w: 60, h: 16 });
  // finish where hard + easy meet
  solids.push({ x: 3150, y: 360, w: 550, h: 280 });
  return { width: 3700, spawn: [100, GY - PH], solids, spikes, wall, key: { x: 3350, y: 320 }, door: { x: 3580, y: 280 } };
}

/** Ghost chasing from the left: waits 3s, then speeds up over time (px per frame, capped). */
export const GHOST_DELAY = 3000;
export const ghostSpeed = (ms: number) => (ms < GHOST_DELAY ? 0 : Math.min(4.6, 2 + (ms - GHOST_DELAY) / 20000));
/** Caught when the ghost's front edge reaches the player. */
export const caught = (ghostX: number, playerX: number) => playerX < ghostX;
