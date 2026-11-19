import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GY, H, PH, PW, SKINS, W, overlap, step, type Body, type Input, type Rect } from "@/lib/game";
import { BRIDGE_MS, HOLD_WIN_MS, SURVIVAL_LEVELS, SURVIVAL_MAX, bridgeOpen, caughtMoving, glassPattern, tugResult, tugStep, type SurvivalKind } from "@/lib/survival";
import { Character, savedSkin } from "@/components/Character";
import { useLuckySkin } from "@/components/LuckyRoyale";
import { useProfile } from "@/lib/use-profile";
import { useGameMusic } from "@/lib/music";
import { sfx } from "@/lib/sfx";
import { ALL_EMOTES, cleanLoadout, DEFAULT_LOADOUT, emoteById } from "@/lib/emotes";

type Colors = { body: string; hat: string };
type P = { name: string; col: Colors; b: Body; bot: boolean; alive: boolean; face: number; cd: number; shield: number; hold: number; jumpT: number; lane: number; say?: string; sayUntil?: number };
type Hz = Rect & { vx: number; vy: number; t: number; on: boolean; base: number; k: string };
type Bullet = { x: number; y: number; vx: number; by: number };
type Tile = Rect & { t: number; gone: boolean };
type Glass = Rect & { strong: boolean; gone: boolean };
type St = {
  kind: SurvivalKind; width: number; plats: Rect[]; ps: P[]; f: number; t0: number;
  finish: number; ghostX: number; btn: { x: number; at: number | null }; bridge: Rect | null;
  bullets: Bullet[]; item: { x: number; y: number; by: number } ; door: number;
  tug: number; taps: number; glass: Glass[]; red: boolean; lightAt: number; nextLight: number;
  lava: number; bomb: number; bombAt: number; booms: number; tiles: Tile[]; spikes: Rect[]; survive: number; over: boolean;
  hz: Hz[]; wind: number; ctiles: (Rect & { c: number })[]; ctarget: number; zoneL: number; zoneR: number;
};

const SURVIVE_HZ = new Set(["laser", "barrel", "meteor", "cannon"]);
const RACE_HZ = new Set(["saw", "mines", "piston"]);
const COLORS = ["#ef4444", "#3b82f6", "#facc15"], COLOR_NAMES = ["MERAH", "BIRU", "KUNING"];
const colorPhase = (T: number) => ({ cycle: Math.floor(T / 4000), hide: T % 4000 > 2600 });
const QUICK = ["Awas! 😱", "Kejar dia!", "GG! 👍", "Haha 🤣", "Nice try!", "Tolong! 🙏"];
const BOTS = ["BOT Rara", "BOT Jaya", "BOT Nana", "BOT Udin"];
const BOT_COLS = (Object.values(SKINS) as Colors[]);
const ground = (from: number, to: number): Rect => ({ x: from, y: GY, w: to - from, h: 80 });

function build(level: number, me: { name: string; col: Colors }): St {
  const kind = SURVIVAL_LEVELS[level - 1]!.kind;
  const mk = (name: string, col: Colors, bot: boolean, x: number, y = 560): P => ({ name, col, bot, alive: true, face: 1, cd: 0, shield: 0, hold: 0, jumpT: 0, lane: 0, b: { x, y, vx: 0, vy: 0, onGround: false } });
  const s: St = {
    kind, width: W, plats: [ground(0, W)], ps: [], f: 0, t0: performance.now(), finish: 0, ghostX: -260,
    btn: { x: -999, at: null }, bridge: null, bullets: [], item: { x: 620, y: 290, by: -1 }, door: 0,
    tug: 0, taps: 0, glass: [], red: false, lightAt: performance.now(), nextLight: 3000, lava: H + 40,
    bomb: -1, bombAt: performance.now(), booms: 0, tiles: [], spikes: [], survive: 0, over: false,
    hz: [], wind: 0, ctiles: [], ctarget: 0, zoneL: 0, zoneR: W,
  };
  const xs = [80, 160, 240, 320, 400];
  if (kind === "ghost") {
    s.width = 3300; s.finish = 3100;
    s.plats = [ground(0, 700), ground(840, 1300), ground(1450, 1900), ground(2160, 2500), ground(2640, 3300), { x: 1100, y: GY - 90, w: 120, h: 24 }];
    s.btn.x = 1820; s.bridge = { x: 1900, y: GY, w: 260, h: 18 };
  } else if (kind === "gun" || kind === "crown") {
    s.plats.push({ x: 160, y: 480, w: 220, h: 24 }, { x: 900, y: 480, w: 220, h: 24 }, { x: 520, y: 340, w: 240, h: 24 });
    if (kind === "crown") s.plats.push({ x: 40, y: 220, w: 160, h: 24 }, { x: 1080, y: 220, w: 160, h: 24 });
    s.item = { x: 630, y: 300, by: -1 };
  } else if (kind === "glass") {
    const pat = glassPattern(level + Math.floor(Math.random() * 1000));
    s.width = 1800; s.finish = 1460;
    s.plats = [ground(0, 300), ground(1420, 1800)];
    pat.forEach((up, i) => { const x = 330 + i * 136; s.glass.push({ x, y: GY - 110, w: 92, h: 16, strong: up, gone: false }, { x, y: GY, w: 92, h: 16, strong: !up, gone: false }); });
  } else if (kind === "redlight") {
    s.width = 2800; s.finish = 2560; s.plats = [ground(0, 2800)];
  } else if (kind === "lava") {
    s.plats = [ground(0, W)];
    [[100, 560], [420, 480], [760, 400], [1020, 320], [700, 240], [380, 170], [80, 110], [980, 140]].forEach(([x, y]) => s.plats.push({ x: x!, y: y!, w: 200, h: 22 }));
    s.survive = 30000;
  } else if (kind === "bomb") {
    s.plats.push({ x: 200, y: 470, w: 260, h: 24 }, { x: 820, y: 470, w: 260, h: 24 });
    s.survive = 0;
  } else if (kind === "tiles") {
    s.plats = [];
    for (const y of [300, 450, 600]) for (let x = 40; x < W - 40; x += 70) s.tiles.push({ x, y, w: 64, h: 18, t: 0, gone: false });
    s.survive = 25000;
  } else if (kind === "rain" || kind === "laser" || kind === "barrel" || kind === "meteor" || kind === "cannon" || kind === "zone") {
    s.survive = 25000;
  } else if (kind === "wind") {
    s.plats = [ground(220, W - 220), { x: 420, y: 500, w: 160, h: 22 }, { x: 700, y: 500, w: 160, h: 22 }]; s.survive = 25000;
  } else if (kind === "color") {
    s.plats = []; s.survive = 30000;
    for (let x = 40, i = 0; x < W - 40; x += 75, i++) s.ctiles.push({ x, y: 560, w: 70, h: 22, c: (i * 7 + Math.floor(Math.random() * 3)) % 3 });
  } else if (kind === "saw" || kind === "mines" || kind === "piston") {
    s.width = 3000; s.finish = 2800; s.plats = [ground(0, 3000)];
    const mkHz = (x: number, y: number, w: number, h: number, k: string): Hz => ({ x, y, w, h, vx: 0, vy: 0, t: 0, on: true, base: y, k });
    if (kind === "saw") for (let x = 500; x < 2700; x += 330) s.hz.push(mkHz(x, GY - 150, 44, 44, "saw"));
    if (kind === "mines") for (let x = 420; x < 2700; x += 160 + Math.random() * 120) s.hz.push(mkHz(x, GY - 10, 34, 10, "mine"));
    if (kind === "piston") for (let x = 480; x < 2700; x += 360) s.hz.push(mkHz(x, 0, 100, 0, "piston"));
  }
  s.ps = [mk(me.name, me.col, false, xs[0]!, kind === "tiles" ? 240 : 560)];
  BOTS.forEach((n, i) => s.ps.push(mk(n, BOT_COLS[(i + 1) % BOT_COLS.length]!, true, kind === "gun" || kind === "crown" || kind === "bomb" || kind === "rain" || kind === "tiles" || kind === "laser" || kind === "barrel" || kind === "meteor" || kind === "cannon" || kind === "zone" || kind === "wind" || kind === "color" ? 260 + i * 220 : xs[i + 1]!, kind === "tiles" ? 240 : 560)));
  if (kind === "bomb") s.bomb = 1 + Math.floor(Math.random() * 4);
  return s;
}

