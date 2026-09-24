import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Capability } from "@/lib/permissions";

/**
 * Renders children only for people who hold a specific capability.
 *
 * Screens that read across every homeowner at once use this rather than a
 * blanket role check, so access follows one named permission the database
 * enforces too.
 */
export function CapabilityGate({
  capability,
  title = "You do not have access to this area",
  children,
}: {
  capability: Capability;
  title?: string;
  children: ReactNode;
}) {
  const { can, isLoading, landing } = useRole();

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!can(capability)) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          This view is limited to leadership. If you need it, ask an administrator to update your
          access.
        </p>
        <Button asChild variant="outline">
          <Link to={landing as never}>Back to my work</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
