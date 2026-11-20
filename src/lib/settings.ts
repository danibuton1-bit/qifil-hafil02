import { useEffect, useState } from "react";

/** Each player's own sound settings, saved on their phone. */
export type AudioSettings = { video: boolean; videoVol: number; music: boolean; sfx: boolean };
export const DEFAULT_SETTINGS: AudioSettings = { video: true, videoVol: 0.6, music: true, sfx: true };
const KEY = "qh-settings";
const EVT = "qh-settings";

const vol = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 10) / 10)) : d);

/** Sanitize whatever was saved (old versions, hand-edited storage). */
export function cleanSettings(raw: unknown): AudioSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const b = (k: keyof AudioSettings) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean));
  return { video: b("video"), videoVol: vol(r["videoVol"], DEFAULT_SETTINGS.videoVol), music: b("music"), sfx: b("sfx") };
}

export function readSettings(): AudioSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try { return cleanSettings(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(patch: Partial<AudioSettings>) {
  const next = cleanSettings({ ...readSettings(), ...patch });
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
  return next;
}

export function onSettings(fn: (s: AudioSettings) => void) {
  const h = () => fn(readSettings());
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
}

export function useSettings(): AudioSettings {
  const [s, setS] = useState<AudioSettings>(DEFAULT_SETTINGS);
  useEffect(() => { setS(readSettings()); return onSettings(setS); }, []);
  return s;
}

/** Next video in the lobby playlist; wraps around. */
export const nextVideo = (i: number, count: number) => (count === 0 ? -1 : (i + 1) % count);
