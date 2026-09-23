import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readProjectTeam, setProjectRoleAssignee } from "@/lib/onboarding-team.functions";

const NONE = "__none__";

/** One home's Project Team: the person on each functional role for this project. */
export function ProjectTeamPanel({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const readFn = useServerFn(readProjectTeam);
  const setFn = useServerFn(setProjectRoleAssignee);
  const q = useQuery({
    queryKey: ["project-team", propertyId],
    queryFn: () => readFn({ data: { propertyId } }),
  });
  const [pending, setPending] = useState<Record<string, string>>({});
  const [reassign, setReassign] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: (v: { roleCode: string; userId: string | null; reassignPending: boolean }) =>
      setFn({ data: { projectId: q.data!.projectId, ...v } }),
    onSuccess: (r, v) => {
      toast.success(
        v.reassignPending ? `Saved. ${r.moved} unfinished Task(s) moved.` : "Project Team updated.",
      );
      setPending((p) => {
        const n = { ...p };
        delete n[v.roleCode];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["project-team", propertyId] });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!q.data) return null;
  const { roles, canEdit } = q.data;

  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Project Team">
      <div className="mb-1 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Project Team</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Who does each role on this home. Tasks for a role go to the person set here.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((r) => {
          const choice = pending[r.code] ?? r.assignee ?? NONE;
          const changed = r.code in pending && (pending[r.code] === NONE ? null : pending[r.code]) !== r.assignee;
          return (
            <div key={r.code} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                {!r.assignee && <span className="text-xs text-destructive">Unassigned</span>}
              </div>
              <Select
                value={choice}
                disabled={!canEdit}
                onValueChange={(v) => {
                  setPending((p) => ({ ...p, [r.code]: v }));
                  setReassign((p) => ({ ...p, [r.code]: p[r.code] ?? true }));
                }}
              >
                <SelectTrigger aria-label={`${r.name} for this home`}>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No one</SelectItem>
                  {r.pool.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email ?? "Team member"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {r.pool.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No one is in this role yet. Add people on the Onboarding Team page.
                </p>
              )}
              {changed && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={reassign[r.code] ?? true}
                      onCheckedChange={(c) => setReassign((p) => ({ ...p, [r.code]: c === true }))}
                    />
                    Move this home's unfinished {r.name} Tasks to them
                  </label>
                  <Button
                    size="sm"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({
                        roleCode: r.code,
                        userId: choice === NONE ? null : choice,
                        reassignPending: reassign[r.code] ?? true,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
