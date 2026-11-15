import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/hotspot")({
  head: () => ({
    meta: [
      { title: "Mabar Offline (Hotspot) - QIFIL DAN HAFIL" },
      { name: "description", content: "Mode mabar lewat hotspot HP tanpa kuota." },
      { property: "og:title", content: "Mabar Offline - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Mode mabar lewat hotspot HP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Hotspot,
});

function Hotspot() {
  return (
    <main className="pixel-page">
      <section className="pixel-card mx-auto max-w-md text-center">
        <p className="font-pixel text-sm">MABAR OFFLINE</p>
        <p className="mt-3 text-sm">🚧 Mode Hotspot sedang disiapkan.</p>
        <p className="mt-2 text-xs text-muted-foreground">Sementara ini pakai MAIN SENDIRI (tanpa internet) atau ONLINE.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Link to="/solo" className="pixel-btn">MAIN SENDIRI ▶</Link>
          <Link to="/" className="tab-off">Kembali</Link>
        </div>
      </section>
    </main>
  );
}
