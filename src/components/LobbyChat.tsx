import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChatMsg = { id: string; name: string; text: string };
type Row = { id: string; username: string; body: string };
const toMsg = (r: Row): ChatMsg => ({ id: r.id, name: r.username, text: r.body });

/** Free Fire style chat box: DUNIA = everyone in the lobby (saved), TIM = party only. */
export function LobbyChat({ myName, team, onSendTeam }: { myName: string; team: ChatMsg[] | null; onSendTeam: (t: string) => void }) {
  const [tab, setTab] = useState<"dunia" | "tim">("dunia");
  const [open, setOpen] = useState(true);
  const [world, setWorld] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    let alive = true;
    supabase.from("lobby_messages").select("id, username, body").order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => { if (alive && data) setWorld(data.reverse().map(toMsg)); });
    const ch = supabase.channel(`lobby-chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lobby_messages" }, ({ new: r }) => {
        const m = toMsg(r as Row);
        setWorld((w) => (w.some((x) => x.id === m.id) ? w : [...w.slice(-60), m]));
        if (!openRef.current) setUnread((u) => u + 1);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { if (!team && tab === "tim") setTab("dunia"); }, [team, tab]);
  const list = tab === "tim" ? team ?? [] : world;
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [list.length, tab, open]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim().slice(0, 120);
    if (!t) return;
    setText("");
    if (tab === "tim") return onSendTeam(t);
    const { data, error } = await supabase.from("lobby_messages").insert({ body: t }).select("id, username, body").single();
    if (error) { setText(t); return alert("Pesan gagal terkirim."); }
    const m = toMsg(data);
    setWorld((w) => (w.some((x) => x.id === m.id) ? w : [...w.slice(-60), m]));
  };

  if (!open) return (
    <button onClick={() => { setOpen(true); setUnread(0); }} aria-label="Buka chat" className="es-chip relative w-fit !px-2 text-xl">
      💬{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-es-neon px-1 text-[10px] text-es-bg">{unread}</span>}
    </button>
  );

  return (
    <div className="es-panel w-52 max-w-[calc(100vw-6rem)] p-2">
      <div className="mb-1 flex items-center gap-1">
        <button onClick={() => setTab("dunia")} className={`es-chip ${tab === "dunia" ? "!border-es-neon text-es-neon" : ""}`}>🌍 DUNIA</button>
        {team && <button onClick={() => setTab("tim")} className={`es-chip ${tab === "tim" ? "!border-es-neon text-es-neon" : ""}`}>👥 TIM</button>}
        <button onClick={() => setOpen(false)} aria-label="Tutup chat" className="es-chip ml-auto">✕</button>
      </div>
      <div ref={box} className="h-16 space-y-0.5 overflow-y-auto text-xs">
        {list.length === 0 && <p className="text-es-dim">{tab === "tim" ? "💬 Chat tim di sini..." : "💬 Sapa pemain lain di lobi..."}</p>}
        {list.map((m) => <p key={m.id} className="break-words"><b className={m.name === myName ? "text-es-cyan" : "text-es-neon"}>{m.name}:</b> {m.text}</p>)}
      </div>
      <form onSubmit={send} className="mt-1 flex gap-1">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder={tab === "tim" ? "Pesan ke tim..." : "Pesan ke semua..."} className="min-w-0 flex-1 rounded border border-es-line bg-transparent px-2 py-1 text-xs" />
        <button className="rounded bg-es-neon px-2 text-xs font-bold text-es-bg">KIRIM</button>
      </form>
    </div>
  );
}
