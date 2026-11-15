import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { W, H, PW, PH, GY, step, hazardCheck, touches, SKINS, type Body, type Input, type Skin } from "@/lib/game";
import { raceMap, ghostSpeed, caught, GHOST_DELAY, netColor, NET_HEX, ease, fitZoom, leader } from "@/lib/race";
import { playJump } from "@/components/Game";
import { useGameMusic } from "@/lib/music";

type Other = { id: string; name: string; x: number; y: number; vx: number; key: boolean; ping: number | null; s: Skin; at: number; air?: boolean };
type CamMode = "auto" | "wide" | "free" | string; // string = follow player id
const SKIN_LIST = Object.keys(SKINS) as Skin[];

export function Race({ room, slot, drone, level }: { room: string; slot: number; drone: boolean; level: number }) {
  const me = useProfile();
  const nav = useNavigate();
  const cv = useRef<HTMLCanvasElement>(null);
  const input = useRef<Input>({ left: false, right: false, up: false, down: false });
  const zoomIn = useRef(false), zoomOut = useRef(false);
  const camMode = useRef<CamMode>("auto");
  const [mode, setModeState] = useState<CamMode>("auto");
  const setMode = (m: CamMode) => { camMode.current = m; setModeState(m); };
  const [win, setWin] = useState<string | null>(null);
  const [out, setOut] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [list, setList] = useState<Other[]>([]);
  const music = useGameMusic();

  useEffect(() => {
    if (!me) return;
    const L = raceMap(level);
    const solids = L.solids;
    let out = false; const t0 = Date.now(); const ghost = { x: -260, y: GY - 80 };
    const others = new Map<string, Other>();
    const skin = SKIN_LIST[slot % SKIN_LIST.length]!;
    let b: Body = { x: L.spawn[0] + slot * 10, y: L.spawn[1], vx: 0, vy: 0, onGround: false };
    let safe = { x: b.x, y: GY - PH };
    let key = false, done = false, ping: number | null = null, shield = 0, last = 0, raf = 0, walk = 0;
    // camera: top-left in world + zoom, all eased for a cinematic glide
    const cam = { x: 0, y: 0, z: 1 };
    const free = { x: 0, y: 0, z: 0.8 };
    // the physical drone everyone sees in the sky
    const bot = { x: L.spawn[0], y: 120 };

    const ch = supabase.channel(`race:${room}`, { config: { broadcast: { self: true } } });
    ch.on("broadcast", { event: "st" }, ({ payload }) => { if (payload.id !== me.id) others.set(payload.id, { ...payload, at: Date.now() }); })
      .on("broadcast", { event: "png" }, ({ payload }) => { if (payload.id === me.id) ping = Date.now() - payload.t; })
      .on("broadcast", { event: "out" }, ({ payload }) => { others.delete(payload.id); setNote(`👻 ${payload.name} Tertangkap Hantu!`); setTimeout(() => setNote(null), 2500); })
      .on("broadcast", { event: "win" }, ({ payload }) => { done = true; setWin(payload.name); })
      .subscribe();
    const pinger = setInterval(() => { if (!drone) void ch.send({ type: "broadcast", event: "png", payload: { id: me.id, t: Date.now() } }); }, 2000);
    const ui = setInterval(() => setList([...others.values()]), 1000);

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const i = input.current;
      const spec = drone || out;
      if (!done) ghost.x += ghostSpeed(Date.now() - t0);
      if (!spec && !done && caught(ghost.x + 60, b.x)) {
        out = true; setOut(true); setMode("auto"); setNote(`👻 ${me.username} Tertangkap Hantu!`); setTimeout(() => setNote(null), 2500);
        void ch.send({ type: "broadcast", event: "out", payload: { id: me.id, name: me.username } });
      }
      if (!spec && !done) {
        const wasGround = b.onGround;
        b = step(b, i, solids, L.width);
        if (wasGround && i.up && b.vy < 0) playJump();
        if (Math.abs(b.vx) > 0.5) walk++;
        if (b.onGround && solids.some((s) => s.y === b.y + PH && b.x + PW > s.x && b.x < s.x + s.w)) safe = { x: b.x, y: b.y };
        const d = hazardCheck(b, L.spikes, Date.now() < shield);
        if (d.dead) { b = { ...safe, vx: 0, vy: 0, onGround: true }; shield = Date.now() + 2500; }
        if (!key && touches(b, L.key.x, L.key.y)) key = true;
        if (key && touches(b, L.door.x + 20, L.door.y + 40, 50)) {
          done = true; setWin(me.username);
          void ch.send({ type: "broadcast", event: "win", payload: { name: me.username } });
        }
        if (t - last > 70) { last = t; void ch.send({ type: "broadcast", event: "st", payload: { id: me.id, name: me.username, x: b.x, y: b.y, vx: b.vx, air: !b.onGround, key, ping, s: skin } }); }
      }

      // everyone racing (for leader tracking)
      const racers = [...others.values()].map((o) => ({ x: o.x, y: o.y, key: o.key, id: o.id }));
      if (!spec) racers.push({ x: b.x, y: b.y, key, id: me.id });
      const lead = racers[leader(racers)];

      // physical drone hovers above the leader with a gentle bob
      const bx = lead ? lead.x + PW / 2 : L.spawn[0], by = lead ? Math.max(60, lead.y - 150) : 120;
      bot.x = ease(bot.x, bx, 0.04); bot.y = ease(bot.y, by + Math.sin(t / 600) * 10, 0.05);

      // camera target
      let tz = 1, tx = 0, ty = 0;
      const m = camMode.current;
      const focus = (x: number, y: number, z: number) => { tz = z; tx = x - W / z / 2; ty = y - H / z / 2; };
      if (!spec) focus(b.x + W / 6, b.y - 40, 1);
      else if (m === "wide") { tz = fitZoom(L.width, W); tx = 0; ty = H - H / tz; }
      else if (m === "free") {
        free.x += (i.left ? -14 : i.right ? 14 : 0) / free.z;
        free.y += (i.up ? -10 : i.down ? 10 : 0) / free.z;
        if (zoomIn.current) free.z = Math.min(2, free.z * 1.02);
        if (zoomOut.current) free.z = Math.max(fitZoom(L.width, W), free.z / 1.02);
        tz = free.z; tx = free.x; ty = free.y;
      } else {
        const target = m === "auto" ? lead : racers.find((r) => r.id === m);
        if (target) focus(target.x + PW / 2, target.y, 1.25); else focus(bot.x, H / 2, 0.8);
      }
      // keep inside the arena
      const vw = W / tz, vh = H / tz;
      tx = Math.max(0, Math.min(Math.max(0, L.width - vw), tx));
      ty = Math.min(H - vh, Math.max(H - vh - 400, ty));
      if (m === "free" && spec) { free.x = tx; free.y = ty; }
      const k = spec ? 0.06 : 0.15;
      cam.z = ease(cam.z, tz, k); cam.x = ease(cam.x, tx, k); cam.y = ease(cam.y, ty, k);

      const g = cv.current?.getContext("2d"); if (!g) return;
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#9ED8FF"); sky.addColorStop(1, "#E6F6FF");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.save(); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y);
      g.fillStyle = "#9ED8FF"; g.fillRect(cam.x, cam.y, W / cam.z, Math.max(0, -cam.y));
      for (const s of solids) { g.fillStyle = "#8B5A2B"; g.fillRect(s.x, s.y, s.w, s.h); g.fillStyle = "#6BBF59"; g.fillRect(s.x, s.y, s.w, 6); }
      g.fillStyle = "#555";
      for (const s of L.spikes) { for (let x = s.x; x < s.x + s.w; x += 14) { g.beginPath(); g.moveTo(x, s.y + s.h); g.lineTo(x + 7, s.y); g.lineTo(x + 14, s.y + s.h); g.fill(); } }
      g.fillStyle = "#5D4037"; g.fillRect(L.door.x, L.door.y, 60, 80);
      g.fillStyle = "#FFD93D"; g.fillRect(L.door.x + 44, L.door.y + 40, 6, 6);
      if (!key) { g.fillStyle = "gold"; g.fillRect(L.key.x, L.key.y, 20, 8); g.beginPath(); g.arc(L.key.x + 22, L.key.y + 4, 7, 0, 7); g.fill(); }

      const blink = t % 5000 < 160;
      const drawP = (x: number, y: number, s: Skin, name: string, hasKey: boolean, p: number | null, stale: boolean, moving: boolean, air: boolean, phase: number, guard: boolean) => {
        const c = SKINS[s] ?? SKINS[SKIN_LIST[0]!];
        if (guard) g.globalAlpha = Math.floor(t / 120) % 2 ? 0.45 : 1;
        g.fillStyle = c.body; g.fillRect(x, y, PW, PH - 8);
        g.fillStyle = c.hat; g.fillRect(x - 3, y - 10, PW + 6, 12); g.beginPath(); g.arc(x + PW / 2, y - 12, 5, 0, 7); g.fill();
        g.fillStyle = "#000";
        if (blink) { g.fillRect(x + 10, y + 15, 5, 2); g.fillRect(x + 25, y + 15, 5, 2); }
        else { g.fillRect(x + 10, y + 12, 5, 7); g.fillRect(x + 25, y + 12, 5, 7); }
        const sw = air ? 3 : moving ? Math.sin(phase * 0.35) * 5 : 0;
        g.fillRect(x + 6 + sw, y + PH - 8, 9, 8); g.fillRect(x + 25 - sw, y + PH - 8, 9, 8);
        g.globalAlpha = 1;
        if (hasKey) { g.fillStyle = "gold"; g.fillRect(x + 6, y - 48, 20, 8); g.beginPath(); g.arc(x + 28, y - 44, 7, 0, 7); g.fill(); }
        g.font = "bold 13px monospace"; g.textAlign = "center";
        g.fillStyle = c.hat; g.fillText(name, x + PW / 2, y - 22);
        g.fillStyle = NET_HEX[stale ? "merah" : netColor(p)];
        g.beginPath(); g.arc(x + PW / 2 + g.measureText(name).width / 2 + 8, y - 26, 5, 0, 7); g.fill();
        g.textAlign = "left";
      };
      for (const o of others.values()) drawP(o.x, o.y, o.s, o.name, o.key, o.ping, Date.now() - o.at > 2000, Math.abs(o.vx ?? 0) > 0.5, !!o.air, t / 16, false);
      if (!spec) drawP(b.x, b.y, skin, me.username, key, ping, false, Math.abs(b.vx) > 0.5, !b.onGround, walk, Date.now() < shield);

      // ghost chasing from behind
      const alive = racers.filter((r) => r.id !== me.id || !spec);
      const back = alive.reduce((m2, r) => (r.x < m2.x ? r : m2), alive[0] ?? { x: 0, y: GY - 80 });
      ghost.y = ease(ghost.y, back.y - 20, 0.05);
      if (Date.now() - t0 > GHOST_DELAY - 1000) {
        const gx = ghost.x, gy = ghost.y + Math.sin(t / 300) * 8;
        g.globalAlpha = 0.85; g.fillStyle = "#F5F3FF";
        g.beginPath(); g.arc(gx + 30, gy + 30, 30, Math.PI, 0); g.lineTo(gx + 60, gy + 75);
        for (let k2 = 0; k2 < 4; k2++) g.lineTo(gx + 52 - k2 * 15, gy + (k2 % 2 ? 75 : 62));
        g.lineTo(gx, gy + 75); g.fill(); g.globalAlpha = 1;
        g.fillStyle = "#1E1B4B"; g.fillRect(gx + 16, gy + 22, 8, 12); g.fillRect(gx + 36, gy + 22, 8, 12);
        g.font = "bold 14px monospace"; g.fillText("👻", gx + 20, gy - 6);
      }
      // drone body: spotlight, arms, spinning rotors, blinking LEDs
      const dx = bot.x, dy = bot.y;
      const spot = g.createLinearGradient(0, dy, 0, dy + 260);
      spot.addColorStop(0, "rgba(255,255,200,0.35)"); spot.addColorStop(1, "rgba(255,255,200,0)");
      g.fillStyle = spot; g.beginPath(); g.moveTo(dx - 8, dy + 10); g.lineTo(dx + 8, dy + 10); g.lineTo(dx + 70, dy + 260); g.lineTo(dx - 70, dy + 260); g.fill();
      g.strokeStyle = "#222"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(dx - 34, dy - 6); g.lineTo(dx + 34, dy - 6); g.stroke();
      for (const sx of [-34, 34]) {
        const r = Math.abs(Math.sin(t / 25)) * 22 + 4;
        g.fillStyle = "rgba(60,60,60,0.5)"; g.beginPath(); g.ellipse(dx + sx, dy - 12, r, 3, 0, 0, 7); g.fill();
      }
      g.fillStyle = "#333"; g.fillRect(dx - 20, dy - 10, 40, 16);
      g.fillStyle = "#111"; g.beginPath(); g.arc(dx, dy + 10, 6, 0, 7); g.fill();
      g.fillStyle = "#60A5FA"; g.beginPath(); g.arc(dx, dy + 10, 3, 0, 7); g.fill();
      const on = Math.floor(t / 400) % 2 === 0;
      g.fillStyle = on ? "#EF4444" : "#7f1d1d"; g.beginPath(); g.arc(dx - 18, dy - 2, 3, 0, 7); g.fill();
      g.fillStyle = on ? "#14532d" : "#22C55E"; g.beginPath(); g.arc(dx + 18, dy - 2, 3, 0, 7); g.fill();
      g.restore();

      if (spec) {
        g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 3;
        const c = 40; for (const [x, y, sx, sy] of [[20, 20, 1, 1], [W - 20, 20, -1, 1], [20, H - 20, 1, -1], [W - 20, H - 20, -1, -1]] as const) {
          g.beginPath(); g.moveTo(x, y + sy * c); g.lineTo(x, y); g.lineTo(x + sx * c, y); g.stroke();
        }
        g.beginPath(); g.moveTo(W / 2 - 15, H / 2); g.lineTo(W / 2 + 15, H / 2); g.moveTo(W / 2, H / 2 - 15); g.lineTo(W / 2, H / 2 + 15); g.stroke();
        g.fillStyle = Math.floor(t / 600) % 2 ? "#EF4444" : "#991b1b"; g.beginPath(); g.arc(46, 52, 8, 0, 7); g.fill();
        g.fillStyle = "#fff"; g.font = "bold 22px sans-serif"; g.fillText(`LIVE · 🎥 DRONE · ${Math.round(cam.z * 100)}%`, 62, 60);
      }
    };
    raf = requestAnimationFrame(loop);
    const kd = (e: KeyboardEvent, v: boolean) => {
      const m: Record<string, keyof Input> = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", " ": "up", ArrowDown: "down", s: "down" };
      const k = m[e.key]; if (k) { input.current[k] = v; if ((drone || out) && v && camMode.current !== "free" && camMode.current !== "wide") setMode("free"); }
      if (e.key === "+" || e.key === "=") zoomIn.current = v;
      if (e.key === "-") zoomOut.current = v;
    };
    const dn = (e: KeyboardEvent) => kd(e, true), up = (e: KeyboardEvent) => kd(e, false);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { cancelAnimationFrame(raf); clearInterval(pinger); clearInterval(ui); supabase.removeChannel(ch); window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, room, slot, drone, level]);

  const press = (set: (v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); set(true); },
    onPointerUp: () => set(false), onPointerLeave: () => set(false), onPointerCancel: () => set(false),
  });
  const hold = (k: keyof Input, label: string) => (
    <button className="pixel-btn flex-1 select-none !py-3" {...press((v) => { input.current[k] = v; if ((drone || out) && v && camMode.current !== "free") setMode("free"); })}>{label}</button>
  );
  const tab = (m: CamMode, label: string) => (
    <button onClick={() => setMode(m)} className={`${mode === m ? "pixel-btn" : "tab-off"} !w-auto !py-1 px-2 text-xs`}>{label}</button>
  );

  return (
    <main className="pixel-page flex flex-col items-center gap-2">
      <div className="flex w-full max-w-3xl items-center justify-between gap-2">
        <b className="font-pixel text-xs">🏁 TURNAMEN LEVEL {level}{drone ? " · 🎥 DRONE" : ""}</b>
        <div className="flex gap-1">
          {music.hasMusic && <>
            <button onClick={() => music.setVolume(music.volume - 0.1)} className="tab-off !w-auto !py-1 px-2">🔉</button>
            <span className="text-xs self-center">🎵{Math.round(music.volume * 100)}%</span>
            <button onClick={() => music.setVolume(music.volume + 0.1)} className="tab-off !w-auto !py-1 px-2">🔊</button>
          </>}
          <button onClick={() => nav({ to: "/mabar" })} className="pixel-btn !py-1">← Keluar</button>
        </div>
      </div>
      {note && <p className="font-pixel text-xs">{note}</p>}
      {out && !drone && <p className="text-xs">👀 Kamu tereliminasi — sekarang jadi penonton drone.</p>}
      <canvas ref={cv} width={W} height={H} className="w-full max-w-3xl rounded-lg border-4 border-foreground" />
      {(drone || out) && (
        <div className="flex w-full max-w-3xl flex-wrap gap-1">
          {tab("auto", "🔄 AUTO")}{tab("wide", "🗺️ SEISI ARENA")}{tab("free", "🕹️ BEBAS")}
          {list.map((o) => <span key={o.id}>{tab(o.id, `👁️ ${o.name}`)}</span>)}
        </div>
      )}
      <div className="flex w-full max-w-3xl gap-2">
        {hold("left", "◀")}{hold("right", "▶")}
        {(drone || out) ? <>
          {hold("up", "▲")}{hold("down", "▼")}
          <button className="pixel-btn flex-1 select-none !py-3" {...press((v) => { zoomIn.current = v; if (v) setMode("free"); })}>🔍+</button>
          <button className="pixel-btn flex-1 select-none !py-3" {...press((v) => { zoomOut.current = v; if (v) setMode("free"); })}>🔍−</button>
        </> : hold("up", "▲ LOMPAT")}
      </div>
      <div className="pixel-card w-full max-w-3xl text-xs">
        <b>Pemain:</b>
        {list.length === 0 && <p>Menunggu pemain...</p>}
        {list.map((o) => {
          const c = Date.now() - o.at > 2000 ? "merah" : netColor(o.ping);
          return <p key={o.id}><span style={{ color: NET_HEX[c] }}>●</span> {o.name} {o.key ? "🔑" : ""} — {o.ping ?? "?"} ms</p>;
        })}
      </div>
      {win && (
        <div className="fixed inset-0 flex items-center justify-center bg-background/80">
          <div className="pixel-card text-center">
            <p className="font-pixel text-lg">🏆 {win} MENANG!</p>
            <button onClick={() => nav({ to: "/mabar" })} className="pixel-btn mt-3">KEMBALI KE MABAR</button>
          </div>
        </div>
      )}
    </main>
  );
}
