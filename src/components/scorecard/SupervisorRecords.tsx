import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import { getMyScorecardRoles, recordCoaching, recordFinancePacket } from "@/lib/scorecard-capture.functions";
import { CAPTURE_COPY, financePacketVisible, financeWeekEnding } from "@/lib/scorecard-capture";

/** The Supervisor's records on Home. Shows only for the Operations Supervisor or Director role. */
export function SupervisorRecords() {
  const rolesFn = useServerFn(getMyScorecardRoles);
  const roles = useQuery({ queryKey: ["scorecard-roles"], queryFn: () => rolesFn(), staleTime: 5 * 60 * 1000 });
  const [coaching, setCoaching] = useState(false);
  const [finance, setFinance] = useState(false);
  const showFinance = financePacketVisible(new Date());

  const r = roles.data;
  if (!r || (!r.supervisor && !r.leads)) return null;
  if (!r.supervisor && !showFinance) return null;

  return (
    <SectionCard title="Your records" description="Short notes that show the care behind the week.">
      <div className="flex flex-wrap gap-2">
        {r.supervisor && (
          <Button variant="outline" className="min-h-11" onClick={() => setCoaching(true)}>
            {CAPTURE_COPY.coachingButton}
          </Button>
        )}
        {showFinance && r.leads && (
          <Button variant="outline" className="min-h-11" onClick={() => setFinance(true)}>
            {CAPTURE_COPY.financeButton}
          </Button>
        )}
      </div>
      <CoachingDialog open={coaching} onOpenChange={setCoaching} />
      <FinanceDialog open={finance} onOpenChange={setFinance} />
    </SectionCard>
  );
}

function CoachingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const staff = useStaffDirectory();
  const saveFn = useServerFn(recordCoaching);
  const [who, setWho] = useState("");
  const [strength, setStrength] = useState("");
  const [improvement, setImprovement] = useState("");
  const [followUp, setFollowUp] = useState("");
  const coordinators = useMemo(
    () => (staff.data ?? []).filter((m) => m.roles.includes("tech")),
    [staff.data],
  );
  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { coordinatorId: who, strength, improvement, followUp: followUp.trim() || undefined } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.coachingThanks);
      setWho("");
      setStrength("");
      setImprovement("");
      setFollowUp("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ready = who && strength.trim().length >= 3 && improvement.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{CAPTURE_COPY.coachingButton}</DialogTitle>
          <DialogDescription>Today's date is saved with it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Coordinator</Label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Choose a coordinator" />
              </SelectTrigger>
              <SelectContent>
                {coordinators.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {displayName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-strength">What went well</Label>
            <Textarea id="coach-strength" value={strength} onChange={(e) => setStrength(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-improve">What to grow next</Label>
            <Textarea id="coach-improve" value={improvement} onChange={(e) => setImprovement(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-follow">Follow-up</Label>
            <Input id="coach-follow" className="min-h-11" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="min-h-11" disabled={!ready || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinanceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const saveFn = useServerFn(recordFinancePacket);
  const [weekEnding, setWeekEnding] = useState(() => financeWeekEnding(new Date()));
  const [complete, setComplete] = useState<"yes" | "no" | "">("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { weekEnding, complete: complete === "yes", note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.financeThanks);
      setComplete("");
      setNote("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ready = weekEnding && complete && (complete === "yes" || note.trim().length >= 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{CAPTURE_COPY.financeButton}</DialogTitle>
          <DialogDescription>The Friday packet for Finance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fp-week">Week ending</Label>
            <Input id="fp-week" type="date" className="min-h-11" value={weekEnding} onChange={(e) => setWeekEnding(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Was it complete?</Label>
            <Select value={complete} onValueChange={(v) => setComplete(v as "yes" | "no")}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes, complete</SelectItem>
                <SelectItem value="no">No, something was missing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {complete === "no" && (
            <div className="space-y-1.5">
              <Label htmlFor="fp-note">What was missing</Label>
              <Textarea id="fp-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button className="min-h-11" disabled={!ready || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
