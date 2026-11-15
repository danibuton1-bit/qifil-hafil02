import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/Game";

export const Route = createFileRoute("/solo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Main Sendiri - QIFIL DAN HAFIL" },
      { name: "description", content: "Main solo bersama BOT yang membantu dorong balok dan injak tombol." },
      { property: "og:title", content: "Main Sendiri - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Main solo bersama BOT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Game room="SOLO" role="qifil" solo />,
});
