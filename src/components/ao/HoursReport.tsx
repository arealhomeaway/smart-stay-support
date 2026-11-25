/** Weekly hours report (Nov 25): the Admin editor on Owner programs and the one line on each home's Owner tab. */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  holdHoursReportFn,
  hoursReportLineFn,
  previewHoursReportFn,
  readHoursReportAdminFn,
  saveHoursReportSettingsFn,
  sendHoursReportTestFn,
} from "@/lib/hours-report.functions";
import { LOG_HOURS_LABEL, SEND_DAYS, shortDayLabel, timeLabel, type HoursReportSettings } from "@/lib/hours-report";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

function PreviewDialog(p: { open: boolean; onOpenChange: (o: boolean) => void; preview: { subject: string; body: string } | null }) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{p.preview?.subject ?? "Preview"}</DialogTitle></DialogHeader>
        {p.preview ? (
          <div className="space-y-4 rounded-md border bg-card p-4">
            <p className="whitespace-pre-line text-sm">{p.preview.body}</p>
            <span className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{LOG_HOURS_LABEL}</span>
          </div>
        ) : <p className="text-sm text-muted-foreground">Loading…</p>}
      </DialogContent>
    </Dialog>
  );
}

export function HoursReportSettingsCard() {
  const qc = useQueryClient();
  const read = useServerFn(readHoursReportAdminFn);
  const save = useServerFn(saveHoursReportSettingsFn);
  const preview = useServerFn(previewHoursReportFn);
  const test = useServerFn(sendHoursReportTestFn);
  const q = useQuery({ queryKey: ["hours-report-admin"], queryFn: () => read() });
  const [draft, setDraft] = useState<HoursReportSettings | null>(null);
  const [shown, setShown] = useState<{ subject: string; body: string } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (q.data && !draft) setDraft(q.data.settings); }, [q.data, draft]);
  const saveM = useMutation({
    mutationFn: () => save({ data: draft! }),
    onSuccess: () => { toast.success("Saved. Applies from the next send."); void qc.invalidateQueries({ queryKey: ["hours-report-admin"] }); },
    onError: (e) => toast.error(msg(e)),
  });
  const previewM = useMutation({
    mutationFn: () => preview({ data: { draft: draft! } }),
    onMutate: () => { setShown(null); setOpen(true); },
    onSuccess: (r) => setShown(r),
    onError: (e) => { setOpen(false); toast.error(msg(e)); },
  });
  const testM = useMutation({
    mutationFn: () => test({ data: { draft: draft! } }),
    onSuccess: () => toast.success("Test copy sent to you."),
    onError: (e) => toast.error(msg(e)),
  });
  if (!q.data || !draft) return null;
  const admin = q.data.isAdmin;
  const set = (patch: Partial<HoursReportSettings>) => setDraft({ ...draft, ...patch });
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Weekly hours report</h2>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Switch checked={draft.enabled} disabled={!admin} onCheckedChange={(v) => set({ enabled: v })} aria-label="Weekly hours report on" />
          {draft.enabled ? "On" : "Off"}
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Send day</span>
          <select className="min-h-11 rounded-md border bg-background px-3" value={draft.day} disabled={!admin} onChange={(e) => set({ day: Number(e.target.value) })}>
            {SEND_DAYS.map((d) => <option key={d.dow} value={d.dow}>{d.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Send time (Central)</span>
          <Input type="time" className="min-h-11" value={draft.time} disabled={!admin} onChange={(e) => set({ time: e.target.value })} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-3">
          <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Subject</span>
            <Input className="min-h-11" value={draft.subject} disabled={!admin} onChange={(e) => set({ subject: e.target.value })} /></label>
          <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Opening</span>
            <Textarea rows={3} value={draft.opening} disabled={!admin} onChange={(e) => set({ opening: e.target.value })} /></label>
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Hours box, filled in each send</div>
          <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Closing</span>
            <Textarea rows={3} value={draft.closing} disabled={!admin} onChange={(e) => set({ closing: e.target.value })} /></label>
        </div>
        <aside className="space-y-1 text-sm">
          <p className="font-medium">Merge fields</p>
          <p><code>{"{{First Name}}"}</code></p>
          <p><code>{"{{Date}}"}</code></p>
        </aside>
      </div>
      <div className="flex flex-wrap gap-2">
        {admin && <Button className="min-h-11" onClick={() => saveM.mutate()} disabled={saveM.isPending}>{saveM.isPending ? "Saving…" : "Save"}</Button>}
        <Button variant="outline" className="min-h-11" onClick={() => previewM.mutate()}>Preview</Button>
        {admin && <Button variant="outline" className="min-h-11" onClick={() => testM.mutate()} disabled={testM.isPending}>Send a test copy</Button>}
      </div>
      {q.data.edits[0] && <p className="text-xs text-muted-foreground">Last edit: {q.data.edits[0].who}, {new Date(q.data.edits[0].at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>}
      <PreviewDialog open={open} onOpenChange={setOpen} preview={shown} />
    </section>
  );
}

export function HoursReportLine({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const read = useServerFn(hoursReportLineFn);
  const preview = useServerFn(previewHoursReportFn);
  const test = useServerFn(sendHoursReportTestFn);
  const hold = useServerFn(holdHoursReportFn);
  const q = useQuery({ queryKey: ["hours-report-line", propertyId], queryFn: () => read({ data: { propertyId } }) });
  const [shown, setShown] = useState<{ subject: string; body: string } | null>(null);
  const [open, setOpen] = useState(false);
  const previewM = useMutation({
    mutationFn: () => preview({ data: { propertyId } }),
    onMutate: () => { setShown(null); setOpen(true); },
    onSuccess: setShown,
    onError: (e) => { setOpen(false); toast.error(msg(e)); },
  });
  const testM = useMutation({ mutationFn: () => test({ data: { propertyId } }), onSuccess: () => toast.success("Test copy sent to you."), onError: (e) => toast.error(msg(e)) });
  const holdM = useMutation({
    mutationFn: (weekStart: string) => hold({ data: { propertyId, weekStart } }),
    onSuccess: () => { toast.success("Held for this week."); void qc.invalidateQueries({ queryKey: ["hours-report-line", propertyId] }); },
    onError: (e) => toast.error(msg(e)),
  });
  const d = q.data;
  if (!d || !d.program) return null;
  const last = d.lastSentAt ? new Date(d.lastSentAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" }) : "never";
  const line = !d.enabled ? "Hours report: Off"
    : `Hours report: next send ${d.nextDate ? `${shortDayLabel(d.nextDate)}, ${timeLabel(d.time ?? "09:00")}` : "none"} · last sent ${last}`;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
      <p className="mr-auto text-sm">{line}</p>
      <Button variant="outline" className="min-h-11" onClick={() => previewM.mutate()}>Preview</Button>
      {d.enabled && d.nextWeek && (
        <Button variant="outline" className="min-h-11" disabled={holdM.isPending} onClick={() => holdM.mutate(d.nextWeek!)}>Hold this week</Button>
      )}
      <Button variant="outline" className="min-h-11" disabled={testM.isPending} onClick={() => testM.mutate()}>Send a test copy</Button>
      <PreviewDialog open={open} onOpenChange={setOpen} preview={shown} />
    </div>
  );
}
