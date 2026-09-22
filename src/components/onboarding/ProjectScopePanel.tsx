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
import { assignablePeople } from "@/lib/assignable-people";

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
  APPLIANCE_SCOPES,
  FURNISHING_SCOPES,
  POOL_LOCATIONS,
  SCOPE_MODULES,
  applianceScope,
  applyApplianceScope,
  applyPoolLocation,
  moduleLabel,
  poolLocation,
  scopeSummary,
  suggestedModules,
  type FurnishingScope,
  type ModuleKey,
  type PoolLocation,
} from "@/lib/onboarding-scope";

import {
  applyOnboardingTemplateFn,
  getPropertyProject,
  startOnboardingProjectFn,
  updateOnboardingProjectFn,
} from "@/lib/onboarding.functions";
import { listOnboardingTemplatesFn } from "@/lib/onboarding-template-admin.functions";

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
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
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

  // Which plan this home is set up from. On an existing project, choosing a
  // plan adds any of its steps the home is missing; a step already here is
  // never duplicated.
  const listTemplates = useServerFn(listOnboardingTemplatesFn);
  const { data: templates } = useQuery({
    queryKey: ["onboarding-templates"],
    queryFn: () => listTemplates(),
  });
  const applyPlan = useMutation({
    mutationFn: useServerFn(applyOnboardingTemplateFn),
    onSuccess: (r: { created: number }) => {
      if (r.created > 0) toast.success(`${r.created} step${r.created === 1 ? "" : "s"} added.`);
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
            <Fact
              label="Utility manager"
              value={personName(people, project.utility_manager) || "Not set"}
            />
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
        templates={(templates ?? [])
          .filter((t) => t.id && !t.isArchived)
          .map((t) => ({ id: t.id as string, name: t.name }))}
        busy={start.isPending || update.isPending || applyPlan.isPending}
        canAssign={data?.assignments.canAssign ?? false}
        initial={
          project
            ? {
                furnishing: project.furnishing_scope as FurnishingScope,
                modules: (project.modules ?? []) as ModuleKey[],
                pool: poolLocation(project),

                branch: project.branch ?? "",
                projectManager: project.project_manager,
                director: project.director,
                utilityManager: project.utility_manager ?? null,
                templateId: null,
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
                pool: poolLocation({
                  modules: suggestedModules({ pool_spa: hints?.pool_spa ?? null, hoa: null }),
                }),

                branch: "",
                projectManager: data?.assignments.projectManagerId ?? null,
                director: data?.assignments.directorId ?? null,
                utilityManager: null,
                templateId: null,
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
                utilityManager: v.utilityManager,
                plannedClosingOn: v.plannedClosingOn || null,
                possessionOn: v.possessionOn || null,
                targetHandoffOn: v.targetHandoffOn || null,
                furnishingScope: v.furnishing,
                modules: v.modules,
                poolLocation: v.pool,

                notes: v.notes || null,
                externalRefs: v.externalRefs,
                reason: reason.trim(),
              },
            });
            if (v.templateId) {
              applyPlan.mutate({ data: { propertyId, templateId: v.templateId } });
            }
          } else {
            start.mutate({
              data: {
                propertyId,
                branch: v.branch || null,
                projectManager: v.projectManager,
                director: v.director,
                utilityManager: v.utilityManager,
                plannedClosingOn: v.plannedClosingOn || null,
                possessionOn: v.possessionOn || null,
                targetHandoffOn: v.targetHandoffOn || null,
                furnishingScope: v.furnishing,
                modules: v.modules,
                poolLocation: v.pool,

                notes: v.notes || null,
                externalRefs: v.externalRefs,
                templateId: v.templateId,
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
  pool: PoolLocation;
  branch: string;
  projectManager: string | null;
  director: string | null;
  utilityManager: string | null;
  templateId: string | null;
  plannedClosingOn: string;
  possessionOn: string;
  targetHandoffOn: string;
  notes: string;
  externalRefs: Record<string, string>;
};

/** Modules that the grouped questions above already answer. */
const GROUPED_MODULES = new Set<ModuleKey>([
  "new_appliances",
  "existing_appliances",
  "pool",
  "smart_lock",
  "cameras",
]);

/** One question, answered by picking a single card. */
function ChoiceCards<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; blurb: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="eyebrow">{label}</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border p-3 text-left text-sm ${
              value === o.value ? "border-primary bg-muted" : "border-border"
            }`}
          >
            <span className="font-medium">{o.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{o.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModuleToggle({
  moduleKey,
  checked,
  onToggle,
}: {
  moduleKey: ModuleKey;
  checked: boolean;
  onToggle: () => void;
}) {
  const m = SCOPE_MODULES.find((x) => x.key === moduleKey);
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{m?.label ?? moduleKey}</span>
        <span className="block text-xs text-muted-foreground">{m?.blurb}</span>
      </span>
    </label>
  );
}


function ScopeDialog({
  open,
  onOpenChange,
  propertyName,
  people,
  initial,
  editing,
  busy,
  canAssign,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyName: string;
  people: Person[];
  initial: ScopeValues;
  editing: boolean;
  busy: boolean;
  canAssign: boolean;
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
          <ChoiceCards
            label="Furnishing"
            options={FURNISHING_SCOPES}
            value={v.furnishing}
            onChange={(furnishing) => setV((p) => ({ ...p, furnishing }))}
          />

          <ChoiceCards
            label="Appliances"
            options={APPLIANCE_SCOPES}
            value={applianceScope(v.modules)}
            onChange={(choice) =>
              setV((p) => ({ ...p, modules: applyApplianceScope(p.modules, choice) as ModuleKey[] }))
            }
          />

          <ChoiceCards
            label="Pool / hot tub"
            options={POOL_LOCATIONS}
            value={v.pool}
            onChange={(pool) =>
              setV((p) => ({
                ...p,
                pool,
                modules: applyPoolLocation(p.modules, pool) as ModuleKey[],
              }))
            }
          />

          <div className="space-y-2">
            <Label className="eyebrow">Security</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["smart_lock", "cameras"] as const).map((key) => (
                <ModuleToggle
                  key={key}
                  moduleKey={key}
                  checked={v.modules.includes(key)}
                  onToggle={() => toggle(key)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="eyebrow">Anything else that applies</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCOPE_MODULES.filter((m) => !GROUPED_MODULES.has(m.key)).map((m) => (
                <ModuleToggle
                  key={m.key}
                  moduleKey={m.key}
                  checked={v.modules.includes(m.key)}
                  onToggle={() => toggle(m.key)}
                />
              ))}
            </div>
          </div>


          <div className="space-y-2">
            <Label className="eyebrow">Onboarding plan</Label>
            <Select
              value={v.templateId ?? "default"}
              onValueChange={(id) =>
                setV((p) => ({ ...p, templateId: id === "default" ? null : id }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Default plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  {editing ? "Leave the plan as it is" : "Default plan"}
                </SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {editing
                ? "Choosing a plan adds any of its steps this home is missing. Work already here is never duplicated or removed."
                : "The plan this home's steps are created from."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PersonField
              label="Project manager"
              disabled={!canAssign}
              people={people}
              value={v.projectManager}
              onChange={(id) => setV((p) => ({ ...p, projectManager: id }))}
            />
            <PersonField
              label="Utility manager"
              disabled={false}
              people={people}
              value={v.utilityManager}
              onChange={(id) => setV((p) => ({ ...p, utilityManager: id }))}
            />
            <PersonField
              label="Director"
              disabled={!canAssign}
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

          {!canAssign && (
            <p className="text-xs text-muted-foreground">
              {editing
                ? "Project responsibility is assigned by the Onboarding Director or a platform administrator."
                : "You will be the project manager. The Director comes from the current Onboarding leadership assignment; if vacant, an administrator must assign it."}
            </p>
          )}

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
            {(["property_folder"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`project-ref-${key}`}>
                  {key === "property_folder" ? "Property folder" : key}
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
  disabled,
}: {
  label: string;
  people: Person[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}) {
  return (
    <Field label={label}>
      <Select
        disabled={disabled}
        value={value ?? "none"}
        onValueChange={(x) => onChange(x === "none" ? null : x)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {assignablePeople(people).map((p) => (
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
