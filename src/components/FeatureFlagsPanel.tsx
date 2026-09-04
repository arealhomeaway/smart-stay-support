import { useState } from "react";
import { toast } from "sonner";
import { useFeatureFlags } from "@/lib/feature-flags";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Safe controls for workflows that are deliberately paused for launch.
 * Turning one on only unlocks the in-app surface — the scheduled jobs behind
 * email intake and quarterly inspections stay paused until explicitly resumed.
 */
export function FeatureFlagsPanel() {
  const { flags, isLoading, setEnabled } = useFeatureFlags();
  const { isAdmin, readOnly } = useRole();
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow controls</CardTitle>
        <CardDescription>
          Everything off is off on purpose. Nothing here sends a message or runs a job on its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map((f) => (
          <div
            key={f.key}
            className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm font-medium">{f.label}</p>
              {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
            </div>
            <Switch
              checked={f.enabled}
              disabled={!isAdmin || readOnly || busy === f.key}
              onCheckedChange={async (v) => {
                setBusy(f.key);
                try {
                  await setEnabled(f.key, v);
                  toast.success(`${f.label} ${v ? "enabled" : "disabled"}.`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not change that.");
                } finally {
                  setBusy(null);
                }
              }}
            />
          </div>
        ))}
        {flags.length === 0 && (
          <p className="text-sm text-muted-foreground">No controls configured.</p>
        )}
      </CardContent>
    </Card>
  );
}
