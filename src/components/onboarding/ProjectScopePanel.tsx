/**
 * Onboarding Project record for one home.
 *
 * A property existing is not the same as onboarding being underway. This panel
 * is where a project is deliberately started, where its scope lives (which
 * modules apply to this home), and where every scope change is explained.
 * Presentation only — all rules live in `onboarding-scope.ts` and the server.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { stateChip } from "@/lib/semantic";
import {
  FURNISHING_SCOPES,
  SCOPE_MODULES,
  moduleLabel,
  scopeSummary,
  suggestedModules,
  type FurnishingScope,
  type ModuleKey,
} from "@/lib/onboarding-scope";
import {
  getPropertyProject,
  startOnboardingProjectFn,
  updateOnboardingProjectFn,
} from "@/lib/onboarding.functions";

type Person = { id: string; full_name: string | null; email: string | null };

export function ProjectScopePanel({
  propertyId,
  propertyName,
  people,
  canEdit,
  hints,
}: {
  propertyId: string;
  propertyName: string;
  people: Person[];
  canEdit: boolean;
  hints?: { pool_spa?: string | null; hoa?: string | null; planned_closing_on?: string | null };
}) {
  const load = useServerFn(getPropertyProject);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-project", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["onboarding-project", propertyId] });
    void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
  };

  const start = useMutation({
    mutationFn: useServerFn(startOnboardingProjectFn),
    onSuccess: () => {
      toast.success("Onboarding started.");
      setOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: useServerFn(updateOnboardingProjectFn),
    onSuccess: () => {
      toast.success("Scope updated.");
      setOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const project = data?.project ?? null;
  const events = data?.events ?? [];

  if (isLoading) return <div className="surface h-24 animate-pulse" />;

  return (
    <section className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Onboarding project</h3>
        {project ? (
          <Chip className={stateChip("active")}>Started</Chip>
        ) : (
          <Chip className={stateChip("new")}>Not started</Chip>
        )}
        {canEdit && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen(true)}>
            {project ? "Edit scope" : "Start onboarding"}
          </Button>
        )}
      </div>

      {project ? (
        <>
          <p className="text-sm text-muted-foreground">
            {scopeSummary({
              furnishing: project.furnishing_scope as FurnishingScope,
              modules: (project.modules ?? []) as ModuleKey[],
            })}
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact label="Project manager" value={personName(people, project.project_manager)} />
            <Fact label="Director" value={personName(people, project.director)} />
            <Fact label="Branch" value={project.branch ?? "—"} />
            <Fact label="Closing" value={project.planned_closing_on ?? "—"} />
            <Fact label="Possession" value={project.possession_on ?? "—"} />
            <Fact label="Target handoff" value={project.target_handoff_on ?? "—"} />
          </dl>
          {events.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3">
              {events.slice(0, 4).map((e) => (
                <li key={e.id} className="text-xs text-muted-foreground">
                  <span className="numeric">{e.created_at.slice(0, 10)}</span> — {e.summary}
                  {e.detail ? ` ${e.detail}` : ""}
                  {/* History has to be readable without opening the record:
                      say what the scope was and what it became. */}
                  {(e.prior_value || e.new_value) && (
                    <span className="block text-foreground/70">
                      {e.prior_value ?? "—"} → {e.new_value ?? "—"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This home is in Resolve, but no onboarding project has been started. Starting one records
          who is accountable and which work actually applies to {propertyName}.
        </p>
      )}

      <ScopeDialog
        open={open}
        onOpenChange={setOpen}
        propertyName={propertyName}
        people={people}
        busy={start.isPending || update.isPending}
        initial={
          project
            ? {
                furnishing: project.furnishing_scope as FurnishingScope,
                modules: (project.modules ?? []) as ModuleKey[],
                branch: project.branch ?? "",
                projectManager: project.project_manager,
                director: project.director,
                plannedClosingOn: project.planned_closing_on ?? "",
                possessionOn: project.possession_on ?? "",
                targetHandoffOn: project.target_handoff_on ?? "",
                notes: project.notes ?? "",
                externalRefs: (project.external_refs ?? {}) as Record<string, string>,
              }
            : {
                furnishing: "full_furnishing",
                modules: suggestedModules({
                  pool_spa: hints?.pool_spa ?? null,
                  hoa: hints?.hoa ?? null,
                }),
                branch: "",
                projectManager: null,
                director: null,
                plannedClosingOn: hints?.planned_closing_on ?? "",
                possessionOn: "",
                targetHandoffOn: "",
                notes: "",
                externalRefs: {},
              }
        }
        editing={Boolean(project)}
        onSubmit={(v, reason) => {
          if (project) {
            update.mutate({
              data: {
                projectId: project.id,
                branch: v.branch || null,
                projectManager: v.projectManager,
                director: v.director,
                plannedClosingOn: v.plannedClosingOn || null,
                possessionOn: v.possessionOn || null,
                targetHandoffOn: v.targetHandoffOn || null,
                furnishingScope: v.furnishing,
                modules: v.modules,
                notes: v.notes || null,
                externalRefs: v.externalRefs,
                reason: reason.trim(),
              },
            });
          } else {
            start.mutate({
              data: {
                propertyId,
                branch: v.branch || null,
                projectManager: v.projectManager,
                director: v.director,
                plannedClosingOn: v.plannedClosingOn || null,
                possessionOn: v.possessionOn || null,
                targetHandoffOn: v.targetHandoffOn || null,
                furnishingScope: v.furnishing,
                modules: v.modules,
                notes: v.notes || null,
                externalRefs: v.externalRefs,
              },
            });
          }
        }}
      />
    </section>
  );
}

