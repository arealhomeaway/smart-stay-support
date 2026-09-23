/**
 * V2 handoff — two steps, no gate chain.
 *   1. Onboarding Director marks the home Ready for Operations (available once
 *      every required, handoff-blocking internal Task is complete).
 *   2. Operations Director accepts it into live operations, or logs a
 *      deficiency that becomes an internal Task for the right role. The home
 *      stays in readiness until those Tasks are done, then returns for
 *      acceptance. Active Owner Opportunities never block either step.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleAlert, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  acceptIntoOperations,
  FUNCTIONAL_ROLES,
  logHandoffDeficiency,
  markReadyForOperations,
  readHandoffV2,
  roleLabel,
} from "@/lib/v2-workflow.functions";

export function TwoStepHandoff({
  propertyId,
  readOnly = false,
  onOpenTask,
}: {
  propertyId: string;
  readOnly?: boolean;
  onOpenTask?: (taskId: string) => void;
}) {
  const qc = useQueryClient();
  const read = useServerFn(readHandoffV2);
  const ready = useServerFn(markReadyForOperations);
  const accept = useServerFn(acceptIntoOperations);
  const deficiency = useServerFn(logHandoffDeficiency);
  const key = ["handoff-v2", propertyId];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { propertyId } }) });
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [role, setRole] = useState("onboarding_project_manager");
  const [showDeficiency, setShowDeficiency] = useState(false);

  const done = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries();
  };
  const onErr = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong.");
  const markReady = useMutation({ mutationFn: (projectId: string) => ready({ data: { projectId } }), onSuccess: () => { toast.success("Marked Ready for Operations."); done(); }, onError: onErr });
  const doAccept = useMutation({ mutationFn: (projectId: string) => accept({ data: { projectId } }), onSuccess: () => { toast.success("Accepted into live operations."); done(); }, onError: onErr });
  const logDef = useMutation({
    mutationFn: (projectId: string) => deficiency({ data: { projectId, title, detail, role } }),
    onSuccess: () => {
      toast.success("Deficiency Task created and assigned.");
      setTitle("");
      setDetail("");
      setShowDeficiency(false);
      done();
    },
    onError: onErr,
  });

  if (q.isLoading) return <section className="surface p-4 text-sm text-muted-foreground">Loading handoff…</section>;
  if (q.error || !q.data) return <section className="surface p-4 text-sm text-destructive">Could not load handoff.</section>;
  const { project, blockers, canMarkReady, canAccept } = q.data;
  if (!project) return <section className="surface p-4 text-sm text-muted-foreground">No onboarding project for this home.</section>;

  const state = project.handoff_state;
  const deficiencies = blockers.filter((b) => (b.tags ?? []).includes("deficiency"));
  const otherBlockers = blockers.filter((b) => !(b.tags ?? []).includes("deficiency"));

  return (
    <section className="surface space-y-4 p-4">
      <div>
        <p className="font-medium">Handoff to Operations</p>
        <p className="text-sm text-muted-foreground">
          Two steps: the Onboarding Director marks the home ready, then the Operations Director accepts it.
          Optional work and Active Owner Opportunities never hold this up.
        </p>
      </div>

      <ol className="space-y-3">
        <li className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            {state === "in_progress" ? <CircleDot className="size-4 text-primary" /> : <CheckCircle2 className="size-4 text-state-done" />}
            <p className="text-sm font-medium">1. Ready for Operations</p>
          </div>
          {state === "in_progress" ? (
            <>
              {otherBlockers.length > 0 ? (
                <div className="mt-2 text-sm">
                  <p className="text-muted-foreground">{otherBlockers.length} required Task{otherBlockers.length === 1 ? "" : "s"} still open:</p>
                  <ul className="mt-1 space-y-1">
                    {otherBlockers.map((b) => (
                      <li key={b.id}>
                        <button type="button" className="text-left text-primary underline-offset-2 hover:underline" onClick={() => onOpenTask?.(b.id)}>
                          {b.title}
                        </button>{" "}
                        <span className="text-muted-foreground">· {roleLabel(b.assigned_seat)}{b.due_on ? ` · due ${b.due_on}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Every required handoff Task is complete.</p>
              )}
              <Button
                className="mt-3"
                size="sm"
                disabled={readOnly || !canMarkReady || otherBlockers.length > 0 || markReady.isPending}
                onClick={() => markReady.mutate(project.id)}
              >
                Mark Ready for Operations
              </Button>
              {!canMarkReady ? <p className="mt-1 text-xs text-muted-foreground">Only the Onboarding Director can take this step.</p> : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Marked ready {project.ready_for_ops_at ? new Date(project.ready_for_ops_at).toLocaleDateString() : ""}.
            </p>
          )}
        </li>

        <li className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            {state === "accepted" ? <CheckCircle2 className="size-4 text-state-done" /> : deficiencies.length > 0 ? <CircleAlert className="size-4 text-state-blocked" /> : <CircleDot className="size-4 text-muted-foreground" />}
            <p className="text-sm font-medium">2. Operations acceptance</p>
          </div>
          {state === "accepted" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Accepted into live operations {project.ops_accepted_at ? new Date(project.ops_accepted_at).toLocaleDateString() : ""}.
            </p>
          ) : state === "ready" ? (
            <>
              {deficiencies.length > 0 ? (
                <div className="mt-2 text-sm">
                  <p className="text-muted-foreground">Waiting on {deficiencies.length} deficiency Task{deficiencies.length === 1 ? "" : "s"}:</p>
                  <ul className="mt-1 space-y-1">
                    {deficiencies.map((b) => (
                      <li key={b.id}>
                        <button type="button" className="text-left text-primary underline-offset-2 hover:underline" onClick={() => onOpenTask?.(b.id)}>
                          {b.title}
                        </button>{" "}
                        <span className="text-muted-foreground">· {roleLabel(b.assigned_seat)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={readOnly || !canAccept || blockers.length > 0 || doAccept.isPending} onClick={() => doAccept.mutate(project.id)}>
                  Accept into operations
                </Button>
                <Button size="sm" variant="outline" disabled={readOnly || !canAccept} onClick={() => setShowDeficiency((v) => !v)}>
                  Log a deficiency
                </Button>
              </div>
              {!canAccept ? <p className="mt-1 text-xs text-muted-foreground">Only the Operations Director can take this step.</p> : null}
              {showDeficiency ? (
                <div className="mt-3 space-y-2 rounded-md border border-border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="def-title">What needs fixing</Label>
                    <Input id="def-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Blinds missing in primary bedroom" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="def-detail">Details</Label>
                    <Textarea id="def-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label>Assign to role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FUNCTIONAL_ROLES.filter((r) => r.code !== "owner").map((r) => (
                          <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" disabled={title.trim().length < 3 || logDef.isPending} onClick={() => logDef.mutate(project.id)}>
                    Create deficiency Task
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Available once the home is marked ready.</p>
          )}
        </li>
      </ol>
    </section>
  );
}