const elapsed = (s: St) => performance.now() - s.t0;

export function Survival() {
  const navigate = useNavigate();
  const prof = useProfile();
  const lucky = useLuckySkin();
  const music = useGameMusic("game");
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<Input>({ left: false, right: false, up: false, down: false });
  const act = useRef(false);
  const [level, setLevel] = useState(1);
  const [toast, setToast] = useState("");
  const [result, setResult] = useState<null | { win: boolean; name: string; col: Colors; msg: string }>(null);
  const meRef = useRef({ name: "KAMU", col: SKINS.pink as Colors });
  const st = useRef<St | null>(null);
  const [panel, setPanel] = useState<null | "emo" | "chat">(null);
  const [loadout, setLoadout] = useState<string[]>(DEFAULT_LOADOUT);
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<{ n: string; t: string }[]>([]);
  useEffect(() => { try { setLoadout(cleanLoadout(JSON.parse(localStorage.getItem("emote-loadout") ?? "null"))); } catch { /* default */ } }, []);
  const say = (i: number, text: string) => {
    const p = st.current?.ps[i]; if (!p) return;
    p.say = text; p.sayUntil = performance.now() + 3500;
    setLog((l) => [...l.slice(-4), { n: p.name, t: text }]);
  };
  const botReply = (emo: boolean) => setTimeout(() => {
    const s = st.current; if (!s || Math.random() < 0.4) return;
    const i = 1 + Math.floor(Math.random() * (s.ps.length - 1));
    if (emo) { const e = ALL_EMOTES[Math.floor(Math.random() * ALL_EMOTES.length)]!; say(i, e.icon); } else say(i, QUICK[Math.floor(Math.random() * QUICK.length)]!);
  }, 900 + Math.random() * 1200);
  const doEmote = (id: string) => {
    const e = emoteById(id); if (!e) return; sfx.emote(id); setPanel(null);
    say(0, `${e.icon} ${e.label}`);
    const s = st.current; if (s && (e.scope === "all" || e.scope === "duo")) s.ps.slice(1, e.scope === "all" ? undefined : 2).forEach((_, k) => say(k + 1, e.icon));
    botReply(true);
  };
  const doChat = (t: string) => { const v = t.trim().slice(0, 40); if (!v) return; sfx.chat(); say(0, v); setMsg(""); setPanel(null); botReply(false); };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1800); };

  useEffect(() => {
    meRef.current = { name: prof?.username ?? "KAMU", col: lucky ?? SKINS[savedSkin("qifil")] };
  }, [prof, lucky]);

  const begin = (n: number) => { setResult(null); setLevel(n); st.current = build(n, meRef.current); flash(`${SURVIVAL_LEVELS[n - 1]!.icon} ${SURVIVAL_LEVELS[n - 1]!.goal}`); };
  useEffect(() => { begin(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    const keys: Record<string, keyof Input> = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", " ": "up", ArrowDown: "down", s: "down" };
    const dn = (e: KeyboardEvent) => { if (e.key === "f" || e.key === "j" || e.key === "Enter") act.current = true; const k = keys[e.key]; if (k) { input.current[k] = true; e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { const k = keys[e.key]; if (k) input.current[k] = false; };
    addEventListener("keydown", dn); addEventListener("keyup", up);
    return () => { removeEventListener("keydown", dn); removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const end = (s: St, win: boolean, who: P, msg: string) => {
      if (s.over) return; s.over = true;
      setResult({ win, name: who.name, col: who.col, msg }); if (win) sfx.win(); else sfx.lose();
    };
    const eliminate = (s: St, p: P, why: string) => {
      if (!p.alive) return;
      p.alive = false; if (why.includes("lava")) sfx.hiss(); else if (why.includes("ranjau") || why.includes("meteor")) sfx.boom(); else sfx.hit();
      if (!p.bot) end(s, false, p, `Kamu tereliminasi: ${why}`);
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = st.current;
      if (!s) return;
      const now = performance.now(), T = elapsed(s);
      s.f++;
      const me = s.ps[0]!;
      const alive = s.ps.filter((p) => p.alive);
      const lvl = SURVIVAL_LEVELS.findIndex((l) => l.kind === s.kind) + 1;

      if (!s.over && s.kind !== "tug") {
        // solids for this frame
        const solids: Rect[] = [...s.plats];
        const open = bridgeOpen(s.btn.at, now);
        if (s.bridge && open) solids.push(s.bridge);
        for (const g of s.glass) if (!g.gone) solids.push(g);
        for (const t of s.tiles) if (!t.gone) solids.push(t);
        for (const t of s.ctiles) if (!(t as Rect & { hid?: boolean }).hid) solids.push(t);
        const hasFloor = (x: number, y: number) => solids.some((r) => x >= r.x && x <= r.x + r.w && r.y >= y - 4 && r.y <= y + 140);
        const target = (p: P): Input => {
          const i: Input = { left: false, right: false, up: false, down: false };
          const b = p.b, cx = b.x + PW / 2;
          const go = (x: number) => { if (x > cx + 8) i.right = true; else if (x < cx - 8) i.left = true; };
          const jumpGap = () => { const ax = cx + (i.right ? 70 : i.left ? -70 : 0); if (b.onGround && (i.left || i.right) && !hasFloor(ax, b.y + PH)) i.up = true; };
          if (s.kind === "ghost") {
            const atBridge = s.bridge && cx > s.bridge.x - 120 && cx < s.bridge.x && !open;
            go(atBridge ? s.btn.x : s.finish + 100); jumpGap(); if (atBridge && Math.abs(cx - s.btn.x) < 20) i.right = false;
          } else if (s.kind === "redlight") {
            if (!s.red || (now - s.lightAt < 250 + p.lane)) go(s.finish + 100);
          } else if (s.kind === "glass") {
            go(s.finish + 100);
            if (b.onGround && p.jumpT <= 0 && b.y + PH < GY - 60 === false && Math.random() < 0.5) { i.up = true; }
            p.jumpT = b.onGround ? p.jumpT - 1 : 30;
          } else if (s.kind === "gun" || s.kind === "crown") {
            const goal = s.item.by >= 0 && s.item.by !== s.ps.indexOf(p) ? s.ps[s.item.by]!.b : s.item.by === s.ps.indexOf(p) ? { x: (s.f % 600 < 300 ? 100 : 1100), y: 560 } : { x: s.item.x, y: s.item.y };
            go(goal.x + PW / 2); if (goal.y < b.y - 40 && b.onGround && Math.abs(goal.x - b.x) < 220) i.up = true; jumpGap();
            if (s.kind === "gun" && p.cd <= 0 && Math.random() < 0.05) { const t = alive.find((o) => o !== p && Math.abs(o.b.y - b.y) < 30 && Math.abs(o.b.x - b.x) < 500); if (t) { p.face = t.b.x > b.x ? 1 : -1; shoot(s, p); } }
          } else if (s.kind === "lava") {
            const up = s.plats.filter((r) => r.y < b.y + PH - 10 && r.y > b.y + PH - 140).sort((a, c) => Math.abs(a.x + a.w / 2 - cx) - Math.abs(c.x + c.w / 2 - cx))[0];
            if (up) { go(up.x + up.w / 2); if (b.onGround && Math.abs(up.x + up.w / 2 - cx) < 170) i.up = true; }
          } else if (s.kind === "bomb") {
            const holder = s.ps[s.bomb];
            if (s.bomb === s.ps.indexOf(p)) { const n = alive.filter((o) => o !== p).sort((a, c) => Math.abs(a.b.x - b.x) - Math.abs(c.b.x - b.x))[0]; if (n) { go(n.b.x + PW / 2); if (n.b.y < b.y - 40 && b.onGround) i.up = true; } }
            else if (holder && Math.abs(holder.b.x - b.x) < 260) { go(holder.b.x > b.x ? b.x - 200 : b.x + 240); if (Math.random() < 0.03 && b.onGround) i.up = true; }
          } else if (s.kind === "tiles") {
            if (s.f % 90 === 0) p.lane = Math.random() < 0.5 ? -1 : 1;
            if (p.lane < 0) i.left = true; else i.right = true;
            jumpGap(); if (b.x < 60) p.lane = 1; if (b.x > W - 100) p.lane = -1;
          } else if (s.kind === "rain") {
            const d = s.spikes.find((k) => Math.abs(k.x - cx) < 60 && k.y < b.y);
            if (d) go(d.x > cx ? cx - 120 : cx + 120);
          } else if (SURVIVE_HZ.has(s.kind) || s.kind === "zone") {
            if (s.kind === "zone") go((s.zoneL + s.zoneR) / 2 + p.lane * 40);
            if (s.f % 120 === 0) p.lane = Math.random() * 2 - 1;
            for (const h of s.hz) {
              const hx = h.x + h.w / 2, d = hx - cx;
              if (h.k === "warn" && Math.abs(d) < h.w / 2 + 40) go(d > 0 ? cx - 200 : cx + 200);
              if ((h.k === "laser" || h.k === "barrel" || h.k === "ball") && h.y > b.y - 30 && Math.sign(-d) === Math.sign(h.vx) && Math.abs(d) < 110 && b.onGround && Math.random() < 0.6) i.up = true;
            }
          } else if (s.kind === "wind") {
            go(W / 2 + p.lane * 120 - s.wind * 40); if (s.f % 150 === 0) p.lane = Math.random() * 2 - 1;
          } else if (s.kind === "color") {
            const ph = colorPhase(T);
            if (s.f % 100 === 0) p.lane = Math.random() < 0.5 ? -1 : 1;
            const ok = s.ctiles.filter((t) => t.c === s.ctarget).sort((a, c) => Math.abs(a.x + 35 - cx) - Math.abs(c.x + 35 - cx))[0];
            if (ok && (T % 4000) > 900) go(ok.x + 35); else if (p.lane < 0) i.left = true; else i.right = true;
            void ph; jumpGap();
          } else if (RACE_HZ.has(s.kind)) {
            const ahead = s.hz.find((h) => h.x - cx > -10 && h.x - cx < 130);
            if (s.kind === "piston" && ahead && ahead.h > GY - PH - 60 - p.lane * 0) { /* wait */ }
            else go(s.finish + 100);
            if (ahead && s.kind !== "piston" && b.onGround && ahead.x - cx < 70 && (s.kind === "mines" || ahead.y > b.y - 40)) i.up = true;
          }
          return i;
        };

        for (const [idx, p] of s.ps.entries()) {
          if (!p.alive) continue;
          const inp = p.bot ? target(p) : input.current;
          if (!p.bot && inp.up && p.b.onGround) sfx.jump();
          if (s.kind === "wind") p.b.x += s.wind;
          const prevX = p.b.x;
          p.b = step(p.b, inp, solids, s.width);
          if (inp.left) p.face = -1; else if (inp.right) p.face = 1;
          p.cd--;
          if (p.b.y > H) {
            if (s.kind === "gun" || s.kind === "crown") respawn(s, p, idx);
            else eliminate(s, p, "jatuh ke jurang");
            continue;
          }
          const cx = p.b.x + PW / 2;
          // standing on breakable things
          if (p.b.onGround) {
            for (const g of s.glass) if (!g.gone && !g.strong && cx > g.x - 6 && cx < g.x + g.w + 6 && Math.abs(p.b.y + PH - g.y) < 2) { g.gone = true; sfx.glass(); }
            for (const t of s.tiles) if (!t.gone && cx > t.x - 4 && cx < t.x + t.w + 4 && Math.abs(p.b.y + PH - t.y) < 2 && !t.t) { t.t = now; if (!p.bot) sfx.crack(); }
          }
          if (s.kind === "ghost") {
            if (Math.abs(cx - s.btn.x) < 30 && p.b.onGround && Math.abs(p.b.y + PH - GY) < 4 && !open) s.btn.at = now;
            if (p.b.x < s.ghostX + 70) eliminate(s, p, "ditangkap hantu");
            if (p.b.x > s.finish && !s.over) end(s, idx === 0, p, idx === 0 ? "Kamu lolos dari hantu!" : `${p.name} sampai duluan`);
          }
          if (s.kind === "redlight") {
            if (caughtMoving(s.red, now - s.lightAt, p.b.x - prevX)) eliminate(s, p, "bergerak saat lampu merah");
            if (p.b.x > s.finish && !s.over) end(s, idx === 0, p, idx === 0 ? "Kamu lolos lampu merah!" : `${p.name} sampai duluan`);
          }
          if (s.kind === "glass" && p.b.x > s.finish && !s.over) end(s, idx === 0, p, idx === 0 ? "Kamu menyeberangi jembatan kaca!" : `${p.name} menyeberang duluan`);
          const body = { x: p.b.x + 6, y: p.b.y + 4, w: PW - 12, h: PH - 4 };
          for (const h of s.hz) if (h.on && h.k !== "warn" && overlap(body, h)) { eliminate(s, p, h.k === "mine" ? "kena ranjau" : h.k === "boom" ? "tertimpa meteor" : h.k === "piston" ? "tergencet balok" : "terkena rintangan"); break; }
          if (s.kind === "zone" && (cx < s.zoneL || cx > s.zoneR)) eliminate(s, p, "menghirup gas beracun");
          if (RACE_HZ.has(s.kind) && p.alive && p.b.x > s.finish && !s.over) end(s, idx === 0, p, idx === 0 ? "Kamu sampai finis duluan!" : `${p.name} sampai duluan`);
          if (s.kind === "lava" && p.b.y + PH > s.lava + 6) eliminate(s, p, "terkena lava");
          if (s.kind === "rain" && s.spikes.some((k) => overlap({ x: p.b.x + 6, y: p.b.y + 4, w: PW - 12, h: PH - 4 }, k))) eliminate(s, p, "tertusuk duri");
          if ((s.kind === "gun" || s.kind === "crown") && p.alive) {
            if (s.item.by < 0 && overlap({ x: p.b.x, y: p.b.y, w: PW, h: PH }, { x: s.item.x - 14, y: s.item.y - 14, w: 28, h: 28 })) { s.item.by = idx; sfx.coin(); }
            if (s.kind === "crown" && s.item.by >= 0 && s.item.by !== idx && p.cd <= 0) {
              const h = s.ps[s.item.by]!; if (h.cd <= 0 && overlap({ x: p.b.x, y: p.b.y, w: PW, h: PH }, { x: h.b.x, y: h.b.y, w: PW, h: PH })) { s.item.by = idx; p.cd = 60; h.cd = 60; sfx.coin(); }
            }
            if (s.item.by === idx) { p.hold += 16.7; const goal = HOLD_WIN_MS[s.kind]; if (p.hold >= goal) end(s, idx === 0, p, idx === 0 ? (s.kind === "crown" ? "Kamu JUARA SURVIVAL! 👑" : "Kamu merebut kunci!") : `${p.name} menang`); }
          }
          if (s.kind === "bomb" && s.bomb === idx && p.cd <= 0) {
            const n = alive.find((o) => o !== p && o.alive && overlap({ x: p.b.x, y: p.b.y, w: PW, h: PH }, { x: o.b.x, y: o.b.y, w: PW, h: PH }));
            if (n) { s.bomb = s.ps.indexOf(n); n.cd = 60; sfx.tap(); }
          }
        }
        if (s.kind === "gun" && act.current && me.alive && me.cd <= 0) { shoot(s, me); sfx.shoot(); }
        act.current = false;
        // world updates
        if (s.kind === "ghost") s.ghostX += 2.3 + s.f / 1800;
        if (s.kind === "redlight" && now - s.lightAt > s.nextLight) { s.red = !s.red; s.lightAt = now; s.nextLight = s.red ? 1800 + Math.random() * 1400 : 1800 + Math.random() * 2500; s.ps.forEach((p) => (p.lane = Math.random() < 0.15 ? 600 : 0)); if (s.red) sfx.whistle(); }
        if (s.kind === "lava") s.lava = Math.max(250, H + 40 - T * 0.016);
        for (const t of s.tiles) if (t.t && !t.gone && now - t.t > 900) t.gone = true;
        if (s.kind === "rain") {
          if (s.f % Math.max(8, 26 - Math.floor(T / 1500)) === 0) s.spikes.push({ x: Math.random() * (W - 20), y: -30, w: 18, h: 30 });
          s.spikes.forEach((k) => (k.y += 7)); s.spikes = s.spikes.filter((k) => k.y < GY);
        }
        if (s.kind === "gun") {
          for (const bl of s.bullets) {
            bl.x += bl.vx;
            const hit = s.ps.findIndex((p, i) => p.alive && i !== bl.by && now > p.shield && overlap({ x: p.b.x, y: p.b.y, w: PW, h: PH }, { x: bl.x, y: bl.y, w: 10, h: 6 }));
            if (hit >= 0) { bl.x = -9999; const p = s.ps[hit]!; if (hit === 0) flash("💥 Kamu tertembak! Respawn"); sfx.hit(); respawn(s, p, hit); }
          }
          s.bullets = s.bullets.filter((b) => b.x > -20 && b.x < W + 20);
        }
        if (s.kind === "bomb" && now - s.bombAt > 7000 && !s.over) {
          const h = s.ps[s.bomb]!; s.booms++;
          flash(`💥 BOM meledak di ${h.name}!`); sfx.boom();
          eliminate(s, h, "bom meledak");
          const rest = s.ps.filter((p) => p.alive);
          if (!s.over && (s.booms >= 3 || rest.length <= 1)) end(s, true, me, "Kamu selamat dari bom!");
          s.bomb = s.ps.indexOf(rest[Math.floor(Math.random() * rest.length)] ?? me); s.bombAt = now;
        }
        const mk = (x: number, y: number, w: number, h: number, k: string, vx = 0, vy = 0): Hz => ({ x, y, w, h, vx, vy, t: now, on: true, base: y, k });
        if (s.kind === "laser" && s.f % Math.max(70, 140 - Math.floor(T / 400)) === 0) {
          const left = Math.random() < 0.5, high = Math.random() < 0.35;
          s.hz.push(mk(left ? -20 : W + 20, high ? GY - PH - 70 : GY - 34, 18, high ? 26 : 34, "laser", left ? 9 : -9)); sfx.zap();
        }
        if (s.kind === "barrel" && s.f % Math.max(45, 100 - Math.floor(T / 500)) === 0) { const left = Math.random() < 0.3; s.hz.push(mk(left ? -50 : W + 10, GY - 40, 40, 40, "barrel", (left ? 1 : -1) * (5 + Math.random() * 3))); sfx.rumble(); }
        if (s.kind === "meteor" && s.f % Math.max(22, 50 - Math.floor(T / 800)) === 0) s.hz.push({ ...mk(Math.random() * (W - 130), GY - 40, 130, 40, "warn"), on: false });
        if (s.kind === "cannon" && s.f % Math.max(50, 100 - Math.floor(T / 600)) === 0) { const left = Math.random() < 0.5; s.hz.push(mk(left ? 0 : W - 40, 180, 38, 38, "ball", (left ? 1 : -1) * (4 + Math.random() * 3), 0)); sfx.thud(); }
        for (const h of s.hz) {
          if (h.k === "laser" || h.k === "barrel") h.x += h.vx;
          if (h.k === "ball") { h.x += h.vx; h.vy += 0.5; h.y += h.vy; if (h.y + h.h > GY) { h.y = GY - h.h; h.vy = -Math.max(11, Math.abs(h.vy) * 0.9); } }
          if (h.k === "warn" && now - h.t > 1300) { h.k = "boom"; h.on = true; h.y = 0; h.h = GY; h.t = now; sfx.boom(); }
          if (h.k === "saw") h.y = h.base + Math.sin(now / 380 + h.x) * 85;
          if (h.k === "piston") { const v = 0.5 + 0.5 * Math.sin(now / 550 + h.x / 97); const prev = h.h; h.h = 60 + v * (GY - 60); if (prev < GY - 40 && h.h >= GY - 40 && Math.abs(h.x - me.b.x) < 700) sfx.thud(); }
          if (h.k === "mine") h.on = true;
        }
        s.hz = s.hz.filter((h) => !(h.k === "boom" && now - h.t > 350) && h.x > -80 && h.x < s.width + 80);
        if (s.kind === "wind") s.wind = Math.sin(T / 1700) * (2 + T / 12000);
        if (s.kind === "color") {
          const ph = colorPhase(T), tgt = (ph.cycle * 5 + 1) % 3;
          if (tgt !== s.ctarget || s.f === 1) { s.ctarget = tgt; sfx.tap(); }
          const wasHide = s.ctiles.some((t) => (t as Rect & { c: number; hid?: boolean }).hid);
          for (const t of s.ctiles) (t as Rect & { c: number; hid?: boolean }).hid = ph.hide && t.c !== s.ctarget;
          if (ph.hide && !wasHide) sfx.crack();
        }
        if (s.kind === "zone") { const g = Math.min(480, T * 0.022); s.zoneL = g; s.zoneR = W - g; }
        if (s.survive && T > s.survive && me.alive) end(s, true, me, "Kamu bertahan hidup!");
      }

      if (s.kind === "tug" && !s.over) {
        if (act.current) { s.taps++; act.current = false; sfx.tap(); }
        s.tug = tugStep(s.tug, s.taps, 0.004 + Math.min(0.012, T / 400000) + (Math.random() < 0.08 ? 0.01 : 0));
        s.taps = 0;
        const r = tugResult(s.tug);
        if (r) end(s, r === "win", r === "win" ? me : s.ps[1]!, r === "win" ? "Lawan jatuh ke jurang!" : "Kamu tertarik jatuh ke jurang!");
      }

      draw(ctx, s, now, lvl);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current[k] = true; },
    onPointerUp: () => { input.current[k] = false; }, onPointerCancel: () => { input.current[k] = false; }, onPointerLeave: () => { input.current[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const kind = SURVIVAL_LEVELS[level - 1]!.kind;
  const info = SURVIVAL_LEVELS[level - 1]!;

  return (
    <div className="play-stage">
      <canvas ref={canvas} width={W} height={H} className="play-canvas" />
      <div className="play-hud">
        <button onClick={() => navigate({ to: "/" })} className="hud-btn" aria-label="Keluar">✕</button>
        <span className="hud-chip">👑 SURVIVAL {level}/{SURVIVAL_MAX} · {info.icon} {info.name}</span>
        <button onClick={() => setPanel(panel === "emo" ? null : "emo")} className="hud-btn" aria-label="Emot">😊</button>
        <button onClick={() => setPanel(panel === "chat" ? null : "chat")} className="hud-btn" aria-label="Chat">💬</button>
        {music.hasMusic && <button onClick={music.skip} className="hud-btn" aria-label="Lagu berikutnya">⏭</button>}
      </div>
      {toast && <div className="play-toast">{toast}</div>}
      {log.length > 0 && <div className="pointer-events-none fixed left-2 top-14 z-30 max-w-[45%] space-y-0.5 text-[11px]">{log.map((l, k) => <p key={k} className="rounded bg-es-bg/70 px-2 py-0.5 text-es-text"><b className="text-es-cyan">{l.n}:</b> {l.t}</p>)}</div>}
      {panel === "emo" && (
        <div className="es-panel fixed left-1/2 top-14 z-40 flex -translate-x-1/2 gap-2 p-2">
          {loadout.map((id) => emoteById(id)!).map((e) => <button key={e.id} onClick={() => doEmote(e.id)} className="emo-wheel-btn !static !m-0 text-2xl" title={e.label}>{e.icon}</button>)}
        </div>
      )}
      {panel === "chat" && (
        <div className="es-panel fixed left-1/2 top-14 z-40 w-[min(92vw,420px)] -translate-x-1/2 p-2">
          <div className="mb-2 flex flex-wrap gap-1">{QUICK.map((q) => <button key={q} onClick={() => doChat(q)} className="es-chip text-xs">{q}</button>)}</div>
          <form onSubmit={(e) => { e.preventDefault(); doChat(msg); }} className="flex gap-1">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={40} placeholder="Ketik pesan..." className="flex-1 rounded border border-es-cyan/40 bg-es-bg px-2 py-1 text-sm text-es-text" />
            <button className="es-start px-3 py-1 text-sm">KIRIM</button>
          </form>
        </div>
      )}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-es-bg/85 p-4">
          <div className="es-panel flex flex-col items-center gap-2 p-6 text-center text-es-text">
            <p className="font-display text-xs tracking-widest text-es-cyan">{result.win ? (level === SURVIVAL_MAX ? "🏆 JUARA SURVIVAL" : "✔ LOLOS") : "✖ TERELIMINASI"}</p>
            <p className="font-display text-[10px] text-es-dim">PEMENANG</p>
            <div className="sv-winner"><Character skin="pink" colors={result.win || result.name === meRef.current.name ? meRef.current.col : result.col} size={90} /></div>
            <p className="font-display text-lg text-es-neon">{result.win ? meRef.current.name : result.name === meRef.current.name ? "—" : result.name}</p>
            <p className="text-sm">{result.msg}</p>
            <div className="mt-2 flex gap-2">
              {result.win && level < SURVIVAL_MAX && <button onClick={() => begin(level + 1)} className="es-start px-6 py-2 text-sm">LEVEL {level + 1} ▶</button>}
              {result.win && level === SURVIVAL_MAX && <button onClick={() => begin(1)} className="es-start px-6 py-2 text-sm">MAIN LAGI</button>}
              {!result.win && <button onClick={() => begin(level)} className="es-start px-6 py-2 text-sm">ULANG LEVEL ↺</button>}
              <button onClick={() => navigate({ to: "/" })} className="es-chip">LOBI</button>
            </div>
          </div>
        </div>
      )}
      {kind !== "tug" && (<>
        <div className="pad pad-left">
          <button className="pad-key" {...hold("left")}>◀</button>
          <button className="pad-key" {...hold("right")}>▶</button>
        </div>
        <div className="pad pad-right">
          {kind === "gun" && <button className="pad-key" onPointerDown={(e) => { e.preventDefault(); act.current = true; }}>🔫</button>}
          <button className="pad-key" {...hold("up")}>▲</button>
        </div>
      </>)}
      {kind === "tug" && (
        <button className="es-start fixed bottom-6 left-1/2 z-40 -translate-x-1/2 px-12 py-5 text-2xl" onPointerDown={(e) => { e.preventDefault(); act.current = true; }}>💪 TARIK!</button>
      )}
      <div className="rotate-hint">Putar HP ke posisi mendatar 📱↔️</div>
    </div>
  );
}

function shoot(s: St, p: P) {
  p.cd = p.bot ? 50 : 22;
  s.bullets.push({ x: p.b.x + (p.face > 0 ? PW : -10), y: p.b.y + 16, vx: p.face * 14, by: s.ps.indexOf(p) });
}
function respawn(s: St, p: P, idx: number) {
  if (s.item.by === idx) { s.item = { x: Math.max(20, Math.min(W - 20, p.b.x + PW / 2)), y: Math.min(GY - 20, p.b.y + 20), by: -1 }; }
  p.b = { x: Math.random() < 0.5 ? 40 : W - 80, y: 100, vx: 0, vy: 0, onGround: false };
  p.shield = performance.now() + 1500;
}

function draw(ctx: CanvasRenderingContext2D, s: St, now: number, lvl: number) {
  const me = s.ps[0]!;
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
  if (s.kind === "tug") return drawTug(ctx, s);
  const cam = Math.max(0, Math.min(s.width - W, me.b.x + PW / 2 - W / 2));
  ctx.save(); ctx.translate(-cam, 0);
  ctx.fillStyle = "#F2884B"; ctx.strokeStyle = "#C8642A"; ctx.lineWidth = 3;
  for (const p of s.plats) { ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3); }
  for (const t of s.tiles) if (!t.gone) { const shake = t.t ? (Math.random() - 0.5) * 4 : 0; ctx.fillStyle = t.t ? "#fca5a5" : "#F2884B"; ctx.fillRect(t.x + shake, t.y, t.w, t.h); }
  for (const g of s.glass) if (!g.gone) { ctx.fillStyle = "rgba(125,211,252,.55)"; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeStyle = "#0284c7"; ctx.lineWidth = 2; ctx.strokeRect(g.x, g.y, g.w, g.h); }
  if (s.bridge) {
    const left = s.btn.at === null ? 0 : BRIDGE_MS - (now - s.btn.at);
    if (bridgeOpen(s.btn.at, now)) { ctx.fillStyle = left < 1000 && Math.floor(now / 120) % 2 ? "#d6a77a" : "#8D6E63"; ctx.fillRect(s.bridge.x, s.bridge.y, s.bridge.w, 18);
      ctx.fillStyle = "#000"; ctx.font = "bold 18px monospace"; ctx.fillText(`${Math.ceil(left / 1000)}s`, s.bridge.x + s.bridge.w / 2 - 12, GY - 12); }
    const pressed = bridgeOpen(s.btn.at, now);
    ctx.fillStyle = pressed ? "#b45309" : "#f59e0b"; ctx.fillRect(s.btn.x - 25, GY - (pressed ? 4 : 10), 50, pressed ? 4 : 10);
  }
  if (s.finish) { ctx.fillStyle = "#111"; for (let y = 0; y < GY; y += 40) ctx.fillRect(s.finish, y, 10, 20); ctx.font = "bold 22px monospace"; ctx.fillText("FINIS", s.finish - 20, 120); }
  if (s.kind === "ghost") { ctx.font = "120px serif"; ctx.globalAlpha = 0.85; ctx.fillText("👻", s.ghostX - 40, GY - 30); ctx.globalAlpha = 1; ctx.fillStyle = "rgba(30,0,60,.18)"; ctx.fillRect(cam, 0, Math.max(0, s.ghostX - cam), H); }
  if (s.kind === "redlight") { ctx.font = "90px serif"; ctx.fillText(s.red ? "🔴" : "🟢", s.finish + 60, 260); ctx.fillText("🧍‍♀️", s.finish + 60, 420); }
  if (s.kind === "lava") { ctx.fillStyle = "#ef4444"; ctx.fillRect(0, s.lava, W, H); ctx.fillStyle = "#f97316"; for (let x = 0; x < W; x += 40) ctx.fillRect(x, s.lava - 6 + Math.sin(now / 200 + x) * 4, 30, 8); }
  for (const t of s.ctiles) if (!(t as Rect & { hid?: boolean }).hid) { ctx.fillStyle = COLORS[t.c]!; ctx.fillRect(t.x, t.y, t.w, t.h); }
  if (s.kind === "zone") { ctx.fillStyle = "rgba(34,197,94,.45)"; ctx.fillRect(0, 0, s.zoneL, H); ctx.fillRect(s.zoneR, 0, W - s.zoneR, H); }
  if (s.kind === "wind") { ctx.fillStyle = "#ef4444"; ctx.font = "bold 40px monospace"; ctx.fillText(s.wind > 0 ? "≫≫≫" : "≪≪≪", W / 2 - 50, 200); }
  for (const h of s.hz) {
    if (h.k === "laser") { ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 16; ctx.fillRect(h.x, h.y, h.w, h.h); ctx.shadowBlur = 0; }
    else if (h.k === "barrel") { ctx.fillStyle = "#92400e"; ctx.beginPath(); ctx.arc(h.x + 20, h.y + 20, 20, 0, 7); ctx.fill(); ctx.strokeStyle = "#451a03"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x + 20, h.y + 20, 12, 0, 7); ctx.stroke(); }
    else if (h.k === "ball") { ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.arc(h.x + 19, h.y + 19, 19, 0, 7); ctx.fill(); }
    else if (h.k === "warn") { ctx.fillStyle = `rgba(239,68,68,${0.2 + 0.3 * (Math.floor(now / 120) % 2)})`; ctx.fillRect(h.x, GY - 8, h.w, 8); ctx.font = "40px serif"; ctx.fillText("☄️", h.x + h.w / 2 - 20, 80 + ((now - h.t) / 1300) * 450); }
    else if (h.k === "boom") { ctx.fillStyle = "rgba(249,115,22,.75)"; ctx.fillRect(h.x, GY - 120, h.w, 120); }
    else if (h.k === "saw") { ctx.font = "44px serif"; ctx.save(); ctx.translate(h.x + 22, h.y + 22); ctx.rotate(now / 80); ctx.fillText("⚙️", -22, 16); ctx.restore(); }
    else if (h.k === "mine") { ctx.globalAlpha = Math.floor(now / 400) % 2 ? 0.85 : 0.35; ctx.fillStyle = "#b91c1c"; ctx.fillRect(h.x, h.y, h.w, h.h); ctx.globalAlpha = 1; }
    else if (h.k === "piston") { ctx.fillStyle = "#64748b"; ctx.fillRect(h.x, 0, h.w, h.h); ctx.fillStyle = "#334155"; ctx.fillRect(h.x, h.h - 14, h.w, 14); }
  }
  ctx.fillStyle = "#555"; for (const k of s.spikes) { ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x + k.w, k.y); ctx.lineTo(k.x + k.w / 2, k.y + k.h); ctx.fill(); }
  ctx.fillStyle = "#facc15"; for (const b of s.bullets) ctx.fillRect(b.x, b.y, 12, 5);
  if ((s.kind === "gun" || s.kind === "crown") && s.item.by < 0) { ctx.font = "30px serif"; ctx.fillText(s.kind === "gun" ? "🔑" : "👑", s.item.x - 15, s.item.y + 10); }
  for (const [i, p] of s.ps.entries()) {
    if (!p.alive) continue;
    const { x, y } = p.b;
    if (now < p.shield) ctx.globalAlpha = Math.floor(now / 100) % 2 ? 0.4 : 1;
    ctx.fillStyle = p.col.body; ctx.fillRect(x, y, PW, PH - 8);
    ctx.fillStyle = p.col.hat; ctx.fillRect(x - 3, y - 10, PW + 6, 12);
    ctx.fillStyle = "#000"; ctx.fillRect(x + 10, y + 12, 5, 7); ctx.fillRect(x + 25, y + 12, 5, 7);
    const sw = Math.abs(p.b.vx) > 0.5 ? Math.sin(now / 60) * 5 : 0;
    ctx.fillRect(x + 6 + sw, y + PH - 8, 9, 8); ctx.fillRect(x + 25 - sw, y + PH - 8, 9, 8);
    if (s.kind === "gun") { ctx.fillStyle = "#333"; ctx.fillRect(p.face > 0 ? x + PW - 4 : x - 12, y + 16, 16, 6); }
    ctx.globalAlpha = 1;
    ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.fillStyle = i === 0 ? "#e11d48" : "#334155";
    ctx.fillText(i === 0 ? `▼ ${p.name}` : p.name, x + PW / 2, y - 18);
    if (p.say && (p.sayUntil ?? 0) > now) {
      ctx.font = "bold 15px sans-serif"; const tw = ctx.measureText(p.say).width + 16;
      ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x + PW / 2 - tw / 2, y - 66, tw, 26, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.fillText(p.say, x + PW / 2, y - 48);
    }
    if (s.item.by === i) { ctx.font = "26px serif"; ctx.fillText(s.kind === "gun" ? "🔑" : "👑", x + PW / 2, y - 34); }
    if (s.kind === "bomb" && s.bomb === i) { ctx.font = "28px serif"; ctx.fillText("💣", x + PW / 2, y - 34); }
    ctx.textAlign = "left";
  }
  ctx.restore();
  // HUD
  ctx.fillStyle = "rgba(15,23,42,.8)"; ctx.fillRect(W / 2 - 260, 52, 520, 40);
  ctx.fillStyle = "#fff"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
  const T = now - s.t0, alive = s.ps.filter((p) => p.alive).length;
  let hud = `Level ${lvl} · Hidup ${alive}/${s.ps.length}`;
  if (s.survive) hud += ` · ⏱ ${Math.max(0, Math.ceil((s.survive - T) / 1000))}s`;
  if (s.kind === "color") hud += ` · Berdiri di ${COLOR_NAMES[s.ctarget]}!`;
  if (s.kind === "bomb") hud += ` · 💣 ${Math.max(0, Math.ceil((7000 - (now - s.bombAt)) / 1000))}s`;
  if (s.kind === "gun" || s.kind === "crown") { const h = s.item.by >= 0 ? s.ps[s.item.by]! : null; hud += h ? ` · ${h.name} ${Math.floor(h.hold / 1000)}/${HOLD_WIN_MS[s.kind] / 1000}s` : " · Rebut!"; }
  ctx.fillText(hud, W / 2, 79); ctx.textAlign = "left";
}

function drawTug(ctx: CanvasRenderingContext2D, s: St) {
  const me = s.ps[0]!, op = s.ps[1]!;
  ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#F2884B"; ctx.fillRect(0, 420, 380, 300); ctx.fillRect(W - 380, 420, 380, 300);
  ctx.fillStyle = "#0f172a"; ctx.fillRect(380, 420, W - 760, 300);
  const off = s.tug * 190;
  const mx = 300 + off, ox = W - 340 + off;
  ctx.strokeStyle = "#a16207"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(mx + PW, 400); ctx.lineTo(ox, 400); ctx.stroke();
  ctx.fillStyle = "#ef4444"; ctx.fillRect(W / 2 + off - 4, 386, 8, 28);
  const fig = (p: P, x: number) => { const y = 420 - PH - (x < 380 || x > W - 380 - PW ? 0 : -40); ctx.fillStyle = p.col.body; ctx.fillRect(x, y, PW, PH - 8); ctx.fillStyle = p.col.hat; ctx.fillRect(x - 3, y - 10, PW + 6, 12); ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.fillText(p.name, x + PW / 2, y - 18); ctx.textAlign = "left"; };
  fig(me, mx); fig(op, ox);
  ctx.fillStyle = "#fff"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center"; ctx.fillText("TEKAN TARIK SECEPAT MUNGKIN!", W / 2, 140); ctx.textAlign = "left";
}
