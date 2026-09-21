import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/recovery")({
  head: () => ({
    meta: [
      { title: "Guest refunds & credits — Resolve" },
      {
        name: "description",
        content:
          "What each guest is owed after a service failure: impact, evidence, the remedy, whose approval it needs under ARHA policy, and what was actually issued.",
      },
      { property: "og:title", content: "Guest refunds & credits — Resolve" },
      {
        property: "og:description",
        content:
          "ARHA's guest refund and credit queue, with approval authority derived from policy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="claims_work" title="Guest refunds & credits">
      <RecoveryLayout />
    </RequireCapability>
  ),
  errorComponent: () => (
    <p className="text-muted-foreground">Guest refunds & credits could not be loaded.</p>
  ),
});

function RecoveryLayout() {
  const { isSupervisor } = useRole();
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1" aria-label="Recovery views">
        <SubLink to="/recovery">Today</SubLink>
        <SubLink to="/recovery/my-recoveries">Mine</SubLink>
        {isSupervisor ? <SubLink to="/recovery/manager">Manager</SubLink> : null}
      </nav>
      <Outlet />
    </div>
  );
}

function SubLink({ to, children }: { to: string; children: ReactNode }) {
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
