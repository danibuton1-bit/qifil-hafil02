// Survival (Squid Game style) rules. Pure helpers so they can be tested.
export type SurvivalKind = "ghost" | "gun" | "tug" | "glass" | "redlight" | "lava" | "bomb" | "tiles" | "rain" | "crown";
export const SURVIVAL_LEVELS: { kind: SurvivalKind; icon: string; name: string; goal: string }[] = [
  { kind: "ghost", icon: "👻", name: "DIKEJAR HANTU", goal: "Lari ke garis finis, jangan tersentuh hantu!" },
  { kind: "gun", icon: "🔫", name: "REBUT KUNCI", goal: "Tembak lawan, pegang kunci 10 detik untuk menang." },
  { kind: "tug", icon: "🪢", name: "TARIK TAMBANG", goal: "Tekan TARIK secepatnya! Yang kalah jatuh ke jurang." },
  { kind: "glass", icon: "🪟", name: "JEMBATAN KACA", goal: "Pilih kaca atas atau bawah. Kaca rapuh akan pecah!" },
  { kind: "redlight", icon: "🚦", name: "LAMPU MERAH", goal: "Lari saat hijau, DIAM saat merah." },
  { kind: "lava", icon: "🌋", name: "LAVA NAIK", goal: "Panjat terus, bertahan 30 detik." },
  { kind: "bomb", icon: "💣", name: "OPER BOM", goal: "Sentuh pemain lain untuk mengoper bom sebelum meledak." },
  { kind: "tiles", icon: "🧱", name: "UBIN RUNTUH", goal: "Ubin runtuh setelah diinjak. Bertahan 25 detik." },
  { kind: "rain", icon: "🗡️", name: "HUJAN DURI", goal: "Hindari duri yang jatuh. Bertahan 25 detik." },
  { kind: "crown", icon: "👑", name: "FINAL MAHKOTA", goal: "Rebut mahkota, pegang 8 detik jadi JUARA!" },
];
export const SURVIVAL_MAX = SURVIVAL_LEVELS.length;

/** Timed bridge: one press keeps it open for `ms`, so a lone player can cross. */
export const BRIDGE_MS = 4000;
export const bridgeOpen = (pressedAt: number | null, now: number, ms = BRIDGE_MS) =>
  pressedAt !== null && now - pressedAt >= 0 && now - pressedAt < ms;

/** Which glass is strong in each column: true = upper. Deterministic per seed. */
export function glassPattern(seed: number, n = 8): boolean[] {
  let s = (seed * 9301 + 49297) % 233280;
  return Array.from({ length: n }, () => { s = (s * 9301 + 49297) % 233280; return s / 233280 < 0.5; });
}

/** Tug of war: positive = you pull the rope your way. Returns new position. */
export const TUG_TAP = 0.035;
export const tugStep = (pos: number, taps: number, botPull: number) => Math.max(-1, Math.min(1, pos + taps * TUG_TAP - botPull));
export const tugResult = (pos: number): "win" | "lose" | null => (pos >= 1 ? "win" : pos <= -1 ? "lose" : null);

/** Red light: moving after the short grace period gets you eliminated. */
export const RED_GRACE_MS = 400;
export const caughtMoving = (red: boolean, sinceRedMs: number, speed: number) => red && sinceRedMs > RED_GRACE_MS && Math.abs(speed) > 0.5;

/** Holding the key / crown long enough wins the round. */
export const HOLD_WIN_MS = { gun: 10000, crown: 8000 } as const;
