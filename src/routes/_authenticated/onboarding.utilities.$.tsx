import { createFileRoute, redirect } from "@tanstack/react-router";

/** Retired page sub-paths: permanently redirect to the Onboarding home list. */
export const Route = createFileRoute("/_authenticated/onboarding/utilities/$")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding", statusCode: 301, replace: true });
  },
});
