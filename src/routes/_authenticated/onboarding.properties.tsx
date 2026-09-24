import { createFileRoute, redirect } from "@tanstack/react-router";

// Static destination for the Onboarding Properties directory. The directory
// itself is the Onboarding page's "all" lens; this route claims the literal
// "properties" segment so it can never be read as a property id.
export const Route = createFileRoute("/_authenticated/onboarding/properties")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding", search: { lens: "all" } as never, replace: true });
  },
});
