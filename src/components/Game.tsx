import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { BOX, GY, GRAVITY, H, MAX_LEVEL, PH, PW, SHIELD_MS, SKINS, W, hazardCheck, isSkin, levelAt, overlap, step, touches, type Body, type Input, type Skin } from "@/lib/game";
import { savedSkin } from "@/components/Character";
import { useGameMusic } from "@/lib/music";
import { SettingsMenu } from "@/components/SettingsMenu";
import { botInput, loadProgress, saveProgress } from "@/lib/bot";
import { loadCloud, saveCloud } from "@/lib/progress";

type Role = "qifil" | "hafil";

const QUICK = ["Sini!", "Tumpuk!", "Injak tombol!", "Ambil kunci!", "Ke pintu!", "Hore! 🎉"];

let audioCtx: AudioContext | null = null;
/** Short rising "tuwing" blip, like Pico Park's jump. */
export function playJump() {
  try {
    audioCtx ??= new AudioContext();
    const a = audioCtx;
    if (a.state === "suspended") void a.resume();
    const t = a.currentTime;
    const o = a.createOscillator(), v = a.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    v.gain.setValueAtTime(0.12, t);
    v.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(v).connect(a.destination);
    o.start(t); o.stop(t + 0.2);
  } catch { /* audio not available */ }
}

