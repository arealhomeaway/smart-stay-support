/** Bulk editor for safe, shared Workflow Template step settings. */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLAN_ANCHORS, type OffsetUnit, type PlanAnchor } from "@/lib/plan-rules";
import {
  bulkPreviewSentence,
  planTemplateBulkEdit,
  type TemplateBulkPatch,
  type TemplateBulkStep,
} from "@/lib/template-bulk-edit";
import { bulkUpdateTemplateStepsV2, FUNCTIONAL_ROLES, roleLabel } from "@/lib/v2-workflow.functions";

type Choice = "leave" | "set" | "clear";

export function TemplateBulkEditDialog({
  templateId,
  steps,
  stages,
  selectedIds,
  onClose,
  onSaved,
}: {
  templateId: string;
  steps: TemplateBulkStep[];
  stages: string[];
  selectedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const bulkUpdate = useServerFn(bulkUpdateTemplateStepsV2);
  const [dueMode, setDueMode] = useState<Choice>("leave");
  const [offset, setOffset] = useState("0");
  const [anchor, setAnchor] = useState<PlanAnchor>("actual_access");
  const [unit, setUnit] = useState<"leave" | OffsetUnit>("leave");
  const [role, setRole] = useState("leave");
  const [required, setRequired] = useState("leave");
  const [blocking, setBlocking] = useState("leave");
  const [stage, setStage] = useState("leave");
  const [saving, setSaving] = useState(false);

  const offsetNumber = offset.trim() === "" ? Number.NaN : Math.round(Number(offset));
  const patch = useMemo(() => {
    const next: TemplateBulkPatch = {};
    if (dueMode === "set") next.dueRule = { offsetDays: offsetNumber, scheduleAnchor: anchor };
    if (dueMode === "clear") next.dueRule = { offsetDays: null, scheduleAnchor: null };
    if (unit !== "leave") next.offsetUnit = unit;
    if (role !== "leave") next.functionalRole = role === "none" ? null : role;
    if (required !== "leave") next.isRequired = required === "yes";
    if (blocking !== "leave") next.blocksHandoff = blocking === "yes";
    if (stage !== "leave") next.stage = stage;
    return next;
  }, [anchor, blocking, dueMode, offsetNumber, required, role, stage, unit]);

  const plan = useMemo(
    () => planTemplateBulkEdit(steps, selectedIds, patch, { stages, roleName: roleLabel }),
    [patch, selectedIds, stages, steps],
  );
  const dueInvalid = dueMode === "set" && (!Number.isInteger(offsetNumber) || offsetNumber < -260 || offsetNumber > 365);

  const save = async () => {
    if (!plan.ok) return;
    setSaving(true);
    try {
      const result = await bulkUpdate({ data: { templateId, stepIds: selectedIds, patch } });
      const parts = [`${result.changed} step${result.changed === 1 ? "" : "s"} updated.`];
      if (result.skipped.length) parts.push(`${result.skipped.length} homeowner or Active Owner steps were left as non-blocking.`);
      toast.success(parts.join(" "));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was changed. Review the steps and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {selectedIds.length} selected steps</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[62vh] pr-4">
          <div className="space-y-4">
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Changes apply to homes started from this template after you save. Homes already in progress keep their current plan.
            </p>

            <div className="space-y-2 rounded-md border border-border p-3">
              <Label>Due date rule</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Select value={dueMode} onValueChange={(value) => setDueMode(value as Choice)}>
                  <SelectTrigger aria-label="Due date rule change"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    <SelectItem value="set">Set due date rule</SelectItem>
                    <SelectItem value="clear">No date rule</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Days"
                  inputMode="numeric"
                  disabled={dueMode !== "set"}
                  value={offset}
                  onChange={(event) => setOffset(event.target.value)}
                  placeholder="Days"
                />
                <Select value={anchor} onValueChange={(value) => setAnchor(value as PlanAnchor)} disabled={dueMode !== "set"}>
                  <SelectTrigger aria-label="From"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_ANCHORS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {dueInvalid ? <p className="text-xs text-destructive">Days must be a whole number from -260 to 365.</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Day type</Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as "leave" | OffsetUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {FUNCTIONAL_ROLES.filter((item) => item.code !== "owner").map((item) => (
                      <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Required</Label>
                <Select value={required} onValueChange={setRequired}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave as is</SelectItem>
                    {stages.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">Preview</p>
              {plan.ok ? (
                <>
                  <p className="mt-1">{bulkPreviewSentence(plan)}</p>
                  {plan.handoffSkipMessage ? <p className="mt-2 text-muted-foreground">{plan.handoffSkipMessage}</p> : null}
                  {plan.skipped.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      {plan.skipped.map((item) => <li key={item.stepId}>{item.title}: {item.reason}</li>)}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-muted-foreground">{plan.error}</p>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!plan.ok || dueInvalid || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
