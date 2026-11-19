import { sfx } from "@/lib/sfx";
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
  const [idx, setIdx] = useState(-1);
  const [wins, setWins] = useState<(LuckySkin & { duplicate: boolean })[] | null>(null);

  const order: Rarity[] = ["legendary", "epic", "rare", "common"];
  const sorted = [...pool].sort((a, b) => order.indexOf(a.rarity as Rarity) - order.indexOf(b.rarity as Rarity));
  const grand = sorted[0];

  /** Free Fire style: highlight runs around the prize grid, slows down and stops on the prize. */
  const runLight = (target: number) => new Promise<void>((done) => {
    const n = sorted.length; const steps = n * 3 + ((target - (idx < 0 ? 0 : idx) + n) % n);
    let i = 0, cur = idx < 0 ? 0 : idx;
    const tick = () => {
      cur = (cur + 1) % n; setIdx(cur); i++; sfx.tap();
      if (i >= steps) return done();
      setTimeout(tick, 50 + Math.pow(i / steps, 3) * 320);
    };
    tick();
  });

  const spin = async (times: 1 | 10) => {
    if (rolling || dia === null || !sorted.length || dia < SPIN_COST * times) return;
    setRolling(true); setWins(null);
    const got: (LuckySkin & { duplicate: boolean })[] = [];
    let last: (LuckySkin & { duplicate: boolean; diamonds: number }) | null = null;
    for (let k = 0; k < times; k++) {
      const { data, error } = await supabase.rpc("spin_lucky");
      if (error) { if (!got.length) { setRolling(false); return alert(error.message); } break; }
      last = data as unknown as LuckySkin & { duplicate: boolean; diamonds: number };
      got.push(last);
    }
    if (last) await runLight(Math.max(0, sorted.findIndex((s) => s.id === last!.id)));
    setRolling(false);
    if (!last) return;
    sfx.win(); setDia(last.diamonds); setWins(got);
    setOwned((o) => [...new Set([...o, ...got.map((g) => g.id)])]);
    window.dispatchEvent(new Event("skins-changed"));
  };

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
            {!grand ? <p className="mt-4 text-center text-sm text-es-dim">Belum ada hadiah skin.</p> : (
              <div className="mt-3 flex gap-3">
                <div className="lr-grand flex w-2/5 shrink-0 flex-col items-center justify-center rounded-lg border-2 p-2" style={{ borderColor: RARITY[grand.rarity as Rarity]?.color }}>
                  <span className="font-display text-[9px] tracking-widest text-es-neon">★ HADIAH UTAMA</span>
                  <Character skin="pink" colors={grand} size={64} />
                  <span className="text-center text-xs font-bold">{grand.name}</span>
                  <span className="text-[10px]" style={{ color: RARITY[grand.rarity as Rarity]?.color }}>{RARITY[grand.rarity as Rarity]?.label}</span>
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-4 gap-1.5">
                    {sorted.map((s, i) => (
                      <div key={s.id} className={`lr-cell ${idx === i ? "lr-cell-on" : ""}`} style={{ borderColor: idx === i ? undefined : RARITY[s.rarity as Rarity]?.color }}>
                        <Character skin="pink" colors={s} size={22} />
                        <span className="w-full truncate text-center text-[8px]">{s.name}</span>
                        {owned.includes(s.id) && <span className="absolute right-0.5 top-0 text-[8px] text-es-cyan">✔</span>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => spin(1)} disabled={rolling || dia === null || dia < SPIN_COST} className="flex-1 rounded bg-es-cyan px-2 py-2 font-display text-xs text-es-bg disabled:opacity-40">
                      {rolling ? "..." : <>1x · 💎 {SPIN_COST}</>}
                    </button>
                    <button onClick={() => spin(10)} disabled={rolling || dia === null || dia < SPIN_COST * 10} className="flex-1 rounded bg-es-neon px-2 py-2 font-display text-xs text-es-bg disabled:opacity-40">
                      {rolling ? "..." : <>10x · 💎 {SPIN_COST * 10}</>}
                    </button>
                  </div>
                  {dia !== null && !canSpin(dia) && <p className="mt-1 text-xs text-es-dim">Diamond tidak cukup. Minta top up ke admin (ID kamu {me?.player_id}).</p>}
                </div>
              </div>
            )}
            {wins && !rolling && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-es-bg/80 p-4" onClick={() => setWins(null)}>
                <div className="es-panel w-full max-w-sm p-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <p className="font-display text-sm tracking-widest text-es-neon">🎉 SELAMAT!</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {wins.map((w, k) => (
                      <div key={k} className="flex w-16 flex-col items-center rounded border-2 p-1" style={{ borderColor: RARITY[w.rarity as Rarity]?.color }}>
                        <Character skin="pink" colors={w} size={wins.length > 1 ? 26 : 60} />
                        <span className="w-full truncate text-[9px] font-bold">{w.name}</span>
                        {w.duplicate && <span className="text-[8px] text-es-dim">sudah punya</span>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-center gap-2">
                    {wins.length === 1 && <button onClick={() => { equip(wins[0] ?? null); setWins(null); }} className="es-chip">PAKAI</button>}
                    <button onClick={() => setWins(null)} className="es-chip">OKE</button>
                  </div>
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
