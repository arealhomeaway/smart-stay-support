import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/page";
import { loadOwnerPlan, submitCard } from "@/lib/ao-data";
import { ownerPace } from "@/lib/ao-engine";
import {
  groupPlanByHome, paceSentence, portalCardView, submissionValues, validateSubmission, type OutputField, type PortalPlanCard,
} from "@/lib/ao-ui";

/** Homeowner plan cards, grouped under each home. Hidden entirely while the plan engine is not set up. */
export function OwnerPlanCards({ programId, readOnly, homes = [] }: { programId: string; readOnly: boolean; homes?: { propertyId: string; name: string }[] }) {
  const q = useQuery({ queryKey: ["ao-owner-plan", programId], queryFn: () => loadOwnerPlan(programId), retry: false });
  if (!q.data?.available || q.data.data.length === 0) return null;
  const groups = groupPlanByHome(q.data.data, homes);
  return (
    <SectionCard title="Your homeowner plan">
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.propertyId ?? "home"} className="space-y-2" aria-label={g.name}>
            {groups.length > 1 || homes.length > 1 ? <h3 className="text-sm font-semibold">{g.name}</h3> : null}
            <ul className="space-y-3">
              {g.cards.map((c) => <li key={c.plan_card_id}><PlanCardItem card={c} programId={programId} readOnly={readOnly} /></li>)}
            </ul>
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

export function PlanCardItem({ card, programId, readOnly }: { card: PortalPlanCard; programId: string; readOnly: boolean }) {
  const view = portalCardView(card);
  return (
    <div className="rounded-md border p-3" data-state={view.kind}>
      <p className="font-medium">{card.title}</p>
      {view.kind === "locked" ? <p className="text-sm text-muted-foreground">{view.text}</p> : null}
      {view.kind === "done" ? <p className="text-sm text-muted-foreground">Done. Thank you.</p> : null}
      {view.kind === "closed" ? <p className="text-sm text-muted-foreground">This item has closed. ARHA is taking care of it.</p> : null}
      {view.kind === "open" ? (
        <>
          {card.what_text ? <p className="text-sm text-muted-foreground">{card.what_text}</p> : null}
          <PlanCardForm planCardId={card.plan_card_id} programId={programId} fields={view.fields} readOnly={readOnly} />
        </>
      ) : null}
    </div>
  );
}

export function PlanCardForm({ planCardId, programId, fields, readOnly }: { planCardId: string; programId: string; fields: OutputField[]; readOnly: boolean }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const submit = useMutation({
    mutationFn: () => {
      const err = validateSubmission(fields, values);
      if (err) throw new Error(err);
      return submitCard(planCardId, submissionValues(fields, values));
    },
    onSuccess: () => { toast.success("Sent to ARHA"); void qc.invalidateQueries({ queryKey: ["ao-owner-plan", programId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
      {fields.map((f) => {
        const id = `${planCardId}-${f.key}`;
        const set = (v: string) => setValues({ ...values, [f.key]: v });
        return (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={id}>{f.label}</Label>
            {f.type === "long_text" ? <Textarea id={id} value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} disabled={readOnly} />
              : f.type === "yes_no" ? (
                <select id={id} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} disabled={readOnly}>
                  <option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
              ) : <Input id={id} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} disabled={readOnly} />}
          </div>
        );
      })}
      <Button type="submit" size="sm" disabled={readOnly || submit.isPending}>Send to ARHA</Button>
    </form>
  );
}

/** Owner pace: weekly hours needed to reach 100 by the program end date. */
export function OwnerPaceCard({ loggedHours, endsOn, endLabel, now = new Date() }: { loggedHours: number; endsOn: string | null; endLabel: string; now?: Date }) {
  if (!endsOn) return null;
  const end = new Date(`${endsOn.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const pace = ownerPace(loggedHours, now, end);
  return (
    <div className="rounded-md border p-3" data-testid="owner-pace">
      <p className="text-sm">{paceSentence(pace.weeklyNeeded, endLabel)}</p>
      <p className="text-sm font-medium">{pace.label}</p>
    </div>
  );
}
