import { createFileRoute } from "@tanstack/react-router";
import { BayOne } from "@/components/BayOne";

export const Route = createFileRoute("/_authenticated/bayone/$room")({
  validateSearch: (s: Record<string, unknown>): { slot: number } => ({ slot: Math.max(0, Math.min(4, Number(s["slot"]) || 0)) }),
  head: () => ({
    meta: [
      { title: "Bay One Mabar - QIFIL DAN HAFIL" },
      { name: "description", content: "Saling tembak online sampai 5 pemain. Pertama 30 poin menang." },
      { property: "og:title", content: "Bay One Mabar - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Saling tembak online sampai 5 pemain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { room } = Route.useParams();
  const { slot } = Route.useSearch();
  return <BayOne room={room} slot={slot} />;
}
