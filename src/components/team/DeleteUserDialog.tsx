import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteStaffUser, reassignStaffOpenWork, staffOpenWork } from "@/lib/user-removal.functions";
import { canDeleteNow, DELETE_CONFIRM, OPEN_WORK_LABEL, type OpenWorkItem } from "@/lib/user-removal";

/** Admin only. Blocked while the person owns open work; offers one-click reassignment. */
export function DeleteUserDialog({ userId, name, onClose, onDeleted }: { userId: string; name: string; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const load = useServerFn(staffOpenWork);
  const reassign = useServerFn(reassignStaffOpenWork);
  const del = useServerFn(deleteStaffUser);
  const key = ["staff-open-work", userId];
  const work = useQuery({ queryKey: key, queryFn: () => load({ data: { userId } }) });
  const move = useMutation({
    mutationFn: () => reassign({ data: { userId } }),
    onSuccess: (r) => { toast.success(`${r.moved} items reassigned.`); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { userId } }),
    onSuccess: () => { toast.success(`${name} was deleted. Their history now shows "${name} (former)".`); onDeleted(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const items = (work.data?.items ?? []) as OpenWorkItem[];
  const link = (i: OpenWorkItem) =>
    i.kind === "ticket" ? <Link to="/tickets/$ticketId" params={{ ticketId: i.item_id }} className="text-primary hover:underline">{i.label}</Link> : <span>{i.label}</span>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col">
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>{DELETE_CONFIRM}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto text-sm">
          {work.isLoading ? <Skeleton className="h-16 w-full" /> : work.data?.pending ? (
            <p className="text-warning">Delete needs a database change that is not applied yet.</p>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              <p className="font-medium text-danger">{name} still owns {items.length} open {items.length === 1 ? "item" : "items"}. Reassign them before deleting.</p>
              <ul className="space-y-1">
                {items.map((i) => <li key={i.kind + i.item_id}><span className="text-muted-foreground">{OPEN_WORK_LABEL[i.kind]}:</span> {link(i)}</li>)}
              </ul>
              <p className="text-xs text-muted-foreground">One click hands tickets to their role, then the backup role, then the Operations Supervisor. Tasks go to the Director of Onboarding, Work Orders and approvals to the Operations Supervisor, and their roles are cleared. You can also reassign each item yourself.</p>
              <Button size="sm" variant="outline" disabled={move.isPending} onClick={() => move.mutate()}>Reassign all to the role or backup</Button>
            </div>
          ) : (
            <p>Nothing open is left in their name.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!work.data || work.data.pending || !canDeleteNow(items) || remove.isPending} onClick={() => remove.mutate()}>Delete user</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
