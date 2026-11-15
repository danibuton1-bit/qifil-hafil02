import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { AH, AW, COVER, MAX_HP, R, SPAWNS, TARGET, WEAPONS, applyHit, hitsRect, moveCircle, winner } from "@/lib/bayone";

const COLORS = ["#FF8FAB", "#6BA5FF", "#FFD93D", "#7CFFB2", "#C084FC"];
type P = { id: string; name: string; color: string; x: number; y: number; hp: number; fx: number; fy: number; tx: number; ty: number; seen: number };
type Bullet = { by: string; x: number; y: number; vx: number; vy: number; dmg: number; left: number };

export function BayOne({ room, solo = false, slot = 0 }: { room: string; solo?: boolean; slot?: number }) {
  const me = useProfile();
  const navigate = useNavigate();
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef({ left: false, right: false, up: false, down: false, fire: false });
  const chan = useRef<RealtimeChannel | null>(null);
  const [hud, setHud] = useState({ hp: MAX_HP, ammo: WEAPONS[0]!.ammo, w: 0 });
  const [board, setBoard] = useState<{ name: string; k: number; me: boolean }[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const myId = solo ? "me" : me?.id ?? "";
  const s = useRef({
    players: {} as Record<string, P>, kills: {} as Record<string, number>, bullets: [] as Bullet[],
    w: 0, ammo: WEAPONS[0]!.ammo, last: 0, over: false,
  });
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1800); };

  const spawn = (id: string, name: string, i: number): P => {
    const sp = SPAWNS[i % SPAWNS.length]!;
    return { id, name, color: COLORS[i % COLORS.length]!, x: sp.x, y: sp.y, hp: MAX_HP, fx: 1, fy: 0, tx: sp.x, ty: sp.y, seen: performance.now() };
  };

  const reset = () => {
    const st = s.current;
    st.kills = {}; st.bullets = []; st.over = false; setResult(null);
    for (const [i, p] of Object.values(st.players).entries()) Object.assign(p, spawn(p.id, p.name, p.id === myId ? slot : i));
  };

  // setup players + network
  useEffect(() => {
    const st = s.current;
    if (solo) {
      st.players = { me: spawn("me", "KAMU", 0) };
      for (let i = 1; i <= 4; i++) st.players[`bot${i}`] = spawn(`bot${i}`, `BOT ${i}`, i);
      return;
    }
    if (!me) return;
    st.players[me.id] = spawn(me.id, me.username, slot);
    const ch = supabase.channel(`bay:${room}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "st" }, ({ payload: p }) => {
      const o = st.players[p.id] ?? (st.players[p.id] = { ...spawn(p.id, p.name, p.slot), x: p.x, y: p.y });
      o.name = p.name; o.color = COLORS[p.slot % COLORS.length]!; o.tx = p.x; o.ty = p.y; o.hp = p.hp; o.fx = p.fx; o.fy = p.fy; o.seen = performance.now();
    })
      .on("broadcast", { event: "shot" }, ({ payload: b }) => { st.bullets.push(b); })
      .on("broadcast", { event: "kill" }, ({ payload }) => {
        st.kills[payload.by] = (st.kills[payload.by] ?? 0) + 1;
        if (payload.by === me.id) flash(`KILL! ${st.players[payload.victim]?.name ?? ""} tumbang`);
        const w = winner(st.kills); if (w && !st.over) { st.over = true; setResult(w); }
      })
      .on("broadcast", { event: "again" }, () => reset())
      .subscribe();
    chan.current = ch;
    return () => { supabase.removeChannel(ch); chan.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, room, solo]);

  const send = (event: string, payload: object) => void chan.current?.send({ type: "broadcast", event, payload });

  const shoot = (p: P, w: number, now: number) => {
    const W = WEAPONS[w]!;
    const b: Bullet = { by: p.id, x: p.x + p.fx * (R + 4), y: p.y + p.fy * (R + 4), vx: p.fx * W.speed, vy: p.fy * W.speed, dmg: W.dmg, left: W.range };
    s.current.bullets.push(b);
    if (!solo) send("shot", b);
    void now;
  };

  const killed = (victim: string, by: string) => {
    const st = s.current;
    st.kills[by] = (st.kills[by] ?? 0) + 1;
    if (!solo) send("kill", { by, victim });
    if (by === myId) flash(`KILL! ${st.players[victim]?.name ?? ""} tumbang`);
    if (victim === myId) flash("💀 Kamu tumbang! Respawn...");
    const v = st.players[victim]; if (v) { const sp = SPAWNS[Math.floor(Math.random() * SPAWNS.length)]!; v.x = v.tx = sp.x; v.y = v.ty = sp.y; v.hp = MAX_HP; }
    const w = winner(st.kills); if (w && !st.over) { st.over = true; setResult(w); }
  };

  const fire = () => {
    const st = s.current, p = st.players[myId], now = performance.now();
    if (!p || st.over) return;
    const W = WEAPONS[st.w]!;
    if (now - st.last < W.cd) return;
    if (st.ammo <= 0) { st.ammo = W.ammo; flash("Reload..."); st.last = now + 600; return; }
    st.last = now; st.ammo--; shoot(p, st.w, now);
  };
  const swap = () => { const st = s.current; st.w = (st.w + 1) % WEAPONS.length; st.ammo = WEAPONS[st.w]!.ammo; flash(`Senjata: ${WEAPONS[st.w]!.name}`); };

  useEffect(() => {
    const map: Record<string, "left" | "right" | "up" | "down" | "fire"> = { arrowleft: "left", a: "left", arrowright: "right", d: "right", arrowup: "up", w: "up", arrowdown: "down", s: "down", " ": "fire", j: "fire" };
    const on = (v: boolean) => (e: KeyboardEvent) => { if (e.key.toLowerCase() === "q" && v) swap(); const k = map[e.key.toLowerCase()]; if (k) { keys.current[k] = v; e.preventDefault(); } };
    const d = on(true), u = on(false);
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loop
  useEffect(() => {
    const ctx = canvas.current!.getContext("2d")!;
    let raf = 0, lastSend = 0, lastHud = 0;
    const loop = (t: number) => {
      const st = s.current, k = keys.current, p = st.players[myId];
      if (p && !st.over) {
        const dx = (k.right ? 1 : 0) - (k.left ? 1 : 0), dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        if (dx || dy) { const n = Math.hypot(dx, dy); p.fx = dx / n; p.fy = dy / n; Object.assign(p, moveCircle(p.x, p.y, (dx / n) * 3.2, (dy / n) * 3.2)); }
        if (k.fire) fire();
      }
      // remote smoothing / bots
      for (const o of Object.values(st.players)) {
        if (o.id === myId) continue;
        if (solo && !st.over && p) {
          const ddx = p.x - o.x, ddy = p.y - o.y, d = Math.hypot(ddx, ddy) || 1;
          o.fx = ddx / d; o.fy = ddy / d;
          if (d > 160) Object.assign(o, moveCircle(o.x, o.y, o.fx * 1.6 + Math.sin(t / 700 + o.x) * 0.8, o.fy * 1.6));
          if (d < 380 && Math.random() < 0.012) shoot(o, 2, t);
        } else if (!solo) { o.x += (o.tx - o.x) * 0.35; o.y += (o.ty - o.y) * 0.35; }
      }
      if (!solo) for (const [id, o] of Object.entries(st.players)) if (id !== myId && t - o.seen > 6000) delete st.players[id];
      // bullets
      st.bullets = st.bullets.filter((b) => {
        b.x += b.vx; b.y += b.vy; b.left -= Math.hypot(b.vx, b.vy);
        if (b.left <= 0 || b.x < 0 || b.y < 0 || b.x > AW || b.y > AH) return false;
        if (COVER.some((c) => hitsRect(b.x, b.y, 2, c))) return false;
        // online: only my own body decides if I was hit; solo: everything is local
        const targets = solo ? Object.values(st.players) : p ? [p] : [];
        for (const v of targets) {
          if (v.id === b.by || (solo && v.id !== "me" && b.by !== "me")) continue;
          if (Math.hypot(v.x - b.x, v.y - b.y) < R + 3) {
            if (st.over) return false;
            const h = applyHit(v.hp, b.dmg); v.hp = h.hp;
            if (h.dead) killed(v.id, b.by);
            return false;
          }
        }
        return true;
      });
      if (!solo && p && t - lastSend > 60) { lastSend = t; send("st", { id: p.id, name: p.name, slot, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, fx: p.fx, fy: p.fy }); }
      if (t - lastHud > 200) {
        lastHud = t;
        setHud({ hp: p?.hp ?? 0, ammo: st.ammo, w: st.w });
        setBoard(Object.values(st.players).map((o) => ({ name: o.name, k: st.kills[o.id] ?? 0, me: o.id === myId })).sort((a, b) => b.k - a.k));
      }
      // draw
      ctx.fillStyle = "#2b2b36"; ctx.fillRect(0, 0, AW, AH);
      ctx.strokeStyle = "#383848"; ctx.lineWidth = 1;
      for (let x = 0; x < AW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, AH); ctx.stroke(); }
      for (let y = 0; y < AH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(AW, y); ctx.stroke(); }
      for (const c of COVER) { ctx.fillStyle = "#8B5A2B"; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeStyle = "#5c3a1a"; ctx.lineWidth = 4; ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4); }
      ctx.fillStyle = "#FFD93D";
      for (const b of st.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
      for (const o of Object.values(st.players)) {
        ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#111"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.fx * (R + 10), o.y + o.fy * (R + 10)); ctx.stroke();
        ctx.fillStyle = "#ff4444"; ctx.fillRect(o.x - 20, o.y - R - 12, 40 * (o.hp / MAX_HP), 5);
        ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
        ctx.fillText(o.id === myId ? `⭐ ${o.name}` : o.name, o.x, o.y - R - 16); ctx.textAlign = "left";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const hold = (k: keyof typeof keys.current) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); keys.current[k] = true; },
    onPointerUp: () => { keys.current[k] = false; }, onPointerCancel: () => { keys.current[k] = false; },
    onPointerLeave: () => { keys.current[k] = false; }, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const winName = result ? s.current.players[result]?.name ?? "?" : "";
  const mine = s.current.kills[myId] ?? 0;

  return (
    <div className="play-stage">
      <canvas ref={canvas} width={AW} height={AH} className="play-canvas" />
      <div className="play-hud">
        <button onClick={() => navigate({ to: solo ? "/" : "/mabar" })} className="hud-btn">✕</button>
        <span className="hud-chip">❤️ {hud.hp}</span>
        <span className="hud-chip">🔫 {WEAPONS[hud.w]!.name} | {Number.isFinite(hud.ammo) ? hud.ammo : "∞"}</span>
        <span className="hud-chip">🏆 {board.slice(0, 5).map((b) => `${b.me ? "⭐" : ""}${b.name} ${b.k}`).join(" · ")} / {TARGET}</span>
      </div>
      {toast && <div className="play-toast">{toast}</div>}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="pixel-card w-full max-w-xs text-center">
            <div className="text-5xl">{result === myId ? "🏆" : "💀"}</div>
            <p className="font-pixel mt-2 text-xs">{result === myId ? "KAMU MENANG!" : `${winName} MENANG`}</p>
            <p className="mt-1 text-xs text-muted-foreground">Skor kamu: {mine} Poin</p>
            <div className="mt-2 text-xs">{board.map((b, i) => <p key={i}>{i + 1}. {b.name} - {b.k}</p>)}</div>
            <button onClick={() => { reset(); if (!solo) send("again", {}); }} className="pixel-btn mt-3 w-full">REMATCH 🔄</button>
            <button onClick={() => navigate({ to: "/" })} className="pixel-btn mt-2 w-full">MENU</button>
          </div>
        </div>
      )}
      <div className="pad pad-left">
        <button className="pad-key" {...hold("left")}>◀</button>
        <button className="pad-key" {...hold("up")}>▲</button>
        <button className="pad-key" {...hold("down")}>▼</button>
        <button className="pad-key" {...hold("right")}>▶</button>
      </div>
      <div className="pad pad-right">
        <button className="pad-key" onClick={swap}>🔄</button>
        <button className="pad-key" {...hold("fire")}>🔥</button>
      </div>
      <div className="rotate-hint">Putar HP ke posisi mendatar 📱↔️</div>
    </div>
  );
}
