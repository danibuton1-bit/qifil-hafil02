import { createFileRoute } from "@tanstack/react-router";
import { BayOne } from "@/components/BayOne";

export const Route = createFileRoute("/bayone-solo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bay One vs BOT - QIFIL DAN HAFIL" },
      { name: "description", content: "Latihan saling tembak melawan 4 BOT, tanpa internet." },
      { property: "og:title", content: "Bay One vs BOT - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Latihan melawan 4 BOT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <BayOne room="SOLO" solo />,
});
