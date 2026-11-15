import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { Character } from "@/components/Character";
import { RARITY, SPIN_COST, canSpin, type LuckySkin, type Rarity } from "@/lib/economy";

type Colors = { body: string; hat: string };
const read = (): Colors | null => { try { return JSON.parse(localStorage.getItem("luckySkin") || "null"); } catch { return null; } };

/** Currently equipped Lucky Royale skin colors (null = normal Vault color). */
export function useLuckySkin() {
  const [c, setC] = useState<Colors | null>(null);
  useEffect(() => {
    const on = () => setC(read());
    on();
    window.addEventListener("lucky-skin", on);
    return () => window.removeEventListener("lucky-skin", on);
  }, []);
  return c;
}
export const equip = (s: Colors | null) => {
  if (s) localStorage.setItem("luckySkin", JSON.stringify({ body: s.body, hat: s.hat })); else localStorage.removeItem("luckySkin");
  window.dispatchEvent(new Event("lucky-skin"));
};

/** Lucky Royale skins this player owns; reloads whenever a spin wins a new one. */
export function useOwnedSkins(enabled = true) {
  const me = useProfile();
  const [skins, setSkins] = useState<LuckySkin[]>([]);
  useEffect(() => {
    if (!me || !enabled) return;
    const load = async () => {
      const { data } = await supabase.from("user_skins").select("created_at, lucky_skins(*)").eq("user_id", me.id).order("created_at");
      setSkins((data ?? []).map((r) => r.lucky_skins as unknown as LuckySkin).filter(Boolean));
    };
    load();
    window.addEventListener("skins-changed", load);
    return () => window.removeEventListener("skins-changed", load);
  }, [me, enabled]);
  return skins;
}

export function LuckyRoyale() {
  const me = useProfile();
  const [open, setOpen] = useState(false);
  const [dia, setDia] = useState<number | null>(null);
  const [pool, setPool] = useState<LuckySkin[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [idx, setIdx] = useState(0);
  const [win, setWin] = useState<(LuckySkin & { duplicate: boolean }) | null>(null);

  const load = async () => {
    if (!me) return;
    const [w, p, o] = await Promise.all([
      supabase.from("wallets").select("diamonds").eq("user_id", me.id).maybeSingle(),
      supabase.from("lucky_skins").select("*").eq("active", true).order("created_at"),
      supabase.from("user_skins").select("skin_id").eq("user_id", me.id),
    ]);
    setDia(w.data?.diamonds ?? 200);
    setPool((p.data ?? []) as LuckySkin[]);
    setOwned((o.data ?? []).map((r) => r.skin_id));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [me?.id]);
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel(`wallet:${me.id}`)
      .on("broadcast", { event: "diamonds" }, ({ payload }) => { if (typeof payload?.diamonds === "number") setDia(payload.diamonds); })
      .subscribe();
    const poll = setInterval(async () => {
      const { data } = await supabase.from("wallets").select("diamonds").eq("user_id", me.id).maybeSingle();
      if (data) setDia(data.diamonds);
    }, 10000);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { supabase.removeChannel(ch); clearInterval(poll); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);
  useEffect(() => { if (open) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const spin = async () => {
    if (rolling || dia === null || !canSpin(dia) || !pool.length) return;
    setRolling(true); setWin(null);
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 90);
    const [{ data, error }] = await Promise.all([supabase.rpc("spin_lucky"), new Promise((r) => setTimeout(r, 2200))]);
    clearInterval(t);
    setRolling(false);
    if (error) return alert(error.message);
    const r = data as unknown as LuckySkin & { duplicate: boolean; diamonds: number };
    setIdx(Math.max(0, pool.findIndex((s) => s.id === r.id)));
    setWin(r); setDia(r.diamonds);
    setOwned((o) => (o.includes(r.id) ? o : [...o, r.id]));
    window.dispatchEvent(new Event("skins-changed"));
  };

  const shown = pool[idx];
  const mine = pool.filter((s) => owned.includes(s.id));

  return (
    <>
      <span className="es-chip">💎 {dia ?? "…"}</span>
      <button onClick={() => setOpen(true)} className="es-chip">🎰 LUCKY ROYALE</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-es-bg/90 p-4" onClick={() => !rolling && setOpen(false)}>
          <div className="es-panel max-h-full w-full max-w-lg overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm tracking-widest text-es-neon">🎰 LUCKY ROYALE</p>
              <span className="font-display text-sm">💎 {dia}</span>
            </div>
            {pool.length === 0 ? <p className="mt-4 text-center text-sm text-es-dim">Belum ada hadiah skin.</p> : (
              <div className="mt-3 flex flex-col items-center">
                <div className={`flex h-40 w-40 flex-col items-center justify-center rounded-xl border-4 ${rolling ? "animate-pulse" : ""}`}
                  style={{ borderColor: shown ? RARITY[(shown.rarity as Rarity)]?.color : undefined }}>
                  {shown && <Character skin="pink" colors={shown} size={70} />}
                  {shown && <span className="mt-1 text-xs font-bold">{shown.name}</span>}
                </div>
                {win && !rolling && (
                  <p className="mt-2 text-center font-display text-xs" style={{ color: RARITY[win.rarity as Rarity]?.color }}>
                    🎉 Dapat {win.name} ({RARITY[win.rarity as Rarity]?.label}){win.duplicate ? " · sudah punya" : ""}
                  </p>
                )}
                <button onClick={spin} disabled={rolling || dia === null || !canSpin(dia)} className="mt-3 rounded bg-es-neon px-5 py-2 font-display text-sm text-es-bg disabled:opacity-40">
                  {rolling ? "MEMUTAR..." : `SPIN · 💎 ${SPIN_COST}`}
                </button>
                {dia !== null && !canSpin(dia) && <p className="mt-1 text-xs text-es-dim">Diamond tidak cukup. Minta top up ke admin (ID kamu {me?.player_id}).</p>}
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {pool.map((s) => (
                    <span key={s.id} className="flex items-center gap-1 rounded border px-1 text-[10px]" style={{ borderColor: RARITY[s.rarity as Rarity]?.color }}>
                      <span className="inline-block h-3 w-3 rounded" style={{ background: s.body }} />{s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 font-display text-xs tracking-widest text-es-cyan">👕 SKIN SAYA</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <button onClick={() => equip(null)} className="es-chip">Warna biasa</button>
              {mine.length === 0 && <span className="text-xs text-es-dim">Belum punya skin.</span>}
              {mine.map((s) => <button key={s.id} onClick={() => equip(s)} className="es-chip" style={{ borderColor: s.body }}>PAKAI {s.name}</button>)}
            </div>
            <button onClick={() => setOpen(false)} disabled={rolling} className="es-chip mt-4">TUTUP</button>
          </div>
        </div>
      )}
    </>
  );
}
