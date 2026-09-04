import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Tenant leads — Resolve" },
      {
        name: "description",
        content:
          "Direct booking opportunities from first enquiry to signed stay: follow-up timing, property matches, quotes and conversion, all in one queue.",
      },
      { property: "og:title", content: "Tenant leads — Resolve" },
      {
        property: "og:description",
        content:
          "ARHA's direct and non-OTA booking pipeline, with follow-up timing Resolve remembers for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="matters_assigned" title="Tenant leads">
      <LeadsLayout />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">Leads could not be loaded.</p>,
});

function LeadsLayout() {
  const { isSupervisor } = useRole();
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1" aria-label="Lead views">
        <SubLink to="/leads">Today</SubLink>
        <SubLink to="/leads/my-leads">My leads</SubLink>
        <SubLink to="/leads/pipeline">Pipeline</SubLink>
        {isSupervisor ? <SubLink to="/leads/manager">Manager</SubLink> : null}
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
