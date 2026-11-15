import { useEffect, useRef, useState } from "react";
import { deleteTrack, listTracks, uploadTrack, type Track } from "@/lib/music";

export function MusicPanel({ userId }: { userId: string | undefined }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => listTracks().then(setTracks);
  useEffect(() => { refresh(); }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !userId) return;
    setErr("");
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) { setErr(`${f.name} bukan file musik/video.`); continue; }
      if (f.size > 50 * 1024 * 1024) { setErr(`${f.name} lebih dari 50 MB.`); continue; }
      setBusy(`Mengunggah ${f.name}...`);
      try { await uploadTrack(f, userId); } catch { setErr(`Gagal unggah ${f.name}.`); }
    }
    setBusy("");
    if (input.current) input.current.value = "";
    refresh();
  };

  const remove = async (t: Track) => {
    if (!confirm(`Hapus "${t.title}"?`)) return;
    try { await deleteTrack(t); } catch { setErr("Gagal menghapus."); }
    refresh();
  };

  return (
    <section className="pixel-card mx-auto mt-4 max-w-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-pixel text-xs">🎵 MUSIK GAME ({tracks.length})</p>
        <button disabled={!userId || !!busy} onClick={() => input.current?.click()} className="pixel-btn !py-1 text-xs">+ Upload</button>
        <input ref={input} type="file" accept="audio/*,video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
      {busy && <p className="text-xs text-muted-foreground">{busy}</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
      {tracks.length === 0 && <p className="text-sm text-muted-foreground">Belum ada musik. Upload lagu, nanti diputar saat main.</p>}
      {tracks.map((t, i) => (
        <div key={t.id} className="flex items-center justify-between gap-2 border-t py-2">
          <span className="truncate text-sm">{i + 1}. {t.title}</span>
          <button onClick={() => remove(t)} className="tab-off !w-auto px-2 text-xs">Hapus</button>
        </div>
      ))}
    </section>
  );
}
