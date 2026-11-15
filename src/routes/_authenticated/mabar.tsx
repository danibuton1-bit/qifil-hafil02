import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { MAX_PLAYERS, canStart, newCode } from "@/lib/bayone";

export const Route = createFileRoute("/_authenticated/mabar")({
  head: () => ({
    meta: [
      { title: "Mabar 1-5 Orang - QIFIL DAN HAFIL" },
      { name: "description", content: "Buat atau gabung room mabar sampai 5 orang dari HP berbeda." },
      { property: "og:title", content: "Mabar 1-5 Orang - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Room mabar sampai 5 pemain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Mabar,
});

type Seat = { id: string; name: string; ready: boolean; at: number; drone?: boolean };
type Mode = "bayone" | "coop" | "race";

function Mabar() {
  const me = useProfile();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [join, setJoin] = useState("");
  const [host, setHost] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("bayone");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [msg, setMsg] = useState("");
  const [drone, setDrone] = useState(false);
  const [lvl, setLvl] = useState(1);
  const ch = useRef<RealtimeChannel | null>(null);
  const joinedAt = useRef(Date.now());

  useEffect(() => {
    if (!code || !me) return;
    const c = supabase.channel(`mabar:${code}`, { config: { presence: { key: me.id } } });
    c.on("presence", { event: "sync" }, () => {
      const st = c.presenceState<Seat>();
      setSeats(Object.values(st).map((v) => v[0]!).filter(Boolean).sort((a, b) => a.at - b.at));
    })
      .on("broadcast", { event: "mode" }, ({ payload }) => setMode(payload.mode))
      .on("broadcast", { event: "start" }, ({ payload }) => go(payload.mode, payload.order, payload.drones, payload.level))
      .subscribe((s) => { if (s === "SUBSCRIBED") void c.track({ id: me.id, name: me.username, ready: false, at: joinedAt.current }); });
    ch.current = c;
    return () => { supabase.removeChannel(c); ch.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, me]);

  const go = (m: Mode, order: string[], drones: string[] = [], level = 1) => {
    const i = order.indexOf(me?.id ?? "");
    if (i < 0) return;
    if (m === "race") { navigate({ to: "/race/$room", params: { room: code }, search: { slot: i, drone: drones.includes(me!.id), level } }); return; }
    if (m === "bayone") navigate({ to: "/bayone/$room", params: { room: code }, search: { slot: i } });
    else if (i < 2) navigate({ to: "/play/$room", params: { room: `m${code}` }, search: { role: i === 0 ? "qifil" : "hafil" } });
    else setMsg("Co-op berjalan untuk 2 pemain pertama. Kamu bisa main Bay One di room ini.");
  };

  const toggle = () => { const r = !ready; setReady(r); void ch.current?.track({ id: me!.id, name: me!.username, ready: r, at: joinedAt.current, drone }); };
  const toggleDrone = () => { const d = !drone; setDrone(d); void ch.current?.track({ id: me!.id, name: me!.username, ready, at: joinedAt.current, drone: d }); };
  const pickMode = (m: Mode) => { setMode(m); void ch.current?.send({ type: "broadcast", event: "mode", payload: { mode: m } }); };
  const full = seats.length > MAX_PLAYERS;
  const myIdx = seats.findIndex((s) => s.id === me?.id);
  const ok = canStart(seats) && (mode === "bayone" || (mode === "race" ? seats.some((s) => !s.drone) : seats.length === 2));
  const start = () => {
    const order = seats.map((s) => s.id);
    void ch.current?.send({ type: "broadcast", event: "start", payload: { mode, order, drones: seats.filter((s) => s.drone).map((s) => s.id), level: lvl } });
    go(mode, order, seats.filter((s) => s.drone).map((s) => s.id), lvl);
  };
  const share = async () => {
    const t = `Ayo mabar QIFIL HAFIL! Kode Room: ${code}`;
    try { await navigator.clipboard.writeText(t); setMsg("Kode tersalin!"); } catch { /* ignore */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank");
  };

  return (
    <main className="pixel-page flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md items-center justify-between">
        <h1 className="font-pixel text-sm">👥 MABAR 1-5 ORANG</h1>
        <button onClick={() => navigate({ to: "/" })} className="pixel-btn !py-1">← Menu</button>
      </div>
      {!code ? (
        <div className="pixel-card w-full max-w-md">
          <b>🏠 BUAT ROOM</b>
          <p className="my-2 text-xs text-muted-foreground">Klik BUAT ROOM lalu kirim kode ke teman. Maksimal 5 pemain, tanpa BOT.</p>
          <button onClick={() => { setHost(true); setCode(newCode()); }} className="pixel-btn w-full">BUAT ROOM MABAR</button>
          <hr className="my-4" />
          <b>🔍 GABUNG ROOM</b>
          <input value={join} onChange={(e) => setJoin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Kode Room - 2211" className="pixel-input mt-2" />
          <button disabled={join.length !== 4} onClick={() => { setHost(false); setCode(join); }} className="pixel-btn mt-2 w-full">GABUNG ROOM</button>
        </div>
      ) : (
        <div className="pixel-card w-full max-w-md">
          <p className="text-xs">Kode Room:</p>
          <p className="font-pixel text-2xl tracking-widest">{code}</p>
          <button onClick={share} className="pixel-btn mt-2 w-full">SALIN KODE + BAGIKAN WA</button>
          <p className="mt-4 font-bold">LOBBY - {seats.length}/{MAX_PLAYERS} Pemain</p>
          {full && myIdx >= MAX_PLAYERS && <p className="text-xs text-destructive">Room penuh (maks 5).</p>}
          <div className="mt-2 flex flex-col gap-1">
            {seats.slice(0, MAX_PLAYERS).map((s, i) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span>{i === 0 ? "👑 " : ""}<b>{s.name}</b>{s.drone ? " 🎥" : ""} {s.id === me?.id ? "(Kamu)" : ""}</span>
                <span>{s.ready ? "✅ READY" : "❌ BELUM"}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs">Mode: <b>{mode === "bayone" ? "⚔️ BAY ONE - SALING TEMBAK" : mode === "race" ? `🏁 TURNAMEN BALAPAN - LEVEL ${lvl}` : "🧩 CO-OP (2 pemain)"}</b></p>
          {host && (
            <div className="mt-2 flex gap-2">
              <button onClick={() => pickMode("bayone")} className="pixel-btn flex-1 !py-1">⚔️ BAY ONE</button>
              <button onClick={() => pickMode("coop")} className="pixel-btn flex-1 !py-1">🧩 CO-OP</button>
              <button onClick={() => pickMode("race")} className="pixel-btn flex-1 !py-1">🏁 TURNAMEN</button>
            </div>
          )}
          {host && mode === "race" && (
            <label className="mt-2 flex items-center gap-2 text-xs">Level: <input type="number" min={1} max={100} value={lvl} onChange={(e) => setLvl(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="pixel-input !w-20" /></label>
          )}
          {mode === "race" && (
            <button onClick={toggleDrone} className="pixel-btn mt-2 w-full">{drone ? "🏃 JADI PEMAIN" : "🎥 JADI KAMERA DRONE"}</button>
          )}
          <button onClick={toggle} className="pixel-btn mt-3 w-full">{ready ? "BATAL READY ❌" : "SAYA READY ✅"}</button>
          {host ? (
            <button disabled={!ok} onClick={start} className="pixel-btn mt-2 w-full">MULAI GAME ▶</button>
          ) : (
            <p className="mt-2 text-center text-xs">MENUNGGU HOST MULAI...</p>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {seats.length < 2 ? "Tunggu minimal 1 teman lagi." : mode === "coop" && seats.length !== 2 ? "Co-op butuh tepat 2 pemain." : seats.every((s) => s.ready) ? "Semua READY! Host bisa MULAI!" : "Menunggu semua READY..."}
          </p>
          {msg && <p className="mt-2 text-center text-xs">{msg}</p>}
        </div>
      )}
    </main>
  );
}
