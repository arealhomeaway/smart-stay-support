/**
 * Playbook administration.
 *
 * Authoring, review and approval of the judgment layer. Frontline coordinators
 * never come here — they see approved guidance contextually inside their work.
 * Ordinary procedural guidance is a supervisor decision; anything touching
 * policy, spending authority, safety, owner obligations, compensation,
 * escalation thresholds or material risk needs the Director of Operations.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { usDate, usDateTime } from "@/lib/dates";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";
import { useServerFn } from "@tanstack/react-start";
import { PlaybookEditor } from "@/components/playbooks/PlaybookEditor";
import { SopVersionComparison } from "@/components/playbooks/SopVersionComparison";
import { SopUpload } from "@/components/playbooks/SopUpload";
import { getSopPlaybookLinks } from "@/lib/sop-upload.functions";
import { sopNeedsReview, type SopLink } from "@/lib/sop-upload";
import { canManagePlaybooks, canSavePlaybooks, playbookEditContent, type PlaybookContent, type PlaybookStepEdit } from "@/lib/playbook-editing";
import { savePlaybookEdit, changePlaybookState } from "@/lib/playbook-editing.functions";
import { CATEGORIES, labelFor } from "@/lib/tickets";
import { FieldHint } from "@/components/FieldHint";
import {
  SOURCE_LABELS,
  STATUS_LABELS,
  driftWarnings,
  hasAuthoredGuidance,
  isTestPlaybook,
  parsePlaybook,
  type AuthoredPlaybook,
  type PlaybookRow,
  type PlaybookStatus,
} from "@/lib/playbooks";

export const Route = createFileRoute("/_authenticated/playbooks")({
  head: () => ({
    meta: [
      { title: "Playbook administration | Resolve Operations" },
      {
        name: "description",
        content: "Author, review and approve the guidance that reaches frontline work.",
      },
      { property: "og:title", content: "Playbook administration | Resolve Operations" },
      {
        property: "og:description",
        content: "Draft, review, approve and retire operational guidance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Every staff account can read the library. Saving, approving and review
  // notes are checked below and by the database.
  component: () => (
    <RequireCapability capability="playbooks_view" title="Playbooks">
      <PlaybooksPage />
    </RequireCapability>
  ),
});

const FILTERS: { value: PlaybookStatus | "all" | "attention"; label: string }[] = [
  { value: "attention", label: "Needs a decision" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "retired", label: "Retired" },
  { value: "all", label: "Everything" },
];

function statusTone(status: PlaybookStatus) {
  switch (status) {
    case "approved":
      return "border-success/30 bg-success/10 text-success";
    case "in_review":
      return "border-warning/40 bg-warning/10";
    case "retired":
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-border";
  }
}

function usePlaybooks() {
  return useQuery({
    queryKey: ["playbooks-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as (PlaybookRow & { updated_at: string })[]).map((row) => ({ ...parsePlaybook(row), updatedAt: row.updated_at })).filter((p) => !p.isChecklist);
    },
  });
}

function PlaybooksPage() {
  const qc = useQueryClient();
  const { readOnly: previewOnly, roles, access, can } = useRole();
  // Approval and SOP upload use the caller-checked Admin/Director rule;
  // saving drafts also allows the Operations Supervisor.
  const isDirector = canManagePlaybooks(roles, access.seats);
  const canSave = canSavePlaybooks(roles, access.seats);
  // The library opens read only for people without playbook administration.
  const libraryOnly = !can("playbooks_edit");
  const readOnly = previewOnly || libraryOnly;
  const [filter, setFilter] = useState<PlaybookStatus | "all" | "attention">(libraryOnly ? "approved" : "attention");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editUploaded, setEditUploaded] = useState<string | null>(null);
  const readLinks = useServerFn(getSopPlaybookLinks);
  const links = useQuery({ queryKey: ["sop-playbook-links"], queryFn: () => readLinks() });

  const { data, isLoading } = usePlaybooks();

  const visible = useMemo(() => {
    const rows = (data ?? []).filter((pb) => !isTestPlaybook(pb) || filter === "all");
    if (filter === "all") return rows;
    if (filter === "attention")
      return rows.filter((pb) => pb.status === "in_review" || pb.status === "draft" || sopNeedsReview(links.data?.[pb.id], pb.status));
    return rows.filter((pb) => pb.status === filter);
  }, [data, filter, links.data]);

  const selected = (data ?? []).find((pb) => pb.id === openId) ?? null;

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const counts = {
    draft: data.filter((p) => p.status === "draft").length,
    in_review: data.filter((p) => p.status === "in_review").length,
    approved: data.filter((p) => p.status === "approved").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{libraryOnly ? "Playbooks" : "Playbook administration"}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {libraryOnly
              ? `${counts.approved} playbooks guiding work today.`
              : `${counts.in_review} awaiting review · ${counts.draft} in draft · ${counts.approved} guiding work today. Only approved guidance reaches a coordinator, and only from its effective date.`}
          </p>
        </div>
        {!readOnly && canSave && (
          <div className="flex flex-wrap items-start gap-2">
          {isDirector && <SopUpload onSaved={(receipt) => { setFilter("all"); setOpenId(receipt.draftIds[0] ?? null); setEditUploaded(receipt.draftIds[0] ?? null); void qc.invalidateQueries({ queryKey: ["playbooks-admin"] }); void qc.invalidateQueries({ queryKey: ["sop-playbook-links"] }); toast.success(`${receipt.draftIds.length} draft playbooks created.`); }} />}
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4" /> New playbook
          </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          Nothing here.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((pb) => (
            <button
              key={pb.id}
              onClick={() => setOpenId(pb.id)}
              className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
            >
              <Badge variant="outline" className={statusTone(pb.status)}>
                {STATUS_LABELS[pb.status]}
              </Badge>
              <span className="font-medium">{pb.title}</span>
              {sopNeedsReview(links.data?.[pb.id], pb.status) && <Badge variant="outline" className="border-warning/40 text-warning">Needs review</Badge>}
              <span className="text-sm text-muted-foreground">
                {labelFor(CATEGORIES, pb.category)}
              </span>
              {pb.requires_director && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <ShieldCheck className="size-3" /> Director
                </Badge>
              )}
              {pb.source !== "authored" && (
                <Badge variant="outline" className="text-xs">
                  {SOURCE_LABELS[pb.source]}
                </Badge>
              )}
              {driftWarnings(pb).length > 0 && (
                <Badge variant="outline" className="gap-1 border-warning/40 bg-warning/10 text-xs">
                  <AlertTriangle className="size-3" /> Drift
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">v{pb.version}</span>
            </button>
          ))}
        </div>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <PlaybookDetail
              key={selected.id}
              pb={selected}
              updatedAt={selected.updatedAt}
              isDirector={isDirector}
              readOnly={readOnly}
              sopLink={links.data?.[selected.id]}
              initialEditing={editUploaded === selected.id}
              activeVersion={(data ?? []).find((p) => p.id === selected.supersedes_id) ?? null}
              suggestedDraft={(data ?? []).find((p) => p.supersedes_id === selected.id && p.status === "draft") ?? null}
              onChanged={(id) => { if (id) setOpenId(id); void qc.invalidateQueries({ queryKey: ["playbooks-admin"] }); void qc.invalidateQueries({ queryKey: ["playbooks-contextual"] }); void qc.invalidateQueries({ queryKey: ["playbooks"] }); void qc.invalidateQueries({ queryKey: ["work-types"] }); }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showNew} onOpenChange={setShowNew}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New playbook</SheetTitle>
            <SheetDescription>
              It starts as a draft. Nothing reaches the frontline until it is approved.
            </SheetDescription>
          </SheetHeader>
          <NewPlaybook
            onSaved={() => {
              setShowNew(false);
              void qc.invalidateQueries({ queryKey: ["playbooks-admin"] });
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PlaybookDetail({
  pb,
  updatedAt,
  isDirector,
  readOnly,
  onChanged,
  sopLink,
  initialEditing,
  activeVersion,
  suggestedDraft,
}: {
  pb: AuthoredPlaybook;
  updatedAt: string;
  isDirector: boolean;
  readOnly: boolean;
  onChanged: (id?: string) => void;
  sopLink?: SopLink | undefined;
  initialEditing?: boolean;
  activeVersion: AuthoredPlaybook | null;
  suggestedDraft: AuthoredPlaybook | null;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const drift = driftWarnings(pb);
  const [editing, setEditing] = useState(Boolean(initialEditing));
  const saveEdit = useServerFn(savePlaybookEdit);
  const changeState = useServerFn(changePlaybookState);
  const qc = useQueryClient();
  const steps = useQuery({ queryKey: ["playbook-editor-steps", pb.id], queryFn: async () => {
    const { data, error } = await supabase.from("playbook_steps").select("instruction, detail, required, photo_required").eq("playbook_id", pb.id).order("position");
    if (error) throw error; return data as PlaybookStepEdit[];
  }});
  async function save(content: PlaybookContent) {
    setBusy(true);
    try {
      const result = await saveEdit({ data: { id: pb.id, expectedUpdatedAt: updatedAt, content } });
      setEditing(false); toast.success(result.created ? `Draft version ${result.version} created.` : "Draft saved.");
      void qc.invalidateQueries({ queryKey: ["playbook-editor-steps", result.id] }); onChanged(result.id);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save the draft."); }
    finally { setBusy(false); }
  }

  const history = useQuery({
    queryKey: ["playbook-approvals", pb.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbook_approvals")
        .select("*")
        .eq("playbook_id", pb.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).flatMap((row) => row.actor_id ? [row.actor_id] : []))];
      const people = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [], error: null };
      if (people.error) throw people.error;
      return (data ?? []).map((row) => ({ ...row, actorName: people.data?.find((person) => person.id === row.actor_id)?.full_name }));
    },
  });

  async function move(action: "approve" | "archive" | "note" | "submit") {
    setBusy(true);
    try {
      await changeState({ data: { id: pb.id, expectedUpdatedAt: updatedAt, action, note } });
      toast.success(action === "approve" ? "Approved and made active." : action === "archive" ? "Playbook archived." : action === "submit" ? "Sent for review." : "Review note saved.");
      setNote(""); onChanged(); void history.refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save this change."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <SheetHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusTone(pb.status)}>
            {STATUS_LABELS[pb.status]}
          </Badge>
          {pb.requires_director && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="size-3" /> Director approval
            </Badge>
          )}
        </div>
        <SheetTitle>{pb.title}</SheetTitle>
        <SheetDescription>{pb.summary ?? "No summary written yet."}</SheetDescription>
      </SheetHeader>

      {sopLink && <div className="space-y-2 border-b border-border pb-4"><p className="text-sm">Created from SOP: {sopLink.title} v{sopLink.version}</p><a href={sopLink.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Open SOP in SharePoint</a>
        {sopNeedsReview(sopLink, pb.status) && <p className="text-sm text-warning">Needs review</p>}
        {suggestedDraft && <Button variant="outline" onClick={() => onChanged(suggestedDraft.id)}>Review suggested changes</Button>}
      </div>}
      {sopLink && activeVersion && <SopVersionComparison active={activeVersion} draft={pb} />}
      {sopLink && suggestedDraft && <SopVersionComparison active={pb} draft={suggestedDraft} />}

      {isDirector && !readOnly && !editing && <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={steps.isLoading || steps.isError || busy} onClick={() => setEditing(true)}>Edit</Button>
        {(pb.status === "draft" || pb.status === "in_review") && <Button disabled={busy} onClick={() => move("approve")}>Approve and make active</Button>}
        {pb.status !== "retired" && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Archive this playbook? It will no longer guide new work.")) void move("archive"); }}>Archive</Button>}
      </div>}
      {steps.isError && <p role="alert" className="text-sm text-destructive">Could not load the steps. Reopen this playbook to try again.</p>}
      {editing && !steps.data ? <Skeleton className="h-40 w-full" /> : editing ? <PlaybookEditor initial={playbookEditContent(pb, steps.data ?? [])} busy={busy} onSave={save} onCancel={() => setEditing(false)} /> : <>

      {drift.length > 0 && (
        <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">Withheld from the frontline until this is fixed</p>
          {drift.map((d) => (
            <p key={d} className="text-muted-foreground">
              {d}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Row label="Category" value={labelFor(CATEGORIES, pb.category)} />
        <Row label="Applies to" value={pb.applies_to.join(", ")} />
        <Row label="Version" value={`v${pb.version}`} />
        <Row label="Source" value={SOURCE_LABELS[pb.source]} />
        <Row label="Source refs" value={pb.source_refs.join(", ")} />
        <Row label="Source version" value={pb.source_version} />
        <Row label="Generated" value={pb.generated_at ? usDate(pb.generated_at) : null} />
        <Row label="Required evidence" value={pb.required_evidence.join(", ")} />
        <Row label="Effective" value={pb.effective_on ? usDate(pb.effective_on) : null} />
        <Row label="Submitted" value={pb.submitted_at ? usDateTime(pb.submitted_at) : null} />
        <Row label="Approved" value={pb.approved_at ? usDateTime(pb.approved_at) : null} />
        <Row
          label="Matching"
          value={
            Object.keys(pb.matcher).length
              ? Object.entries(pb.matcher)
                  .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
                  .join(" · ")
              : "No matching rule — this will never surface in context."
          }
        />
      </div>

      {hasAuthoredGuidance(pb) ? (
        <div className="space-y-3 text-sm">
          {pb.risk_flags.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Consider
              </p>
              <ul className="list-disc pl-5">
                {pb.risk_flags.map((f) => (
                  <li key={f.title}>
                    {f.title}
                    {f.why ? ` — ${f.why}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pb.immediate_actions.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Do first
              </p>
              <ul className="list-disc pl-5">
                {pb.immediate_actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {pb.escalate_if.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Escalate if
              </p>
              <ul className="list-disc pl-5">
                {pb.escalate_if.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {pb.vendor_brief?.evidence_required?.length ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Required evidence
              </p>
              <ul className="list-disc pl-5">
                {pb.vendor_brief.evidence_required.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No authored judgment yet — this carries steps only, so it will not show as guidance.
        </p>
      )}

      <div className="space-y-3"><h3 className="font-medium">Ordered steps</h3>
        {(steps.data ?? []).map((step, i) => <div key={i} className="text-sm"><p>{i + 1}. {step.instruction}{step.required ? " (required)" : ""}</p>{step.detail && <p className="text-muted-foreground">{step.detail}</p>}</div>)}
        {steps.data?.length === 0 && <p className="text-sm text-muted-foreground">No steps written yet.</p>}
      </div>
      {!readOnly && <div className="space-y-3 border-t border-border pt-4">
        <Label htmlFor="pb-note">Review note</Label><Textarea id="pb-note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2"><Button variant="outline" disabled={busy || !note.trim()} onClick={() => move("note")}>Save review note</Button>
        {pb.status === "draft" && <Button variant="outline" disabled={busy} onClick={() => move("submit")}>Send for review</Button>}</div>
      </div>}
      </>}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Approval history
        </p>
        {(history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(history.data ?? []).map((h) => (
              <li key={h.id} className="text-muted-foreground">
                {STATUS_LABELS[(h.from_status as PlaybookStatus) ?? "draft"]} →{" "}
                {STATUS_LABELS[(h.to_status as PlaybookStatus) ?? "draft"]} ·{" "}
                {usDateTime(h.created_at)}
                {` · v${(h as unknown as { version?: number }).version ?? pb.version}`}
                {h.actorName ? ` · ${h.actorName}` : h.actor_role ? ` · ${h.actor_role}` : ""}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewPlaybook({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [summary, setSummary] = useState("");
  const create = useServerFn(savePlaybookEdit);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await create({ data: { id: null, expectedUpdatedAt: null, content: { title: title.trim(), category, summary: summary.trim() || null, applies_to: ["ticket"], keywords: [], risk_flags: [], immediate_actions: [], escalate_if: [], required_evidence: [], steps: [] } } });
      toast.success("Draft created."); onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not create the draft."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hot water heater failure"
        />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <FieldHint guide="ticket.category" />
      </div>
      <div className="space-y-2">
        <Label>Summary</Label>
        <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <Button onClick={save} disabled={busy} className="w-full">
        Create draft
      </Button>
    </div>
  );
}
