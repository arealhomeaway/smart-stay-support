/**
 * Property page Part 2 (2.1): the Owner tab. Left: what to do (Needs action) and every conversation
 * with the owner. Right: who they are (About the owner) and the Active Owner program card.
 * Rules live in src/lib/owner-tab.ts; writes go through src/lib/owner-tab.functions.ts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { EmailComposer } from "@/components/EmailComposer";
import { HomeAutomation } from "@/components/ao/HomeAutomation";
import { OpportunityDetail } from "@/components/onboarding/OwnerCollaboration";
import { ReleasedActivityDetail } from "@/components/onboarding/ReleasedActivityDetail";
import { needsAttention as completionNeedsAttention, useOwnerCompletions } from "@/components/onboarding/OwnerCompletionsReview";
import type { usePropertyOwnerSummary } from "@/components/onboarding/PropertyOpportunitiesPanel";
import { ChatThread } from "@/components/chat/ChatThread";
import { WeeklyUpdateDialog } from "./WeeklyUpdateDialog";
import { readPropertyOwnerFn } from "@/lib/owner-link.functions";
import {
  logOwnerContactFn,
  logReminderNowFn,
  postHomeChatFn,
  readOwnerTabFn,
  saveGoodToKnowFn,
  setOwnerPreferredFn,
  setWeeklySwitchFn,
} from "@/lib/owner-tab.functions";
import {
  COMPOSER_LABEL,
  TIMELINE_FILTERS,
  TIMELINE_TAG,
  composerHint,
  composerModes,
  filterTimeline,
  hoursPace,
  needsAction,
  ownerTabCount,
  reminderDay,
  reminderText,
  type ComposerMode,
  type NeedsActionRow,
  type TimelineFilter,
  type TimelineKind,
} from "@/lib/owner-tab";
import { formatPropertyLabel } from "@/lib/property-label";
import { cn } from "@/lib/utils";

type Summary = ReturnType<typeof usePropertyOwnerSummary>;

export function ownerTabKey(propertyId: string) {
  return ["owner-tab", propertyId] as const;
}

export function useOwnerTabData(propertyId: string, enabled = true) {
  const read = useServerFn(readOwnerTabFn);
  return useQuery({ queryKey: ownerTabKey(propertyId), queryFn: () => read({ data: { propertyId } }), enabled, staleTime: 30_000 });
}

/** The Owner tab count (the tab badge): owner answers staff have not replied to, plus a weekly update ready. */
export function ownerTabBadge(summary: Summary, tab: ReturnType<typeof useOwnerTabData>["data"]): number {
  const chat = tab?.ownerChatWaiting ? 1 : 0;
  const weekly = tab?.weekly && tab.rights.sendWeekly ? 1 : 0;
  return summary.waitingOnUs + chat + weekly;
}

const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(iso.length === 10 ? { timeZone: "UTC" } : { timeZone: "America/Chicago" }) }) : "";
const fmtWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const TAG_TONE: Record<TimelineKind, string> = {
  portal: "bg-amber/20 text-foreground",
  email: "bg-info/15 text-foreground",
  text: "bg-sage/25 text-foreground",
  call: "bg-sage/25 text-foreground",
  approval: "bg-role-homeowner-bg text-role-homeowner-fg",
  weekly: "bg-sky/25 text-foreground",
};

function firstNames(people: string[]): string {
  const firsts = people.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean) as string[];
  if (firsts.length <= 1) return firsts[0] ?? "";
  return `${firsts.slice(0, -1).join(", ")} and ${firsts.at(-1)}`;
}

