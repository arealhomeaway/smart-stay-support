/**
 * Claims Coordinator view sections (approved Nov 18): Dates, Reported issues, Amounts,
 * Status bar and Platform log. Evidence stays the existing checklist in ClaimDrawer.
 * Gates, stages, waivers and the Finance ledger are unchanged.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { GUIDED_STEPS, GUIDED_STEP_LABELS, formatMoney, guidedStep } from "@/lib/claims";
import { chicagoToday, deadlineLine, lineItemsTotal, plainDate, PRE_SUBMISSION_STAGES } from "@/lib/claim-coordinator";
import {
  NOT_ON_YET,
  addLineItem,
  addPlatformLog,
  changeLineItem,
  loadLineItems,
  loadPlatformLog,
  loadReportedFromBreezeway,
} from "@/lib/claim-coordinator.data";
import { displayName, type TeamMember } from "@/hooks/useTeam";
import type { ClaimRow } from "@/lib/claim-types";

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function DatesSection({ claim }: { claim: ClaimRow }) {
  return (
    <Section title="Dates" testId="claim-dates">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Checkout</p>
          <p>{claim.stay_departure ? plainDate(claim.stay_departure) : "Not recorded"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Filing deadline</p>
          <p data-testid="claim-deadline-line">{deadlineLine(claim)}</p>
        </div>
      </div>
    </Section>
  );
}

export function ReportedIssuesSection({ claim }: { claim: ClaimRow }) {
  const bz = useQuery({
    queryKey: ["claim-reported", claim.departure_review_id],
    queryFn: () => loadReportedFromBreezeway(claim.departure_review_id ?? null),
    enabled: !!claim.departure_review_id,
    retry: false,
  });
  const cats = claim.damage_categories ?? [];
  return (
    <Section title="Reported issues" testId="claim-reported">
      <p className="whitespace-pre-wrap text-sm">{claim.incident_description || "No description recorded."}</p>
      {cats.length ? (
        <div className="flex flex-wrap gap-1">{cats.map((c) => <Chip key={c}>{c.replace(/_/g, " ")}</Chip>)}</div>
      ) : null}
      {bz.isError ? <p className="text-xs text-muted-foreground">The clean review notes could not load.</p> : null}
      {(bz.data?.comments ?? []).length ? (
        <ul className="space-y-1 text-sm">
          {bz.data!.comments.map((c) => (
            <li key={c.id} className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">{c.author ?? "Breezeway"}{c.at ? ` · ${plainDate(c.at.slice(0, 10))}` : ""}</p>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {(bz.data?.photos ?? []).length ? (
        <div className="grid grid-cols-3 gap-2">
          {bz.data!.photos.filter((p) => p.url).map((p) => (
            <a key={p.id} href={p.url!} target="_blank" rel="noreferrer" className="block">
              <img src={p.url!} alt={p.caption ?? "Clean review photo"} className="aspect-square w-full rounded-md object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

export function useLineItems(claimId: string) {
  return useQuery({ queryKey: ["claim-line-items", claimId], queryFn: () => loadLineItems(claimId), retry: false, enabled: !!claimId });
}

export function AmountsSection({ claim, canEdit, userId, onChanged }: { claim: ClaimRow; canEdit: boolean; userId: string | null; onChanged: () => void }) {
  const qc = useQueryClient();
  const items = useLineItems(claim.id);
  const [issue, setIssue] = useState("");
  const [amount, setAmount] = useState("");
  const open = (PRE_SUBMISSION_STAGES as readonly string[]).includes(claim.stage);
  const rows = items.data?.rows ?? [];
  const total = lineItemsTotal(rows);
  const done = () => { void qc.invalidateQueries({ queryKey: ["claim-line-items", claim.id] }); onChanged(); };
  const add = useMutation({
    mutationFn: async () => {
      const n = Number(amount.replace(/[$,]/g, ""));
      if (!issue.trim()) throw new Error("Name the issue first.");
      if (!Number.isFinite(n) || n < 0) throw new Error("Enter the amount requested.");
      if (!userId) throw new Error("Sign in again.");
      await addLineItem(claim.id, userId, issue.trim(), n);
    },
    onSuccess: () => { toast.success(`Saved: ${issue.trim()}`); setIssue(""); setAmount(""); done(); },
    onError: (e: Error) => toast.error(`Not saved: ${e.message}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => changeLineItem(id, { archived_at: new Date().toISOString() }),
    onSuccess: () => { toast.success("Line item removed"); done(); },
    onError: (e: Error) => toast.error(`Not saved: ${e.message}`),
  });
  return (
    <Section title="Amounts" testId="claim-amounts">
      {items.isError ? <p className="text-sm text-muted-foreground">Line items could not load.</p> : null}
      {rows.length ? (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 break-words">{r.issue}</span>
              <span className="flex shrink-0 items-center gap-2">
                {formatMoney(r.amount_requested)}
                {canEdit && open ? (
                  <Button size="sm" variant="ghost" className="min-h-11" disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>Remove</Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No line items yet.</p>
      )}
      <p className="text-sm font-semibold" data-testid="claim-line-total">Total requested {formatMoney(rows.length ? total : claim.submitted_amount)}</p>
      {canEdit && open && items.data?.available !== false ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <Input aria-label="Issue" placeholder="Issue" value={issue} onChange={(e) => setIssue(e.target.value)} className="min-h-11" />
          <Input aria-label="Amount requested" placeholder="Amount $" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-11" />
          <Button className="min-h-11" disabled={add.isPending || !issue.trim() || !amount.trim()} onClick={() => add.mutate()}>Add</Button>
        </div>
      ) : null}
      {items.data?.available === false && canEdit ? <p className="text-xs text-muted-foreground">Line items: {NOT_ON_YET}</p> : null}
    </Section>
  );
}

export function StatusBar({ claim }: { claim: ClaimRow }) {
  const step = guidedStep(claim);
  const at = GUIDED_STEPS.indexOf(step);
  return (
    <div className="space-y-1" data-testid="claim-status-bar">
      <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={GUIDED_STEPS.length} aria-valuenow={at + 1} aria-label="Claim progress">
        {GUIDED_STEPS.map((s, i) => (
          <div key={s} className={`h-2 flex-1 rounded-full ${i <= at ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-sm">Step {at + 1} of {GUIDED_STEPS.length}: {GUIDED_STEP_LABELS[step]}</p>
    </div>
  );
}

export function PlatformLogSection({ claim, canEdit, userId, people }: { claim: ClaimRow; canEdit: boolean; userId: string | null; people: TeamMember[] }) {
  const qc = useQueryClient();
  const log = useQuery({ queryKey: ["claim-platform-log", claim.id], queryFn: () => loadPlatformLog(claim.id), retry: false });
  const [on, setOn] = useState(chicagoToday());
  const [said, setSaid] = useState("");
  const [did, setDid] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      if (!said.trim()) throw new Error("Write what the platform said or asked.");
      if (!userId) throw new Error("Sign in again.");
      await addPlatformLog(claim.id, userId, { entry_on: on, platform_said: said.trim(), we_did: did.trim() || null });
    },
    onSuccess: () => { toast.success("Saved to the platform log"); setSaid(""); setDid(""); void qc.invalidateQueries({ queryKey: ["claim-platform-log", claim.id] }); },
    onError: (e: Error) => toast.error(`Not saved: ${e.message}`),
  });
  const rows = log.data?.rows ?? [];
  return (
    <Section title="Platform log" testId="claim-platform-log">
      {log.isError ? <p className="text-sm text-muted-foreground">The platform log could not load.</p> : null}
      {rows.length ? (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">{plainDate(r.entry_on)} · {displayName(people.find((p) => p.id === r.author_id))}</p>
              <p className="whitespace-pre-wrap"><span className="font-medium">Platform: </span>{r.platform_said}</p>
              {r.we_did ? <p className="whitespace-pre-wrap"><span className="font-medium">We did: </span>{r.we_did}</p> : null}
            </li>
          ))}
        </ul>
      ) : log.data?.available === false ? (
        <p className="text-sm text-muted-foreground">Platform log: {NOT_ON_YET}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      )}
      {canEdit && log.data?.available !== false ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="pl-date" className="text-xs">Date</Label>
            <Input id="pl-date" type="date" max={chicagoToday()} value={on} onChange={(e) => setOn(e.target.value)} className="min-h-11" />
          </div>
          <Textarea aria-label="What the platform said or asked" placeholder="What the platform said or asked" rows={2} value={said} onChange={(e) => setSaid(e.target.value)} />
          <Textarea aria-label="What we did" placeholder="What we did" rows={2} value={did} onChange={(e) => setDid(e.target.value)} />
          <Button className="min-h-11" disabled={add.isPending || !said.trim()} onClick={() => add.mutate()}>{add.isPending ? "Saving…" : "Add entry"}</Button>
        </div>
      ) : null}
    </Section>
  );
}
