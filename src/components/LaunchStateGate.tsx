import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureFlags } from "@/lib/feature-flags";

/**
 * Launch-state gate for workstreams that exist in the codebase but are not part
 * of the current Operations beta. Nothing is deleted: the flag simply keeps the
 * unfinished surface out of an operator's way. Backend records, RLS and jobs are
 * untouched, so turning the flag on restores the page exactly as it is today.
 */
export function LaunchStateGate({
  flag,
  title,
  description,
  children,
}: {
  flag: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { enabled, isLoading } = useFeatureFlags();

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (enabled(flag)) return <>{children}</>;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Nothing has been removed. An administrator can enable this from Integrations → Feature flags
        when the workstream is ready.
      </CardContent>
    </Card>
  );
}
