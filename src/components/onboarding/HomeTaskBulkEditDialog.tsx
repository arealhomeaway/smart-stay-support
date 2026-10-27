/** Bulk editor for open Tasks on one home's onboarding plan. Mirrors TemplateBulkEditDialog. */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usDate } from "@/lib/dates";
import { stageLabel } from "@/lib/onboarding";
import {
  HOME_MANUAL_DATE_NOTE,
  homeBulkPreviewSentence,
  planHomeTaskBulkEdit,
  type HomeBulkPatch,
  type HomeBulkTask,
} from "@/lib/home-task-bulk-edit";
import { bulkUpdateHomeTasksFn } from "@/lib/onboarding.functions";
import { FUNCTIONAL_ROLES, roleLabel } from "@/lib/v2-workflow.functions";

export function HomeTaskBulkEditDialog({
  propertyId,
  homeName,
  tasks,
  stages,
  selectedIds,
  onClose,
  onSaved,
}: {
  propertyId: string;
  homeName: string;
  tasks: HomeBulkTask[];
  stages: string[];
  selectedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const bulkUpdate = useServerFn(bulkUpdateHomeTasksFn);
  const [due, setDue] = useState("");
  const [unit, setUnit] = useState<"leave" | "calendar" | "business">("leave");
  const [role, setRole] = useState("leave");
  const [required, setRequired] = useState("leave");
  const [blocking, setBlocking] = useState("leave");
  const [stage, setStage] = useState("leave");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const patch = useMemo(() => {
    const next: HomeBulkPatch = {};
    if (due) next.dueOn = due;
    if (unit !== "leave") next.offsetUnit = unit;
    if (role !== "leave") next.role = role === "none" ? null : role;
    if (required !== "leave") next.isRequired = required === "yes";
    if (blocking !== "leave") next.blocksHandoff = blocking === "yes";
    if (stage !== "leave") next.stage = stage;
    return next;
  }, [blocking, due, required, role, stage, unit]);

  const plan = useMemo(
    () => planHomeTaskBulkEdit(tasks, selectedIds, patch, { stages, roleName: roleLabel, dateLabel: usDate }),
    [patch, selectedIds, stages, tasks],
  );

  const save = async () => {
    if (!plan.ok) return;
    setSaving(true);
    setFailure(null);
    try {
      const result = await bulkUpdate({ data: { propertyId, taskIds: selectedIds, patch } });
      const parts = [`${result.changed} Task${result.changed === 1 ? "" : "s"} updated.`];
      if (result.skipped.length) parts.push(`${result.skipped.length} homeowner or Active Owner Tasks were left as non-blocking.`);
      toast.success(parts.join(" "));
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Nothing was changed. Review the Tasks and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {selectedIds.length} selected Task{selectedIds.length === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[62vh] pr-4">
          <div className="space-y-4">
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Only this home's open Tasks change. Completed Tasks and Task status are never changed.
            </p>

            <div className="space-y-1 rounded-md border border-border p-3">
              <Label htmlFor="bulk-due">Due date</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input id="bulk-due" type="date" className="w-48" value={due} onChange={(e) => setDue(e.target.value)} />
                {due ? <Button variant="ghost" size="sm" onClick={() => setDue("")}>Leave as is</Button> : <span className="text-xs text-muted-foreground">Leave as is</span>}
              </div>
              {due ? <p className="text-xs text-muted-foreground">{HOME_MANUAL_DATE_NOTE}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Day type</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
                  <SelectTrigger aria-label="Day type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    <SelectItem value="calendar">Calendar days</SelectItem>
                    <SelectItem value="business">Business days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Assigned role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger aria-label="Assigned role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {FUNCTIONAL_ROLES.filter((r) => r.code !== "owner").map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {role !== "leave" ? <p className="text-xs text-muted-foreground">The person comes from whoever holds that role on this home.</p> : null}
              </div>
              <div className="space-y-1">
                <Label>Required</Label>
                <Select value={required} onValueChange={setRequired}>
                  <SelectTrigger aria-label="Required"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    <SelectItem value="yes">Required</SelectItem>
                    <SelectItem value="no">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Blocks handoff</Label>
                <Select value={blocking} onValueChange={setBlocking}>
                  <SelectTrigger aria-label="Blocks handoff"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger aria-label="Stage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    {stages.map((s) => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">Preview</p>
              {plan.ok ? (
                <>
                  <p className="mt-1">{homeBulkPreviewSentence(plan, homeName)}</p>
                  {plan.readiness.message ? <p className="mt-2 font-medium">{plan.readiness.message}</p> : null}
                  {plan.handoffSkipMessage ? <p className="mt-2 text-muted-foreground">{plan.handoffSkipMessage}</p> : null}
                  {plan.skipped.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      {plan.skipped.map((s) => <li key={s.taskId}>{s.title}: {s.reason}</li>)}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-muted-foreground">{plan.error}</p>
              )}
            </div>
            {failure ? (
              <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
                {failure}
              </p>
            ) : null}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!plan.ok || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
