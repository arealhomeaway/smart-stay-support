import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveOverride } from "@/lib/coverage-admin.functions";
import {
  applyCoverageActions,
  centralInstant,
  centralToday,
  nightStatus,
  personName,
  planTimeOff,
  addDays,
  type SOverride,
  type SPerson,
  type SRole,
  type SRoster,
  type OncallPattern,
} from "@/lib/team-schedule";

const NONE = "";

/** One form for time off, used on the Schedule tab and in a user's side panel. */
export function TimeOffDialog({
  open,
  onClose,
  onSaved,
  people,
  roles,
  roster,
  overrides,
  defaultUserId,
  pattern = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  people: SPerson[];
  roles: SRole[];
  roster: SRoster[];
  overrides: SOverride[];
  defaultUserId?: string | null;
  pattern?: OncallPattern | null;
}) {
  const today = centralToday();
  const [userId, setUserId] = useState(defaultUserId ?? NONE);
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(today);
  const [endTime, setEndTime] = useState("23:59");
  const [note, setNote] = useState("");
  const [coverId, setCoverId] = useState(NONE);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveOverride);

  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
  const startsAt = centralInstant(startDate, toMin(startTime));
  const endsAt = centralInstant(endDate, toMin(endTime));

  // Flag nights in the range where this person is on call.
  const onCallNights: string[] = [];
  if (userId && endDate >= startDate) {
    for (let d = addDays(startDate, -1), i = 0; d <= endDate && i < 62; d = addDays(d, 1), i++) {
      const n = nightStatus(d, roster, roles, overrides, pattern);
      const nightFrom = centralInstant(d, 22 * 60), nightTo = centralInstant(d, 1440 + 8 * 60);
      if (n.userId === userId && new Date(startsAt) < new Date(nightTo) && new Date(endsAt) > new Date(nightFrom)) onCallNights.push(d);
    }
  }

  const submit = async () => {
    setBusy(true);
    try {
      const actions = planTimeOff({ roles, userId, startsAt, endsAt, note, coverUserId: coverId || null });
      await applyCoverageActions(actions, {
        saveOverride: (a) => save({ data: a }),
        saveShift: async () => undefined,
        deleteShift: async () => undefined,
        setSeatHolder: async () => undefined,
      });
      toast.success("Time off saved.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Time off could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add time off</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="to-person">Person</Label>
            <select id="to-person" className="h-9 w-full rounded-md border border-input bg-background px-2" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value={NONE}>Choose a person</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="to-sd">Start date</Label><Input id="to-sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="to-st">Start time</Label><Input id="to-st" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="to-ed">End date</Label><Input id="to-ed" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="to-et">End time</Label><Input id="to-et" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="to-cover">Who is covering (optional)</Label>
            <select id="to-cover" className="h-9 w-full rounded-md border border-input bg-background px-2" value={coverId} onChange={(e) => setCoverId(e.target.value)}>
              <option value={NONE}>No cover, use the backup role</option>
              {people.filter((p) => p.id !== userId).map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label htmlFor="to-note">Note</Label><Textarea id="to-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
          {onCallNights.length > 0 && (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-2 text-danger">
              {personName(people, userId)} is on call during this time off. Change the on-call night so it has cover.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !userId}>Save time off</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
