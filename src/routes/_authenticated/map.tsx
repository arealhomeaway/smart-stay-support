import { createFileRoute, Navigate } from "@tanstack/react-router";
import { parseOperationsSearch } from "@/lib/operations-view-state";

/** Existing /map links lead to the shared Operations population and URL state. */
export const Route = createFileRoute("/_authenticated/map")({
  validateSearch: parseOperationsSearch,
  component: MapAlias,
});

function MapAlias() {
  const search = Route.useSearch();
  return <Navigate to="/team-queue" search={{ ...search, view: "map" }} replace />;
}
