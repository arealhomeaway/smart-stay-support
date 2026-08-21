import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Capability } from "@/lib/permissions";

/**
 * UI mirror of the server-side permission check. The database and every server
 * function enforce the same rule — this only avoids showing a dead-end screen.
 */
export function RequireCapability({
  capability,
  title = "You do not have access to this area",
  children,
}: {
  capability: Capability;
  title?: string;
  children: ReactNode;
}) {
  const { can, isLoading } = useRole();

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!can(capability)) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Ask a Platform Owner or Supervisor if you need this added to your role.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to my work</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
