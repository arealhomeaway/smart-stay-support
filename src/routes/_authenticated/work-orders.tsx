import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/work-orders")({
  head: () => ({
    meta: [
      { title: "Work orders — Resolve" },
      {
        name: "description",
        content:
          "Maintenance execution at ARHA: emergency mitigation, quotes, owner approval authority, warranty routing, vendor commitments and closure evidence.",
      },
      { property: "og:title", content: "Work orders — Resolve" },
      {
        property: "og:description",
        content:
          "ARHA maintenance work orders with derived authority, warranty routing and closure gates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    // Same capability the navigation uses, so nobody can reach by URL a
    // portal Resolve does not show them.
    <RequireCapability capability="work_orders_internal" title="Work orders">
      <WorkOrdersLayout />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">Work orders could not be loaded.</p>,
});

function WorkOrdersLayout() {
  const { isSupervisor } = useRole();
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1" aria-label="Work order views">
        <SubLink to="/work-orders">Today</SubLink>
        <SubLink to="/work-orders/my-work-orders">Mine</SubLink>
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
