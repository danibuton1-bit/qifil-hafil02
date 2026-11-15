import { createFileRoute } from "@tanstack/react-router";
import { Race } from "@/components/Race";

export const Route = createFileRoute("/_authenticated/race/$room")({
  validateSearch: (s: Record<string, unknown>): { slot: number; drone: boolean; level: number } => ({
    slot: Math.max(0, Math.min(4, Number(s["slot"]) || 0)),
    drone: s["drone"] === true || s["drone"] === "true",
    level: Math.max(1, Math.min(100, Number(s["level"]) || 1)),
  }),
  head: () => ({
    meta: [
      { title: "Turnamen Balapan - QIFIL DAN HAFIL" },
      { name: "description", content: "Balapan rintangan: ambil kunci dan capai pintu duluan. Ada kamera drone wasit." },
      { property: "og:title", content: "Turnamen Balapan - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Balapan rintangan dengan kamera drone wasit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { room } = Route.useParams();
  const s = Route.useSearch();
  return <Race room={room} slot={s.slot} drone={s.drone} level={s.level} />;
}
