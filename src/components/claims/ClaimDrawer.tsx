import { ExpensesCard } from "@/components/finance/ExpensesCard";
/**
 * Claim workspace.
 *
 * A claim is a recovery process, not a form. The workspace leads with the one
 * thing to do next, then the evidence still outstanding, then the money, then
 * the history. Resolve derives what it can; the employee supplies judgement
 * and the amounts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Chip } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayName, useCurrentUserId, type TeamMember } from "@/hooks/useTeam";
import { stateChip } from "@/lib/semantic";
import {
  CLAIM_PIPELINE,
  CLAIM_STAGE_LABELS,
  CLAIM_TYPE_LABELS,
  DISPOSITION_LABELS,
  RECOVERY_SOURCE,
  amountAtRisk,
  deadlineLabel,
  deadlineState,
  evidenceProgress,
  formatDate,
  formatMoney,
  isOpenClaim,
  nextAction,
  proposeStage,
  stageState,
  unrecovered,
  type ClaimDisposition,
  type ClaimStage,
  type RequirementLike,
} from "@/lib/claims";
import type { ClaimActivityRow, ClaimRow, ClaimUpdate } from "@/lib/claim-types";

const DISPOSITIONS: ClaimDisposition[] = [
  "approved",
  "partial",
  "denied",
  "withdrawn",
  "written_off",
];

/** Dates a stage change should stamp, so nobody backfills them by hand. */
function stampsFor(stage: ClaimStage): ClaimUpdate {
  const today = new Date().toISOString().slice(0, 10);
  if (stage === "submitted") return { submitted_on: today };
  if (stage === "decided") return { decided_on: today };
  if (stage === "recovered") return { recovered_on: today };
  if (stage === "closed") return { closed_at: new Date().toISOString() };
  return {};
}

