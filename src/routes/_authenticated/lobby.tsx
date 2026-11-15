import { createFileRoute, redirect } from "@tanstack/react-router";

// There is only one lobby now: the home screen.
export const Route = createFileRoute("/_authenticated/lobby")({
  beforeLoad: () => { throw redirect({ to: "/", replace: true }); },
});
