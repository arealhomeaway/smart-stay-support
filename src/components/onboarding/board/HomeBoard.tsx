/**
 * One home's onboarding page, as on the "One Home" board (register O1, O3):
 * the photo header with the six stage stepper, and the pieces of the Plan,
 * Design, Budget & Invoices, Agreements and General Info tabs. Saves go through
 * the caller-authenticated database functions; the database decides who may save.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, Search } from "lucide-react";
import { Chip } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { stateChip } from "@/lib/semantic";
import { cn } from "@/lib/utils";
import { CatchUpBox, openSelectable, type CatchUpSelection } from "@/components/onboarding/PlanCatchUp";
import { stageCheckState, toggleStage } from "@/lib/plan-catch-up";
import {
  DESIGN_FOLDERS,
  INVOICE_STATUSES,
  NOT_SET,
  NOTION_STATUSES,
  OWNER_TYPES,
  PMA_STATUSES,
  SIX_STAGES,
  designFolders,
  dueLabel,
  isFinished,
  planFilter,
  pmaSteps,
  shortDate,
  shown,
  summaryChips,
  planStageOpenByDefault,
  sixStageFor,
  type BoardTask,
  type HealthLevel,
  type PlanFilter,
  type ProjectDetails,
  type Stepper,
} from "@/lib/onboarding-board";
import { correctCommittedHandoffFn, saveOnboardingDetailsFn } from "@/lib/onboarding-details.functions";
import { HealthDot, StageProgress } from "./BoardParts";
import { planStageElementId, searchPlanTasks } from "@/lib/plan-search";

const HEALTH_CHIP: Record<HealthLevel, string> = {
  on_track: stateChip("done"),
  watch: stateChip("info"),
  at_risk: stateChip("waiting"),
  blocked: stateChip("blocked"),
};

function dateOrNotSet(d: string | null | undefined) {
  return d ? shortDate(d) : NOT_SET;
}

/* ---------------------------------------------------------------- header */

