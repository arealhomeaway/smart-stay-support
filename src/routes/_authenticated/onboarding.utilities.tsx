import { createFileRoute, redirect } from "@tanstack/react-router";

/** Retired page: permanently redirects (with any sub-path or query) to the Onboarding home list. */
export const Route = createFileRoute("/_authenticated/onboarding/utilities")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding", statusCode: 301, replace: true });
  },
});
