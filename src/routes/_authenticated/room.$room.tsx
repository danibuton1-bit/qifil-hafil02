import { createFileRoute, redirect } from "@tanstack/react-router";

// Old team room: the party now lives inside the single lobby on the home screen.
export const Route = createFileRoute("/_authenticated/room/$room")({
  beforeLoad: () => { throw redirect({ to: "/", replace: true }); },
});
