import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/Game";

type Role = "qifil" | "hafil";
export const Route = createFileRoute("/_authenticated/play/$room")({
  validateSearch: (s: Record<string, unknown>): { role: Role } => ({ role: s["role"] === "hafil" ? "hafil" : "qifil" }),
  head: () => ({
    meta: [
      { title: "Main - QIFIL DAN HAFIL" },
      { name: "description", content: "Main berdua online QIFIL DAN HAFIL." },
      { property: "og:title", content: "Main - QIFIL DAN HAFIL" },
      { property: "og:description", content: "Main berdua online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Play,
});

function Play() {
  const { room } = Route.useParams();
  const { role } = Route.useSearch();
  return <Game room={room} role={role} />;
}
