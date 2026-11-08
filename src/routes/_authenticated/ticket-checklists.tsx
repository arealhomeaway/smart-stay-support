import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useFeatureFlags } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { ChecklistStepView } from "@/components/tickets/ChecklistStepCard";
import {
  ACTION_LABELS,
  CHECKLIST_CATEGORIES,
  templateProblems,
  parseChecklistRow,
  type ChecklistAction,
  type ChecklistAnswer,
  type ChecklistCategoryId,
  type ChecklistStep,
  type ChecklistTemplate,
} from "@/lib/ticket-checklists";
import { SEED_TEMPLATES } from "@/lib/ticket-checklist-seed";

export const Route = createFileRoute("/_authenticated/ticket-checklists")({
  head: () => ({
    meta: [
      { title: "Ticket checklists · Resolve" },
      { name: "description", content: "Edit the guided step-by-step checklists Property Coordinators follow on tickets." },
      { property: "og:title", content: "Ticket checklists · Resolve" },
      { property: "og:description", content: "Edit the guided step-by-step checklists Property Coordinators follow on tickets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketChecklistsPage,
});

type Db = { from: (t: string) => any; rpc: (f: string, a: unknown) => any };
const db = supabase as unknown as Db;

function TicketChecklistsPage() {
  const role = useRole();
  const flags = useFeatureFlags();
  const qc = useQueryClient();
  const canEdit = role.isAdmin || role.access.seats.opsDirector === true;
  const [cat, setCat] = useState<ChecklistCategoryId>("lockout");

  const live = useQuery({
    queryKey: ["checklist-admin", cat],
    queryFn: async () => {
      const { data, error } = await db
        .from("playbooks")
        .select("id, title, version, checklist, checklist_category, sop_url")
        .eq("checklist_category", cat)
        .eq("status", "approved")
        .not("checklist", "is", null)
        .maybeSingle();
      // Before the pending database step is applied the column does not exist: show the seed read-only.
      if (error) return { row: null, pending: true as const };
      return { row: data ? parseChecklistRow(data) : null, pending: false as const };
    },
  });

  const seed = SEED_TEMPLATES.find((t) => t.category === cat) ?? null;
  const base: ChecklistTemplate | null = live.data?.row ?? seed;
  const [draft, setDraft] = useState<ChecklistTemplate | null>(base);
  useEffect(() => setDraft(base), [cat, live.data?.row?.id, live.data?.row?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const problems = useMemo(() => (draft ? templateProblems(draft) : []), [draft]);
  const [previewAnswers, setPreviewAnswers] = useState<ChecklistAnswer[]>([]);
  const [previewGuest, setPreviewGuest] = useState(true);
  useEffect(() => setPreviewAnswers([]), [cat]);

  const publish = useMutation({
    mutationFn: async () => {
      if (!draft || !live.data?.row) throw new Error("Nothing to publish.");
      const { error } = await db.rpc("publish_ticket_checklist", {
        _category: cat,
        _title: draft.title,
        _sop_url: draft.sopUrl ?? null,
        _checklist: { priority: draft.priority ?? null, settings: draft.settings ?? [], steps: draft.steps },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Published. New tickets use this version; open tickets keep theirs.");
      await qc.invalidateQueries({ queryKey: ["checklist-admin", cat] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not publish."),
  });

  const category = CHECKLIST_CATEGORIES.find((c) => c.id === cat)!;
  const editable = canEdit && !live.data?.pending && Boolean(live.data?.row);
  const setStep = (i: number, s: ChecklistStep) => draft && setDraft({ ...draft, steps: draft.steps.map((x, j) => (j === i ? s : x)) });
  const move = (i: number, d: -1 | 1) => {
    if (!draft) return;
    const steps = [...draft.steps];
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j]!, steps[i]!];
    setDraft({ ...draft, steps });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Ticket checklists</h1>
        <p className="text-sm text-muted-foreground">
          The step-by-step questions on each kind of ticket. Edits apply to new tickets only. Admins and the Director of Operations can edit.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Checklist">
        {CHECKLIST_CATEGORIES.filter((c): c is typeof c & { id: ChecklistCategoryId } => Boolean(c.flag)).map((c) => (
          <Button key={c.id} role="tab" aria-selected={cat === c.id} variant={cat === c.id ? "default" : "outline"} size="sm" onClick={() => setCat(c.id)}>
            {c.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Chip>{category.flag && flags.enabled(category.flag) ? "On for new tickets" : "Off: new tickets use today's flow"}</Chip>
        {live.data?.row && <Chip>Version {live.data.row.version}</Chip>}
        {live.data?.pending && <span className="text-muted-foreground">Not turned on yet. Showing the starting text, read-only.</span>}
        {!canEdit && <span className="text-muted-foreground">View only.</span>}
      </div>

      {draft && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="space-y-4" aria-label="Steps">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cl-title">Name</Label>
                <Input id="cl-title" disabled={!editable} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cl-sop">Source SOP link (optional)</Label>
                <Input id="cl-sop" disabled={!editable} value={draft.sopUrl ?? ""} placeholder="https://" onChange={(e) => setDraft({ ...draft, sopUrl: e.target.value || null })} />
              </div>
            </div>
            {(draft.settings ?? []).length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3" aria-label="Settings">
                <p className="font-medium">Settings</p>
                <p className="text-xs text-muted-foreground">Used in the step text wherever {"{"}name{"}"} appears.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(draft.settings ?? []).map((st, i) => (
                    <div key={st.key} className="space-y-1">
                      <Label htmlFor={`cl-set-${st.key}`}>{st.label}</Label>
                      <Input
                        id={`cl-set-${st.key}`}
                        disabled={!editable}
                        value={st.value}
                        onChange={(e) => setDraft({ ...draft, settings: (draft.settings ?? []).map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {draft.priority && <p className="text-sm text-muted-foreground">Starting priority: {draft.priority.activeGuest.toUpperCase()} with a guest in the home or arriving within 48 hours, otherwise {draft.priority.otherwise.toUpperCase()}.</p>}

            {draft.steps.map((s, i) => (
              <StepEditor
                key={s.key + i}
                step={s}
                index={i}
                count={draft.steps.length}
                stepKeys={draft.steps.map((x) => x.key)}
                disabled={!editable}
                onChange={(n) => setStep(i, n)}
                onMove={(d) => move(i, d)}
                onRemove={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
              />
            ))}
            {editable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    steps: [...draft.steps, { key: `step_${draft.steps.length + 1}`, label: String(draft.steps.length + 1), question: "New question", options: [{ value: "yes", label: "Yes" }] }],
                  })
                }
              >
                <Plus className="size-4" /> Add step
              </Button>
            )}
            {problems.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive" aria-label="Problems">
                {problems.map((p: string) => <li key={p}>{p}</li>)}
              </ul>
            )}
            {editable && (
              <Button disabled={publish.isPending || problems.length > 0} onClick={() => publish.mutate()}>
                Publish as version {(live.data?.row?.version ?? 0) + 1}
              </Button>
            )}
          </section>

          <aside className="space-y-3 self-start rounded-lg border border-border p-4" aria-label="Preview">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Preview</p>
              <Button variant="ghost" size="sm" onClick={() => setPreviewAnswers([])}>Start over</Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={previewGuest} onChange={(e) => setPreviewGuest(e.target.checked)} /> Guest in home or arriving within 48 hours
            </label>
            <ChecklistStepView
              template={draft}
              answers={previewAnswers}
              activeGuest={previewGuest}
              facts={{ guest: previewGuest ? "Example guest, in home" : null, lockSystem: "Yale", reservation: null, lastStay: "Example guest", nextClean: null, nextArrival: null }}
              readOnly={false}
              busy={false}
              onAnswer={(step, a) =>
                setPreviewAnswers([...previewAnswers, { stepKey: step.key, value: a.value, note: a.note, fields: a.fields, answeredBy: null, answeredAt: new Date().toISOString() }])
              }
              onAction={(a) => toast.message(`On a ticket this opens: ${ACTION_LABELS[a]}`)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

/** Set or drop an optional key (exact optional property types). */
function withOpt<T extends object, K extends keyof T>(o: T, k: K, v: T[K] | undefined): T {
  const n = { ...o };
  if (v === undefined || v === "" || v === false) delete n[k];
  else n[k] = v;
  return n;
}

function StepEditor({
  step, index, count, stepKeys, disabled, onChange, onMove, onRemove,
}: {
  step: ChecklistStep; index: number; count: number; stepKeys: string[]; disabled: boolean;
  onChange: (s: ChecklistStep) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3" data-testid="step-editor">
      <div className="flex items-center gap-2">
        <Input aria-label="Step number" className="w-16" disabled={disabled} value={step.label} onChange={(e) => onChange({ ...step, label: e.target.value })} />
        <Input aria-label="Question" disabled={disabled} value={step.question} onChange={(e) => onChange({ ...step, question: e.target.value })} />
        {!disabled && (
          <>
            <Button variant="ghost" size="icon" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Remove step" onClick={onRemove}><Trash2 className="size-4" /></Button>
          </>
        )}
      </div>
      <Textarea aria-label="Help text" rows={2} disabled={disabled} placeholder="Help text (optional)" value={step.help ?? ""} onChange={(e) => onChange(withOpt(step, "help", e.target.value))} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          Opens
          <select className="rounded border border-border bg-background px-1 py-0.5" disabled={disabled} value={step.action ?? ""} onChange={(e) => onChange(withOpt(step, "action", (e.target.value || undefined) as ChecklistAction | undefined))}>
            <option value="">Nothing</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" disabled={disabled} checked={Boolean(step.guestResponse)} onChange={(e) => onChange(withOpt(step, "guestResponse", e.target.checked))} />
          Guest response step
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" disabled={disabled} checked={step.activeGuestOnly === true} onChange={(e) => onChange(withOpt(step, "activeGuestOnly", e.target.checked))} />
          Only with an active guest
        </label>
      </div>
      <ul className="space-y-1.5">
        {step.options.map((o, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <Input aria-label="Answer" className="w-56" disabled={disabled} value={o.label} onChange={(e) => onChange({ ...step, options: step.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <label className="flex items-center gap-1">
              then
              <select className="rounded border border-border bg-background px-1 py-0.5" disabled={disabled} value={o.goto ?? ""} onChange={(e) => onChange({ ...step, options: step.options.map((x, j) => (j === i ? withOpt(x, "goto", e.target.value) : x)) })}>
                <option value="">Next step</option>
                {stepKeys.filter((k) => k !== step.key).map((k) => <option key={k} value={k}>Go to {k}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" disabled={disabled} checked={Boolean(o.keepsOpen)} onChange={(e) => onChange({ ...step, options: step.options.map((x, j) => (j === i ? withOpt(x, "keepsOpen", e.target.checked) : x)) })} />
              keeps step open
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" disabled={disabled} checked={Boolean(o.noteRequired)} onChange={(e) => onChange({ ...step, options: step.options.map((x, j) => (j === i ? withOpt(x, "noteRequired", e.target.checked) : x)) })} />
              note required
            </label>
            {!disabled && step.options.length > 1 && (
              <Button variant="ghost" size="icon" aria-label="Remove answer" onClick={() => onChange({ ...step, options: step.options.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...step, options: [...step.options, { value: `opt_${step.options.length + 1}`, label: "New answer" }] })}>
          <Plus className="size-4" /> Add answer
        </Button>
      )}
    </div>
  );
}
