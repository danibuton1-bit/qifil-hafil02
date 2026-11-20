import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nextVideo, useSettings } from "@/lib/settings";

/** Lobby background videos: stored in the `events` bucket, rows in event_banners titled "[VIDEO]". */
export const LOBBY_VIDEO_TITLE = "[VIDEO]";
type Vid = { id: string; path: string; created_at: string };

async function listVideos(): Promise<Vid[]> {
  const { data } = await supabase.from("event_banners").select("id,path,created_at").eq("title", LOBBY_VIDEO_TITLE).order("created_at");
  return data ?? [];
}

/** Plays every uploaded lobby video in turn. Sound follows the player's ⚙️ settings and
 *  starts after their first tap, because browsers block autoplay with sound. */
export function LobbyVideoBg() {
  const [vids, setVids] = useState<Vid[]>([]);
  const [idx, setIdx] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const el = useRef<HTMLVideoElement>(null);
  const s = useSettings();

  useEffect(() => { listVideos().then(setVids); }, []);
  useEffect(() => {
    const v = vids[idx];
    if (!v) return;
    let off = false;
    supabase.storage.from("events").createSignedUrl(v.path, 60 * 60 * 24).then(({ data }) => { if (!off && data?.signedUrl) setUrl(data.signedUrl); });
    return () => { off = true; };
  }, [vids, idx]);

  useEffect(() => {
    if (unlocked) return;
    const go = () => setUnlocked(true);
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); window.removeEventListener("keydown", go); };
  }, [unlocked]);

  const wantSound = s.video && unlocked;
  useEffect(() => {
    const v = el.current;
    if (!v) return;
    v.volume = s.videoVol;
    v.muted = !wantSound;
    v.play().catch(() => { v.muted = true; void v.play().catch(() => {}); });
  }, [wantSound, s.videoVol, url]);

  if (!url) return null;
  return (
    <video
      ref={el}
      key={url}
      src={url}
      autoPlay
      muted
      playsInline
      loop={vids.length === 1}
      onEnded={() => setIdx((i) => nextVideo(i, vids.length))}
      onError={() => { if (vids.length > 1) setIdx((i) => nextVideo(i, vids.length)); }}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
    />
  );
}

export function AdminLobbyVideo() {
  const [vids, setVids] = useState<Vid[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = () => listVideos().then(setVids);
  useEffect(() => { load(); }, []);

  const upload = async (files: FileList) => {
    setBusy(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("video/")) { setMsg(`${f.name} bukan video.`); continue; }
      if (f.size > 50 * 1024 * 1024) { setMsg(`${f.name} lebih dari 50MB.`); continue; }
      setMsg(`Mengupload ${f.name}...`);
      const path = `lobby/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const up = await supabase.storage.from("events").upload(path, f, { contentType: f.type });
      if (up.error) { setMsg("Gagal: " + up.error.message); continue; }
      const ins = await supabase.from("event_banners").insert({ path, title: LOBBY_VIDEO_TITLE });
      if (ins.error) { await supabase.storage.from("events").remove([path]); setMsg("Gagal: " + ins.error.message); continue; }
      ok++;
    }
    setBusy(false);
    if (ok) setMsg(`✔ ${ok} video ditambahkan ke playlist lobi.`);
    load();
  };
  const remove = async (v: Vid) => {
    if (!confirm("Hapus video ini dari lobi?")) return;
    await supabase.storage.from("events").remove([v.path]);
    await supabase.from("event_banners").delete().eq("id", v.id);
    setMsg("Video dihapus."); load();
  };
  const preview = async (v: Vid) => {
    const { data } = await supabase.storage.from("events").createSignedUrl(v.path, 600);
    if (data) window.open(data.signedUrl, "_blank");
  };

  return (
    <section className="pixel-card mx-auto mt-4 max-w-2xl">
      <p className="mb-1 font-pixel text-xs">🎬 VIDEO LATAR LOBI ({vids.length})</p>
      <p className="mb-2 text-xs text-muted-foreground">Bisa upload banyak video (maks 50MB per video). Diputar bergantian dengan suara.</p>
      <input type="file" accept="video/*" multiple disabled={busy} onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} className="text-sm" />
      {vids.length === 0 && <p className="mt-2 text-xs">Belum ada video.</p>}
      <ul className="mt-2 space-y-1">
        {vids.map((v, i) => (
          <li key={v.id} className="flex items-center gap-2 rounded bg-muted p-2 text-sm">
            <span className="flex-1 truncate">{i + 1}. {v.path.split("/").pop()?.replace(/^\d+-/, "")}</span>
            <button onClick={() => preview(v)} className="tab-off !w-auto px-2 text-xs">▶</button>
            <button onClick={() => remove(v)} className="tab-off !w-auto px-2 text-xs">🗑</button>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-2 text-xs">{msg}</p>}
    </section>
  );
}
