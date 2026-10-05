import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/claims")({
  head: () => ({
    meta: [
      { title: "Damage claims and recovery — Resolve" },
      {
        name: "description",
        content:
          "Track every recoverable incident from evidence and cost through submission, platform decision and reimbursement, with deadlines Resolve keeps in view.",
      },
      { property: "og:title", content: "Damage claims and recovery — Resolve" },
      {
        property: "og:description",
        content:
          "ARHA's recovery pipeline: evidence, costs, submissions and reimbursements in one queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="claims_work" title="Claims">
      <ClaimsLayout />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">Claims could not be loaded.</p>,
});

function ClaimsLayout() {
  const { isSupervisor } = useRole();
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1" aria-label="Claim views">
        <SubLink to="/claims">Today</SubLink>
        <SubLink to="/claims/my-claims">My claims</SubLink>
        {isSupervisor ? <SubLink to="/claims/manager">Manager</SubLink> : null}
        <SubLink to="/claims/closed">Closed</SubLink>
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
