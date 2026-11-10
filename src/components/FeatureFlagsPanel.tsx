import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { setEmailIntake } from "@/lib/mailbox.functions";
import { ONE_SWITCH_NOTE, OUT_OF_STEP_LINE } from "@/lib/email-intake";
import { useFeatureFlags } from "@/lib/feature-flags";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Safe controls for workflows that are deliberately paused for launch.
 * Turning one on only unlocks the in-app surface. The one exception is email
 * intake (register E1 (e)): its switch starts and stops its timed check in the
 * same database step. The quarterly inspection job stays paused until resumed.
 */
export function FeatureFlagsPanel() {
  const { flags, isLoading, setEnabled } = useFeatureFlags();
  const { isAdmin, readOnly } = useRole();
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  const setIntake = useServerFn(setEmailIntake);

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
              {f.key === "email_intake" ? (
                <p className="text-xs font-medium text-foreground">{ONE_SWITCH_NOTE}</p>
              ) : null}
            </div>
            <Switch
              checked={f.enabled}
              disabled={!isAdmin || readOnly || busy === f.key}
              onCheckedChange={async (v) => {
                setBusy(f.key);
                try {
                  if (f.key === "email_intake") {
                    // The one path: turning it on moves the start line and starts the
                    // timed check in the same step; off stops both.
                    const r = await setIntake({ data: { enabled: v } });
                    await qc.invalidateQueries({ queryKey: ["feature-flags"] });
                    await qc.invalidateQueries({ queryKey: ["mailbox-status"] });
                    // Say plainly if the timed check did not follow the switch.
                    if (r?.timed_check !== v) toast.error(OUT_OF_STEP_LINE);
                    else toast.success(v ? "Email intake is on. The timed check started." : "Email intake is off. The timed check stopped.");
                    return;
                  }
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
