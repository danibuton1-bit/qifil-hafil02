import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { SKINS, type Skin } from "@/lib/game";
import { Character, savedSkin } from "@/components/Character";
import { useGameMusic } from "@/lib/music";
import { isSkin } from "@/lib/game";
import { LuckyRoyale, useLuckySkin, useOwnedSkins, equip } from "@/components/LuckyRoyale";
import { LobbyChat } from "@/components/LobbyChat";
import { LobbyVideoBg } from "@/components/LobbyVideo";
import { RARITY, type Rarity } from "@/lib/economy";
import { ALL_EMOTES, emoteById, toggleLoadout, cleanLoadout, MAX_LOADOUT, DEFAULT_LOADOUT } from "@/lib/emotes";
import logo from "@/assets/qifil-hafil-logo.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QIFIL DAN HAFIL - Lobi Game Co-op Online" },
      { name: "description", content: "Lobi game QIFIL & HAFIL: pilih mode, ganti warna di Vault, ajak teman online dan mulai main." },
      { property: "og:title", content: "QIFIL DAN HAFIL - Lobi Game" },
      { property: "og:description", content: "Pilih mode, ganti warna karakter, ajak teman online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type ModeId = "coop" | "race" | "mabar" | "bayone" | "solo" | "hotspot" | "bluetooth";
const MODES: { id: ModeId; icon: string; name: string; sub: string; online: boolean }[] = [
  { id: "coop", icon: "🤝", name: "PETUALANGAN CO-OP", sub: "2 pemain · ajak teman di kanan", online: true },
  { id: "race", icon: "🏁", name: "TURNAMEN BALAPAN", sub: "2-5 pemain · hantu 👻 · drone", online: true },
  { id: "mabar", icon: "👥", name: "MABAR 1-5 ORANG", sub: "room kode 4 angka", online: true },
  { id: "bayone", icon: "⚔️", name: "BAY ONE ARENA", sub: "lawan 4 BOT", online: false },
  { id: "solo", icon: "🤖", name: "MAIN SENDIRI", sub: "bareng BOT · offline", online: false },
  { id: "hotspot", icon: "📶", name: "MABAR HOTSPOT", sub: "offline", online: false },
  { id: "bluetooth", icon: "🔵", name: "MABAR BLUETOOTH", sub: "offline", online: false },
];
type Invite = { to: string; from: string; fromName: string; room: string };
type Role = "qifil" | "hafil";
type Seat = { name: string; pid: string; skin: Skin; ready: boolean; colors?: { body: string; hat: string } | null };
type Emote = string;
type Chat = { id: string; name: string; text: string };

function Home() {
  const me = useProfile();
  const navigate = useNavigate();
  const [net, setNet] = useState(true);
  const [mode, setMode] = useState<ModeId>("coop");
  const [showOnline, setShowOnline] = useState(true);
  const [pickMode, setPickMode] = useState(false);
  const [vault, setVault] = useState(false);
  const [skin, setSkin] = useState<Skin>("pink");
  const lucky = useLuckySkin();
  const owned = useOwnedSkins();
  const [online, setOnline] = useState<{ pid: string; name: string }[]>([]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [waiting, setWaiting] = useState("");
  const chan = useRef<RealtimeChannel | null>(null);
  const [party, setParty] = useState<{ room: string; role: Role } | null>(null);
  const [mate, setMate] = useState<Seat | null>(null);
  const [ready, setReady] = useState(false);
  const [chat, setChat] = useState<Chat[]>([]);
  const [wheel, setWheel] = useState(false);
  const [loadout, setLoadout] = useState<string[]>(DEFAULT_LOADOUT);
  useEffect(() => { try { setLoadout(cleanLoadout(JSON.parse(localStorage.getItem("emote-loadout") ?? "null"))); } catch { /* default */ } }, []);
  const tapLoadout = (id: string) => setLoadout((c) => { const n = toggleLoadout(c, id); localStorage.setItem("emote-loadout", JSON.stringify(n)); return n; });
  const [emote, setEmote] = useState<Partial<Record<Role, { kind: Emote; at: number }>>>({});
  const pch = useRef<RealtimeChannel | null>(null);
  const seatRef = useRef<Seat | null>(null);
  const music = useGameMusic("lobby");

  useEffect(() => {
    setSkin(savedSkin("qifil"));
    const m = localStorage.getItem("mode");
    if (m && MODES.some((x) => x.id === m)) setMode(m as ModeId);
    const u = () => setNet(navigator.onLine);
    u(); window.addEventListener("online", u); window.addEventListener("offline", u);
    return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); };
  }, []);

  // Same "lobby" channel protocol as the old lobby page, so invites work across both.
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel("lobby", { config: { presence: { key: me.player_id } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<{ name: string }>();
      setOnline(Object.entries(st).map(([pid, v]) => ({ pid, name: v[0]?.name ?? "" })).filter((o) => o.pid !== me.player_id));
    })
      .on("broadcast", { event: "invite" }, ({ payload }) => { if (payload.to === me.player_id) setInvite(payload as Invite); })
      .on("broadcast", { event: "answer" }, ({ payload }) => {
        if (payload.to !== me.player_id) return;
        setWaiting("");
        if (payload.ok) setParty({ room: payload.room, role: "qifil" });
        else alert(`${payload.fromName} menolak ajakan.`);
      })
      .subscribe((s) => { if (s === "SUBSCRIBED") ch.track({ name: me.username }); });
    chan.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [me, navigate]);

  const ask = (pid: string, name: string) => {
    if (!me) return;
    const room = Math.random().toString(36).slice(2, 8).toUpperCase();
    chan.current?.send({ type: "broadcast", event: "invite", payload: { to: pid, from: me.player_id, fromName: me.username, room } });
    setWaiting(name);
  };
  const answer = (ok: boolean) => {
    if (!invite || !me) return;
    chan.current?.send({ type: "broadcast", event: "answer", payload: { to: invite.from, ok, room: invite.room, fromName: me.username } });
    if (ok) setParty({ room: invite.room, role: "hafil" });
    setInvite(null);
  };
  // Party lives inside this one lobby: mate appears next to you, with chat and emotes.
  useEffect(() => {
    if (!party || !me) return;
    const other: Role = party.role === "qifil" ? "hafil" : "qifil";
    const ch = supabase.channel(`party:${party.room}`, { config: { presence: { key: party.role }, broadcast: { self: false } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<Seat>();
      const p = st[other]?.[st[other].length - 1];
      setMate(p ? { name: p.name, pid: p.pid, skin: p.skin, ready: p.ready, colors: p.colors ?? null } : null);
    })
      .on("broadcast", { event: "seat" }, ({ payload }) => { if (payload.role === other) setMate(payload.seat); })
      .on("broadcast", { event: "chat" }, ({ payload }) => setChat((c) => [...c.slice(-30), payload as Chat]))
      .on("broadcast", { event: "emote" }, ({ payload }) => showEmote(payload.role, payload.kind))
      .on("broadcast", { event: "leave" }, () => { setMate(null); if (party.role === "hafil") leaveParty(false); })
      .on("broadcast", { event: "start" }, () => navigate({ to: "/play/$room", params: { room: party.room }, search: { role: party.role } }))
      .subscribe((st) => { if (st === "SUBSCRIBED") { pch.current = ch; if (seatRef.current) ch.track(seatRef.current); } });
    return () => { supabase.removeChannel(ch); pch.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party, me, navigate]);

  useEffect(() => {
    if (!me || !party) return;
    const seat: Seat = { name: me.username, pid: me.player_id, skin, ready, colors: lucky };
    seatRef.current = seat;
    pch.current?.track(seat);
    pch.current?.send({ type: "broadcast", event: "seat", payload: { role: party.role, seat } });
  }, [me, party, skin, ready, lucky]);

  const showEmote = (role: Role, kind: Emote) => {
    const at = Date.now();
    const scope = emoteById(kind)?.scope ?? "self";
    const roles: Role[] = scope === "self" ? [role] : ["qifil", "hafil"];
    setEmote((e) => { const n = { ...e }; for (const r of roles) n[r] = { kind, at }; return n; });
    setTimeout(() => setEmote((e) => { const n = { ...e }; for (const r of roles) if (n[r]?.at === at) delete n[r]; return n; }), 3200);
  };

  const sendEmote = (kind: Emote) => {
    const role = party?.role ?? "qifil";
    showEmote(role, kind);
    pch.current?.send({ type: "broadcast", event: "emote", payload: { role, kind } });
  };
  const sendChat = (t: string) => {
    if (!me) return;
    const m: Chat = { id: `${Date.now()}${Math.random()}`, name: me.username, text: t };
    setChat((c) => [...c.slice(-30), m]);
    pch.current?.send({ type: "broadcast", event: "chat", payload: m });
  };
  const leaveParty = (notify = true) => {
    if (notify) pch.current?.send({ type: "broadcast", event: "leave", payload: {} });
    setParty(null); setMate(null); setReady(false); setChat([]);
  };
  const startParty = () => {
    if (!party) return;
    pch.current?.send({ type: "broadcast", event: "start", payload: {} });
    navigate({ to: "/play/$room", params: { room: party.room }, search: { role: party.role } });
  };

  const chooseSkin = (s: Skin) => { setSkin(s); localStorage.setItem("skin", s); localStorage.removeItem("luckySkin"); window.dispatchEvent(new Event("lucky-skin")); };
  const chooseMode = (m: ModeId) => { setMode(m); localStorage.setItem("mode", m); setPickMode(false); };

  const cur = MODES.find((m) => m.id === mode)!;
  const needLogin = cur.online && !me;
  const blocked = cur.online && !net;

  const start = () => {
    if (blocked) return;
    if (needLogin) return navigate({ to: "/auth" });
    if (party) {
      if (party.role === "hafil") return setReady((v) => !v);
      if (!mate) return;
      if (!mate.ready) return alert(`${mate.name} belum SIAP.`);
      return startParty();
    }
    switch (mode) {
      case "coop": return online[0] ? ask(online[0].pid, online[0].name) : alert("Belum ada teman online. Ajak lewat daftar di kanan.");
      case "race": case "mabar": return navigate({ to: "/mabar" });
      case "bayone": return navigate({ to: "/bayone-solo" });
      case "solo": return navigate({ to: "/solo" });
      case "hotspot": return navigate({ to: "/hotspot" });
      case "bluetooth": return navigate({ to: "/bluetooth" });
    }
  };
  const logout = async () => { await supabase.auth.signOut(); location.reload(); };

  return (
    <main className="es-stage" onClick={() => setWheel(false)}>
      <LobbyVideoBg />
      <div className="es-grid" />
      <div className="es-floor" />
      {/* Top bar */}
      <header className="absolute inset-x-2 top-2 z-30 flex flex-wrap items-center gap-2">
        <img src={logo} alt="QIFIL DAN HAFIL" className="h-10 rounded border border-es-line" />
        <div className="es-panel flex items-center gap-2 px-3 py-1">
          <span className="font-display text-xs">{me?.username ?? "TAMU"}</span>
          {me && <span className="text-xs text-es-dim">ID {me.player_id}</span>}
          <span className="text-xs">{net ? "🟢" : "⚪"}</span>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {me && <LuckyRoyale />}
          {me ? <button onClick={logout} className="es-chip">🚪 KELUAR</button> : <Link to="/auth" className="es-chip">🔑 MASUK</Link>}
        </div>
      </header>

      {/* Left menu */}
      <nav className="absolute left-2 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
        <button onClick={() => setVault(true)} className="es-side-btn"><span className="text-xl">🎒</span>VAULT</button>
        <button onClick={() => setPickMode(true)} className="es-side-btn"><span className="text-xl">🎮</span>MODE</button>
        <Link to="/mabar" className="es-side-btn"><span className="text-xl">🏆</span>EVENT</Link>
      </nav>

      {/* Center stage: you + party mate side by side */}
      <section className="pointer-events-none absolute inset-0 flex items-end justify-center gap-10 pb-[16%] pr-8 pl-20">
        {[
          { role: (party?.role ?? "qifil") as Role, name: me?.username ?? "QIFIL", sk: skin, col: lucky, rd: party ? (party.role === "hafil" ? ready : true) : null, you: true },
          ...(party ? [mate
            ? { role: (party.role === "qifil" ? "hafil" : "qifil") as Role, name: mate.name, sk: isSkin(mate.skin) ? mate.skin : ("biru" as Skin), col: mate.colors ?? null, rd: party.role === "qifil" ? mate.ready : true, you: false }
            : null] : []),
        ].map((p, i) => p ? (
          <div key={p.role} className="pointer-events-auto relative flex flex-col items-center">
            <span className="mb-1 font-display text-xs tracking-widest text-es-neon">{p.rd === null ? "" : p.rd ? "✔ " : "… "}{p.name}{p.you && party ? " (kamu)" : ""}</span>
            {(() => {
              const e = emote[p.role];
              const kissing = e?.kind === "kiss" && mate;
              const dir = i === 0 ? 1 : -1;
              return (
                <div onClick={p.you && me ? (ev) => { ev.stopPropagation(); setWheel((w) => !w); } : undefined}
                  role={p.you && me ? "button" : undefined} aria-label={p.you && me ? "Pilih emote" : undefined}
                  className={`relative ${p.you && me ? "cursor-pointer" : ""} ${emoteById(e?.kind ?? "")?.anim ?? ""}`}
                  style={{ transition: "transform .4s", transform: kissing ? `translateX(${dir * 34}px) rotate(${dir * 8}deg)` : undefined, filter: "drop-shadow(0 0 18px color-mix(in oklab, var(--es-cyan) 60%, transparent))" }}>
                  <Character skin={p.sk} colors={p.col} size={90} />
                  {p.you && wheel && (
                    <div className="emo-wheel" onClick={(ev) => ev.stopPropagation()}>
                      {loadout.map((id) => emoteById(id)!).map((em, k, arr) => {
                        const a = (-90 + (k - (arr.length - 1) / 2) * (300 / Math.max(arr.length - 1, 1))) * Math.PI / 180;
                        return (
                          <button key={em.id} aria-label={em.label} title={em.label} className="emo-wheel-btn"
                            style={{ left: `calc(50% + ${Math.cos(a) * 78}px)`, top: `calc(45% + ${Math.sin(a) * 78}px)` }}
                            onClick={() => { sendEmote(em.id); setWheel(false); }}>
                            <span className="text-xl">{em.icon}</span><span className="text-[7px] leading-none">{em.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {e?.kind === "love" && (<>{[0, 1, 2, 3, 4].map((k) => <span key={k} className="emo-heart" style={{ left: `${10 + k * 18}%`, animationDelay: `${k * 0.25}s` }}>❤️</span>)}</>)}
                  {e?.kind === "kiss" && <span className="emo-kiss" style={{ [i === 0 ? "right" : "left"]: "-24px" }}>💋</span>}
                  {e && emoteById(e.kind)?.dark && <span className="emo-aura" />}
                  {e && !["love", "kiss", "salting"].includes(e.kind) && <span className="emo-face">{emoteById(e.kind)?.icon}</span>}
                  {e && (e.kind === "couple" || e.kind === "bucin") && (<>{[0, 1, 2, 3].map((k) => <span key={k} className="emo-heart" style={{ left: `${15 + k * 22}%`, animationDelay: `${k * 0.3}s` }}>💗</span>)}</>)}
                  {e?.kind === "salting" && (<><span className="emo-face">😖</span><span className="emo-blush" style={{ left: "8%" }} /><span className="emo-blush" style={{ right: "8%" }} /></>)}
                </div>
              );
            })()}
          </div>
        ) : (
          <div key="empty" className="flex h-[117px] w-[90px] items-center justify-center rounded-xl border-4 border-dashed border-es-line text-3xl text-es-dim">?</div>
        ))}
      </section>

      {/* Emotes + party chat */}
      {me && (
        <div className="absolute bottom-20 left-20 z-10 flex flex-col gap-1">
          <div className="flex gap-1">
            {party && <button onClick={() => leaveParty()} className="es-chip">KELUAR TIM</button>}
          </div>
          <LobbyChat myName={me.username} team={party ? chat : null} onSendTeam={sendChat} />
        </div>
      )}

      {/* Right: online players */}
      {!showOnline && (
        <button onClick={() => setShowOnline(true)} aria-label="Lihat teman online" className="es-panel absolute right-0 top-1/3 z-10 rounded-r-none px-1 py-3 font-display text-xs text-es-cyan">
          &lt;<br />👥<br />{online.length}
        </button>
      )}
      {showOnline && <aside className="es-panel absolute right-2 top-14 z-10 max-h-[55%] flex w-36 flex-col p-1.5">
        <div className="mb-1 flex items-center">
          <p className="flex-1 font-display text-[9px] tracking-widest text-es-cyan">👥 ONLINE ({online.length})</p>
          <button onClick={() => setShowOnline(false)} aria-label="Tutup daftar teman" className="es-chip !px-1.5 !py-0 text-xs">&gt;</button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {!me && <p className="text-sm text-es-dim">Masuk dulu untuk melihat dan mengajak teman.</p>}
          {me && online.length === 0 && <p className="text-sm text-es-dim">Belum ada pemain lain online.</p>}
          {online.map((o) => (
            <div key={o.pid} className="flex items-center gap-1 rounded border border-es-line/40 px-1 py-0.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-es-cyan" />
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{o.name}</span>
              <button disabled={!!party} onClick={() => ask(o.pid, o.name)} className="rounded bg-es-neon px-1 text-[10px] font-bold text-es-bg">+</button>
            </div>
          ))}
        </div>
        {waiting && <p className="mt-1 text-[10px] text-es-neon">Menunggu {waiting}...</p>}
      </aside>}

      {/* Bottom-left: mode card */}
      <button onClick={() => setPickMode(true)} className="es-panel absolute bottom-2 left-20 z-10 flex items-center gap-3 px-4 py-2 text-left">
        <span className="text-3xl">{cur.icon}</span>
        <span>
          <span className="block text-[10px] tracking-widest text-es-dim">MODE ▸ GANTI</span>
          <span className="block font-display text-sm text-es-neon">{cur.name}</span>
          <span className="block text-xs text-es-dim">{cur.sub}</span>
        </span>
      </button>

      {/* Bottom-right: start */}
      <button onClick={start} disabled={blocked} className="es-start absolute bottom-3 right-3 z-10 px-10 py-3">
        {blocked ? "BUTUH INTERNET" : needLogin ? "MASUK ▶" : party?.role === "hafil" ? (ready ? "BATAL SIAP" : "SIAP ✔") : party && !mate ? "MENUNGGU…" : "MULAI ▶"}
      </button>

      {/* Mode picker */}
      {pickMode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-es-bg/85 p-4" onClick={() => setPickMode(false)}>
          <div className="grid w-full max-w-3xl grid-cols-4 gap-2" onClick={(e) => e.stopPropagation()}>
            {MODES.map((m) => (
              <button key={m.id} onClick={() => chooseMode(m.id)}
                className={`es-panel flex flex-col items-start p-3 text-left ${m.id === mode ? "!border-es-neon" : ""}`}>
                <span className="text-3xl">{m.icon}</span>
                <span className="mt-1 font-display text-[11px] text-es-neon">{m.name}</span>
                <span className="text-xs text-es-dim">{m.sub}</span>
                {m.online && !net && <span className="text-xs">🔒 butuh internet</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vault */}
      {vault && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-es-bg/85 p-4" onClick={() => setVault(false)}>
          <div className="es-panel flex items-center gap-6 p-5" onClick={(e) => e.stopPropagation()}>
            <Character skin={skin} colors={lucky} size={80} />
            <div>
              <p className="mb-2 font-display text-sm tracking-widest text-es-neon">🎒 VAULT · WARNA</p>
              <div className="flex gap-2">
                {(Object.keys(SKINS) as Skin[]).map((s) => (
                  <button key={s} onClick={() => chooseSkin(s)} aria-label={SKINS[s].label}
                    className={`h-10 w-10 rounded border-2 ${s === skin && !lucky ? "border-es-neon" : "border-es-line"}`}
                    style={{ background: SKINS[s].body }} />
                ))}
              </div>
              <p className="mb-1 mt-3 font-display text-xs tracking-widest text-es-cyan">🎰 SKIN LUCKY ROYALE ({owned.length})</p>
              {!me && <p className="text-xs text-es-dim">Masuk dulu untuk melihat skin kamu.</p>}
              {me && owned.length === 0 && <p className="text-xs text-es-dim">Belum punya. Spin di LUCKY ROYALE, skin langsung tersimpan di sini.</p>}
              <div className="flex max-w-64 flex-wrap gap-2">
                {owned.map((o) => {
                  const on = lucky?.body === o.body && lucky?.hat === o.hat;
                  return (
                    <button key={o.id} onClick={() => equip(o)} aria-label={`Pakai ${o.name}`} title={o.name}
                      className={`flex w-16 flex-col items-center rounded border-2 p-1 ${on ? "border-es-neon" : "border-es-line"}`}>
                      <Character skin="pink" colors={o} size={28} />
                      <span className="w-full truncate text-[10px] font-bold" style={{ color: RARITY[o.rarity as Rarity]?.color }}>{o.name}</span>
                      {on && <span className="text-[9px] text-es-neon">DIPAKAI</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mb-1 mt-3 font-display text-xs tracking-widest text-es-cyan">🎭 EMOT · DI LOBI {loadout.length}/{MAX_LOADOUT}</p>
              <p className="mb-1 text-[10px] text-es-dim">Ketuk untuk pasang/lepas. Yang menyala muncul saat ketuk karakter.</p>
              <div className="grid max-w-72 grid-cols-5 gap-1.5">
                {ALL_EMOTES.map((em) => {
                  const on = loadout.includes(em.id);
                  return (
                    <button key={em.id} onClick={() => tapLoadout(em.id)} aria-label={`${on ? "Lepas" : "Pasang"} emot ${em.label}`} title={em.label}
                      className={`relative flex flex-col items-center rounded border-2 p-1 ${on ? "border-es-neon" : "border-es-line opacity-60"} ${em.dark ? "bg-es-bg" : ""}`}>
                      <span className="text-xl">{em.icon}</span>
                      <span className="w-full truncate text-[8px] font-bold">{em.label}</span>
                      {em.tag && <span className="emo-tag">{em.tag}</span>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setVault(false)} className="es-chip mt-3">SIMPAN ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming invite */}
      {invite && (
        <div className="es-panel absolute left-1/2 top-14 z-30 -translate-x-1/2 p-3 text-center">
          <p className="font-display text-xs">{invite.fromName} mengajak main!</p>
          <div className="mt-2 flex justify-center gap-2">
            <button onClick={() => answer(true)} className="rounded bg-es-neon px-3 py-1 font-bold text-es-bg">TERIMA</button>
            <button onClick={() => answer(false)} className="es-chip">TOLAK</button>
          </div>
        </div>
      )}
    </main>
  );
}
