import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Lobby background video: stored in the `events` bucket, row in event_banners titled "[VIDEO]". */
export const LOBBY_VIDEO_TITLE = "[VIDEO]";

async function latestVideo() {
  const { data } = await supabase.from("event_banners").select("id,path").eq("title", LOBBY_VIDEO_TITLE).order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export function LobbyVideoBg() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const v = await latestVideo();
      if (!v) return;
      const { data } = await supabase.storage.from("events").createSignedUrl(v.path, 60 * 60 * 24);
      if (!off && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => { off = true; };
  }, []);
  if (!url) return null;
  return (
    <video src={url} autoPlay muted loop playsInline className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" />
  );
}

export function AdminLobbyVideo() {
  const [cur, setCur] = useState<{ id: string; path: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = () => latestVideo().then(setCur);
  useEffect(() => { load(); }, []);

  const upload = async (f: File) => {
    if (!f.type.startsWith("video/")) return setMsg("File harus video.");
    if (f.size > 50 * 1024 * 1024) return setMsg("Maksimal 50MB.");
    setBusy(true); setMsg("Mengupload...");
    const path = `lobby/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const up = await supabase.storage.from("events").upload(path, f, { contentType: f.type });
    if (up.error) { setBusy(false); return setMsg("Gagal: " + up.error.message); }
    const ins = await supabase.from("event_banners").insert({ path, title: LOBBY_VIDEO_TITLE });
    if (ins.error) { setBusy(false); return setMsg("Gagal: " + ins.error.message); }
    if (cur) { await supabase.storage.from("events").remove([cur.path]); await supabase.from("event_banners").delete().eq("id", cur.id); }
    setBusy(false); setMsg("✔ Video latar lobi diganti."); load();
  };
  const remove = async () => {
    if (!cur) return;
    await supabase.storage.from("events").remove([cur.path]);
    await supabase.from("event_banners").delete().eq("id", cur.id);
    setMsg("Video dihapus."); load();
  };

  return (
    <section className="pixel-card mx-auto mt-4 max-w-2xl">
      <p className="mb-2 font-pixel text-xs">🎬 VIDEO LATAR LOBI</p>
      <p className="mb-2 text-xs">{cur ? "Video aktif: " + cur.path.split("/").pop() : "Belum ada video."}</p>
      <input type="file" accept="video/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} className="text-sm" />
      {cur && <button onClick={remove} className="ml-2 rounded bg-muted px-2 py-1 text-xs">Hapus video</button>}
      {msg && <p className="mt-2 text-xs">{msg}</p>}
    </section>
  );
}
