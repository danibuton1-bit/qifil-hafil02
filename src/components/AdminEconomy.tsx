import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RARITY, validGift, type LuckySkin, type Rarity } from "@/lib/economy";

type Player = { id: string; username: string; player_id: string; diamonds: number };
const EMPTY = { name: "", body: "#FF8FAB", hat: "#E94F86", rarity: "common" };

export function AdminEconomy() {
  const [skins, setSkins] = useState<LuckySkin[]>([]);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [players, setPlayers] = useState<Player[]>([]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [amount, setAmount] = useState("100");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [s, p, w] = await Promise.all([
      supabase.from("lucky_skins").select("*").order("created_at"),
      supabase.from("profiles").select("id, username, player_id").order("created_at", { ascending: false }).limit(500),
      supabase.from("wallets").select("user_id, diamonds"),
    ]);
    setSkins((s.data ?? []) as LuckySkin[]);
    const bal = new Map((w.data ?? []).map((r) => [r.user_id, r.diamonds]));
    setPlayers((p.data ?? []).map((r) => ({ ...r, diamonds: bal.get(r.id) ?? 0 })));
  };
  useEffect(() => { load(); }, []);

  const saveSkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const row = { name: form.name.trim(), body: form.body, hat: form.hat, rarity: form.rarity };
    const { error } = form.id ? await supabase.from("lucky_skins").update(row).eq("id", form.id) : await supabase.from("lucky_skins").insert(row);
    if (error) return alert(error.message);
    setForm(EMPTY); load();
  };
  const toggle = async (s: LuckySkin) => { await supabase.from("lucky_skins").update({ active: !s.active }).eq("id", s.id); load(); };
  const del = async (s: LuckySkin) => { if (confirm(`Hapus skin "${s.name}"?`)) { await supabase.from("lucky_skins").delete().eq("id", s.id); load(); } };

  const give = async (kind: string) => {
    const n = Number(amount);
    if (!pick) return setMsg("Pilih ID pemain dulu.");
    if (!validGift(n)) return setMsg("Jumlah diamond tidak valid.");
    const { data, error } = await supabase.rpc("admin_give_diamonds", { _player_id: pick, _amount: n });
    if (error) return setMsg("Gagal: " + error.message);
    const r = data as unknown as { username: string; diamonds: number };
    setMsg(`✅ ${kind} 💎${n} ke ${r.username} (ID ${pick}). Saldo sekarang 💎${r.diamonds}.`);
    load();
  };

  const list = players.filter((p) => !q || p.player_id.includes(q) || p.username.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <section className="pixel-card mx-auto mt-4 max-w-2xl">
        <p className="mb-2 font-pixel text-xs">💎 GIFT / TOP UP DIAMOND</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari ID atau nama pemain..." className="w-full rounded border bg-transparent px-2 py-1 text-sm" />
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {list.map((p) => (
            <li key={p.id}>
              <button onClick={() => setPick(p.player_id)} className={`flex w-full justify-between rounded p-2 text-left text-sm ${pick === p.player_id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <span>{p.username} · ID {p.player_id}</span><span>💎 {p.diamonds}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm">ID: <b>{pick || "-"}</b></span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 rounded border bg-transparent px-2 py-1 text-sm" />
          <button onClick={() => give("Gift")} className="pixel-btn">🎁 GIFT</button>
          <button onClick={() => give("Top up")} className="pixel-btn">💳 TOP UP</button>
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </section>

      <section className="pixel-card mx-auto mt-4 max-w-2xl">
        <p className="mb-2 font-pixel text-xs">🎰 SKIN LUCKY ROYALE</p>
        <form onSubmit={saveSkin} className="flex flex-wrap items-center gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama skin" maxLength={30} className="flex-1 rounded border bg-transparent px-2 py-1 text-sm" />
          <label className="text-xs">Badan <input type="color" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          <label className="text-xs">Topi <input type="color" value={form.hat} onChange={(e) => setForm({ ...form, hat: e.target.value })} /></label>
          <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })} className="rounded border bg-background px-1 py-1 text-sm">
            {(Object.keys(RARITY) as Rarity[]).map((r) => <option key={r} value={r}>{RARITY[r].label}</option>)}
          </select>
          <button className="pixel-btn">{form.id ? "SIMPAN" : "+ TAMBAH"}</button>
          {form.id && <button type="button" onClick={() => setForm(EMPTY)} className="tab-off !w-auto px-2">Batal</button>}
        </form>
        <ul className="mt-3 space-y-1">
          {skins.length === 0 && <li className="text-sm text-muted-foreground">Belum ada skin.</li>}
          {skins.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 rounded bg-muted p-2 text-sm ${s.active ? "" : "opacity-50"}`}>
              <span className="inline-block h-5 w-5 rounded" style={{ background: s.body, borderTop: `5px solid ${s.hat}` }} />
              <span className="flex-1 truncate">{s.name} · <span style={{ color: RARITY[s.rarity as Rarity]?.color }}>{RARITY[s.rarity as Rarity]?.label}</span></span>
              <button onClick={() => setForm({ id: s.id, name: s.name, body: s.body, hat: s.hat, rarity: s.rarity })} className="tab-off !w-auto px-2">✏️</button>
              <button onClick={() => toggle(s)} className="tab-off !w-auto px-2">{s.active ? "⏸" : "▶"}</button>
              <button onClick={() => del(s)} className="tab-off !w-auto px-2">🗑</button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
