import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRole } from "@/hooks/useRole";
import { getOnboardingWorkspace } from "@/lib/onboarding.functions";
import { onboardingWorkspaceKey } from "@/lib/onboarding-workspace-view";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
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

function OnboardingLayout() {
  const { userId } = useRole();
  const load = useServerFn(getOnboardingWorkspace);
  const { data } = useQuery({
    queryKey: onboardingWorkspaceKey(userId),
    queryFn: () => load(),
    enabled: Boolean(userId),
  });
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1" aria-label="Onboarding views">
        {data && data.workspaceMode !== "assigned" && (
          <SubLink to="/onboarding">
            {data.workspaceMode === "portfolio" ? "Director hub" : "Project hub"}
          </SubLink>
        )}
        <SubLink to="/onboarding/my-work">My work</SubLink>
        <SubLink to="/onboarding/utilities">Utilities &amp; Accounts</SubLink>
        <SubLink to="/onboarding/transitions">Transitions</SubLink>
      </nav>
      <Outlet />
    </div>
  );
}

function SubLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{ className: "bg-card text-foreground shadow-card" }}
      inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
      className="rounded-md border border-transparent px-3 py-1.5 text-sm font-medium"
    >
      {children}
    </Link>
  );
}
