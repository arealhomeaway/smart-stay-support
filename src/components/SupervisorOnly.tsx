import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/** Renders children only for admins and managers. */
export function SupervisorOnly({ children }: { children: ReactNode }) {
  const { isSupervisor, isLoading } = useRole();

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!isSupervisor) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-semibold">Supervisor access only</h1>
        <p className="text-sm text-muted-foreground">
          This area is limited to supervisors and leadership. If you need it, ask a manager to
          update your access.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
