import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RequireAnyCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/work-orders")({
  head: () => ({
    meta: [
      { title: "Work Orders: Resolve" },
      {
        name: "description",
        content:
          "Maintenance execution at ARHA: emergency mitigation, quotes, owner approval authority, warranty routing, vendor commitments and closure evidence.",
      },
      { property: "og:title", content: "Work Orders: Resolve" },
      {
        property: "og:description",
        content:
          "ARHA maintenance Work Orders with derived authority, warranty routing and closure gates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    // Same rule the navigation uses, so nobody can reach by URL a portal
    // Resolve does not show them. Read-only viewers hold work_orders_view.
    <RequireAnyCapability capabilities={["work_orders_internal", "work_orders_view"]} title="Work Orders">
      <WorkOrdersLayout />
    </RequireAnyCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">Work Orders could not be loaded.</p>,
});

function WorkOrdersLayout() {
  const { isSupervisor, can } = useRole();
  const works = can("work_orders_internal");
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1" aria-label="Work order views">
        <SubLink to="/work-orders">Today</SubLink>
        {works ? <SubLink to="/work-orders/my-work-orders">Mine</SubLink> : null}
        <SubLink to="/work-orders/calendar">Calendar</SubLink>
        {isSupervisor ? <SubLink to="/work-orders/manager">Manager</SubLink> : null}
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