export function Game({ room, role, solo = false }: { room: string; role: Role; solo?: boolean }) {
  const other: Role = role === "qifil" ? "hafil" : "qifil";
  const me = useProfile();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const input = useRef<Input>({ left: false, right: false, up: false, down: false });
  const chan = useRef<RealtimeChannel | null>(null);
  const [partnerHere, setPartnerHere] = useState(false);
  const [level, setLevel] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const [text, setText] = useState("");
  const [toast, setToast] = useState("");
  const [shieldOn, setShieldOn] = useState(false);
  const [conn, setConn] = useState<"ok" | "lost">("ok");
  const [retry, setRetry] = useState(0);
  const music = useGameMusic();
  const musicRef = useRef(music);
  musicRef.current = music;
  // QIFIL leads the music; HAFIL's phone follows the same song and position.
  useEffect(() => {
    if (role !== "qifil") return;
    const id = setInterval(() => {
      const snap = musicRef.current.snapshot();
      if (snap) void chan.current?.send({ type: "broadcast", event: "music", payload: snap });
    }, 2000);
    return () => clearInterval(id);
  }, [role]);
  const g = useRef({
    level: 1,
    mine: { x: 0, y: 0, vx: 0, vy: 0, onGround: false } as Body,
    theirs: { x: -100, y: -100, tx: -100, ty: -100, vx: 0 },
    skins: { qifil: "pink", hafil: "biru" } as Record<Role, Skin>,
    safe: { x: 80, y: 560 },
    walk: 0,
    names: { qifil: "QIFIL", hafil: "HAFIL" } as Record<Role, string>,
    bubbles: { qifil: { t: "", n: 0 }, hafil: { t: "", n: 0 } } as Record<Role, { t: string; n: number }>,
    button: false,
    keyBy: "" as "" | Role,
    winning: false,
    shield: 0,
    shieldOther: 0,
    boxes: [] as { x: number; y: number; vy: number; color: "pink" | "biru"; lock: number; moved: boolean }[],
    ext: [] as number[],
    bot: { x: 0, y: 0, vx: 0, vy: 0, onGround: false } as Body,
    botStuck: 0,
  });

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2000); };

  const resetLevel = (n: number) => {
    const s = g.current;
    const L = levelAt(n);
    s.boxes = L.boxes.map((b) => ({ ...b, vy: 0, lock: 0, moved: false }));
    s.ext = L.bridges.map(() => 0);
    s.level = n; s.button = false; s.keyBy = ""; s.winning = false;
    s.shield = 0; s.shieldOther = 0; setShieldOn(false);
    s.mine = { x: L.spawn[role === "qifil" ? 0 : 1], y: 560, vx: 0, vy: 0, onGround: false };
    s.safe = { x: s.mine.x, y: 560 };
    s.bot = { x: L.spawn[1], y: 560, vx: 0, vy: 0, onGround: false }; s.botStuck = 0;
    if (solo) { s.theirs = { x: s.bot.x, y: s.bot.y, tx: s.bot.x, ty: s.bot.y, vx: 0 }; }
    if (solo) { saveProgress(n); if (n > 1) void saveCloud("solo_level", n); }
    else if (role === "qifil") void saveCloud("online_level", n);
    setLevel(n);
  };

  useEffect(() => {
    resetLevel(solo ? loadProgress() : 1);
    // continue the last saved game from the online save
    void loadCloud(solo ? "solo_level" : "online_level").then((n) => {
      if (solo ? n > loadProgress() : role === "qifil" && n > 1) { resetLevel(n); flash(`▶ Lanjut Level ${n}`); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = g.current;
    if (solo) {
      s.names[other] = "BOT"; s.skins[role] = savedSkin(role);
      if (s.skins[other] === s.skins[role]) s.skins[other] = s.skins[role] === "biru" ? "kuning" : "biru";
      setPartnerHere(true);
      return;
    }
    if (!me) return;
    s.names[role] = me.username;
    s.skins[role] = savedSkin(role);
    const ch = supabase.channel(`room:${room}`, { config: { presence: { key: role }, broadcast: { self: false } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<{ name: string }>();
      const here = !!st[other];
      if (here) s.names[other] = st[other]?.[0]?.name ?? s.names[other];
      const sk = (st[other]?.[0] as { skin?: string } | undefined)?.skin;
      if (isSkin(sk)) s.skins[other] = sk;
      setPartnerHere(here);
    })
      .on("broadcast", { event: "pos" }, ({ payload }) => {
        // HAFIL follows QIFIL's level (e.g. after QIFIL continued a saved game)
        if (role === "hafil" && typeof payload.l === "number" && payload.l !== s.level && !s.winning) resetLevel(payload.l);
        s.theirs.tx = payload.x; s.theirs.ty = payload.y; if (s.theirs.x < -50) { s.theirs.x = payload.x; s.theirs.y = payload.y; } })
      .on("broadcast", { event: "box" }, ({ payload }) => { const b = s.boxes[payload.i]; if (b && payload.l === s.level) { b.x = payload.x; b.y = payload.y; b.vy = 0; b.lock = 8; } })
      .on("broadcast", { event: "dead" }, () => { flash(`💥 ${s.names[other]} respawn!`); s.shieldOther = performance.now() + SHIELD_MS; })
      .on("broadcast", { event: "button" }, () => { s.button = true; })
      .on("broadcast", { event: "key" }, ({ payload }) => { s.keyBy = payload.by; })
      .on("broadcast", { event: "level" }, ({ payload }) => { flash(`🎉 Level ${payload.done} selesai!`); resetLevel(payload.next); })
      .on("broadcast", { event: "music" }, ({ payload }) => { if (role !== "qifil" && typeof payload?.id === "string") musicRef.current.follow({ id: payload.id, t: Number(payload.t) + 0.15, paused: !!payload.paused }); })
      .on("broadcast", { event: "chat" }, ({ payload }) => { if (typeof payload?.t === "string") s.bubbles[other] = { t: payload.t.slice(0, 40), n: 200 }; })
      .subscribe((st) => {
        if (st === "SUBSCRIBED") { setConn("ok"); ch.track({ name: me.username, skin: s.skins[role] }); }
        else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") setConn("lost");
      });
    chan.current = ch;
    return () => { supabase.removeChannel(ch); chan.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, room, role, retry]);

  useEffect(() => {
    if (solo) return;
    const off = () => setConn("lost");
    window.addEventListener("offline", off);
    return () => window.removeEventListener("offline", off);
  }, [solo]);

  // keyboard
  useEffect(() => {
    const map: Record<string, keyof Input> = { arrowleft: "left", a: "left", arrowright: "right", d: "right", arrowup: "up", w: "up", " ": "up", arrowdown: "down", s: "down" };
    const set = (v: boolean) => (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      const k = map[e.key.toLowerCase()];
      if (k) { input.current[k] = v; e.preventDefault(); }
    };
    const d = set(true), u = set(false);
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, []);

  // loop
  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    let raf = 0, lastSend = 0, hudShield = false;
    const loop = (t: number) => {
      const s = g.current;
      const L = levelAt(s.level);
      const th = s.theirs;
      if (!solo) {
        const ox = th.x;
        th.x += (th.tx - th.x) * 0.35; th.y += (th.ty - th.y) * 0.35; th.vx = th.x - ox;
      }
      const partnerRect = { x: th.x, y: th.y, w: PW, h: PH };
      // bridges: extend while anyone (or a box) stands on either button
      const bridgeRects = L.bridges.map((br, i) => {
        const btns = [br.x - 50, br.x + br.w + 50];
        const on = (o: { x: number; y: number }, w = PW) => btns.some((bx) => o.x + w > bx - 25 && o.x < bx + 25 && Math.abs(o.y + (w === PW ? PH : BOX) - GY) < 14);
        const pressed = on(s.mine) || on(th) || s.boxes.some((b) => on(b, BOX));
        s.ext[i] = Math.max(0, Math.min(1, (s.ext[i] ?? 0) + (pressed ? 0.05 : -0.05)));
        const w = br.w * s.ext[i]!;
        return { x: br.x + br.w - w, y: GY, w, h: 18 };
      }).filter((r) => r.w > 2);
      const world = [...L.platforms, ...bridgeRects];
      // boxes: pushable by me, fall with gravity
      for (const [i, b] of s.boxes.entries()) {
        const sameRow = s.mine.y + PH > b.y + 6 && s.mine.y < b.y + BOX - 6;
        let dx = 0;
        if (sameRow && input.current.right && Math.abs(s.mine.x + PW - b.x) < 8) dx = 3;
        if (sameRow && input.current.left && Math.abs(b.x + BOX - s.mine.x) < 8) dx = -3;
        if (dx) {
          // push a whole row of touching boxes together (pink + blue at once)
          const chain = [b];
          for (;;) {
            const last = chain[chain.length - 1]!;
            const next = s.boxes.find((o) => !chain.includes(o) && Math.abs(o.y - last.y) < 10 &&
              (dx > 0 ? o.x >= last.x + BOX - 2 && o.x <= last.x + BOX + 10 : o.x + BOX <= last.x + 2 && o.x + BOX >= last.x - 10));
            if (!next) break;
            chain.push(next);
          }
          const others = s.boxes.filter((o) => !chain.includes(o)).map((o) => ({ x: o.x, y: o.y, w: BOX, h: BOX }));
          const free = chain.every((c) => ![...world, ...others, partnerRect].some((r) => overlap({ x: c.x + dx, y: c.y, w: BOX, h: BOX }, r)));
          if (free) for (const c of chain) { c.x += dx; c.moved = true; }
        }
        if (b.lock > 0) { b.lock--; continue; }
        b.vy = Math.min(18, b.vy + GRAVITY); b.y += b.vy;
        const r = { x: b.x, y: b.y, w: BOX, h: BOX };
        for (const p of [...world, ...s.boxes.filter((o) => o !== b && o.y > b.y).map((o) => ({ x: o.x, y: o.y, w: BOX, h: BOX }))])
          if (overlap(r, p) && b.vy > 0) { b.y = p.y - BOX; b.vy = 0; r.y = b.y; }
        if (b.y > H) { const o = L.boxes[i]!; b.x = o.x; b.y = o.y - 200; b.vy = 0; b.moved = true; }
      }
      const boxRects = s.boxes.map((b) => ({ x: b.x, y: b.y, w: BOX, h: BOX }));
      if (solo) {
        // BOT partner: follows the player, holds bridge buttons, teleports back if stuck or fallen
        const bt = s.bot, ox = bt.x;
        s.bot = step(bt, botInput(bt, s.mine, L, s.ext), [...world, ...boxRects, { x: s.mine.x, y: s.mine.y, w: PW, h: PH }], L.width);
        s.botStuck = Math.abs(s.bot.x - ox) < 0.3 && Math.abs(s.bot.x - s.mine.x) > 120 ? s.botStuck + 1 : 0;
        if (s.bot.y > H || Math.abs(s.bot.x - s.mine.x) > 650 || s.botStuck > 150) {
          s.bot = { x: Math.max(0, s.mine.x - 50), y: s.mine.y - 80, vx: 0, vy: 0, onGround: false }; s.botStuck = 0;
        }
        th.vx = s.bot.x - th.x; th.x = s.bot.x; th.y = s.bot.y;
      }
      // ride on partner's head: move along with them
      const mm = s.mine;
      if (mm.onGround && Math.abs(mm.y + PH - th.y) < 3 && mm.x + PW > th.x && mm.x < th.x + PW) mm.x += th.vx;
      const wasGround = s.mine.onGround;
      const shielded = t < s.shield;
      s.mine = step(s.mine, input.current, [...world, ...boxRects, partnerRect], L.width);
      if (wasGround && input.current.up && s.mine.vy < 0) playJump();
      const send = (event: string, payload: object) => chan.current?.send({ type: "broadcast", event, payload });
      let m = s.mine;
      const death = hazardCheck(m, L.spikes, shielded);
      if (death.dead) {
        s.mine = m = { x: s.safe.x, y: s.safe.y - 80, vx: 0, vy: 0, onGround: false };
        s.shield = t + SHIELD_MS;
        send("dead", {}); flash("💥 Respawn!");
      } else if (m.onGround && m.y + PH >= GY - 200 && !L.pits.some((p) => m.x + PW > p.x - 30 && m.x < p.x + p.w + 30) && !L.spikes.some((k) => Math.abs(k.x + k.w / 2 - (m.x + PW / 2)) < k.w / 2 + 70)) {
        s.safe = { x: m.x, y: m.y };
      }
      const nowShielded = t < s.shield;
      if (nowShielded !== hudShield) { hudShield = nowShielded; setShieldOn(nowShielded); }
      s.walk += Math.abs(m.vx) > 0.5 ? 1 : 0;
      if (t - lastSend > 50) { lastSend = t; send("pos", { x: Math.round(m.x), y: Math.round(m.y), l: s.level });
        s.boxes.forEach((b, i) => { if (b.moved) { b.moved = false; send("box", { i, x: b.x, y: b.y, l: s.level }); } }); }

      if (!s.button && (touches(m, L.button.x, L.button.y - 10) || touches(th, L.button.x, L.button.y - 10))) {
        if (touches(m, L.button.x, L.button.y - 10)) send("button", {});
        s.button = true;
      }
      if (!s.keyBy && touches(m, L.key.x + 14, L.key.y + 7)) { s.keyBy = role; send("key", { by: role }); }
      const atDoor = (b: { x: number; y: number }) => touches(b, L.door.x + 30, L.door.y + 40, 60);
      if (role === "qifil" && !s.winning && s.button && s.keyBy && atDoor(m) && atDoor(th)) {
        s.winning = true;
        const next = s.level >= MAX_LEVEL ? 1 : s.level + 1;
        send("level", { done: s.level, next });
        flash(`🎉 Level ${s.level} selesai!`);
        resetLevel(next);
      }

      // draw
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
      const cam = Math.max(0, Math.min(L.width - W, m.x + PW / 2 - W / 2));
      ctx.save(); ctx.translate(-cam, 0);
      ctx.fillStyle = "#F2884B"; ctx.strokeStyle = "#C8642A"; ctx.lineWidth = 3;
      for (const p of L.platforms) { ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3); }
      ctx.fillStyle = "#555";
      for (const k of L.spikes) for (let sx = k.x; sx < k.x + k.w; sx += 16) {
        ctx.beginPath(); ctx.moveTo(sx, GY); ctx.lineTo(sx + 8, GY - k.h); ctx.lineTo(sx + 16, GY); ctx.fill();
      }
      // bridges + their buttons
      L.bridges.forEach((br, i) => {
        const e = s.ext[i] ?? 0;
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(br.x + br.w - br.w * e, GY, br.w * e, 18);
        for (const bx of [br.x - 50, br.x + br.w + 50]) {
          ctx.fillStyle = e > 0 ? "#b45309" : "#f59e0b"; ctx.fillRect(bx - 25, GY - (e > 0 ? 4 : 10), 50, e > 0 ? 4 : 10);
        }
      });
      for (const b of s.boxes) {
        ctx.fillStyle = SKINS[b.color].body; ctx.fillRect(b.x, b.y, BOX, BOX);
        ctx.strokeStyle = SKINS[b.color].hat; ctx.lineWidth = 4; ctx.strokeRect(b.x + 2, b.y + 2, BOX - 4, BOX - 4);
      }
      // door
      ctx.fillStyle = s.button ? "#4ADE80" : "#5D4037"; ctx.fillRect(L.door.x, L.door.y, 60, 80);
      ctx.fillStyle = "#FFD93D"; ctx.fillRect(L.door.x + 44, L.door.y + 40, 6, 6);
      // button
      ctx.fillStyle = s.button ? "#16a34a" : "#22c55e"; ctx.fillRect(L.button.x - 25, L.button.y - (s.button ? 4 : 10), 50, s.button ? 4 : 10);
      // key
      const holder = s.keyBy ? (s.keyBy === role ? m : th) : null;
      const kx = holder ? holder.x + 6 : L.key.x, ky = holder ? holder.y - 48 : L.key.y;
      ctx.fillStyle = "gold"; ctx.fillRect(kx, ky, 20, 8); ctx.beginPath(); ctx.arc(kx + 22, ky + 4, 7, 0, Math.PI * 2); ctx.fill();

      const blink = t % 5000 < 160;
      const drawP = (who: Role, x: number, y: number, moving: boolean, air: boolean, phase: number, guard = false) => {
        const c = SKINS[s.skins[who]];
        if (guard) ctx.globalAlpha = Math.floor(t / 120) % 2 ? 0.45 : 1;
        ctx.fillStyle = c.body; ctx.fillRect(x, y, PW, PH - 8);
        ctx.fillStyle = c.hat; ctx.fillRect(x - 3, y - 10, PW + 6, 12); ctx.beginPath(); ctx.arc(x + PW / 2, y - 12, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        if (blink) { ctx.fillRect(x + 10, y + 15, 5, 2); ctx.fillRect(x + 25, y + 15, 5, 2); }
        else { ctx.fillRect(x + 10, y + 12, 5, 7); ctx.fillRect(x + 25, y + 12, 5, 7); }
        const sw = air ? 3 : moving ? Math.sin(phase * 0.35) * 5 : 0;
        ctx.fillRect(x + 6 + sw, y + PH - 8, 9, 8); ctx.fillRect(x + 25 - sw, y + PH - 8, 9, 8);
        if (guard) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#38BDF8"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x + PW / 2, y + PH / 2 - 6, 34, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = c.hat; ctx.fillText(s.names[who], x + PW / 2, y - 22);
        const b = s.bubbles[who];
        if (b.n > 0) {
          b.n--;
          ctx.font = "16px monospace";
          const bw = ctx.measureText(b.t).width + 20;
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
          ctx.fillRect(x + PW / 2 - bw / 2, y - 64, bw, 28); ctx.strokeRect(x + PW / 2 - bw / 2, y - 64, bw, 28);
          ctx.fillStyle = "#000"; ctx.fillText(b.t, x + PW / 2, y - 45);
        }
        ctx.textAlign = "left";
      };
      drawP(other, th.x, th.y, Math.abs(th.vx) > 0.5, false, t / 16, t < s.shieldOther);
      drawP(role, m.x, m.y, Math.abs(m.vx) > 0.5, !m.onGround, s.walk, t < s.shield);
      ctx.restore();
      // progress bar
      ctx.fillStyle = "#eee"; ctx.fillRect(440, 690, 400, 10);
      ctx.fillStyle = SKINS[s.skins[role]].body; ctx.fillRect(440, 690, (400 * m.x) / L.width, 10);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const releaseKeys = () => { const i = input.current; i.left = i.right = i.up = i.down = false; };
  const say = (raw: string) => {
    const t = raw.trim().slice(0, 40);
    if (!t) return;
    g.current.bubbles[role] = { t, n: 200 };
    void chan.current?.send({ type: "broadcast", event: "chat", payload: { t } });
    setText("");
    releaseKeys();
    setChatOpen(false);
  };

  const fullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } catch { /* not supported */ }
  };

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current[k] = true; },
    onPointerUp: () => { input.current[k] = false; },
    onPointerCancel: () => { input.current[k] = false; },
    onPointerLeave: () => { input.current[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="play-stage">
      <canvas ref={canvasRef} width={W} height={H} className="play-canvas" />

      <div className="play-hud">
        <span className="hud-chip">Level {level}/{MAX_LEVEL}</span>
        <span className="hud-chip">{partnerHere ? `🟢 ${g.current.names[other]}` : "⏳ Menunggu teman..."}</span>
        {shieldOn && <span className="hud-chip">🛡️ Lindung</span>}
        {music.hasMusic && (
          <>
            <button onClick={() => music.setVolume(music.volume - 0.1)} className="hud-btn" aria-label="Kecilkan musik">🔉</button>
            <span className="hud-chip" title={music.title}>🎵 {Math.round(music.volume * 100)}%</span>
            <button onClick={() => music.setVolume(music.volume + 0.1)} className="hud-btn" aria-label="Besarkan musik">🔊</button>
            {role === "qifil" && <button onClick={music.skip} className="hud-btn" aria-label="Lagu berikutnya">⏭</button>}
          </>
        )}
        <button onClick={fullscreen} className="hud-btn">⛶</button>
        <button onClick={() => setChatOpen((v) => !v)} className="hud-btn">💬</button>
        <span className="ml-auto" />
        <SettingsMenu className="hud-btn" exitLabel="KELUAR KE LOBI" onExit={() => navigate({ to: "/" })} />
      </div>

      {toast && <div className="play-toast">{toast}</div>}

      {!solo && conn === "lost" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="pixel-card w-full max-w-xs text-center">
            <p className="font-pixel text-xs">MENGHUBUNGKAN ULANG...</p>
            <p className="mt-2 text-xs text-muted-foreground">Level kamu tetap aman. Cek internet lalu tekan RECONNECT.</p>
            <button onClick={() => setRetry((n) => n + 1)} className="pixel-btn mt-4 w-full">RECONNECT</button>
          </div>
        </div>
      )}

      {chatOpen && (
        <div className="play-chat">
          <div className="flex flex-wrap gap-1">
            {QUICK.map((q) => <button key={q} onClick={() => say(q)} className="hud-chip">{q}</button>)}
          </div>
          <form className="mt-2 flex gap-1" onSubmit={(e) => { e.preventDefault(); say(text); (document.activeElement as HTMLElement)?.blur(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={40}
              onFocus={releaseKeys} onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()}
              enterKeyHint="send" autoComplete="off" placeholder="Ketik..." className="pixel-input !py-1" />
            <button className="pixel-btn !py-1">Kirim</button>
          </form>
        </div>
      )}

      <div className="pad pad-left">
        <button className="pad-key" {...hold("left")}>◀</button>
        <button className="pad-key" {...hold("right")}>▶</button>
      </div>
      <div className="pad pad-right">
        <button className="pad-key" {...hold("down")}>▼</button>
        <button className="pad-key" {...hold("up")}>▲</button>
      </div>
      <div className="rotate-hint">Putar HP ke posisi mendatar 📱↔️</div>
    </div>
  );
}
