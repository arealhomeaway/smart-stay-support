import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireCapability } from "@/components/RequireCapability";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding workspace — Resolve" },
      {
        name: "description",
        content:
          "Track every home from intake to accepted handoff: sectioned workflow tasks, blockers, owner approvals and the readiness gate that starts active operations.",
      },
      { property: "og:title", content: "Onboarding workspace — Resolve" },
      {
        property: "og:description",
        content: "Pre-handoff work, readiness gates and supervisor review for new homes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="onboarding_workspace" title="Onboarding workspace">
      <OnboardingLayout />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">The workspace could not be loaded.</p>,
});

/** Department menu and breadcrumbs come from the shared app shell (ShellNav). */
function OnboardingLayout() {
  return <Outlet />;
}
