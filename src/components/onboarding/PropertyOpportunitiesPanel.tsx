/**
 * Active Owner Opportunities for one home, managed from its Onboarding
 * workspace. Shares the editor and status view with the Task drawer's Owner
 * collaboration section. Opportunity status never controls the internal Task.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { ownerPrograms } from "@/lib/owner-program.functions";
import { OpportunityDetail, OpportunityEditor, ownerState, useOwnerCollaboration, type CollabOpp } from "@/components/onboarding/OwnerCollaboration";

function fmt(d: string | null | undefined) {
  if (!d) return null;
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PropertyOpportunitiesPanel({ propertyId }: { propertyId: string }) {
  const loadPrograms = useServerFn(ownerPrograms);
  const [editing, setEditing] = useState<CollabOpp | "new" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const programs = useQuery({ queryKey: ["owner-programs", "property", propertyId], queryFn: () => loadPrograms({ data: {} }) });
  const program = (programs.data?.rows ?? []).find((p) => p.properties.some((h) => h.id === propertyId));
  const q = useOwnerCollaboration(propertyId);

  if (!programs.isLoading && !program) return null;

  const opps = q.data?.opportunities ?? [];
  const drafts = opps.filter((o) => o.status === "draft");
  const available = opps.filter((o) => o.status !== "draft" && o.status !== "complete");
  const completed = opps.filter((o) => o.status === "complete");
  const closing = q.data?.actualClosingOn ?? program?.startedOn ?? q.data?.plannedClosingOn ?? null;
  const taskTitle = (id: string | null) => q.data?.tasks.find((t) => t.id === id)?.title;

  const row = (o: CollabOpp) => (
    <li key={o.id} className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{o.title}</p>
          <p className="text-xs text-muted-foreground">
            {ownerState(o)}
            {taskTitle(o.taskId) ? ` · Related Task: ${taskTitle(o.taskId)}` : ""}
            {o.source === "arha" ? " · From your ARHA team" : ""}
          </p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>{expanded === o.id ? "Hide" : "Details"}</Button>
          {o.status !== "complete" ? <Button size="sm" variant="outline" onClick={() => setEditing(o)}>{o.status === "draft" ? "Edit draft" : "Edit"}</Button> : null}
        </div>
      </div>
      {expanded === o.id ? <div className="mt-2"><OpportunityDetail o={o} files={q.data?.files ?? []} /></div> : null}
    </li>
  );

  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><Sparkles className="size-4" aria-hidden="true" /> Active Owner Opportunities</span>}
      description="The homeowner's own ways to take part. Separate from ARHA's Tasks — they never block or change internal work."
      actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Create Opportunity</Button>}
    >
      <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Active Owner</dt><dd className="font-medium">{program?.ownerName ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Program period</dt><dd className="font-medium">{fmt(closing) ?? "Closing date not set"} → Dec 31, 2026</dd></div>
        <div><dt className="text-muted-foreground">Hours logged</dt><dd className="numeric font-medium">{(program?.reportedHours ?? 0).toFixed(1)} / 100+ hours</dd></div>
      </dl>
      <div className="space-y-4">
        {drafts.length ? <div><h3 className="mb-2 text-sm font-semibold">Drafts (not visible to the homeowner)</h3><ul className="space-y-2">{drafts.map(row)}</ul></div> : null}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Sent to the homeowner ({available.length})</h3>
          {available.length ? <ul className="space-y-2">{available.map(row)}</ul> : <p className="text-sm text-muted-foreground">None sent yet. Use Create Opportunity.</p>}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Completed ({completed.length})</h3>
          {completed.length ? <ul className="space-y-2">{completed.map(row)}</ul> : <p className="text-sm text-muted-foreground">None completed yet.</p>}
        </div>
      </div>
      <OpportunityEditor propertyId={propertyId} data={q.data} editing={editing} onClose={() => setEditing(null)} />
    </SectionCard>
  );
}