type ScopeValues = {
  furnishing: FurnishingScope;
  modules: ModuleKey[];
  branch: string;
  projectManager: string | null;
  director: string | null;
  plannedClosingOn: string;
  possessionOn: string;
  targetHandoffOn: string;
  notes: string;
  externalRefs: Record<string, string>;
};

function ScopeDialog({
  open,
  onOpenChange,
  propertyName,
  people,
  initial,
  editing,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyName: string;
  people: Person[];
  initial: ScopeValues;
  editing: boolean;
  busy: boolean;
  onSubmit: (values: ScopeValues, reason: string) => void;
}) {
  const [v, setV] = useState<ScopeValues>(initial);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setV(initial);
      setReason("");
    }
    // Values are re-seeded from the record each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (key: ModuleKey) =>
    setV((prev) => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter((m) => m !== key)
        : [...prev.modules, key],
    }));

  const summary = useMemo(
    () => scopeSummary({ furnishing: v.furnishing, modules: v.modules }),
    [v.furnishing, v.modules],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit project scope" : `Start onboarding — ${propertyName}`}
          </DialogTitle>
          <DialogDescription>
            Scope decides what Resolve asks for. Anything switched off is never shown as missing
            work for this home.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="eyebrow">Furnishing</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {FURNISHING_SCOPES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setV((p) => ({ ...p, furnishing: f.value }))}
                  className={`rounded-lg border p-3 text-left text-sm ${
                    v.furnishing === f.value ? "border-primary bg-muted" : "border-border"
                  }`}
                >
                  <span className="font-medium">{f.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{f.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="eyebrow">What applies to this home</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCOPE_MODULES.map((m) => (
                <label
                  key={m.key}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5"
                >
                  <Checkbox
                    checked={v.modules.includes(m.key)}
                    onCheckedChange={() => toggle(m.key)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PersonField
              label="Project manager"
              people={people}
              value={v.projectManager}
              onChange={(id) => setV((p) => ({ ...p, projectManager: id }))}
            />
            <PersonField
              label="Director"
              people={people}
              value={v.director}
              onChange={(id) => setV((p) => ({ ...p, director: id }))}
            />
            <Field label="Branch / market">
              <Input
                value={v.branch}
                onChange={(e) => setV((p) => ({ ...p, branch: e.target.value }))}
              />
            </Field>
            <Field label="Planned closing">
              <Input
                type="date"
                value={v.plannedClosingOn}
                onChange={(e) => setV((p) => ({ ...p, plannedClosingOn: e.target.value }))}
              />
            </Field>
            <Field label="Possession / access">
              <Input
                type="date"
                value={v.possessionOn}
                onChange={(e) => setV((p) => ({ ...p, possessionOn: e.target.value }))}
              />
            </Field>
            <Field label="Target handoff">
              <Input
                type="date"
                value={v.targetHandoffOn}
                onChange={(e) => setV((p) => ({ ...p, targetHandoffOn: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              rows={2}
              value={v.notes}
              onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))}
            />
          </Field>

          <fieldset className="space-y-3">
            <legend className="eyebrow">External references</legend>
            <p className="text-xs text-muted-foreground">
              Link existing source records for context. Saving a reference does not update the
              source system.
            </p>
            {(["asana", "notion", "property_folder"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`project-ref-${key}`}>
                  {key === "property_folder"
                    ? "Property folder"
                    : key === "asana"
                      ? "Asana project"
                      : "Notion record"}
                </Label>
                <Input
                  id={`project-ref-${key}`}
                  value={v.externalRefs[key] ?? ""}
                  maxLength={300}
                  onChange={(e) =>
                    setV((p) => ({
                      ...p,
                      externalRefs: { ...p.externalRefs, [key]: e.target.value },
                    }))
                  }
                />
              </div>
            ))}
          </fieldset>

          {editing && (
            <Field label="Why is the scope changing? (required)">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Owner removed the pool from the scope of work"
                aria-invalid={reason.trim().length < 5}
              />
              <p className="pt-1 text-xs text-muted-foreground">
                A scope change is recorded in History with your name, the time, and the previous
                scope. Give a reason a teammate would understand.
              </p>
            </Field>
          )}

          <p className="text-xs text-muted-foreground">{summary}</p>
          {v.modules.includes("active_owner") && (
            <p className="text-xs text-muted-foreground">
              {moduleLabel("active_owner")}: this property will be enrolled for participation. The
              90-day clock is not started here.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || (editing && reason.trim().length < 5)}
              onClick={() => onSubmit(v, reason.trim())}
            >
              {editing ? "Save scope" : "Start onboarding"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PersonField({
  label,
  people,
  value,
  onChange,
}: {
  label: string;
  people: Person[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value ?? "none"} onValueChange={(x) => onChange(x === "none" ? null : x)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.full_name ?? p.email ?? "Team member"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="eyebrow">{label}</Label>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function personName(people: Person[], id: string | null) {
  if (!id) return "Unassigned";
  const p = people.find((x) => x.id === id);
  return p?.full_name ?? p?.email ?? "Team member";
}
