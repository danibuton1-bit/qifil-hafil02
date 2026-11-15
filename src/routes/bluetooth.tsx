import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/bluetooth")({
  head: () => ({
    meta: [
      { title: "Mabar Bluetooth - QIFIL DAN HAFIL" },
      { name: "description", content: "Cari HP teman terdekat lewat Bluetooth." },
      { property: "og:title", content: "Mabar Bluetooth - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Mabar 2 pemain lewat Bluetooth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Bluetooth,
});

function Bluetooth() {
  const [msg, setMsg] = useState("");
  const scan = async () => {
    const bt = (navigator as unknown as { bluetooth?: { requestDevice: (o: object) => Promise<unknown> } }).bluetooth;
    if (!bt) return setMsg("none");
    try { await bt.requestDevice({ acceptAllDevices: true }); } catch { /* cancelled */ }
    // Browsers can only talk to Bluetooth gadgets, never to another phone.
    setMsg("none");
  };
  return (
    <main className="pixel-page">
      <section className="pixel-card mx-auto max-w-md text-center">
        <p className="font-pixel text-sm">MABAR BLUETOOTH</p>
        <p className="mt-2 text-xs text-muted-foreground">Khusus 2 pemain</p>
        <button onClick={scan} className="pixel-btn mt-4 w-full">SCAN BLUETOOTH</button>
        {msg && (
          <div className="mt-4">
            <p className="text-sm text-destructive">Bluetooth tidak didukung di browser ini, pakai Mode Hotspot saja</p>
            <Link to="/hotspot" className="pixel-btn mt-3 w-full">Pindah ke Hotspot</Link>
          </div>
        )}
        <Link to="/" className="tab-off mt-3">Kembali</Link>
      </section>
    </main>
  );
}
