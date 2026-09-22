import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DEFAULT_ALERT_CONFIG,
  oversightAlerts,
  type OversightAlertConfig,
} from "@/lib/oversight-alerts";
import type { OversightRow } from "@/lib/owner-oversight";
import {
  oversightAlertConfig,
  setOversightAlertConfig,
} from "@/lib/owner-oversight.functions";

/**
 * Follow-up alerts for the program, with the thresholds supervisors choose.
 *
 * Deliberately silent about time expectations for homeowners and about tax
 * treatment: these are staff prompts to reach out, nothing more.
 */
export function OversightAlertsPanel({ rows }: { rows: OversightRow[] }) {
  const loadConfig = useServerFn(oversightAlertConfig);
  const saveConfig = useServerFn(setOversightAlertConfig);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OversightAlertConfig>(DEFAULT_ALERT_CONFIG);

  const config = useQuery({
    queryKey: ["oversight-alert-config"],
    queryFn: () => loadConfig(),
  });

  const active = config.data ?? DEFAULT_ALERT_CONFIG;
  const alerts = useMemo(() => oversightAlerts(rows, active), [rows, active]);

  const save = useMutation({
    mutationFn: (value: OversightAlertConfig) => saveConfig({ data: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["oversight-alert-config"] });
      setOpen(false);
      toast.success("Alert settings saved");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save those settings"),
  });

  const number = (key: keyof OversightAlertConfig, label: string, hint: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`alert-${key}`}>{label}</Label>
      <Input
        id={`alert-${key}`}
        type="number"
        min={0}
        value={String(draft[key])}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  const toggle = (key: keyof OversightAlertConfig, label: string) => (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
      <Label htmlFor={`alert-${key}`} className="text-sm font-normal">
        {label}
      </Label>
      <Switch
        id={`alert-${key}`}
        checked={Boolean(draft[key])}
        onCheckedChange={(v) => setDraft({ ...draft, [key]: v })}
      />
    </div>
  );

  return (
    <SectionCard
      title="Follow-up alerts"
      description="Homeowners worth a call today, using the thresholds your team set."
      actions={
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) setDraft(active);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-1 size-3.5" /> Alert settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alert settings</DialogTitle>
              <DialogDescription>
                Choose when the program should prompt your team to reach out. These settings apply
                to everyone with oversight access and every change is recorded.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {toggle("behindEnabled", "Flag homeowners behind the program pace")}
              {number(
                "behindHours",
                "Hours behind pace before flagging",
                "Compared against the program's own benchmark for the day they are on.",
              )}
              {toggle("checkinEnabled", "Flag overdue 30/60/90 check-ins")}
              {number(
                "checkinOverdueDays",
                "Days a check-in may stay open",
                "After this, the check-in shows as overdue.",
              )}
              {toggle("ownerItemsEnabled", "Flag items waiting on the homeowner")}
              {number(
                "ownerItemDays",
                "Days an item may sit with the homeowner",
                "Counted from the last recorded contact.",
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
                Save settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing needs a nudge right now under the current settings.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert, i) => (
            <li
              key={`${alert.programId}-${alert.kind}-${i}`}
              className={
                alert.severity === "urgent"
                  ? "flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3"
                  : "flex gap-3 rounded-md border border-border p-3"
              }
            >
              <BellRing
                className={
                  alert.severity === "urgent"
                    ? "mt-0.5 size-4 shrink-0 text-destructive"
                    : "mt-0.5 size-4 shrink-0 text-muted-foreground"
                }
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {alert.ownerName} — {alert.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {alert.properties} · {alert.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
