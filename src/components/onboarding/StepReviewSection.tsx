/**
 * "Review" section of the Plan settings step editor. Saves on its own through
 * set_onboarding_step_review_settings; no reviewers means review is off.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FUNCTIONAL_ROLES } from "@/lib/v2-workflow.functions";
import { readStepReviewSettings, saveStepReviewSettings } from "@/lib/onboarding-reviews.functions";
import { BLOCK_OPTIONS, type StepReviewSettings } from "@/lib/onboarding-reviews";

const ROLE_CHOICES = FUNCTIONAL_ROLES.filter((r) => r.code !== "owner" && r.code !== "director_onboarding" && r.code !== "design_staging");

export function StepReviewSection({ stepId, steps, stages }: { stepId: string; steps: { id: string; title: string; stage: string }[]; stages: string[] }) {
  const qc = useQueryClient();
  const read = useServerFn(readStepReviewSettings);
  const save = useServerFn(saveStepReviewSettings);
  const q = useQuery({ queryKey: ["step-review", stepId], queryFn: () => read({ data: { stepId } }) });
  const [first, setFirst] = useState("none");
  const [second, setSecond] = useState("none");
  const [days, setDays] = useState("1");
  const [alerts, setAlerts] = useState(false);
  const [blocks, setBlocks] = useState<StepReviewSettings["blocks"]>("nothing");
  const [blockedSteps, setBlockedSteps] = useState<string[]>([]);
  const [blockedStage, setBlockedStage] = useState("");

  useEffect(() => {
    const s = q.data;
    setFirst(s?.reviewer_roles[0] ?? "none");
    setSecond(s?.reviewer_roles[1] ?? "none");
    setDays(String(s?.time_limit_business_days ?? 1));
    setAlerts(s?.alerts_enabled ?? false);
    setBlocks(s?.blocks ?? "nothing");
    setBlockedSteps(s?.blocked_step_ids ?? []);
    setBlockedStage(s?.blocked_stage ?? "");
  }, [q.data]);

  const on = first !== "none" || second !== "none";
  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          stepId,
          reviewerRoles: [first, second].filter((r) => r !== "none"),
          timeLimitDays: Math.min(30, Math.max(1, Math.round(Number(days) || 1))),
          alertsEnabled: alerts,
          blocks: on ? blocks : "nothing",
          blockedStepIds: on && blocks === "steps" ? blockedSteps : [],
          blockedStage: on && blocks === "stage" ? blockedStage : null,
        },
      }),
    onSuccess: () => {
      toast.success("Review settings saved.");
      void qc.invalidateQueries({ queryKey: ["step-review", stepId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const picker = (value: string, set: (v: string) => void, label: string, other: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={set}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No reviewer</SelectItem>
          {ROLE_CHOICES.filter((r) => r.code !== other).map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="mt-2 space-y-3 rounded-md border border-border p-3" aria-label="Review">
      <p className="text-sm font-medium">Review</p>
      <p className="text-xs text-muted-foreground">
        Choose who must approve this step before it counts as done. Reviewers come from each home's Project Team, or whoever is covering that role. Leave both empty for no review.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {picker(first, setFirst, "First reviewer", second)}
        {picker(second, setSecond, "Second reviewer (optional)", first)}
      </div>
      {on ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rv-days">Review time limit (business days)</Label>
              <Input id="rv-days" inputMode="numeric" className="w-24" value={days} onChange={(e) => setDays(e.target.value)} />
              <p className="text-xs text-muted-foreground">Counted in Central time, Monday to Friday, skipping company holidays.</p>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm"><Switch checked={alerts} onCheckedChange={setAlerts} /> Alerts</label>
              <p className="text-xs text-muted-foreground">When on, reviewers get an in-app alert when the step is submitted and again if the review runs late. A late review also alerts the Onboarding Director. No email is sent.</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>While the review is open, it holds back</Label>
            <Select value={blocks} onValueChange={(v) => setBlocks(v as StepReviewSettings["blocks"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BLOCK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Held back steps show "Waiting on review of" this step until it is approved.</p>
          </div>
          {blocks === "steps" ? (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {steps.filter((s) => s.id !== stepId).map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={blockedSteps.includes(s.id)} onCheckedChange={(v) => setBlockedSteps((cur) => (v ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
                  <span className="truncate">{s.title}</span>
                  <span className="text-xs text-muted-foreground">{s.stage}</span>
                </label>
              ))}
            </div>
          ) : null}
          {blocks === "stage" ? (
            <Select value={blockedStage} onValueChange={setBlockedStage}>
              <SelectTrigger aria-label="Stage"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
        </>
      ) : null}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" disabled={m.isPending || q.isLoading || (on && blocks === "steps" && blockedSteps.length === 0) || (on && blocks === "stage" && !blockedStage)} onClick={() => m.mutate()}>
          Save review settings
        </Button>
      </div>
    </div>
  );
}
