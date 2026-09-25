/**
 * What this Task needs from the homeowner. Information, feedback and
 * acknowledgment never gate the Task; only a Business Decision does.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  OWNER_DEPENDENCIES,
  SELECTABLE_DEPENDENCIES,
  effectiveDependency,
  isProtectedDecision,
  type OwnerDependency,
} from "@/lib/owner-dependency";
import { setTaskOwnerDependency } from "@/lib/owner-dependency.functions";
import type { WorkflowTask } from "@/lib/onboarding-workflow";

export function TaskOwnerDependency({ task, canManage }: { task: WorkflowTask; canManage: boolean }) {
  const current = effectiveDependency(task);
  const [choice, setChoice] = useState<OwnerDependency>(current);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const router = useRouter();
  const save = useServerFn(setTaskOwnerDependency);
  const mutation = useMutation({
    mutationFn: () => save({ data: { taskId: task.id, dependency: choice, reason: reason.trim() } }),
    onSuccess: async () => {
      toast.success("Saved. Nothing was sent to the homeowner.");
      setReason("");
      await qc.invalidateQueries();
      void router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = OWNER_DEPENDENCIES.find((d) => d.code === current)!;
  const locked = current === "business_decision" && isProtectedDecision(task.title);
  const leavingDecision = current === "business_decision" && choice !== "business_decision";
  const editable = canManage && task.status !== "complete" && !locked;

  return (
    <section className="space-y-2">
      <p className="eyebrow">Needs from the homeowner</p>
      <p className="text-sm">
        <span className="font-medium">{meta.label}</span>
        <span className="text-muted-foreground"> — {meta.blurb}</span>
      </p>
      {editable && (
        <div className="space-y-2">
          <Select value={choice} onValueChange={(v) => setChoice(v as OwnerDependency)}>
            <SelectTrigger className="h-8 w-full sm:w-72" aria-label="What this Task needs from the homeowner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OWNER_DEPENDENCIES.filter(
                (d) => SELECTABLE_DEPENDENCIES.includes(d.code) || d.code === current,
              ).map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {leavingDecision && (
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this Task does not need a homeowner decision (kept in history)"
              rows={2}
            />
          )}
          {choice !== current && (
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending || (leavingDecision && reason.trim().length < 5)}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