export function HomeBoardHeader(p: {
  photo: string | null;
  address: string;
  place: string;
  activeOwner: boolean;
  health: { level: HealthLevel; line: string };
  ownerType: string | null;
  status: string | null;
  team: { role: string; name: string | null }[];
  closingOn: string | null;
  committedOn: string | null;
  estimateOn: string | null;
  weeklyStatus: string | null;
  stepper: Stepper;
  /** Item 31: a stage card scrolls the Plan tab to that stage. */
  onSelectStage?: (index: number) => void;
}) {
  // Fix 41: chips are owner type, risk and project status; the stage shows in Progress.
  const chip = summaryChips({ ownerType: p.ownerType, activeOwner: p.activeOwner, projectStatus: p.status });
  const cell = (label: string, value: ReactNode, key?: string) => (
    <div key={key ?? label} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-label="Home summary">
        <div className="flex flex-col md:flex-row">
          {/* Fix 41: a fixed-size photo on the left; under 768 px it sits above the details. Item 40: no photo, no block. */}
          {p.photo ? (
            <div className="h-60 w-full shrink-0 bg-sunken md:w-[360px]">
              <PropertyPhoto url={p.photo} name={p.address} rounded="rounded-none" className="size-full object-cover" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {chip.ownerType ? <Chip>{chip.ownerType}</Chip> : null}
              <Chip className={HEALTH_CHIP[p.health.level]}>
                <HealthDot level={p.health.level} className="mr-1.5" />
                {p.health.line}
              </Chip>
              {chip.projectStatus ? <Chip>{chip.projectStatus}</Chip> : null}
            </div>
            {/* Item 31: the home's name sits once, in the header line above. */}
            {p.place ? <p className="text-sm text-muted-foreground">{p.place}</p> : null}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4" aria-label="Home details">
              {p.team.map((t) => cell(t.role, t.name ?? NOT_SET))}
              {cell("Closing date", <span className="numeric">{dateOrNotSet(p.closingOn)}</span>)}
              {cell(
                "Committed Handoff Date",
                <span className="numeric flex items-center gap-1">
                  {p.committedOn ? <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" /> : null}
                  {dateOrNotSet(p.committedOn)}
                </span>,
              )}
              {cell("Est. Hand Off Date", <span className="numeric">{dateOrNotSet(p.estimateOn)}</span>)}
              {/* Part 2 (2.5): Weekly status retired from screens; data kept. */}
            </dl>
          </div>
        </div>
      </section>
      {/* Fix 41: Progress is its own card under the summary. */}
      <section className="surface space-y-3 p-4 sm:p-5" aria-label="Progress">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Progress</h2>
          <p className="numeric text-sm text-muted-foreground">{p.stepper.progressLine}</p>
        </div>
        <StageProgress stepper={p.stepper} onSelect={p.onSelectStage} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Plan */

export type PlanTask = BoardTask & { roleLabel: string | null };

export function PlanStages({
  tasks,
  stepper,
  userId,
  today,
  onOpen,
  catchUp,
  notNeeded = [],
}: {
  tasks: PlanTask[];
  stepper: Stepper;
  userId: string | null;
  today: string;
  onOpen: (taskId: string) => void;
  /** Plan catch-up selection (Admin approval Nov 12), present only for people who may use it. */
  catchUp?: CatchUpSelection | undefined;
  /** Tasks marked Not needed for this home; kept on record, never counted. */
  notNeeded?: { id: string; title: string; stage: string; exception_reason: string | null }[];
}) {
  const [filter, setFilter] = useState<PlanFilter>("everyone");
  const [term, setTerm] = useState("");
  // Item 30: a search looks through every Task in the plan, finished ones included.
  const hits = searchPlanTasks(tasks, term);
  const shownTasks = planFilter(tasks, filter, userId, today);
  const byStage = (stage: string) =>
    shownTasks
      .filter((t) => sixStageFor(t.stage) === stage && !t.parent_task_id)
      .sort((a, b) => Number(isFinished(a)) - Number(isFinished(b)) || (a.due_on ?? "9").localeCompare(b.due_on ?? "9"));
  const unmapped = shownTasks.filter((t) => !sixStageFor(t.stage) && !t.parent_task_id);
  const row = (t: PlanTask, order: string[], stageName?: string) => {
    const label = dueLabel(t, today);
    const canTick = Boolean(catchUp?.selectable.has(t.id));
    return (
      <li key={t.id} className="flex min-h-[52px] items-stretch">
        {catchUp ? (
          <span className="flex w-12 shrink-0 items-center justify-center">
            {canTick ? (
              <CatchUpBox
                state={catchUp.selected.has(t.id)}
                label={`Select ${t.title}`}
                onToggle={(shift) => catchUp.toggle(t.id, shift, order)}
              />
            ) : null}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onOpen(t.id)}
          className={cn(
            "flex min-h-[52px] w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 py-2 pr-3 text-left text-sm hover:bg-muted/50",
            !catchUp && "pl-3",
          )}
        >
          <span className={cn("min-w-0 flex-1 basis-full font-medium sm:basis-0", isFinished(t) && "text-muted-foreground")}>{t.title}</span>
          {stageName ? <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{stageName}</span> : null}
          <span className="text-xs text-muted-foreground">{t.roleLabel ?? "No role"}</span>
          <span
            className={cn(
              "numeric w-28 text-right text-xs",
              label.startsWith("Overdue") ? "font-medium text-state-blocked" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </button>
      </li>
    );
  };
  const stageBlock = (stage: string, i: number, open: boolean) => {
    const list = byStage(stage);
    const step = stepper.steps[i]!;
    const order = [...list.filter((t) => !isFinished(t)), ...list.filter(isFinished)].map((t) => t.id);
    const skipped = notNeeded.filter((t) => sixStageFor(t.stage) === stage);
    const body =
      list.length === 0 && skipped.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No tasks match.</p>
      ) : (
        // Fixes 10, 27: open Tasks first; finished ones fold into "Finished (n)".
        <>
          <ul className="divide-y divide-border">{list.filter((t) => !isFinished(t)).map((t) => row(t, order))}</ul>
          {list.some(isFinished) ? (
            <details className="border-t border-border">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-muted-foreground">
                Finished ({list.filter(isFinished).length})
              </summary>
              <ul className="divide-y divide-border">{list.filter(isFinished).map((t) => row(t, order))}</ul>
            </details>
          ) : null}
          {skipped.length > 0 ? (
            <details className="border-t border-border">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-muted-foreground">
                Not needed ({skipped.length})
              </summary>
              <ul className="divide-y divide-border">
                {skipped.map((t) => (
                  <li key={t.id} className="px-3 py-2 text-sm">
                    <span className="text-muted-foreground line-through">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">{notNeededLabel(t.exception_reason)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      );
    const openIds = catchUp ? openSelectable(list, catchUp) : [];
    const check = catchUp ? stageCheckState(order, openIds, catchUp.selected) : "none";
    const head = (
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
        <span className="font-semibold">{stage}</span>
        <span className="text-xs text-muted-foreground">{step.note}</span>
      </span>
    );
    const box =
      catchUp && openIds.length > 0 ? (
        <CatchUpBox
          state={check}
          label={`Select every open Task in ${stage}`}
          className="-my-2 -ml-2"
          onToggle={() => catchUp.replace(toggleStage(catchUp.selected, openIds, check))}
        />
      ) : null;
    // Fix 41: every stage folds; the current one starts open, a finished one reads Done.
    return (
      <details key={stage} id={planStageElementId(i)} open={open} className="surface scroll-mt-4 overflow-hidden">
        <summary className="flex min-h-[52px] cursor-pointer items-center gap-1 border-b border-border bg-muted/20 px-3 py-2">
          {box}
          {head}
        </summary>
        {body}
      </details>
    );
  };
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search this plan"
          aria-label="Search this plan"
          className="h-11 pl-9"
          maxLength={120}
        />
      </div>
      {hits ? (
        <section aria-label="Search results" className="surface overflow-hidden">
          <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <span className="text-sm font-semibold">
              {hits.length === 1 ? "1 task" : `${hits.length} tasks`}
            </span>
            <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setTerm("")}>
              Clear
            </Button>
          </div>
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No tasks match.</p>
          ) : (
            <ul className="divide-y divide-border">{hits.map((h) => row(h.task, hits.map((x) => x.task.id), h.stage))}</ul>
          )}
        </section>
      ) : (
      <>
      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {(
          [
            ["mine", "Mine"],
            ["everyone", "Everyone"],
            ["overdue", "Overdue"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium",
              filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {SIX_STAGES.map((s, i) => stageBlock(s, i, planStageOpenByDefault(i, stepper)))}
      {unmapped.length > 0 ? (
        <details className="surface overflow-hidden">
          <summary className="flex min-h-11 cursor-pointer items-center bg-muted/20 px-3 py-2 font-semibold">
            Other tasks ({unmapped.length})
          </summary>
          <ul className="divide-y divide-border">{unmapped.map((t) => row(t, unmapped.map((x) => x.id)))}</ul>
        </details>
      ) : null}
      </>
      )}
    </div>
  );
}

/** Not needed Tasks keep the stored "Voided — not needed: <reason>" record; the screen shows only the reason. */
export function notNeededLabel(reason: string | null) {
  const r = (reason ?? "").replace(/^Voided\s*[—-]\s*not needed:\s*/i, "").trim();
  return r ? `Not needed: ${r}` : "Not needed";
}

/** Item 31: open the Plan tab's stage block and bring it into view. */
export function scrollToPlanStage(index: number) {
  const el = document.getElementById(planStageElementId(index));
  if (!el) return false;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/* ---------------------------------------------------------------- Design */

export function DesignTab({ propertyId }: { propertyId: string }) {
  const list = useServerFn(listAttachmentsFn);
  const files = useQuery({
    queryKey: ["attachments", "property", propertyId],
    queryFn: () => list({ data: { entityType: "property", entityId: propertyId } }),
  });
  const folders = designFolders(
    ((files.data?.files ?? []) as { category?: string | null; created_at?: string; uploaded_at?: string }[]).map((f) => ({
      category: f.category ?? null,
      created_at: f.created_at ?? f.uploaded_at ?? "",
    })),
  );
  return (
    <div className="space-y-4">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Design folders">
        {folders.map((f) => (
          <li key={f.value} className="surface p-3">
            <p className="font-semibold">
              {f.label} <span className="numeric font-normal text-muted-foreground">({f.count})</span>
            </p>
            <p className="text-xs text-muted-foreground">{f.latest}</p>
          </li>
        ))}
      </ul>
      <AttachmentsPanel
        entityType="property"
        entityId={propertyId}
        title="Add files or photos"
        description="Then pick a folder."
        categories={DESIGN_FOLDERS}
        defaultCategory="design_floor_plan"
        dropLabel="Drop files or photos here"
        onlyCategories={DESIGN_FOLDERS.map((f) => f.value)}
        groupByCategory
      />
    </div>
  );
}

/* --------------------------------------------------------- detail editing */

function useSaveDetails(projectId: string | null) {
  const save = useServerFn(saveOnboardingDetailsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProjectDetails) => {
      if (!projectId) throw new Error("This home has no onboarding project yet.");
      return save({ data: { projectId, patch } });
    },
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
      void qc.invalidateQueries({ queryKey: ["onboarding-project"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function ChoiceField({
  label,
  value,
  options,
  canEdit,
  onSave,
  pending,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  canEdit: boolean;
  onSave: (v: string | null) => void;
  pending?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {canEdit ? (
        <Select value={value ?? "__none"} onValueChange={(v) => onSave(v === "__none" ? null : v)} disabled={Boolean(pending)}>
          <SelectTrigger className="h-11" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">{NOT_SET}</SelectItem>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm font-medium">{shown(value)}</p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  canEdit,
  multiline,
  onSave,
  pending,
  max,
}: {
  label: string;
  value: string | null;
  canEdit: boolean;
  multiline?: boolean;
  onSave: (v: string | null) => void;
  pending?: boolean;
  max: number;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const changed = draft.trim() !== (value ?? "").trim();
  if (!canEdit)
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="whitespace-pre-line text-sm font-medium">{shown(value)}</p>
      </div>
    );
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={draft} maxLength={max} rows={3} onChange={(e) => setDraft(e.target.value)} aria-label={label} />
      ) : (
        <Input value={draft} maxLength={max} className="h-11" onChange={(e) => setDraft(e.target.value)} aria-label={label} />
      )}
      {changed ? (
        <Button size="sm" className="h-11" disabled={pending} onClick={() => onSave(draft.trim() || null)}>
          Save {label}
        </Button>
      ) : null}
    </div>
  );
}

/** Owner Type, Status, Greater Area, Weekly status and the Committed Handoff Date. */
export function ProjectDetailsSection({
  projectId,
  details,
  canEdit,
  canSetStatus,
  canCorrect,
}: {
  projectId: string | null;
  details: ProjectDetails;
  canEdit: boolean;
  canSetStatus: boolean;
  canCorrect: boolean;
}) {
  const save = useSaveDetails(projectId);
  const [date, setDate] = useState("");
  return (
    <section className="surface space-y-4 p-4" aria-label="Project details">
      <h2 className="font-semibold">Project details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField
          label="Owner Type"
          value={details.owner_type ?? null}
          options={OWNER_TYPES}
          canEdit={canEdit}
          pending={save.isPending}
          onSave={(v) => save.mutate({ owner_type: v })}
        />
        <ChoiceField
          label="Status"
          value={details.project_status ?? null}
          options={NOTION_STATUSES}
          canEdit={canEdit && canSetStatus}
          pending={save.isPending}
          onSave={(v) => save.mutate({ project_status: v })}
        />
        <TextField
          key={`area-${details.greater_area ?? ""}`}
          label="Greater Area"
          value={details.greater_area ?? null}
          canEdit={canEdit}
          max={120}
          pending={save.isPending}
          onSave={(v) => save.mutate({ greater_area: v })}
        />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Committed Handoff Date</p>
          {details.committed_handoff_on ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="numeric flex items-center gap-1 text-sm font-medium">
                <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {shortDate(details.committed_handoff_on)}
              </p>
              {canCorrect ? (
                <CorrectCommittedDate projectId={projectId} current={details.committed_handoff_on} />
              ) : null}
            </div>
          ) : canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-44" aria-label="Committed Handoff Date" />
              <SetOnceButton disabled={!date || save.isPending} onConfirm={() => save.mutate({ committed_handoff_on: date })} />
            </div>
          ) : (
            <p className="text-sm font-medium">{NOT_SET}</p>
          )}
        </div>
      </div>
      {/* Property page Part 2 (2.5): the internal Weekly status is retired from screens; its data is kept. */}
    </section>
  );
}

export function SetOnceButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11" disabled={disabled}>
          Set date
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set the Committed Handoff Date</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Once set, this date is locked. Only a Supervisor or Admin can correct it, with a reason.
        </p>
        <Button
          className="h-11"
          onClick={() => {
            onConfirm();
            setOpen(false);
          }}
        >
          Set and lock
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function CorrectCommittedDate({ projectId, current }: { projectId: string | null; current: string }) {
  const correct = useServerFn(correctCommittedHandoffFn);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => {
      if (!projectId) throw new Error("This home has no onboarding project yet.");
      return correct({ data: { projectId, date, reason } });
    },
    onSuccess: () => {
      toast.success("Date corrected.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
      void qc.invalidateQueries({ queryKey: ["onboarding-project"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11">
          Correct
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct the Committed Handoff Date</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Corrected date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
          </div>
          <Button
            className="h-11 w-full"
            disabled={m.isPending || reason.trim().length < 5 || !date || date === current}
            onClick={() => m.mutate()}
          >
            Save correction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------ Budget & Invoices */

export function BudgetFigures({
  projectId,
  invoiceStatus,
  canEdit,
}: {
  projectId: string | null;
  invoiceStatus: string | null;
  canEdit: boolean;
}) {
  const save = useSaveDetails(projectId);
  const money = ["Total Furnishing Invoice", "Total Repair Estimate", "Change on Furnishing Invoice", "Final Repair Cost"];
  return (
    <section className="surface space-y-4 p-4" aria-label="Invoices">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {money.map((m) => (
          <div key={m}>
            <dt className="text-xs text-muted-foreground">{m}</dt>
            <dd className="text-sm font-medium">{NOT_SET}</dd>
          </div>
        ))}
      </dl>
      <div className="max-w-sm">
        <ChoiceField
          label="Invoice Status"
          value={invoiceStatus}
          options={INVOICE_STATUSES}
          canEdit={canEdit}
          pending={save.isPending}
          onSave={(v) => save.mutate({ invoice_status: v })}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Agreements */

export function AgreementsTab({
  projectId,
  pmaStatus,
  canEdit,
}: {
  projectId: string | null;
  pmaStatus: string | null;
  canEdit: boolean;
}) {
  const save = useSaveDetails(projectId);
  const steps = pmaSteps(pmaStatus);
  return (
    <div className="space-y-4">
      <ol className="surface divide-y divide-border" aria-label="PMA Status steps">
        {steps.map((s) => (
          <li key={s.label} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className="font-medium">{s.label}</span>
            <Chip className={stateChip(s.state === "Done" ? "done" : s.state === "Next" ? "active" : "info")}>{s.state}</Chip>
          </li>
        ))}
      </ol>
      <div className="max-w-sm">
        <ChoiceField
          label="PMA Status"
          value={pmaStatus}
          options={PMA_STATUSES}
          canEdit={canEdit}
          pending={save.isPending}
          onSave={(v) => save.mutate({ pma_status: v })}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- General Info */

/** Links and review notes kept on the project's existing reference list. */
export const INFO_REFS = [
  { key: "zillow_url", label: "Zillow link", kind: "link" },
  { key: "property_folder", label: "Property folder in SharePoint", kind: "link" },
  { key: "purchase_agreement", label: "Purchase agreement", kind: "link" },
  { key: "verified_address", label: "Verified address", kind: "text" },
  { key: "builder", label: "Builder", kind: "text" },
  { key: "ccrs_reviewed_on", label: "CC&Rs reviewed", kind: "date" },
  { key: "ccrs_note", label: "CC&Rs note", kind: "text" },
] as const;

export function GeneralInfoFields({
  refs,
  ownerRezId,
  owner,
  canEdit,
  onSaveRef,
  pending,
}: {
  refs: Record<string, string>;
  ownerRezId: string | null;
  owner: ReactNode;
  canEdit: boolean;
  onSaveRef: (key: string, value: string) => void;
  pending: boolean;
}) {
  return (
    <section className="surface space-y-4 p-4" aria-label="General Info">
      <div className="grid gap-4 sm:grid-cols-2">
        {INFO_REFS.slice(0, 2).map((r) => (
          <RefField key={r.key} def={r} value={refs[r.key] ?? ""} canEdit={canEdit} onSave={onSaveRef} pending={pending} />
        ))}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">OwnerRez property</p>
          <p className="text-sm font-medium">{ownerRezId ?? NOT_SET}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Owner</p>
          <div className="text-sm font-medium">{owner}</div>
        </div>
        {INFO_REFS.slice(2).map((r) => (
          <RefField key={r.key} def={r} value={refs[r.key] ?? ""} canEdit={canEdit} onSave={onSaveRef} pending={pending} />
        ))}
      </div>
    </section>
  );
}

function RefField({
  def,
  value,
  canEdit,
  onSave,
  pending,
}: {
  def: (typeof INFO_REFS)[number];
  value: string;
  canEdit: boolean;
  onSave: (key: string, value: string) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const display =
    !value ? (
      NOT_SET
    ) : def.kind === "link" && /^https?:\/\//i.test(value) ? (
      <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline-offset-4 hover:underline">
        Open
      </a>
    ) : def.kind === "date" ? (
      shortDate(value)
    ) : (
      value
    );
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{def.label}</p>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type={def.kind === "date" ? "date" : def.kind === "link" ? "url" : "text"}
            value={draft}
            maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            className="h-11 min-w-0 flex-1"
            aria-label={def.label}
          />
          <Button
            className="h-11"
            disabled={pending || (def.kind === "link" && draft.trim() !== "" && !/^https?:\/\//i.test(draft.trim()))}
            onClick={() => {
              onSave(def.key, draft.trim());
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{display}</span>
          {canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-11"
              onClick={() => {
                setDraft(value);
                setEditing(true);
              }}
            >
              {value ? "Change" : "Add"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
