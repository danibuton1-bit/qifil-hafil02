// Solo-mode BOT partner and on-device level progress. Pure helpers so they can be tested.
import { MAX_LEVEL, PW, type Body, type Input, type Level } from "./game";

/** Where the bot wants to stand: on a bridge button while the player is near an unfinished bridge, else just behind the player. */
export function botTarget(bot: Body, me: Body, L: Level, ext: number[]): number {
  for (const [i, br] of L.bridges.entries()) {
    const near = me.x > br.x - 260 && me.x < br.x + br.w + 160;
    if (near && (ext[i] ?? 0) < 1.01) {
      const leftSide = me.x < br.x + br.w / 2;
      return (leftSide ? br.x - 50 : br.x + br.w + 50) - PW / 2;
    }
  }
  return me.x - 55 * Math.sign(me.x - bot.x || 1);
}

export function botInput(bot: Body, me: Body, L: Level, ext: number[]): Input {
  const tx = botTarget(bot, me, L, ext);
  const dir = tx > bot.x + 8 ? 1 : tx < bot.x - 8 ? -1 : 0;
  const front = dir > 0 ? bot.x + PW + 26 : bot.x - 26;
  const wall = dir !== 0 && L.platforms.some((p) => front > p.x && front < p.x + p.w && p.y < bot.y + 30 && p.y + p.h > bot.y);
  const pit = dir !== 0 && L.pits.some((p) => front > p.x && front < p.x + p.w);
  const climb = me.y < bot.y - 40 && Math.abs(me.x - bot.x) < 140;
  return { left: dir < 0, right: dir > 0, up: bot.onGround && (wall || pit || climb), down: false };
}

const KEY = "qh-progress";
export const loadProgress = (): number => {
  try { const n = Number(localStorage.getItem(KEY)); return n >= 1 && n <= MAX_LEVEL ? Math.floor(n) : 1; } catch { return 1; }
};
export const saveProgress = (n: number) => {
  try { if (n > loadProgress()) localStorage.setItem(KEY, String(n)); } catch { /* storage blocked */ }
};