export function ClaimDrawer({
  claim,
  people,
  canEdit,
  propertyName,
  onClose,
}: {
  claim: ClaimRow | null;
  people: TeamMember[];
  canEdit: boolean;
  propertyName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const [note, setNote] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  const requirements = useQuery({
    queryKey: ["claim-evidence", claim?.id],
    enabled: !!claim,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_requirements")
        .select("*")
        .eq("subject_type", "claim")
        .eq("subject_id", claim!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activity = useQuery({
    queryKey: ["claim-activity", claim?.id],
    enabled: !!claim,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claim_activity")
        .select("*")
        .eq("claim_id", claim!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClaimActivityRow[];
    },
  });

  const reqs = (requirements.data ?? []) as RequirementLike[];
  const progress = useMemo(() => evidenceProgress(reqs), [reqs]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["claims"] });
    qc.invalidateQueries({ queryKey: ["claim-requirements"] });
    qc.invalidateQueries({ queryKey: ["claim-evidence", claim?.id] });
    qc.invalidateQueries({ queryKey: ["claim-activity", claim?.id] });
  };

  const logEvent = async (event_type: string, body: string, detail?: Record<string, unknown>) => {
    if (!claim) return;
    await supabase.from("claim_activity").insert({
      claim_id: claim.id,
      author_id: userId,
      event_type,
      body,
      detail: (detail ?? {}) as never,
      is_demo: claim.is_demo,
    });
  };

  const update = useMutation({
    mutationFn: async ({
      patch,
      event,
      body,
    }: {
      patch: ClaimUpdate;
      event: string;
      body: string;
    }) => {
      if (!claim) return;
      const { error } = await supabase.from("claims").update(patch).eq("id", claim.id);
      if (error) throw error;
      await logEvent(event, body, patch as Record<string, unknown>);
    },
    onSuccess: () => {
      refresh();
      toast.success("Claim updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const text = note.trim();
      if (!claim || !text) return;
      await logEvent("note", text);
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["claim-activity", claim?.id] });
    },
  });

  const setRequirementStatus = useMutation({
    mutationFn: async ({ id, status, label }: { id: string; status: string; label: string }) => {
      const { error } = await supabase
        .from("evidence_requirements")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      await logEvent(
        "evidence",
        status === "verified" ? `${label} received` : `${label} marked ${status.replace("_", " ")}`,
      );
    },
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!claim) return null;

  const suggested = proposeStage(claim, reqs);
  const amountField = (key: keyof ClaimRow, label: string, help: string) => (
    <div key={key as string} className="space-y-1">
      <Label htmlFor={`claim-${key as string}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`claim-${key as string}`}
        inputMode="decimal"
        disabled={!canEdit}
        placeholder="—"
        value={amounts[key as string] ?? (claim[key] === null ? "" : String(claim[key]))}
        onChange={(e) => setAmounts((a) => ({ ...a, [key as string]: e.target.value }))}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const next = raw === "" ? null : Number(raw.replace(/[$,]/g, ""));
          if (next !== null && !Number.isFinite(next)) {
            toast.error("Enter a number");
            return;
          }
          if (next === claim[key]) return;
          update.mutate({
            patch: { [key as string]: next } as ClaimUpdate,
            event: "amount",
            body: `${label} set to ${formatMoney(next)}`,
          });
        }}
      />
      <p className="text-[11px] text-muted-foreground">{help}</p>
    </div>
  );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-8 text-left">{claim.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip className={stateChip(stageState(claim.stage))}>
            {CLAIM_STAGE_LABELS[claim.stage]}
          </Chip>
          <Chip>{CLAIM_TYPE_LABELS[claim.claim_type]}</Chip>
          <Chip>Recover from {RECOVERY_SOURCE[claim.claim_type]}</Chip>
          {claim.disposition ? <Chip>{DISPOSITION_LABELS[claim.disposition]}</Chip> : null}
          {claim.is_demo ? <Chip>Demo</Chip> : null}
        </div>

        {/* Next action leads, because it is the reason anyone opened this claim. */}
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Next action</p>
          <p className="mt-1 font-semibold">{nextAction(claim, { requirements: reqs })}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {deadlineLabel(claim.deadline_on)}
            {claim.deadline_on ? ` · deadline ${formatDate(claim.deadline_on)}` : ""}
            {claim.follow_up_on ? ` · follow up ${formatDate(claim.follow_up_on)}` : ""}
          </p>
          {canEdit && suggested !== claim.stage ? (
            <Button
              size="sm"
              className="mt-2"
              onClick={() =>
                update.mutate({
                  patch: { stage: suggested, ...stampsFor(suggested) },
                  event: "stage",
                  body: `Moved to ${CLAIM_STAGE_LABELS[suggested]}`,
                })
              }
            >
              Move to {CLAIM_STAGE_LABELS[suggested]}
            </Button>
          ) : null}
        </div>

        <Separator className="my-4" />

        {/* Context */}
        <section className="space-y-1 text-sm">
          <h3 className="text-sm font-semibold">Incident</h3>
          <p className="text-muted-foreground">
            {claim.incident_description || "No description recorded."}
          </p>
          <p className="text-xs text-muted-foreground">
            {propertyName} · incident {formatDate(claim.incident_on)} ·{" "}
            {claim.guest_name ?? "Guest unrecorded"}
            {claim.reservation_confirmation ? ` · ${claim.reservation_confirmation}` : ""}
            {claim.stay_arrival
              ? ` · stay ${formatDate(claim.stay_arrival)}–${formatDate(claim.stay_departure)}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-3 pt-1 text-xs">
            {claim.ticket_id ? (
              <Link
                to="/tickets/$ticketId"
                params={{ ticketId: claim.ticket_id }}
                className="text-primary underline"
              >
                Originating ticket
              </Link>
            ) : null}
            {claim.property_id ? (
              <Link
                to="/property/$propertyId"
                params={{ propertyId: claim.property_id }}
                className="text-primary underline"
              >
                Property hub
              </Link>
            ) : null}
          </div>
        </section>

        <Separator className="my-4" />
        <ExpensesCard propertyId={claim.property_id ?? null} linkType="claim" targetId={claim.id} />
        <Separator className="my-4" />

        {/* Evidence */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Evidence</h3>
            <span className="text-xs text-muted-foreground">
              {progress.met.length} of {reqs.length} received
            </span>
          </div>
          {reqs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checklist on this claim.</p>
          ) : (
            <ul className="space-y-2">
              {(requirements.data ?? []).map((req) => {
                const met = req.status === "verified" || req.status === "accepted_exception";
                return (
                  <li key={req.id} className="rounded-md border px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {req.label}
                          {req.required ? "" : " (optional)"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{req.instruction}</p>
                      </div>
                      <Chip className={met ? stateChip("done") : stateChip("waiting")}>
                        {met ? "Received" : "Missing"}
                      </Chip>
                    </div>
                    {canEdit ? (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant={met ? "outline" : "default"}
                          onClick={() =>
                            setRequirementStatus.mutate({
                              id: req.id,
                              status: met ? "awaiting" : "verified",
                              label: req.label,
                            })
                          }
                        >
                          {met ? "Mark missing" : "Mark received"}
                        </Button>
                        {!met && req.required ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setRequirementStatus.mutate({
                                id: req.id,
                                status: "accepted_exception",
                                label: req.label,
                              })
                            }
                          >
                            Not available
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Separator className="my-4" />

        {/* Money — only amounts somebody actually recorded. */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Financials</h3>
          <div className="grid grid-cols-2 gap-3">
            {amountField("estimated_amount", "Estimated", "First guess before a quote.")}
            {amountField("actual_cost", "Actual cost", "What the repair or cleaning cost us.")}
            {amountField("submitted_amount", "Submitted", "Amount claimed from the other party.")}
            {amountField("approved_amount", "Approved", "Amount they agreed to pay.")}
            {amountField("recovered_amount", "Recovered", "Money actually received.")}
          </div>
          <p className="text-xs text-muted-foreground">
            At risk {formatMoney(amountAtRisk(claim))} · outstanding{" "}
            {formatMoney(unrecovered(claim))} · booked in QuickBooks separately.
          </p>
        </section>

        <Separator className="my-4" />

        {/* Working controls */}
        {canEdit ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Update claim</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Stage</Label>
                <Select
                  value={claim.stage}
                  onValueChange={(v) =>
                    update.mutate({
                      patch: { stage: v as ClaimStage, ...stampsFor(v as ClaimStage) },
                      event: "stage",
                      body: `Moved to ${CLAIM_STAGE_LABELS[v as ClaimStage]}`,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_PIPELINE.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CLAIM_STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Owner</Label>
                <Select
                  value={claim.assigned_to ?? "unassigned"}
                  onValueChange={(v) =>
                    update.mutate({
                      patch: { assigned_to: v === "unassigned" ? null : v },
                      event: "assignment",
                      body:
                        v === "unassigned"
                          ? "Unassigned"
                          : `Assigned to ${displayName(people.find((p) => p.id === v))}`,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {displayName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="claim-deadline">
                  Deadline
                </Label>
                <Input
                  id="claim-deadline"
                  type="date"
                  defaultValue={claim.deadline_on ?? ""}
                  onChange={(e) =>
                    update.mutate({
                      patch: { deadline_on: e.target.value || null },
                      event: "deadline",
                      body: `Deadline set to ${formatDate(e.target.value)}`,
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  From the platform notice — Resolve never guesses it.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="claim-followup">
                  Follow up on
                </Label>
                <Input
                  id="claim-followup"
                  type="date"
                  defaultValue={claim.follow_up_on ?? ""}
                  onChange={(e) =>
                    update.mutate({
                      patch: { follow_up_on: e.target.value || null },
                      event: "follow_up",
                      body: `Follow-up set to ${formatDate(e.target.value)}`,
                    })
                  }
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs" htmlFor="claim-ref">
                  External reference
                </Label>
                <Input
                  id="claim-ref"
                  defaultValue={claim.external_reference ?? ""}
                  placeholder="Platform case number"
                  onBlur={(e) => {
                    if ((e.target.value || null) === claim.external_reference) return;
                    update.mutate({
                      patch: { external_reference: e.target.value || null },
                      event: "reference",
                      body: `Reference recorded: ${e.target.value || "cleared"}`,
                    });
                  }}
                />
              </div>
            </div>

            {claim.stage === "decided" || claim.disposition ? (
              <div className="space-y-2 rounded-md border px-3 py-2">
                <Label className="text-xs">Outcome</Label>
                <Select
                  value={claim.disposition ?? ""}
                  onValueChange={(v) =>
                    update.mutate({
                      patch: {
                        disposition: v as ClaimDisposition,
                        decided_on: claim.decided_on ?? new Date().toISOString().slice(0, 10),
                      },
                      event: "disposition",
                      body: `Outcome: ${DISPOSITION_LABELS[v as ClaimDisposition]}`,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Record the outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPOSITIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DISPOSITION_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  rows={2}
                  placeholder="Why — in their words where possible"
                  value={reason || (claim.disposition_reason ?? "")}
                  onChange={(e) => setReason(e.target.value)}
                  onBlur={() => {
                    const text = reason.trim();
                    if (!text || text === claim.disposition_reason) return;
                    update.mutate({
                      patch: { disposition_reason: text },
                      event: "disposition",
                      body: `Outcome reason recorded`,
                    });
                  }}
                />
              </div>
            ) : null}

            {isOpenClaim(claim.stage) ? null : (
              <p className="text-xs text-muted-foreground">
                This claim is finished. Reopen it by changing the stage.
              </p>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">You have read-only access to claims.</p>
        )}

        <Separator className="my-4" />

        {/* History */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">History</h3>
          {canEdit ? (
            <div className="space-y-2">
              <Textarea
                rows={2}
                placeholder="Add a note — what you said, who you spoke to, what they promised"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate()}
              >
                Add note
              </Button>
            </div>
          ) : null}
          <ul className="space-y-2 pt-1">
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="rounded-md border px-3 py-2">
                <p className="text-sm">{a.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  {displayName(people.find((p) => p.id === a.author_id))} ·{" "}
                  {formatDate(a.created_at)}
                </p>
              </li>
            ))}
            {(activity.data ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Nothing recorded yet.</li>
            ) : null}
          </ul>
        </section>
      </SheetContent>
    </Sheet>
  );
}
