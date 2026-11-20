import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/settings";

export type Track = { id: string; title: string; path: string; created_at: string };

const VOL_KEY = "qh-music-volume";

/** Next song in the playlist; wraps back to the first after the last. */
export function nextIndex(i: number, count: number): number {
  return count === 0 ? -1 : (i + 1) % count;
}

export type MusicSync = { id: string; t: number; paused: boolean };

/** Jump to the host's position only when we drift more than 1 second. */
export function needsSeek(mine: number, host: number): boolean {
  return Math.abs(mine - host) > 1;
}

export function clampVolume(v: number): number {
  return Math.min(1, Math.max(0, Math.round(v * 10) / 10));
}

export type MusicCategory = "game" | "lobby";

export async function listTracks(category?: MusicCategory): Promise<Track[]> {
  let q = supabase.from("music_tracks").select("id,title,path,created_at").order("created_at");
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return data ?? [];
}

export async function uploadTrack(file: File, userId: string, category: MusicCategory = "game") {
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const up = await supabase.storage.from("music").upload(path, file, { contentType: file.type || "audio/mpeg" });
  if (up.error) throw up.error;
  const title = file.name.replace(/\.[^.]+$/, "").slice(0, 60);
  const { error } = await supabase.from("music_tracks").insert({ title, path, uploaded_by: userId, category });
  if (error) throw error;
}

export async function deleteTrack(t: Track) {
  await supabase.storage.from("music").remove([t.path]);
  const { error } = await supabase.from("music_tracks").delete().eq("id", t.id);
  if (error) throw error;
}

/** Plays every uploaded song in order, looping the list, with a volume each player sets for themselves. */
export function useGameMusic(category: MusicCategory = "game") {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [idx, setIdx] = useState(0);
  const [volume, setVolumeState] = useState(0.6);
  const [blocked, setBlocked] = useState(false);
  const { music: musicOn } = useSettings();

  useEffect(() => {
    const v = Number(localStorage.getItem(VOL_KEY));
    if (localStorage.getItem(VOL_KEY) !== null && !Number.isNaN(v)) setVolumeState(clampVolume(v));
    listTracks(category).then(setTracks);
    const a = new Audio();
    audio.current = a;
    return () => { a.pause(); a.src = ""; audio.current = null; };
  }, []);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.onended = () => setIdx((i) => nextIndex(i, tracks.length));
    a.onerror = () => { if (tracks.length > 1) setIdx((i) => nextIndex(i, tracks.length)); };
  }, [tracks.length]);

  useEffect(() => {
    const a = audio.current;
    const t = tracks[idx];
    if (!a || !t) return;
    let off = false;
    supabase.storage.from("music").createSignedUrl(t.path, 3600).then(({ data }) => {
      if (off || !data) return;
      a.src = data.signedUrl;
      a.loop = tracks.length === 1;
      a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    });
    return () => { off = true; };
  }, [idx, tracks]);

  // Settings ⚙️ can switch the music off for this player only.
  useEffect(() => {
    if (audio.current) audio.current.muted = !musicOn;
  }, [musicOn, idx, tracks]);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
    localStorage.setItem(VOL_KEY, String(volume));
  }, [volume]);

  // Browsers only allow sound after a tap; retry on the first touch.
  useEffect(() => {
    if (!blocked) return;
    const go = () => audio.current?.play().then(() => setBlocked(false)).catch(() => {});
    window.addEventListener("pointerdown", go, { once: true });
    return () => window.removeEventListener("pointerdown", go);
  }, [blocked]);

  const seekTo = useRef<number | null>(null);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.onloadedmetadata = () => { if (seekTo.current !== null) { a.currentTime = seekTo.current; seekTo.current = null; } };
  }, []);

  return {
    /** What is playing now, for the host to share. */
    snapshot: (): MusicSync | null => {
      const t = tracks[idx]; const a = audio.current;
      return t && a ? { id: t.id, t: a.currentTime, paused: a.paused } : null;
    },
    /** Follow the host: same song, same position. */
    follow: (m: MusicSync) => {
      const a = audio.current; if (!a) return;
      const i = tracks.findIndex((t) => t.id === m.id);
      if (i < 0) { listTracks(category).then(setTracks); return; }
      if (i !== idx) { seekTo.current = m.t; setIdx(i); return; }
      if (needsSeek(a.currentTime, m.t)) a.currentTime = m.t;
      if (a.paused && !m.paused) a.play().catch(() => setBlocked(true));
    },
    title: tracks[idx]?.title ?? "",
    hasMusic: tracks.length > 0,
    volume,
    setVolume: (v: number) => setVolumeState(clampVolume(v)),
    skip: () => setIdx((i) => nextIndex(i, tracks.length)),
  };
}
