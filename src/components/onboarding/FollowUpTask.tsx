/** Fix 19: "Add a follow-up Task" on the same home and stage, linked to this Task. */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveOnboardingTaskFn } from "@/lib/onboarding.functions";
import type { WorkflowTask } from "@/lib/onboarding-workflow";

type Seat = "onboarding_director" | "onboarding_manager" | "onboarding_project_manager" | "utilities" | "lead_designer" | "designer" | "staging_team";

/** The line that links a follow-up to the Task it came from. */
export const followUpLine = (title: string) => `Follow-up from: ${title}`;

export function FollowUpTask({
  task,
  people,
  roles,
}: {
  task: WorkflowTask;
  people: { id: string; full_name: string | null; email: string | null }[];
  roles: readonly { code: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState("none");
  const [due, setDue] = useState("");
  const save = useServerFn(saveOnboardingTaskFn);
  const qc = useQueryClient();
  const router = useRouter();
  const m = useMutation({
    mutationFn: () => {
      const [type, id] = who.split(":");
      return save({
        data: {
          propertyId: task.property_id,
          stage: task.stage,
          title: title.trim(),
          detail: followUpLine(task.title),
          assignedTo: type === "person" ? id : null,
          ...(type === "role" ? { assignedSeat: id as Seat } : {}),
          dueOn: due || null,
          blocker: "",
          requiresOwnerApproval: false,
          ownerApprovalStatus: "not_required",
          evidenceRequired: false,
          evidenceNote: "",
          status: "open",
          blocksHandoff: false,
          followUpOf: task.id,
        },
      } as never);
    },
    onSuccess: () => {
      toast.success("Follow-up Task added.");
      setOpen(false);
      setTitle("");
      setWho("none");
      setDue("");
      void qc.invalidateQueries();
      void router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "The follow-up Task was not added."),
  });
  if (!open)
    return (
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        Add a follow-up Task
      </Button>
    );
  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Add a follow-up Task">
      <p className="font-medium">Add a follow-up Task</p>
      <div className="space-y-1.5">
        <Label htmlFor={`fu-title-${task.id}`}>Title</Label>
        <Input id={`fu-title-${task.id}`} className="min-h-11" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Assigned to</Label>
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger className="min-h-11" aria-label="Assigned to"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {roles.map((r) => <SelectItem key={r.code} value={`role:${r.code}`}>{r.label}</SelectItem>)}
              {people.map((p) => <SelectItem key={p.id} value={`person:${p.id}`}>{p.full_name || p.email || "Teammate"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`fu-due-${task.id}`}>Due</Label>
          <Input id={`fu-due-${task.id}`} type="date" className="min-h-11" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="min-h-11" disabled={title.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>Add Task</Button>
        <Button className="min-h-11" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </section>
  );
}
