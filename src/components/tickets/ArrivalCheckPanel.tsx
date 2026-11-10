/**
 * Ticket page, arrival check (Build 12; register BN4, BN10; docs/specs/arrival-check.md).
 * Shows the guest's arrival, the deadline, guests and pets, the lock brand (never a code) and
 * the home's open Breezeway work orders, then the three steps. Saving calls the one
 * caller-authenticated database step `complete_arrival_check`, which takes an unowned check,
 * records the result and who did it, makes the issue ticket when one is flagged and closes the
 * check ticket.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionCard } from "@/components/ui/page";
import { ARRIVAL_COPY as C, arrivalResultLabel, arrivalTime, type ArrivalResult } from "@/lib/arrival-check";

type WorkOrder = { id: number; name: string | null; department: string | null; status: string | null; link: string };
type CheckView = {
  id: string;
  ticket_id: string;
  home: string;
  check_in_at: string;
  deadline_at: string;
  time_zone: string;
  guest_first_name: string | null;
  guests: number | null;
  pets: number | null;
  owner_stay: boolean;
  late_booking: boolean;
  is_test: boolean;
  status: "open" | "complete" | "cancelled";
  result: ArrivalResult | null;
  outcome: "ready" | "issue" | null;
  lock_connected: boolean | null;
  lock_note: string | null;
  issue_text: string | null;
  backup_plan: string | null;
  issue_ticket_id: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  lock_brand: string | null;
  work_orders: WorkOrder[];
};

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export function ArrivalCheckPanel({ ticketId, readOnly }: { ticketId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["arrival-check", ticketId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as Rpc).rpc("arrival_check_for_ticket", { _ticket_id: ticketId });
      if (error) throw new Error(error.message);
      return (data ?? null) as CheckView | null;
    },
  });
  const [lock, setLock] = useState<"yes" | "no" | null>(null);
  const [lockNote, setLockNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [outcome, setOutcome] = useState<"ready" | "issue" | null>(null);
  const [issue, setIssue] = useState("");
  const [plan, setPlan] = useState("");
  const [saving, setSaving] = useState(false);

  const c = q.data;
  if (!c) return null;
  const done = c.status !== "open";
  const canSave =
    !readOnly && !saving && lock !== null && (lock === "yes" || lockNote.trim().length > 0) && reviewed &&
    outcome !== null && (outcome === "ready" || (issue.trim().length > 0 && plan.trim().length > 0));

  async function save() {
    if (!c || !canSave) return;
    setSaving(true);
    try {
      const { error } = await (supabase as unknown as Rpc).rpc("complete_arrival_check", {
        _check_id: c.id,
        _lock_connected: lock === "yes",
        _lock_note: lock === "no" ? lockNote.trim() : null,
        _work_orders_reviewed: reviewed,
        _outcome: outcome,
        _issue: outcome === "issue" ? issue.trim() : null,
        _backup_plan: outcome === "issue" ? plan.trim() : null,
      });
      if (error) throw new Error(error.message);
      toast.success(C.saved);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["arrival-check", ticketId] }),
        qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
        qc.invalidateQueries({ queryKey: ["team-queue"] }),
        qc.invalidateQueries({ queryKey: ["home-my-work"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Not saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const choice = (on: boolean) =>
    `min-h-11 flex-1 rounded-md border px-3 text-sm font-medium ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`;

  return (
    <SectionCard title={C.panelTitle} className="mt-2">
      <div className="space-y-4" data-arrival-check={c.id}>
        <div className="flex flex-wrap gap-2">
          {c.is_test && <Badge variant="outline">{C.test}</Badge>}
          {c.owner_stay && <Badge variant="secondary">{C.ownerStay}</Badge>}
          {c.late_booking && <Badge variant="outline">{C.lateBooking}</Badge>}
          {(done || c.result) && <Badge variant={c.result === "on_time" ? "secondary" : "outline"}>{arrivalResultLabel(c)}</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{C.guestArrives}</dt>
          <dd className="font-medium">{arrivalTime(c.check_in_at, c.time_zone)}</dd>
          <dt className="text-muted-foreground">{C.checkBy}</dt>
          <dd className="font-medium">{arrivalTime(c.deadline_at, c.time_zone)}</dd>
          <dt className="text-muted-foreground">{c.guest_first_name ?? "Guest"}</dt>
          <dd>{C.guests(c.guests)} · {C.pets(c.pets)}</dd>
        </dl>

        {done ? (
          <div className="space-y-2 text-sm" data-arrival-done>
            {c.status === "complete" && (
              <p>{C.done(c.completed_by_name ?? "a teammate", arrivalTime(c.completed_at, c.time_zone))}</p>
            )}
            {c.status === "complete" && (
              <p className="text-muted-foreground">
                Lock {c.lock_connected ? "connected" : `not connected: ${c.lock_note ?? ""}`}.{" "}
                {c.outcome === "ready" ? C.ready + "." : `${c.issue_text ?? ""} Backup plan: ${c.backup_plan ?? ""}`}
              </p>
            )}
            {c.issue_ticket_id && (
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/tickets/$ticketId" params={{ ticketId: c.issue_ticket_id }}>{C.issueTicket}</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <fieldset className="space-y-2" disabled={readOnly}>
              <legend className="text-sm font-semibold">{C.stepLock}</legend>
              <p className="text-sm text-muted-foreground">{c.lock_brand ? C.lockBrand(c.lock_brand) : C.lockUnknown}</p>
              <p className="text-sm">{C.lockQuestion}</p>
              <div className="flex gap-2">
                <button type="button" className={choice(lock === "yes")} aria-pressed={lock === "yes"} onClick={() => setLock("yes")}>{C.lockYes}</button>
                <button type="button" className={choice(lock === "no")} aria-pressed={lock === "no"} onClick={() => setLock("no")}>{C.lockNo}</button>
              </div>
              {lock === "no" && (
                <div className="space-y-1">
                  <Label htmlFor="arrival-lock-note">{C.lockNote}</Label>
                  <Textarea id="arrival-lock-note" value={lockNote} onChange={(e) => setLockNote(e.target.value)} rows={2} />
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-2" disabled={readOnly}>
              <legend className="text-sm font-semibold">{C.stepWorkOrders}</legend>
              {c.work_orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">{C.noWorkOrders}</p>
              ) : (
                <ul className="space-y-1">
                  {c.work_orders.map((w) => (
                    <li key={w.id}>
                      <a href={w.link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline">
                        {w.name || "Work order"}{w.department ? ` · ${w.department}` : ""}{w.status ? ` · ${w.status}` : ""}
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} aria-label={C.reviewed} />
                {C.reviewed}
              </label>
            </fieldset>

            <fieldset className="space-y-2" disabled={readOnly}>
              <legend className="text-sm font-semibold">{C.stepOutcome}</legend>
              <div className="flex gap-2">
                <button type="button" className={choice(outcome === "ready")} aria-pressed={outcome === "ready"} onClick={() => setOutcome("ready")}>{C.ready}</button>
                <button type="button" className={choice(outcome === "issue")} aria-pressed={outcome === "issue"} onClick={() => setOutcome("issue")}>{C.issue}</button>
              </div>
              {outcome === "issue" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="arrival-issue">{C.issueText}</Label>
                    <Textarea id="arrival-issue" value={issue} onChange={(e) => setIssue(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="arrival-plan">{C.backupPlan}</Label>
                    <Textarea id="arrival-plan" value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} />
                  </div>
                </div>
              )}
            </fieldset>

            {readOnly ? (
              <p className="text-sm text-muted-foreground">{C.readOnly}</p>
            ) : (
              <Button className="min-h-11 w-full sm:w-auto" disabled={!canSave} onClick={() => void save()} data-arrival-save>
                {saving ? C.saving : C.save}
              </Button>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
