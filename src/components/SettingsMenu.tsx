import { useState } from "react";
import { saveSettings, useSettings, type AudioSettings } from "@/lib/settings";

/** ⚙️ top-right button: each player's own sound switches plus the exit/logout button. */
export function SettingsMenu({ exitLabel, onExit, className = "es-chip" }: { exitLabel: string; onExit: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const s = useSettings();
  const row = (k: keyof Pick<AudioSettings, "video" | "music" | "sfx">, label: string) => (
    <button
      type="button"
      onClick={() => saveSettings({ [k]: !s[k] })}
      className="flex w-full items-center justify-between rounded border border-es-cyan/30 px-3 py-2 text-sm text-es-text"
      aria-pressed={s[k]}
    >
      <span>{label}</span>
      <span className={`font-display text-xs ${s[k] ? "text-es-cyan" : "text-es-dim"}`}>{s[k] ? "ON" : "OFF"}</span>
    </button>
  );
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={className} aria-label="Pengaturan">⚙️</button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-end bg-es-bg/60 p-2" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="es-panel mt-12 w-[min(92vw,320px)] space-y-2 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm tracking-widest text-es-neon">⚙️ PENGATURAN</p>
              <button type="button" onClick={() => setOpen(false)} className="es-chip" aria-label="Tutup">✕</button>
            </div>
            {row("video", "🎬 Suara video lobi")}
            <label className="flex items-center gap-2 px-1 text-xs text-es-dim">
              Volume video
              <input type="range" min={0} max={1} step={0.1} value={s.videoVol} disabled={!s.video} onChange={(e) => saveSettings({ videoVol: Number(e.target.value) })} className="flex-1" />
              <span className="w-8 text-right">{Math.round(s.videoVol * 100)}%</span>
            </label>
            {row("music", "🎵 Musik")}
            {row("sfx", "🔊 Efek suara")}
            <button type="button" onClick={() => { setOpen(false); onExit(); }} className="es-start mt-2 w-full py-2 text-sm">🚪 {exitLabel}</button>
          </div>
        </div>
      )}
    </>
  );
}
