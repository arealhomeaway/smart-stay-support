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
  return (
    <RequireAnyCapability capabilities={[capability]} title={title}>
      {children}
    </RequireAnyCapability>
  );
}

/** Same as RequireCapability, opened by any one of the listed capabilities. */
export function RequireAnyCapability({
  capabilities,
  title = "You do not have access to this area",
  children,
}: {
  capabilities: Capability[];
  title?: string;
  children: ReactNode;
}) {
  const { can, isLoading, landing } = useRole();

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!capabilities.some((c) => can(c))) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Ask an Admin or Supervisor if you need this added to your role.
        </p>
        <Button asChild variant="outline">
          <Link to={landing as never}>Back to my work</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
