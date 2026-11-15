import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { AdminEconomy } from "@/components/AdminEconomy";
import { deleteTrack, listTracks, uploadTrack, type MusicCategory, type Track } from "@/lib/music";

export const Route = createFileRoute("/_authenticated/admin-qifil-7391")({
  head: () => ({
    meta: [
      { title: "Panel Admin Musik - QIFIL DAN HAFIL" },
      { name: "description", content: "Upload dan kelola musik lobi dan musik game." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Panel Admin Musik - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Kelola musik lobi dan game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const me = useProfile();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tracks, setTracks] = useState<Record<MusicCategory, Track[]>>({ lobby: [], game: [] });
  const [busy, setBusy] = useState("");

  const reload = async () => {
    const [lobby, game] = await Promise.all([listTracks("lobby"), listTracks("game")]);
    setTracks({ lobby, game });
  };
  useEffect(() => {
    supabase.rpc("claim_first_admin").then(({ data }) => setIsAdmin(!!data));
    reload();
  }, []);

  const upload = async (cat: MusicCategory, files: FileList | null) => {
    if (!files || !me) return;
    setBusy(cat);
    try { for (const f of Array.from(files)) await uploadTrack(f, me.id, cat); }
    catch (e) { alert("Gagal upload: " + (e as Error).message); }
    setBusy(""); reload();
  };
  const remove = async (t: Track) => { if (confirm(`Hapus "${t.title}"?`)) { await deleteTrack(t); reload(); } };
  const preview = async (t: Track) => {
    const { data } = await supabase.storage.from("music").createSignedUrl(t.path, 600);
    if (data) window.open(data.signedUrl, "_blank");
  };

  return (
    <main className="pixel-page">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <h1 className="font-pixel text-sm">🛠 PANEL ADMIN MUSIK</h1>
        <Link to="/" className="tab-off !w-auto px-3">← Lobi</Link>
      </header>
      {isAdmin === null && <p className="mt-6 text-center">Memeriksa akses...</p>}
      {isAdmin === false && <p className="pixel-card mx-auto mt-6 max-w-2xl text-center">Hanya admin yang bisa membuka panel ini.</p>}
      {isAdmin && (["lobby", "game"] as MusicCategory[]).map((cat) => (
        <section key={cat} className="pixel-card mx-auto mt-4 max-w-2xl">
          <p className="mb-2 font-pixel text-xs">{cat === "lobby" ? "🏠 MUSIK LOBI" : "🎮 MUSIK GAME"}</p>
          <label className="pixel-btn inline-block cursor-pointer">
            {busy === cat ? "Mengupload..." : "+ Upload lagu"}
            <input type="file" accept="audio/*" multiple hidden disabled={!!busy} onChange={(e) => { upload(cat, e.target.files); e.target.value = ""; }} />
          </label>
          <ul className="mt-3 space-y-1">
            {tracks[cat].length === 0 && <li className="text-sm text-muted-foreground">Belum ada lagu.</li>}
            {tracks[cat].map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded bg-muted p-2 text-sm">
                <span className="flex-1 truncate">🎵 {t.title}</span>
                <button onClick={() => preview(t)} className="tab-off !w-auto px-2">▶</button>
                <button onClick={() => remove(t)} className="tab-off !w-auto px-2">🗑</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {isAdmin && <AdminEconomy />}
    </main>
  );
}
