import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Vendor workspace layout: the index holds the tabs, $vendorId is the profile. */
export const Route = createFileRoute("/_authenticated/vendors")({
  component: () => <Outlet />,
});
