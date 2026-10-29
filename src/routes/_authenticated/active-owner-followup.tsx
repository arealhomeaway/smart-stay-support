import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addFollowupOneOff, getActiveOwnerFollowup, updateFollowupItem } from "@/lib/after-handoff.functions";
import { SENDING_OFF_BANNER, scheduledNext30, sentRows, sourceLabel, waitingOnHomeowner, type ScheduleRow } from "@/lib/after-handoff";

export const Route = createFileRoute("/_authenticated/active-owner-followup")({
  head: () => ({
    meta: [
      { title: "Active Owner follow-up — Resolve" },
      { name: "description", content: "Scheduled after-handoff owner tasks and homeowner items waiting for a reply, across all homes." },
      { property: "og:title", content: "Active Owner follow-up — Resolve" },
      { property: "og:description", content: "Follow up on after-handoff owner tasks across all homes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="owner_programs">
      <FollowupPage />
    </RequireCapability>
  ),
});

const todayChicago = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());

type Edit = { row: ScheduleRow; action: "reschedule" | "skip" | "cancel"; sendOn: string; note: string };
type OneOff = { programHome: string; sourceKey: string; sendOn: string; note: string };

function FollowupPage() {
  const qc = useQueryClient();
  const load = useServerFn(getActiveOwnerFollowup);
  const update = useServerFn(updateFollowupItem);
  const addOne = useServerFn(addFollowupOneOff);
  const q = useQuery({ queryKey: ["active-owner-followup"], queryFn: () => load() });
  const [edit, setEdit] = useState<Edit | null>(null);
  const [oneOff, setOneOff] = useState<OneOff | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["active-owner-followup"] });
  const onError = (e: Error) => toast.error(e.message);
  const updateM = useMutation({
    mutationFn: (e: Edit) => update({ data: { id: e.row.id, action: e.action, send_on: e.action === "reschedule" ? e.sendOn : null, note: e.note } }),
    onSuccess: () => { toast.success("Saved"); setEdit(null); refresh(); },
    onError,
  });
  const oneOffM = useMutation({
    mutationFn: (o: OneOff) => {
      const [program_id, property_id] = o.programHome.split(":") as [string, string];
      const [source_kind, source_id] = o.sourceKey.split(":") as ["template" | "library", string];
      return addOne({ data: { program_id, property_id, source_kind, source_id, send_on: o.sendOn, note: o.note } });
    },
    onSuccess: () => { toast.success("One-off added"); setOneOff(null); refresh(); },
    onError,
  });

  if (q.isLoading) return <LoadingPage />;
  if (q.error) return <EmptyState title="Could not load follow-up" hint={(q.error as Error).message} />;
  const data = q.data;
  const header = <PageHeader eyebrow="Operations" title="Active Owner follow-up" description="After-handoff owner tasks and homeowner items waiting for a reply, across all homes." />;
  if (!data || !data.enabled)
    return <div className="space-y-6">{header}<EmptyState title="Not switched on yet" hint="This page will fill in once the after-handoff plan is turned on." /></div>;

  if (!data.canManage)
    return <div className="space-y-6">{header}<EmptyState title="Not available" hint="This page is for the Active Owner follow-up seat, its cover, the Director of Operations and Admins." /></div>;

  const today = todayChicago();
  const home = (id: string | null) => (id ? data.homes[id] ?? "Home" : "Home");
  const scheduled = scheduledNext30(data.rows, today);
  const sent = sentRows(data.rows);
  const waiting = waitingOnHomeowner(data.waiting, today);
  const programHomes = data.programs.filter((p) => p.property_id).map((p) => ({ key: `${p.id}:${p.property_id}`, label: `${p.owner_name ?? "Owner"}, ${home(p.property_id)}` }));

  return (
    <div className="space-y-6">
      {header}
      <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium">{SENDING_OFF_BANNER}</div>

      <SectionCard
        title="Scheduled"
        description="Next 30 days, by send date."
        actions={data.canManage ? (
          <Button size="sm" variant="outline" onClick={() => setOneOff({ programHome: "", sourceKey: "", sendOn: today, note: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Add a one-off
          </Button>
        ) : null}
      >
        {scheduled.length === 0 ? <EmptyState title="Nothing scheduled" hint="Homes handed off after the plan is set will show here." /> : (
          <ul className="divide-y">
            {scheduled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <Badge variant="outline">{r.send_on}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.title}{r.one_off ? " (one-off)" : ""}</p>
                  <p className="text-xs text-muted-foreground">{home(r.property_id)} · {sourceLabel(r.source_kind)}</p>
                </div>
                {data.canManage && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEdit({ row: r, action: "reschedule", sendOn: r.send_on, note: "" })}>Reschedule</Button>
                    <Button size="sm" variant="outline" onClick={() => setEdit({ row: r, action: "skip", sendOn: r.send_on, note: "" })}>Skip</Button>
                    <Button size="sm" variant="outline" onClick={() => setEdit({ row: r, action: "cancel", sendOn: r.send_on, note: "" })}>Cancel</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Sent">
        {sent.length === 0 ? <EmptyState title="Nothing sent yet" hint="Sending is not turned on." /> : (
          <ul className="divide-y">{sent.map((r) => <li key={r.id} className="py-3">{r.title} · {home(r.property_id)} · {r.send_on}</li>)}</ul>
        )}
      </SectionCard>

      <SectionCard title="Waiting on homeowner" description="Sent and not yet answered, oldest first.">
        {waiting.length === 0 ? <EmptyState title="Nothing waiting" hint="No homeowner items are waiting for a reply." /> : (
          <ul className="divide-y">
            {waiting.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{w.title}</p>
                  <p className="text-xs text-muted-foreground">{home(w.property_id)} · sent {w.sent_at.slice(0, 10)}</p>
                </div>
                <Badge variant="secondary">{w.daysWaiting} {w.daysWaiting === 1 ? "day" : "days"} waiting</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.action === "reschedule" ? "Reschedule" : edit?.action === "skip" ? "Skip this task" : "Cancel this task"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <p className="text-sm">{edit.row.title} · {home(edit.row.property_id)}</p>
              {edit.action === "reschedule" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fu-date">New send date</Label>
                  <Input id="fu-date" type="date" value={edit.sendOn} onChange={(e) => setEdit({ ...edit, sendOn: e.target.value })} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="fu-note">Note (optional)</Label>
                <Input id="fu-note" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Back</Button>
            <Button disabled={!edit || (edit.action === "reschedule" && !edit.sendOn) || updateM.isPending} onClick={() => edit && updateM.mutate(edit)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={oneOff !== null} onOpenChange={(o) => !o && setOneOff(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a one-off</DialogTitle></DialogHeader>
          {oneOff && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Home</Label>
                <Select value={oneOff.programHome} onValueChange={(v) => setOneOff({ ...oneOff, programHome: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a home" /></SelectTrigger>
                  <SelectContent>{programHomes.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Task</Label>
                <Select value={oneOff.sourceKey} onValueChange={(v) => setOneOff({ ...oneOff, sourceKey: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a template or Library item" /></SelectTrigger>
                  <SelectContent>{data.options.map((o) => <SelectItem key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>{sourceLabel(o.kind)}: {o.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oo-date">Send date</Label>
                <Input id="oo-date" type="date" value={oneOff.sendOn} onChange={(e) => setOneOff({ ...oneOff, sendOn: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oo-note">Note (optional)</Label>
                <Input id="oo-note" value={oneOff.note} onChange={(e) => setOneOff({ ...oneOff, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOneOff(null)}>Back</Button>
            <Button disabled={!oneOff?.programHome || !oneOff.sourceKey || !oneOff.sendOn || oneOffM.isPending} onClick={() => oneOff && oneOffM.mutate(oneOff)}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
