/** Bulk editor for safe, shared Workflow Template step settings. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CONDITION_OPTIONS, describeCondition, type ConditionClause } from "@/lib/plan-rules";
import { OWNER_DEPENDENCIES } from "@/lib/owner-dependency";
import { planExtraBulkEdit, type ExtraBulkStep } from "@/lib/template-bulk-edit";
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
import { bulkUpdateTemplateStepsV2, bulkUpdateTemplateStepsV2b, templateBulkV2Ready, FUNCTIONAL_ROLES, roleLabel } from "@/lib/v2-workflow.functions";

type Choice = "leave" | "set" | "clear";

/** One plain sentence per switch, shared by the single-step and bulk editors. */
export const SWITCH_HELP = {
  required: "The plan is not complete until this step is done or skipped with a reason.",
  blocksHandoff: "Operations cannot accept the home until this step is done.",
  active: "Turn off to hide this step from new homes without deleting it.",
} as const;

export function TemplateBulkEditDialog({
  templateId,
  steps,
  stages,
  selectedIds,
  onClose,
  onSaved,
}: {
  templateId: string;
  steps: (TemplateBulkStep & Partial<ExtraBulkStep>)[];
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
  const [saving, setSaving] = useState(false);
  const readyFn = useServerFn(templateBulkV2Ready);
  const bulkExtra = useServerFn(bulkUpdateTemplateStepsV2b);
  const readyQ = useQuery({ queryKey: ["template-bulk-v2-ready"], queryFn: () => readyFn() });
  const extraReady = readyQ.data?.ready === true;
  const [condMode, setCondMode] = useState<Choice>("leave");
  const [clauses, setClauses] = useState<ConditionClause[]>([]);
  const [dependency, setDependency] = useState("leave");
  const [active, setActive] = useState("leave");
  const extra = useMemo(() => ({
    ...(condMode === "set" ? { condition: { all: clauses } } : condMode === "clear" ? { condition: null } : {}),
    ...(dependency !== "leave" ? { ownerDependency: dependency as "none" } : {}),
    ...(active !== "leave" ? { isActive: active === "yes" } : {}),
  }), [condMode, clauses, dependency, active]);
  const extraChosen = Object.keys(extra).length > 0;
  const extraPlan = useMemo(() => planExtraBulkEdit(steps.map((s) => ({ ...s, condition: s.condition ?? null, owner_dependency: s.owner_dependency ?? null, is_active: s.is_active ?? true })), selectedIds, extra), [steps, selectedIds, extra]);

  const offsetNumber = offset.trim() === "" ? Number.NaN : Math.round(Number(offset));
  const patch = useMemo(() => {
    const next: TemplateBulkPatch = {};
    if (dueMode === "set") next.dueRule = { offsetDays: offsetNumber, scheduleAnchor: anchor };
    if (dueMode === "clear") next.dueRule = { offsetDays: null, scheduleAnchor: null };
    if (unit !== "leave") next.offsetUnit = unit;
    if (role !== "leave") next.functionalRole = role === "none" ? null : role;
    if (required !== "leave") next.isRequired = required === "yes";
    if (blocking !== "leave") next.blocksHandoff = blocking === "yes";
    return next;
  }, [anchor, blocking, dueMode, offsetNumber, required, role, unit]);

  const baseChosen = Object.keys(patch).length > 0;
  const mixed = baseChosen && extraChosen;
  const plan = useMemo(
    () => planTemplateBulkEdit(steps, selectedIds, patch, { stages, roleName: roleLabel }),
    [patch, selectedIds, stages, steps],
  );
  const dueInvalid = dueMode === "set" && (!Number.isInteger(offsetNumber) || offsetNumber < -260 || offsetNumber > 365);

  const save = async () => {
    if (mixed) return;
    if (extraChosen) {
      if (!extraPlan.ok) return;
      setSaving(true);
      try {
        const result = await bulkExtra({ data: { templateId, stepIds: selectedIds, ...extra } });
        const parts = [`${result.changed} step${result.changed === 1 ? "" : "s"} updated.`];
        if (result.skipped.length) parts.push(`${result.skipped.length} steps that block handoff were left unchanged.`);
        toast.success(parts.join(" "));
        onSaved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nothing was changed. Review the steps and try again.");
      } finally {
        setSaving(false);
      }
      return;
    }
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
              Changes save to the working plan. New homes get them only after you publish a new version. Homes already in progress keep their current plan. Breezeway settings are edited one step at a time.
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
                <p className="text-xs text-muted-foreground">{SWITCH_HELP.required}</p>
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
                <p className="text-xs text-muted-foreground">{SWITCH_HELP.blocksHandoff}</p>
              </div>
            </div>

            {extraReady ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="space-y-1">
                  <Label>Include this step only when</Label>
                  <Select value={condMode} onValueChange={(v) => setCondMode(v as Choice)}>
                    <SelectTrigger aria-label="Include this step only when"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leave">Leave as is</SelectItem>
                      <SelectItem value="set">Set conditions</SelectItem>
                      <SelectItem value="clear">Every home (no condition)</SelectItem>
                    </SelectContent>
                  </Select>
                  {condMode === "set" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {CONDITION_OPTIONS.map((o) => {
                        const on = clauses.some((c) => c.field === o.field && c.value === o.value);
                        return (
                          <button type="button" key={o.field + o.value} aria-pressed={on}
                            onClick={() => setClauses((cur) => (on ? cur.filter((c) => !(c.field === o.field && c.value === o.value)) : [...cur, { field: o.field, value: o.value }]))}
                            className={"rounded-full border px-2.5 py-1 text-xs " + (on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {condMode === "set" ? <p className="text-xs text-muted-foreground">{describeCondition(clauses.length ? { all: clauses } : null)}.</p> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Needs from the homeowner</Label>
                    <Select value={dependency} onValueChange={setDependency}>
                      <SelectTrigger aria-label="Needs from the homeowner"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leave">Leave as is</SelectItem>
                        {OWNER_DEPENDENCIES.map((d) => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Active in this plan</Label>
                    <Select value={active} onValueChange={setActive}>
                      <SelectTrigger aria-label="Active in this plan"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leave">Leave as is</SelectItem>
                        <SelectItem value="yes">Active</SelectItem>
                        <SelectItem value="no">Not active</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{SWITCH_HELP.active}</p>
                  </div>
                </div>
                {mixed ? <p className="text-xs text-destructive">Save these three separately from the settings above, so each save changes everything or nothing.</p> : null}
              </div>
            ) : null}

            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">Preview</p>
              {extraChosen && !baseChosen ? (
                extraPlan.ok ? (
                  <>
                    <p className="mt-1">This will change {extraPlan.changes} steps.</p>
                    {extraPlan.skipped.length ? <p className="mt-2 text-muted-foreground">{extraPlan.skipped.length} steps that block handoff stay unchanged. Turn off Blocks handoff before making them a Business Decision.</p> : null}
                  </>
                ) : <p className="mt-1 text-muted-foreground">{extraPlan.error}</p>
              ) : plan.ok ? (
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
          <Button disabled={saving || mixed || (extraChosen ? !extraPlan.ok : !plan.ok || dueInvalid)} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
