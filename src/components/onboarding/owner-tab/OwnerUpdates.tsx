/**
 * Owner updates after closing (Nov 22) on the Owner tab: the three updates with their dates and
 * status, and one window to Preview, Edit (this send only), Hold (skip it) or send a test copy.
 * Rules live in src/lib/owner-closing-updates.ts; writes go through owner-closing-updates.functions.ts.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { editOwnerUpdateFn, holdOwnerUpdateFn, readOwnerUpdatesFn, sendOwnerUpdateTestFn } from "@/lib/owner-closing-updates.functions";
import { cn } from "@/lib/utils";

export function ownerUpdatesKey(propertyId: string) {
  return ["owner-updates", propertyId] as const;
}

export function useOwnerUpdates(propertyId: string) {
  const read = useServerFn(readOwnerUpdatesFn);
  return useQuery({ queryKey: ownerUpdatesKey(propertyId), queryFn: () => read({ data: { propertyId } }), staleTime: 30_000 });
}

type Data = NonNullable<Awaited<ReturnType<typeof readOwnerUpdatesFn>>["updates"]>;
export type OwnerUpdateItem = Data["items"][number];

const STATUS: Record<OwnerUpdateItem["status"], { label: string; tone: string }> = {
  planned: { label: "Planned", tone: "bg-muted text-foreground" },
  scheduled: { label: "Scheduled", tone: "bg-info/15 text-foreground" },
  held: { label: "Held", tone: "bg-amber/20 text-foreground" },
  sending: { label: "Sending", tone: "bg-info/15 text-foreground" },
  sent: { label: "Sent", tone: "bg-success/15 text-foreground" },
  test_sent: { label: "Test copy sent", tone: "bg-success/15 text-foreground" },
  missed: { label: "Missed", tone: "bg-state-blocked/15 text-late" },
  stopped: { label: "Stopped", tone: "bg-muted text-muted-foreground" },
  failed: { label: "Not sent", tone: "bg-state-blocked/15 text-late" },
  not_scheduled: { label: "Not scheduled", tone: "bg-muted text-muted-foreground" },
};

export const fmtSendDay = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "";

/** The right column card: Closing date, then Update 1, 2 and 3 with their day and status. */
export function OwnerUpdatesCard({ propertyId, onOpen }: { propertyId: string; onOpen: (no: 1 | 2 | 3) => void }) {
  const q = useOwnerUpdates(propertyId);
  const d = q.data?.updates ?? null;
  return (
    <section className="surface space-y-3 p-4" aria-label="Owner updates">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner updates</h2>
      {q.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {q.error ? <p className="text-sm" role="alert">Could not load the owner updates.</p> : null}
      {d ? (
        <>
          <p className="text-sm">
            {d.closingOn ? <>Closing {fmtSendDay(d.closingOn)} · 9:00 AM home time</> : "No closing date yet"}
          </p>
          {d.stop ? <p className="text-sm text-muted-foreground">{d.stop} Updates stopped.</p> : null}
          <ul className="space-y-1">
            {d.items.map((i) => (
              <li key={i.no}>
                <button
                  type="button"
                  onClick={() => onOpen(i.no)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border px-3 text-left text-sm hover:bg-muted"
                >
                  <span>
                    <span className="font-medium">Update {i.no}</span>
                    {i.sendOn ? <span className="text-muted-foreground"> · {fmtSendDay(i.sendOn)}</span> : null}
                  </span>
                  <span className={cn("rounded px-2 py-0.5 text-xs font-medium", STATUS[i.status].tone)}>{STATUS[i.status].label}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {d.channel === "portal" ? "Goes to the owner's portal." : "Goes by email, from the team mailbox."}
            {d.testing ? " Testing: sends go to the test inbox only." : ""}
          </p>
        </>
      ) : null}
    </section>
  );
}

/** Preview with Edit (this send only), Hold (skips it) and a test copy. */
export function OwnerUpdateDialog(p: { propertyId: string; no: 1 | 2 | 3 | null; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const q = useOwnerUpdates(p.propertyId);
  const d = q.data?.updates ?? null;
  const canChange = q.data?.canChange ?? false;
  const item = d?.items.find((i) => i.no === p.no) ?? null;
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmHold, setConfirmHold] = useState(false);
  useEffect(() => {
    if (p.no === null) return;
    setEditing(false);
    setConfirmHold(false);
  }, [p.no]);
  useEffect(() => {
    if (item && !editing) {
      setSubject(item.subject);
      setBody(item.body);
    }
  }, [item, editing]);
  const edit = useServerFn(editOwnerUpdateFn);
  const hold = useServerFn(holdOwnerUpdateFn);
  const test = useServerFn(sendOwnerUpdateTestFn);
  const refresh = () => void qc.invalidateQueries({ queryKey: ownerUpdatesKey(p.propertyId) });
  const save = useMutation({
    mutationFn: (clear: boolean) => edit({ data: { id: item!.id!, subject: clear ? "" : subject, body: clear ? "" : body } }),
    onSuccess: (r) => {
      toast.success(r.cleared ? "Back to the template." : "Saved for this send only.");
      setEditing(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const holdIt = useMutation({
    mutationFn: () => hold({ data: { id: item!.id! } }),
    onSuccess: () => {
      toast.success(`Update ${item!.no} is held. It will not send.`);
      setConfirmHold(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendTest = useMutation({
    mutationFn: () => test({ data: { propertyId: p.propertyId, no: item!.no } }),
    onSuccess: () => toast.success("Test copy sent to the test inbox."),
    onError: (e: Error) => toast.error(e.message),
  });
  const open = p.no !== null;
  const changeable = canChange && !!item && item.status === "scheduled" && !!item.id;
  const waitingOnApproval = canChange && !!item && d && !d.staged && item.status === "planned";
  return (
    <Dialog open={open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Owner update {p.no}</DialogTitle>
          <DialogDescription>
            {item?.sendOn ? `${fmtSendDay(item.sendOn)} at 9:00 AM home time` : "Not scheduled"}
            {item ? ` · ${STATUS[item.status].label}` : ""}
          </DialogDescription>
        </DialogHeader>
        {!item || !d ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3 text-sm">
            {item.reason ? <p className="text-muted-foreground">{item.reason}</p> : null}
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">To</dt>
              <dd>{d.channel === "portal" ? "The owner's portal" : d.to.length ? d.to.join(", ") : "No owner email on file"}</dd>
              {d.channel === "email" ? (
                <>
                  <dt className="text-muted-foreground">Cc and reply</dt>
                  <dd>{d.projectManager?.email ?? "No Project Manager on this home"}</dd>
                </>
              ) : null}
              {item.heldBy ? (
                <>
                  <dt className="text-muted-foreground">Held by</dt>
                  <dd>{item.heldBy}</dd>
                </>
              ) : null}
              {item.editedBy && item.edited ? (
                <>
                  <dt className="text-muted-foreground">Edited by</dt>
                  <dd>{item.editedBy}</dd>
                </>
              ) : null}
            </dl>
            {editing ? (
              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Subject</span>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="h-11" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Message</span>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} maxLength={8000} />
                </label>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="font-medium">{item.subject}</p>
                <p className="whitespace-pre-wrap">{item.body}</p>
              </div>
            )}
            {confirmHold ? (
              <p className="rounded-md border border-amber/50 bg-amber/10 p-3" role="status">
                Hold skips update {item.no} for good. The next update still sends on its own day.
              </p>
            ) : null}
            {waitingOnApproval ? <p className="text-xs text-muted-foreground">Edit and Hold start once the Admin approves the database change.</p> : null}
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {item && d?.testing && canChange ? (
              <Button variant="outline" className="min-h-11" disabled={sendTest.isPending} onClick={() => sendTest.mutate()}>
                Send a test copy
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {changeable && editing ? (
              <>
                {item!.edited ? (
                  <Button variant="ghost" className="min-h-11" disabled={save.isPending} onClick={() => save.mutate(true)}>
                    Use the template
                  </Button>
                ) : null}
                <Button variant="ghost" className="min-h-11" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button className="min-h-11" disabled={save.isPending || subject.trim().length < 3 || body.trim().length < 20} onClick={() => save.mutate(false)}>
                  Save for this send
                </Button>
              </>
            ) : changeable && confirmHold ? (
              <>
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmHold(false)}>
                  Cancel
                </Button>
                <Button className="min-h-11" disabled={holdIt.isPending} onClick={() => holdIt.mutate()}>
                  Hold update {item!.no}
                </Button>
              </>
            ) : changeable ? (
              <>
                <Button variant="outline" className="min-h-11" onClick={() => setConfirmHold(true)}>
                  Hold
                </Button>
                <Button className="min-h-11" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              </>
            ) : (
              <Button variant="outline" className="min-h-11" onClick={() => p.onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
