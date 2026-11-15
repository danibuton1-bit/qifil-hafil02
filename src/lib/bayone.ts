/** Bay One: top-down shooter rules shared by online and BOT matches. */
export const AW = 960, AH = 540, R = 16;
export const TARGET = 30;
export const MAX_HP = 100;
export const MAX_PLAYERS = 5;

export type Weapon = { name: string; dmg: number; ammo: number; cd: number; speed: number; range: number };
export const WEAPONS: Weapon[] = [
  { name: "AUG-III", dmg: 20, ammo: 30, cd: 140, speed: 12, range: 520 },
  { name: "RIFLE", dmg: 34, ammo: 10, cd: 450, speed: 16, range: 800 },
  { name: "PISTOL", dmg: 25, ammo: 12, cd: 260, speed: 11, range: 420 },
  { name: "PISAU", dmg: 50, ammo: Infinity, cd: 380, speed: 9, range: 50 },
  { name: "TINJU", dmg: 15, ammo: Infinity, cd: 250, speed: 8, range: 36 },
];

export type Rect = { x: number; y: number; w: number; h: number };
/** Wooden blocks and crates: bullets stop on them, players can hide behind them. */
export const COVER: Rect[] = [
  { x: 200, y: 120, w: 70, h: 70 }, { x: 690, y: 120, w: 70, h: 70 },
  { x: 445, y: 220, w: 70, h: 100 }, { x: 200, y: 350, w: 70, h: 70 },
  { x: 690, y: 350, w: 70, h: 70 }, { x: 80, y: 240, w: 40, h: 60 }, { x: 840, y: 240, w: 40, h: 60 },
];
export const SPAWNS = [
  { x: 40, y: 40 }, { x: 920, y: 500 }, { x: 920, y: 40 }, { x: 40, y: 500 }, { x: 480, y: 480 },
];

export const hitsRect = (x: number, y: number, r: number, b: Rect) =>
  x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h;

/** Move a circle, stopping at the arena edge and at cover. */
export function moveCircle(x: number, y: number, dx: number, dy: number) {
  let nx = Math.max(R, Math.min(AW - R, x + dx));
  if (COVER.some((c) => hitsRect(nx, y, R, c))) nx = x;
  let ny = Math.max(R, Math.min(AH - R, y + dy));
  if (COVER.some((c) => hitsRect(nx, ny, R, c))) ny = y;
  return { x: nx, y: ny };
}

/** HP after a hit; dead when it reaches 0. */
export function applyHit(hp: number, dmg: number) {
  const left = Math.max(0, hp - dmg);
  return { hp: left, dead: left === 0 };
}

export function winner(kills: Record<string, number>): string | null {
  for (const [id, k] of Object.entries(kills)) if (k >= TARGET) return id;
  return null;
}

/** Room codes are 4 digits, like the original design. */
export const newCode = () => String(Math.floor(1000 + Math.random() * 9000));
export const canStart = (players: { ready: boolean }[]) =>
  players.length >= 2 && players.length <= MAX_PLAYERS && players.every((p) => p.ready);
