/**
 * Property page Part 1: the Needs attention strip (1.2), the Overview cards (1.3), the no-plan
 * card (1.9) and the Admin's Status to stage map (1.4). Overview only shows; nothing is edited.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NOTION_STATUSES, type Stepper } from "@/lib/onboarding-board";
import {
  PAGE_STAGE_NAMES,
  rowDue,
  type AttentionChip,
  type OwnerTag,
  type PageTask,
} from "@/lib/onboarding-home-page";
import { readStatusStageMapFn, saveStatusStageMapFn } from "@/lib/onboarding-home-page.functions";
import { TAG_CLASS } from "./TasksTab";
import { cn } from "@/lib/utils";

export function NeedsAttentionStrip({ chips, onJump }: { chips: AttentionChip[]; onJump: (c: AttentionChip) => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto rounded-lg bg-amber/10 px-3 py-2" role="region" aria-label="Needs attention">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onJump(c)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-amber/40 bg-background px-3 text-sm font-medium hover:bg-amber/10"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="surface flex flex-col gap-3 p-4" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      <div className="flex-1 space-y-3 text-sm">{children}</div>
      {footer}
    </section>
  );
}

export function OverviewCards(p: {
  stepper: Stepper;
  stage: number;
  handoffOn: string | null;
  nextThree: PageTask[];
  today: string;
  team: { role: string; tag: OwnerTag; name: string | null; outside?: boolean }[];
  owner: { waitingOnUs: number; waitingOnThem: number; hours: number | null; plan: boolean | null; activeOwner: boolean };
  onOpenTasks: () => void;
  onOpenTask: (id: string) => void;
  onOpenDetails: () => void;
  onOpenOwner: () => void;
  shortDate: (iso: string) => string;
}) {
  const link = "inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        title="Progress"
        footer={
          <button type="button" className={link} onClick={p.onOpenTasks}>
            Open Tasks ›
          </button>
        }
      >
        <div className="flex gap-1" aria-label={`Stage ${p.stage} of 6`}>
          {p.stepper.steps.map((s) => (
            <span key={s.stage} title={`${PAGE_STAGE_NAMES[s.index]}: ${s.note}`} className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${s.percent}%` }} />
            </span>
          ))}
        </div>
        <p className="numeric text-muted-foreground">
          Stage {p.stage} of 6 · {p.stepper.done} of {p.stepper.total} Tasks done
          {p.handoffOn ? ` · handoff ${p.shortDate(p.handoffOn)}` : ""}
        </p>
        <div>
          <p className="eyebrow">Your next 3</p>
          {p.nextThree.length ? (
            <ul className="mt-1 space-y-1">
              {p.nextThree.map((t) => {
                const due = rowDue(t, p.today);
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => p.onOpenTask(t.id)} className="flex min-h-11 w-full items-center gap-2 text-left hover:underline">
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <span className={cn("numeric text-xs", due.late ? "font-medium text-late" : "text-muted-foreground")}>{due.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">Nothing open for you here.</p>
          )}
        </div>
      </Card>
      <Card
        title="Team"
        footer={
          <button type="button" className={link} onClick={p.onOpenDetails}>
            Change in Home details ›
          </button>
        }
      >
        <ul className="space-y-2">
          {p.team.map((m) => (
            <li key={m.role} className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium", TAG_CLASS[m.tag].tag)}>{m.role}</span>
              {m.name ? (
                <span className={m.outside ? "text-muted-foreground" : "font-medium"}>
                  {m.name}
                  {m.outside ? " (outside)" : ""}
                </span>
              ) : (
                <span className="font-medium text-late">Not assigned</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title="Owner"
        footer={
          <button type="button" className={link} onClick={p.onOpenOwner}>
            Open Owner ›
          </button>
        }
      >
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Waiting on us</dt>
            <dd className={cn("numeric text-2xl font-semibold", p.owner.waitingOnUs > 0 && "text-late")}>{p.owner.waitingOnUs}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Waiting on them</dt>
            <dd className="numeric text-2xl font-semibold">{p.owner.waitingOnThem}</dd>
          </div>
          {p.owner.activeOwner ? (
            <div>
              <dt className="text-xs text-muted-foreground">Hours this year</dt>
              <dd className="numeric font-medium">{p.owner.hours === null ? "Not set" : p.owner.hours.toFixed(1)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">Homeowner plan</dt>
            <dd className="font-medium">{p.owner.plan === null ? "Not set" : p.owner.plan ? "On" : "Off"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

export function NoPlanCard({ canStart, start }: { canStart: boolean; start: React.ReactNode }) {
  return (
    <section className="surface space-y-3 p-5" aria-label="No onboarding plan">
      <p className="font-semibold">This home has no onboarding plan yet.</p>
      {canStart ? start : <p className="text-sm text-muted-foreground">Ask the Director of Onboarding to start the plan.</p>}
    </section>
  );
}

/** 1.4: which stage each Status means. Everyone reads it; only an Admin saves (logged). */
export function useStatusStageMap() {
  const read = useServerFn(readStatusStageMapFn);
  return useQuery({ queryKey: ["onboarding-status-stage-map"], queryFn: () => read(), staleTime: 5 * 60_000 });
}

export function StatusStageMapEditor({ isAdmin }: { isAdmin: boolean }) {
  const q = useStatusStageMap();
  const save = useServerFn(saveStatusStageMapFn);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, number | null> | null>(null);
  useEffect(() => {
    if (q.data && !draft) setDraft({ ...q.data.map });
  }, [q.data, draft]);
  const m = useMutation({
    mutationFn: () => save({ data: { map: draft ?? {} } }),
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["onboarding-status-stage-map"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!isAdmin || !draft) return null;
  return (
    <details className="surface p-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Which stage each Status means (every home)</summary>
      <ul className="mt-3 divide-y divide-border">
        {NOTION_STATUSES.map((s) => (
          <li key={s} className="flex min-h-11 flex-wrap items-center gap-3 py-1.5 text-sm">
            <span className="min-w-0 flex-1">{s}</span>
            <select
              aria-label={`Stage for ${s}`}
              className="h-11 w-56 rounded-md border border-input bg-background px-3 text-sm"
              value={draft[s] == null ? "none" : String(draft[s])}
              onChange={(e) => setDraft({ ...draft, [s]: e.target.value === "none" ? null : Number(e.target.value) })}
            >
              <option value="none">No stage</option>
              {PAGE_STAGE_NAMES.map((n, i) => (
                <option key={n} value={i + 1}>
                  {i + 1}. {n}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <Button className="mt-3 min-h-11" disabled={m.isPending} onClick={() => m.mutate()}>
        Save
      </Button>
    </details>
  );
}
