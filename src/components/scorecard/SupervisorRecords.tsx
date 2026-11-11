import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { getMyScorecardRoles, recordFinancePacket } from "@/lib/scorecard-capture.functions";
import { CAPTURE_COPY, financePacketVisible, financeWeekEnding } from "@/lib/scorecard-capture";
import { useFeatureFlags } from "@/lib/feature-flags";

/** The Supervisor's records on Home. Shows only for the Operations Supervisor or Director role. */
export function SupervisorRecords() {
  const rolesFn = useServerFn(getMyScorecardRoles);
  const roles = useQuery({ queryKey: ["scorecard-roles"], queryFn: () => rolesFn(), staleTime: 5 * 60 * 1000 });
  const [finance, setFinance] = useState(false);
  const flags = useFeatureFlags();
  // Behind the finance_packet_button switch, OFF: the weekly packet is retired (Build 16 B2).
  const showFinance = flags.enabled("finance_packet_button") && financePacketVisible(new Date());

  const r = roles.data;
  if (!r || (!r.supervisor && !r.leads)) return null;
  if (!r.supervisor && !showFinance) return null;

  return (
    <SectionCard title="Your records" description="Short notes that show the care behind the week.">
      <div className="flex flex-wrap gap-2">
        {/* Build 14 (register BN8): coaching sessions are recorded on the Coaching page, one log. */}
        {r.supervisor && (
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/coaching">{CAPTURE_COPY.coachingButton}</Link>
          </Button>
        )}
        {showFinance && r.leads && (
          <Button variant="outline" className="min-h-11" onClick={() => setFinance(true)}>
            {CAPTURE_COPY.financeButton}
          </Button>
        )}
      </div>
      <FinanceDialog open={finance} onOpenChange={setFinance} />
    </SectionCard>
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