export function OwnerTab(p: {
  propertyId: string;
  homeName: string;
  activeOwner: boolean;
  isDemo: boolean;
  today: string;
  summary: Summary;
  tab: ReturnType<typeof useOwnerTabData>;
  teammates: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const data = p.tab.data;
  const readOwner = useServerFn(readPropertyOwnerFn);
  const ownerQ = useQuery({ queryKey: ["property-owner", p.propertyId], queryFn: () => readOwner({ data: { propertyId: p.propertyId } }) });
  const owner = ownerQ.data?.owner ?? null;
  const people = (owner?.people ?? []) as string[];
  const ownerFirst = firstNames(people) || "the owner";
  const completions = useOwnerCompletions(p.isDemo, p.propertyId);
  const [replying, setReplying] = useState<{ id: string; source: "item" | "chat" } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const logReminder = useServerFn(logReminderNowFn);

  const hasPortal = Boolean(p.summary.program);
  const rows = useMemo<NeedsActionRow[]>(() => {
    if (!data) return [];
    const waitingOnUs: Extract<NeedsActionRow, { kind: "waiting_on_us" }>[] = p.summary.attention.map((i) => ({
      kind: "waiting_on_us",
      id: i.id,
      title: i.title,
      who: ownerFirst,
      at: i.ownerAt,
      source: "item",
    }));
    if (data.ownerChatWaiting)
      waitingOnUs.push({ kind: "waiting_on_us", id: "owner-chat", title: data.lastOwnerChatMessage?.body?.slice(0, 120) || "New message in the owner chat", who: ownerFirst, at: data.ownerChatWaiting.at, source: "chat" });
    return needsAction({
      activeOwner: p.activeOwner,
      waitingOnUs,
      waitingOnOwner: data.decisions.map((d) => ({
        kind: "waiting_on_owner",
        id: d.id,
        title: d.title,
        dueOn: d.dueOn,
        taskTitle: d.taskTitle,
        reminderOn: d.dueOn ? reminderDay(d.dueOn, data.holidays) : null,
        reminderSent: Boolean(data.reminders[d.id]),
      })),
      checkIt: (completions.data ?? []).filter(completionNeedsAttention).map((r) => ({
        kind: "check_it",
        id: r.work_item_id,
        title: r.title,
        what: r.evidence_count ? `${r.evidence_count} ${r.evidence_count === 1 ? "file" : "files"}` : r.latest_feedback ? "A note" : "Marked done",
        at: r.completed_at,
      })),
      weekly: data.weekly && data.rights.sendWeekly ? { kind: "weekly", id: data.weekly.id, ownerFirstNames: ownerFirst } : null,
    });
  }, [data, p.summary.attention, p.activeOwner, completions.data, ownerFirst]);

  // Reply: once the row leaves Needs action (staff have answered), say so and stay on the tab.
  const replyingRef = useRef(replying);
  replyingRef.current = replying;
  useEffect(() => {
    const r = replyingRef.current;
    if (!r || r.source !== "item") return;
    if (!rows.some((x) => x.kind === "waiting_on_us" && x.id === r.id)) {
      setSentTo(ownerFirst);
      setReplying(null);
    }
  }, [rows, ownerFirst]);

  const review = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("record_owner_completion_review", { _id: id, _status: "reviewed" } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked reviewed.");
      void qc.invalidateQueries({ queryKey: ["owner-completions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (p.tab.isPending) return <p className="text-sm text-muted-foreground">Loading the owner…</p>;
  if (p.tab.error || !data) return <p role="alert">Could not load the Owner tab. Please try again.</p>;

  const opps = p.summary.collab?.opportunities ?? [];
  const files = p.summary.collab?.files ?? [];
  const sms = (title: string, dueOn: string | null) =>
    owner?.phone ? `sms:${owner.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(dueOn ? reminderText(title, dueOn) : `Reminder: ${title}`)}` : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="min-w-0 space-y-6">
        {/* NEEDS ACTION */}
        <section id="owner-needs-action" className="scroll-mt-28 space-y-3" aria-label="Needs action">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs action</h2>
          {sentTo ? (
            <p className="flex items-center justify-between gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm" role="status">
              Sent to {sentTo}
              <Button variant="ghost" size="icon" className="size-11" aria-label="Dismiss" onClick={() => setSentTo(null)}>
                <X className="size-4" />
              </Button>
            </p>
          ) : null}
          {rows.length === 0 ? <p className="rounded-md border border-border px-3 py-4 text-sm text-muted-foreground">Nothing needs you here.</p> : null}
          <ul className="space-y-2">
            {rows.map((r) => {
              if (r.kind === "waiting_on_us") {
                const open = replying?.id === r.id;
                const o = r.source === "item" ? opps.find((x) => x.id === r.id) : null;
                const rel = r.source === "item" && !o ? p.summary.released.find((x) => x.id === r.id) : null;
                return (
                  <li key={`us-${r.id}`} className="rounded-lg border border-amber/50 bg-amber/10">
                    <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.who} · {fmtWhen(r.at)}
                        </p>
                      </div>
                      <Button
                        className="min-h-11"
                        variant={open ? "outline" : "default"}
                        onClick={() => {
                          setSentTo(null);
                          setReplying(open ? null : { id: r.id, source: r.source });
                        }}
                        aria-expanded={open}
                      >
                        {open ? "Close" : "Reply"}
                      </Button>
                    </div>
                    {open ? (
                      <div className="border-t border-amber/40 bg-card p-3">
                        {r.source === "chat" ? (
                          <ChatThread
                            propertyId={p.propertyId}
                            kind="owner"
                            canPost={data.rights.postOwnerChat}
                            people={p.teammates}
                            maxHeight="20rem"
                            onSent={() => {
                              setSentTo(ownerFirst);
                              setReplying(null);
                              void qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) });
                            }}
                          />
                        ) : o ? (
                          <OpportunityDetail o={o} files={files} readOnly={!data.rights.askOwner} />
                        ) : rel ? (
                          <ReleasedActivityDetail activity={rel as never} readOnly={!data.rights.askOwner} />
                        ) : (
                          <p className="text-sm text-muted-foreground">This item is not available here.</p>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              }
              if (r.kind === "waiting_on_owner") {
                const link = sms(r.title, r.dueOn);
                const pref = owner?.preferredMethod;
                return (
                  <li key={`owner-${r.id}`} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">We're waiting on the owner · holds up a Task</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.dueOn ? `Due ${fmtDay(r.dueOn)} · ` : ""}holds up "{r.taskTitle}"
                        </p>
                      </div>
                      <Button variant="outline" className="min-h-11" disabled>
                        {r.reminderSent ? `Reminder sent ${fmtDay(data.reminders[r.id])}` : r.reminderOn ? `Reminder goes out ${fmtDay(r.reminderOn)}` : "No due date"}
                      </Button>
                    </div>
                    {data.rights.askOwner ? (
                      pref === "email" || !link ? (
                        <div className="[&_button]:h-11 [&_button]:px-0 [&_button]:text-sm">
                          <EmailComposer
                            context="property"
                            recordId={p.propertyId}
                            label="Send a reminder now"
                            initialSubject={`Reminder: ${r.title}`}
                            initialBody={r.dueOn ? reminderText(r.title, r.dueOn) : `Reminder: ${r.title}`}
                            onSent={() => void qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) })}
                          />
                        </div>
                      ) : (
                        <a
                          href={link}
                          className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
                          onClick={() =>
                            void logReminder({ data: { propertyId: p.propertyId, title: r.title } })
                              .then(() => qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) }))
                              .catch((e: Error) => toast.error(e.message))
                          }
                        >
                          Send a reminder now
                        </a>
                      )
                    ) : null}
                  </li>
                );
              }
              if (r.kind === "check_it") {
                return (
                  <li key={`check-${r.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">The owner finished something · check it</p>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.what} · {fmtDay(r.at)}
                      </p>
                    </div>
                    <Button className="min-h-11" variant="outline" disabled={review.isPending || !data.rights.askOwner} onClick={() => review.mutate(r.id)}>
                      Mark reviewed
                    </Button>
                  </li>
                );
              }
              return (
                <li key={`weekly-${r.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-info/40 bg-info/10 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">This week's update for {r.ownerFirstNames}</p>
                    <p className="text-xs text-muted-foreground">Written from this week's Tasks. Review, edit if needed, and send.</p>
                  </div>
                  <Button className="min-h-11" onClick={() => setWeeklyOpen(true)}>
                    Review and send
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Only what needs someone shows here. The owner's optional plan cards don't: they're the owner's to do, at their pace.</p>
          {data.weekly ? (
            <WeeklyUpdateDialog
              open={weeklyOpen}
              onOpenChange={setWeeklyOpen}
              propertyId={p.propertyId}
              homeName={p.homeName}
              weekly={data.weekly}
              hasPortal={hasPortal}
              onSent={() => {
                setSentTo(ownerFirst);
                void qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) });
              }}
            />
          ) : null}
        </section>

        <ConversationTimeline
          propertyId={p.propertyId}
          rows={data.timeline}
          modes={composerModes({ activeOwner: p.activeOwner, ownerHasPortal: hasPortal, rights: data.rights })}
          ownerFirst={ownerFirst}
          ownerEmail={owner?.email ?? null}
          canLog={data.rights.logContact}
        />
      </div>

      <aside className="min-w-0 space-y-4" aria-label="About the owner">
        <AboutOwner
          propertyId={p.propertyId}
          people={people}
          legal={owner?.name ?? data.owner?.name ?? null}
          since={p.summary.program?.startedOn ?? null}
          preferred={owner?.preferredMethod ?? data.owner?.preferredMethod ?? null}
          canEditPreferred={data.rights.editPreferred}
          ownerId={data.owner?.id ?? null}
          goodToKnow={data.owner?.teamNotes ?? null}
          goodToKnowBy={data.owner?.teamNotesBy ?? null}
          goodToKnowAt={data.owner?.teamNotesAt ?? null}
          goodToKnowReady={data.staged.goodToKnow}
          canEditGoodToKnow={data.rights.editGoodToKnow}
          otherHomes={data.otherHomes}
        />
        {p.activeOwner && p.summary.program ? (
          <section className="surface space-y-3 p-4" aria-label="Active Owner program">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Owner program</h2>
            <ProgramHours hours={p.summary.program.reportedHours} startOn={p.summary.program.startedOn} today={p.today} />
            <HomeAutomation propertyId={p.propertyId} />
            <p className="text-sm">
              Their cards: {p.summary.cards.open} open · {p.summary.cards.done} done
            </p>
            <WeeklyLine propertyId={p.propertyId} settings={data.weeklySettings} ready={data.staged.weekly} canAuto={data.rights.switchAutoSend} canPause={data.rights.pauseWeekly} />
            <p className="text-xs text-muted-foreground">Behind on hours is the Director's to raise, not the PM's.</p>
          </section>
        ) : (
          <section className="surface space-y-2 p-4" aria-label="Weekly update">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weekly update</h2>
            <WeeklyLine propertyId={p.propertyId} settings={data.weeklySettings} ready={data.staged.weekly} canAuto={data.rights.switchAutoSend} canPause={data.rights.pauseWeekly} />
          </section>
        )}
      </aside>
    </div>
  );
}

function ProgramHours({ hours, startOn, today }: { hours: number; startOn: string | null; today: string }) {
  const pace = hoursPace({ hours, startOn, today });
  return (
    <div className="space-y-1">
      <p className="text-sm">
        Hours <span className="numeric font-semibold">{Math.round(hours * 10) / 10}</span> of 100
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, hours)}%` }} />
      </div>
      {pace !== null ? <p className="text-xs text-muted-foreground">on pace for about {pace} by Dec 31</p> : null}
    </div>
  );
}

function WeeklyLine(p: {
  propertyId: string;
  settings: { auto_send: boolean; paused: boolean } | null;
  ready: boolean;
  canAuto: boolean;
  canPause: boolean;
}) {
  const qc = useQueryClient();
  const set = useServerFn(setWeeklySwitchFn);
  const m = useMutation({
    mutationFn: (v: { autoSend?: boolean; paused?: boolean }) =>
      set({ data: { propertyId: p.propertyId, autoSend: v.autoSend ?? null, paused: v.paused ?? null } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) }),
    onError: (e: Error) => toast.error(e.message),
  });
  const auto = p.settings?.auto_send ?? false;
  const paused = p.settings?.paused ?? false;
  return (
    <div className="space-y-2">
      <p className="text-sm">Weekly update: draft every Friday for you to approve</p>
      {p.ready && p.canAuto ? (
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          Send weekly updates automatically
          <Switch checked={auto} disabled={m.isPending} onCheckedChange={(v) => m.mutate({ autoSend: v })} />
        </label>
      ) : null}
      {p.ready && auto && p.canPause ? (
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          Pause this home's automatic update
          <Switch checked={paused} disabled={m.isPending} onCheckedChange={(v) => m.mutate({ paused: v })} />
        </label>
      ) : null}
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = { text: "Text", call: "Call", email: "Email", telegram: "Telegram" };

function AboutOwner(p: {
  propertyId: string;
  people: string[];
  legal: string | null;
  since: string | null;
  preferred: string | null;
  canEditPreferred: boolean;
  ownerId: string | null;
  goodToKnow: string | null;
  goodToKnowBy: string | null;
  goodToKnowAt: string | null;
  goodToKnowReady: boolean;
  canEditGoodToKnow: boolean;
  otherHomes: { id: string; home: Record<string, unknown> }[];
}) {
  const qc = useQueryClient();
  const setPref = useServerFn(setOwnerPreferredFn);
  const saveNote = useServerFn(saveGoodToKnowFn);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(p.goodToKnow ?? "");
  useEffect(() => setNote(p.goodToKnow ?? ""), [p.goodToKnow]);
  const pref = useMutation({
    mutationFn: (method: string) => setPref({ data: { propertyId: p.propertyId, method: (method || null) as never } }),
    onSuccess: () => {
      toast.success("Preferred method saved.");
      void qc.invalidateQueries({ queryKey: ["property-owner", p.propertyId] });
      void qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: () => saveNote({ data: { ownerId: p.ownerId!, notes: note } }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="surface space-y-4 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About the owner</h2>
      {p.people.length ? (
        <ul className="space-y-1">
          {p.people.map((name, i) => (
            <li key={`${name}-${i}`} className="text-sm">
              <span className="font-medium">{name}</span>
              <span className="text-muted-foreground"> · {i === 0 ? "makes the decisions" : "co-owner"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No owner name on file.</p>
      )}
      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Preferred method</span>
        {p.canEditPreferred && p.ownerId ? (
          <select
            className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={p.preferred ?? ""}
            disabled={pref.isPending}
            onChange={(e) => pref.mutate(e.target.value)}
          >
            <option value="">Not chosen</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        ) : (
          <span className="mt-1 block">{p.preferred ? METHOD_LABEL[p.preferred] ?? p.preferred : "Not chosen"}</span>
        )}
      </label>
      {p.legal ? (
        <p className="text-sm">
          <span className="text-xs text-muted-foreground">Legal owner</span>
          <span className="block">{p.legal}</span>
        </p>
      ) : null}
      {p.since ? <p className="text-sm">Active Owner since {fmtDay(p.since)}</p> : null}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Good to know</p>
        {editing ? (
          <div className="space-y-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} aria-label="Good to know" />
            <div className="flex gap-2">
              <Button className="min-h-11" disabled={save.isPending} onClick={() => save.mutate()}>
                Save
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm">{p.goodToKnow || <span className="text-muted-foreground">Nothing yet.</span>}</p>
            {p.goodToKnowBy && p.goodToKnowAt ? (
              <p className="text-xs text-muted-foreground">
                {p.goodToKnowBy} · {fmtWhen(p.goodToKnowAt)}
              </p>
            ) : null}
            {p.canEditGoodToKnow && p.ownerId && p.goodToKnowReady ? (
              <Button variant="link" className="h-11 px-0" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
          </>
        )}
      </div>
      {p.otherHomes.length ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Other homes this owner has</p>
          <ul className="space-y-1">
            {p.otherHomes.map((h) => (
              <li key={h.id}>
                <Link to="/onboarding/$propertyId" params={{ propertyId: h.id }} className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">
                  {formatPropertyLabel(h.home as never)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ConversationTimeline(p: {
  propertyId: string;
  rows: { id: string; kind: TimelineKind; text: string; who: string; at: string }[];
  modes: ComposerMode[];
  ownerFirst: string;
  ownerEmail: string | null;
  canLog: boolean;
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ComposerMode | null>(p.modes[0] ?? null);
  const [text, setText] = useState("");
  const [logKind, setLogKind] = useState<"call" | "text">("call");
  const post = useServerFn(postHomeChatFn);
  const log = useServerFn(logOwnerContactFn);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ownerTabKey(p.propertyId) });
    void qc.invalidateQueries({ queryKey: ["home-chat", p.propertyId] });
  };
  const send = useMutation({
    mutationFn: async () => {
      if (mode === "message") return post({ data: { propertyId: p.propertyId, kind: "owner", body: text.trim(), attachments: [], mentions: [] } });
      if (mode === "log") return log({ data: { propertyId: p.propertyId, kind: logKind, body: text.trim() } });
      return null;
    },
    onSuccess: () => {
      setText("");
      toast.success(mode === "log" ? "Saved." : `Sent to ${p.ownerFirst}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const shown = filterTimeline([...p.rows].sort((a, b) => b.at.localeCompare(a.at)), filter, search);
  const current = mode && p.modes.includes(mode) ? mode : p.modes[0] ?? null;
  return (
    <section className="space-y-3" aria-label="Every conversation with the owner">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Every conversation with the owner</h2>
      {current ? (
        <div className="surface space-y-2 p-3">
          <div role="radiogroup" aria-label="How" className="flex flex-wrap gap-1">
            {p.modes.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={current === m}
                onClick={() => setMode(m)}
                className={cn("min-h-11 rounded-full border px-4 text-sm", current === m ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted")}
              >
                {COMPOSER_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{composerHint(current, p.ownerFirst)}</p>
          {current === "log" ? (
            <div role="radiogroup" aria-label="Call or text" className="flex gap-2">
              {(["call", "text"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={logKind === k}
                  onClick={() => setLogKind(k)}
                  className={cn("min-h-11 rounded-md border px-3 text-sm", logKind === k ? "border-primary bg-primary/10" : "border-border")}
                >
                  {k === "call" ? "A call" : "A text"}
                </button>
              ))}
            </div>
          ) : null}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} aria-label="What to say" placeholder={current === "log" ? "What was said" : `Write to ${p.ownerFirst}`} />
          <div className="flex justify-end">
            {current === "email" ? (
              <div className="[&_button]:min-h-11">
                <EmailComposer
                  key={`email-${text}`}
                  context="property"
                  recordId={p.propertyId}
                  label="Write the email"
                  variant="primary"
                  initialBody={text}
                  initialTo={p.ownerEmail}
                  onSent={() => {
                    setText("");
                    refresh();
                  }}
                />
              </div>
            ) : (
              <Button className="min-h-11" disabled={send.isPending || text.trim().length < (current === "log" ? 3 : 1)} onClick={() => send.mutate()}>
                {current === "log" ? "Save" : "Send"}
              </Button>
            )}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search the conversation" className="h-11 pl-9" />
        </label>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Kinds">
        {TIMELINE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn("min-h-11 rounded-full border px-3 text-sm", filter === f.key ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted")}
          >
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet.</p> : null}
      <ol className="divide-y divide-border rounded-lg border border-border">
        {shown.map((r) => (
          <li key={r.id} className="space-y-1 px-3 py-2">
            <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", TAG_TONE[r.kind])}>{TIMELINE_TAG[r.kind]}</span>
            <p className="line-clamp-4 whitespace-pre-wrap text-sm">{r.text}</p>
            <p className="text-xs text-muted-foreground">
              {r.who} · {fmtWhen(r.at)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export { ownerTabCount };
