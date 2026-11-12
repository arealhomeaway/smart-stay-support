/**
 * Item 1 (Nov 12): Fill in Resolve fields edited in place, with the same saves Home info uses:
 * target handoff, inspection date and verified address through the project save, the budget
 * through the Budget panel, and the default cleaner through the home's vendor coverage.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BudgetPanel } from "@/components/onboarding/BudgetPanel";
import { updateOnboardingProjectFn } from "@/lib/onboarding.functions";
import { fillInDetailsFn, setDefaultCleanerFn } from "@/lib/onboarding-task-kinds.functions";
import { usDate } from "@/lib/dates";

export const IN_PLACE_FIELDS = ["target_handoff", "inspection_date", "verified_address", "default_cleaner", "budget"] as const;

export function useFillInDetails(propertyId: string, withCleaners: boolean) {
  const read = useServerFn(fillInDetailsFn);
  return useQuery({
    queryKey: ["fill-in-details", propertyId, withCleaners],
    queryFn: () => read({ data: { propertyId, withCleaners } }),
    enabled: Boolean(propertyId),
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["fill-in-details"] });
    void qc.invalidateQueries({ queryKey: ["task-fill-in"] });
    void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    void qc.invalidateQueries({ queryKey: ["onboarding-project"] });
  };
}

export function FillInEditors({ propertyId, fields, canEdit }: { propertyId: string; fields: readonly string[]; canEdit: boolean }) {
  const wants = (f: string) => fields.includes(f);
  const q = useFillInDetails(propertyId, wants("default_cleaner"));
  const refresh = useRefresh();
  const saveProject = useServerFn(updateOnboardingProjectFn);
  const project = useMutation({
    mutationFn: (patch: { targetHandoffOn?: string | null; inspectionOn?: string | null; externalRefs?: Record<string, string> }) => {
      if (!q.data?.projectId) throw new Error("This home has no onboarding project yet.");
      return saveProject({ data: { projectId: q.data.projectId, ...patch } } as never);
    },
    onSuccess: () => {
      toast.success("Saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "This could not be saved."),
  });
  const d = q.data;
  if (!fields.some((f) => (IN_PLACE_FIELDS as readonly string[]).includes(f))) return null;
  const editable = canEdit && Boolean(d?.projectId);
  return (
    <div className="space-y-4">
      {wants("target_handoff") && (
        <DateField
          label="Target handoff"
          value={d?.targetHandoffOn ?? null}
          canEdit={editable}
          pending={project.isPending}
          onSave={(v) => project.mutate({ targetHandoffOn: v })}
        />
      )}
      {wants("inspection_date") && (
        <DateField
          label="Inspection date"
          value={d?.inspectionOn ?? null}
          canEdit={editable && Boolean(d?.inspectionReady)}
          pending={project.isPending}
          onSave={(v) => project.mutate({ inspectionOn: v })}
          unavailable={d && !d.inspectionReady ? "Not available yet." : null}
        />
      )}
      {wants("verified_address") && (
        <TextField
          label="Verified address"
          value={d?.verifiedAddress ?? null}
          canEdit={editable}
          pending={project.isPending}
          onSave={(v) => {
            const next = { ...(d?.externalRefs ?? {}) };
            if (v) next["verified_address"] = v;
            else delete next["verified_address"];
            project.mutate({ externalRefs: next });
          }}
        />
      )}
      {wants("default_cleaner") && <DefaultCleanerField propertyId={propertyId} canEdit={canEdit} />}
      {wants("budget") && <BudgetPanel propertyId={propertyId} canEdit={canEdit} />}
    </div>
  );
}

/** The home's default cleaner: shown to everyone, set by those who may edit vendor coverage. */
export function DefaultCleanerField({ propertyId, canEdit }: { propertyId: string; canEdit: boolean }) {
  const q = useFillInDetails(propertyId, true);
  const refresh = useRefresh();
  const set = useServerFn(setDefaultCleanerFn);
  const [pick, setPick] = useState("none");
  useEffect(() => setPick(q.data?.defaultCleaner?.orgId ?? "none"), [q.data?.defaultCleaner?.orgId]);
  const m = useMutation({
    mutationFn: (orgId: string) => set({ data: { propertyId, orgId } }),
    onSuccess: () => {
      toast.success("Default cleaner saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "The default cleaner could not be saved."),
  });
  const d = q.data;
  const current = d?.defaultCleaner ?? null;
  const options = d?.cleanerOptions ?? [];
  const mayEdit = canEdit && Boolean(d?.canSetCleaner);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Default cleaner</Label>
      {mayEdit && options.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={pick} onValueChange={setPick} disabled={m.isPending}>
            <SelectTrigger className="h-11 w-full sm:w-72" aria-label="Default cleaner"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.orgId} value={o.orgId}>{o.name}</SelectItem>
              ))}
              {current && !options.some((o) => o.orgId === current.orgId) && <SelectItem value={current.orgId}>{current.name}</SelectItem>}
            </SelectContent>
          </Select>
          {pick !== "none" && pick !== (current?.orgId ?? "none") && (
            <Button className="h-11" disabled={m.isPending} onClick={() => m.mutate(pick)}>Save default cleaner</Button>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium">
          {current?.name ?? (d && mayEdit && options.length === 0 ? "No cleaning vendor covers this market yet." : "Not set")}
        </p>
      )}
    </div>
  );
}

function DateField({ label, value, canEdit, pending, onSave, unavailable = null }: { label: string; value: string | null; canEdit: boolean; pending: boolean; onSave: (v: string | null) => void; unavailable?: string | null }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const id = `fill-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input id={id} type="date" className="h-11 w-48" value={draft} onChange={(e) => setDraft(e.target.value)} />
          {(draft || null) !== (value ?? null) && (
            <Button className="h-11" disabled={pending} onClick={() => onSave(draft || null)}>Save {label.toLowerCase()}</Button>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium">{value ? usDate(value) : unavailable ?? "Not set"}</p>
      )}
    </div>
  );
}

function TextField({ label, value, canEdit, pending, onSave }: { label: string; value: string | null; canEdit: boolean; pending: boolean; onSave: (v: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const id = `fill-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input id={id} className="h-11 min-w-0 flex-1" maxLength={300} value={draft} onChange={(e) => setDraft(e.target.value)} />
          {draft.trim() !== (value ?? "").trim() && (
            <Button className="h-11" disabled={pending} onClick={() => onSave(draft.trim() || null)}>Save {label.toLowerCase()}</Button>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium">{value || "Not set"}</p>
      )}
    </div>
  );
}
