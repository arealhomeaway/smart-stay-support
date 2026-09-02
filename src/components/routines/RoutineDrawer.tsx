/**
 * Running one routine control.
 *
 * Purpose-built per control, on shared plumbing. The person is walked through
 * the same job they already do — look at it, decide, say what you found — and
 * Resolve handles ownership, evidence, completion and the follow-up ticket.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SpecialHandlingNotice } from "@/components/SpecialHandlingNotice";
import {
  OUTCOME_LABELS,
  routineConfig,
  routineDueLabel,
  type RoutineOutcome,
} from "@/lib/routine-controls";

export type RoutineRow = {
  id: string;
  kind: string;
  status: string;
  title: string;
  outcome: string | null;
  property_id: string | null;
  ticket_id: string | null;
  follow_up_ticket_id: string | null;
  guest_name: string | null;
  reservation_confirmation: string | null;
  stay_arrival: string | null;
  stay_departure: string | null;
  due_at: string | null;
  findings: string | null;
  notes: string | null;
  evidence_urls: string[] | null;
  completed_at: string | null;
  assigned_to: string | null;
  properties?: { name: string | null; nickname: string | null } | null;
};

export function RoutineDrawer({
  row,
  open,
  onOpenChange,
}: {
  row: RoutineRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const config = row ? routineConfig(row.kind) : null;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<RoutineOutcome | null>(null);
  const [findings, setFindings] = useState("");
  const [evidence, setEvidence] = useState("");

  useEffect(() => {
    if (!row) return;
    setChecked({});
    setOutcome((row.outcome as RoutineOutcome) ?? null);
    setFindings(row.findings ?? "");
    setEvidence((row.evidence_urls ?? []).join("\n"));
  }, [row?.id, row]);

  const complete = useMutation({
    mutationFn: async () => {
      if (!row || !outcome) throw new Error("Choose what you found first.");
      const { data: auth } = await supabase.auth.getUser();
      const urls = evidence
        .split(/[\n,]/)
        .map((v) => v.trim())
        .filter(Boolean);
      const { error } = await supabase
        .from("routine_controls")
        .update({
          status: "completed",
          outcome,
          findings: findings.trim() || null,
          evidence_urls: urls,
          completed_at: new Date().toISOString(),
          completed_by: auth.user?.id ?? null,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routine-controls"] });
      qc.invalidateQueries({ queryKey: ["routine-due"] });
      toast.success("Logged. Thanks.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("routine_controls")
        .update({ status: "in_progress", assigned_to: row.assigned_to ?? auth.user?.id ?? null })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routine-controls"] }),
  });

  if (!row || !config) return null;

  const done = row.status === "completed";
  const allChecked = config.steps.every((s) => checked[s.id]);
  const needsFollowUp = outcome === "needs_follow_up";
  const propertyName = row.properties?.nickname ?? row.properties?.name ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-1.5 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{config.label}</Badge>
            {done ? (
              <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                Completed
              </Badge>
            ) : (
              <Badge variant="outline">{routineDueLabel(row)}</Badge>
            )}
          </div>
          <SheetTitle className="text-lg">{row.title}</SheetTitle>
          <SheetDescription>
            {propertyName ? `${propertyName} · ` : ""}
            {config.purpose}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {(row.guest_name || row.reservation_confirmation || row.stay_departure) && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              {row.guest_name && (
                <p>
                  <span className="text-muted-foreground">Guest: </span>
                  {row.guest_name}
                </p>
              )}
              {row.reservation_confirmation && (
                <p>
                  <span className="text-muted-foreground">Reservation: </span>
                  {row.reservation_confirmation}
                </p>
              )}
              {row.stay_departure && (
                <p>
                  <span className="text-muted-foreground">Departed: </span>
                  {new Date(row.stay_departure).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {row.property_id && (
            <SpecialHandlingNotice
              propertyId={row.property_id}
              moment={config.kind === "cleaning_review" ? "cleaning" : "guest_access"}
            />
          )}

          {done ? (
            <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-4" />
                {OUTCOME_LABELS[(row.outcome as RoutineOutcome) ?? "looks_good"]}
              </p>
              {row.findings && <p className="whitespace-pre-line">{row.findings}</p>}
              {row.follow_up_ticket_id && (
                <Link
                  to="/tickets/$ticketId"
                  params={{ ticketId: row.follow_up_ticket_id }}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Open the follow-up ticket <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Work through it</p>
                {config.steps.map((step) => (
                  <label
                    key={step.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-secondary/60"
                  >
                    <Checkbox
                      checked={Boolean(checked[step.id])}
                      onCheckedChange={(v) => {
                        setChecked((c) => ({ ...c, [step.id]: Boolean(v) }));
                        if (row.status === "due") start.mutate();
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{step.prompt}</span>
                      {step.hint && (
                        <span className="block text-xs text-muted-foreground">{step.hint}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">What did you find?</p>
                <div className="flex flex-wrap gap-2">
                  {config.outcomes.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOutcome(o)}
                      className={`h-10 rounded-lg border px-4 text-sm font-medium transition-colors ${
                        outcome === o
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {OUTCOME_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>

              {needsFollowUp && (
                <div className="space-y-2">
                  <Label htmlFor="routine-findings">{config.followUpPrompt}</Label>
                  <Textarea
                    id="routine-findings"
                    rows={3}
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    placeholder="Say it the way you would to a teammate."
                  />
                </div>
              )}

              {!needsFollowUp && outcome && (
                <div className="space-y-2">
                  <Label htmlFor="routine-notes">Anything worth noting? (optional)</Label>
                  <Textarea
                    id="routine-notes"
                    rows={2}
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                  />
                </div>
              )}

              {config.evidenceLabel && (
                <div className="space-y-2">
                  <Label htmlFor="routine-evidence">{config.evidenceLabel} (optional)</Label>
                  <Input
                    id="routine-evidence"
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="Paste one or more links"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button
                  onClick={() => complete.mutate()}
                  disabled={!outcome || complete.isPending}
                  className="h-11"
                >
                  {complete.isPending && <Loader2 className="size-4 animate-spin" />}
                  Mark it done
                </Button>
                {needsFollowUp && (
                  <Button asChild variant="outline" className="h-11">
                    <Link
                      to="/tickets/new"
                      search={{
                        ...(row.property_id ? { property: row.property_id } : {}),
                        from: `routine:${row.id}`,
                      }}
                    >
                      Create a follow-up ticket
                    </Link>
                  </Button>
                )}
                {!allChecked && outcome === "looks_good" && (
                  <p className="basis-full text-xs text-muted-foreground">
                    You have not ticked everything — that is fine, but say why in the note.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
