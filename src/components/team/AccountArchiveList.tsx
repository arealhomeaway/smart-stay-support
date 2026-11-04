import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/ui/page";
import { USER_REMOVAL_ENABLED } from "@/lib/user-removal";
import { listArchivableAccounts, setAccountArchived } from "@/lib/user-removal.functions";
import { ARCHIVE_CONFIRM } from "@/lib/user-removal";

/** Admin only: archive or restore homeowner or vendor logins. Nothing is ever deleted. */
export function AccountArchiveList(props: { kind: "owner" | "vendor" }) {
  if (!USER_REMOVAL_ENABLED) return null;
  return <AccountArchiveListInner {...props} />;
}

function AccountArchiveListInner({ kind }: { kind: "owner" | "vendor" }) {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const list = useServerFn(listArchivableAccounts);
  const save = useServerFn(setAccountArchived);
  const [showArchived, setShowArchived] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; name: string; archive: boolean } | null>(null);
  const q = useQuery({ queryKey: ["archivable", kind], enabled: isAdmin, queryFn: () => list({ data: { kind } }) });
  const m = useMutation({
    mutationFn: (v: { id: string; archive: boolean }) => save({ data: { userId: v.id, archived: v.archive } }),
    onSuccess: (_d, v) => { toast.success(v.archive ? "Archived. Their history is unchanged." : "Restored. They can sign in again."); setConfirm(null); void qc.invalidateQueries({ queryKey: ["archivable", kind] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!isAdmin) return null;
  const who = kind === "owner" ? "Homeowner and co-owner logins" : "Vendor logins";
  const rows = (q.data?.accounts ?? []).filter((a) => showArchived || !a.archivedAt);
  return (
    <SectionCard title={who} description="Archive turns a login off and hides it from active lists. Hours, approvals, documents, work orders, invoices and payments stay as they are.">
      {q.data?.pending && <p className="mb-2 text-sm text-warning">Archiving needs a database change that is not applied yet.</p>}
      <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
      <ul className="divide-y divide-border text-sm">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="font-medium">{a.name}</span>
            <span className="text-muted-foreground">{a.email}</span>
            {a.archivedAt && <Badge variant="outline">Archived</Badge>}
            <Button size="sm" variant="outline" className="ml-auto" disabled={q.data?.pending}
              onClick={() => setConfirm({ id: a.id, name: a.name, archive: !a.archivedAt })}>
              {a.archivedAt ? "Restore" : "Archive"}
            </Button>
          </li>
        ))}
        {rows.length === 0 && <li className="py-2 text-muted-foreground">No logins to show.</li>}
      </ul>
      {confirm && (
        <Dialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.archive ? `Archive ${confirm.name}?` : `Restore ${confirm.name}?`}</DialogTitle>
              <DialogDescription>{confirm.archive ? ARCHIVE_CONFIRM : "Their login is turned back on and they appear in active lists again."}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button disabled={m.isPending} onClick={() => m.mutate({ id: confirm.id, archive: confirm.archive })}>{confirm.archive ? "Archive" : "Restore"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SectionCard>
  );
}
