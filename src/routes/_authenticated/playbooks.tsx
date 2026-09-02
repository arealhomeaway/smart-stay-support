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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";
import { useSeat } from "@/hooks/useSeat";
import { CATEGORIES, labelFor } from "@/lib/tickets";
import {
  SOURCE_LABELS,
  STATUS_LABELS,
  driftWarnings,
  hasAuthoredGuidance,
  isTestPlaybook,
  parsePlaybook,
  nextTransitions,
  type AuthoredPlaybook,
  type PlaybookRow,
  type PlaybookStatus,
} from "@/lib/playbooks";

export const Route = createFileRoute("/_authenticated/playbooks")({
  head: () => ({
    meta: [
      { title: "Playbook administration — Resolve Operations" },
      {
        name: "description",
        content: "Author, review and approve the guidance that reaches frontline work.",
      },
      { property: "og:title", content: "Playbook administration — Resolve Operations" },
      { property: "og:description", content: "Draft, review, approve and retire operational guidance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Administration is supervisor work. Coordinators get guidance in context.
  component: () => (
    <RequireCapability capability="playbooks_edit" title="Playbook administration">
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
      return (data as PlaybookRow[]).map(parsePlaybook);
    },
  });
}

function PlaybooksPage() {
  const qc = useQueryClient();
  const { readOnly } = useRole();
  const seat = useSeat();
  // Only the Director of Operations may release guidance that carries policy,
  // money, safety or owner obligations. Database policy is the real guard.
  const isDirector = seat.code === "director_ops";
  const [filter, setFilter] = useState<PlaybookStatus | "all" | "attention">("attention");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = usePlaybooks();

  const visible = useMemo(() => {
    const rows = (data ?? []).filter((pb) => !isTestPlaybook(pb) || filter === "all");
    if (filter === "all") return rows;
    if (filter === "attention") return rows.filter((pb) => pb.status === "in_review" || pb.status === "draft");
    return rows.filter((pb) => pb.status === filter);
  }, [data, filter]);

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
          <h1 className="text-3xl font-semibold">Playbook administration</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {counts.in_review} awaiting review · {counts.draft} in draft · {counts.approved} guiding work
            today. Only approved guidance reaches a coordinator, and only from its effective date.
          </p>
        </div>
        {!readOnly && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4" /> New playbook
          </Button>
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
              <span className="text-sm text-muted-foreground">{labelFor(CATEGORIES, pb.category)}</span>
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
              pb={selected}
              isDirector={isDirector}
              readOnly={readOnly}
              onChanged={() => qc.invalidateQueries({ queryKey: ["playbooks-admin"] })}
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
  isDirector,
  readOnly,
  onChanged,
}: {
  pb: AuthoredPlaybook;
  isDirector: boolean;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const drift = driftWarnings(pb);

  const history = useQuery({
    queryKey: ["playbook-approvals", pb.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbook_approvals")
        .select("*")
        .eq("playbook_id", pb.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function move(to: PlaybookStatus, directorOnly: boolean) {
    if (directorOnly && !isDirector) {
      toast.error("This one needs the Director of Operations.");
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("playbooks")
      .update({
        status: to,
        review_note: note.trim() || null,
        ...(to === "in_review" ? { submitted_at: now, submitted_by: auth.user?.id ?? null } : {}),
        ...(to === "approved"
          ? { approved_at: now, approved_by: auth.user?.id ?? null, active: true }
          : {}),
        ...(to === "retired" ? { retired_at: now, active: false } : {}),
      })
      .eq("id", pb.id);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("playbook_approvals").insert({
      playbook_id: pb.id,
      from_status: pb.status,
      to_status: to,
      actor_id: auth.user?.id ?? null,
      actor_role: isDirector ? "director_ops" : "ops_supervisor",
      note: note.trim() || null,
    });
    setBusy(false);
    setNote("");
    toast.success(`Moved to ${STATUS_LABELS[to]}.`);
    onChanged();
    void history.refetch();
  }

  const transitions = nextTransitions(pb);

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
        <Row
          label="Generated"
          value={pb.generated_at ? new Date(pb.generated_at).toLocaleDateString() : null}
        />
        <Row label="Required evidence" value={pb.required_evidence.join(", ")} />
        <Row label="Effective" value={pb.effective_on} />
        <Row label="Submitted" value={pb.submitted_at ? new Date(pb.submitted_at).toLocaleString() : null} />
        <Row label="Approved" value={pb.approved_at ? new Date(pb.approved_at).toLocaleString() : null} />
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consider</p>
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Do first</p>
              <ul className="list-disc pl-5">
                {pb.immediate_actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {pb.escalate_if.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Escalate if</p>
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

      {!readOnly && transitions.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <Label htmlFor="pb-note">Review note</Label>
          <Textarea
            id="pb-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you checked, or what needs changing"
          />
          <div className="flex flex-wrap gap-2">
            {transitions.map((t: { to: PlaybookStatus; label: string; effect: string; directorOnly: boolean }) => {
              const blocked = t.directorOnly && !isDirector;
              return (
                <div key={t.to} className="space-y-1">
                  <Button
                    size="sm"
                    variant={t.to === "approved" ? "default" : "outline"}
                    disabled={busy || blocked}
                    onClick={() => move(t.to, t.directorOnly)}
                  >
                    {t.label}
                  </Button>
                  <p className="max-w-48 text-xs text-muted-foreground">
                    {blocked ? "Director of Operations only." : t.effect}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                {new Date(h.created_at).toLocaleString()}
                {h.actor_role ? ` · ${h.actor_role}` : ""}
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
  const [director, setDirector] = useState(false);

  async function save() {
    if (!title.trim()) return;
    const { error } = await supabase.from("playbooks").insert({
      title: title.trim(),
      category,
      summary: summary.trim() || null,
      status: "draft",
      active: false,
      source: "authored",
      requires_director: director,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Draft created.");
    onSaved();
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hot water heater failure" />
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
      </div>
      <div className="space-y-2">
        <Label>Summary</Label>
        <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={director} onCheckedChange={setDirector} />
        Involves policy, money, safety, owner obligations or escalation — Director approval
      </label>
      <Button onClick={save} className="w-full">
        Create draft
      </Button>
    </div>
  );
}
