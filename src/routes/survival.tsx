import { createFileRoute } from "@tanstack/react-router";
import { Survival } from "@/components/Survival";

export const Route = createFileRoute("/survival")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mode Survival 10 Level - QIFIL DAN HAFIL" },
      { name: "description", content: "Bertahan hidup di 10 level ala Squid Game: dikejar hantu, rebut kunci, tarik tambang, jembatan kaca dan lainnya." },
      { property: "og:title", content: "Mode Survival - QIFIL DAN HAFIL" },
      { property: "og:description", content: "10 level bertahan hidup, sendiri-sendiri tanpa tim." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Survival,
});
