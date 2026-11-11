/**
 * Breezeway section on onboarding "Work order:" steps (Kati ticket 67).
 *
 * The only work orders are work orders IN Breezeway. Tonight's path: record a
 * tentative date and who it is assigned to (a Breezeway person, or Leave
 * unassigned), create the work order in Breezeway, then paste its number or
 * link here. Resolve links it to the mirrored Breezeway task and shows its
 * status, assignee, comments and photos. Send to Breezeway is built but stays
 * off until the onboarding send switch is turned on after a verification send.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, ExternalLink, Link2, Send, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stateChip } from "@/lib/semantic";
import { usDate, usDateTime } from "@/lib/dates";
import {
  CONNECTION_LABEL,
  breezewayConnection,
  breezewayTaskUrl,
  parseBreezewayRef,
  sendToBreezewayRefusal,
} from "@/lib/onboarding-breezeway";
import {
  breezewayHomeLinkFn,
  onboardingBreezewayStateFn,
  saveOnboardingBreezewayFn,
  sendOnboardingWorkOrderFn,
} from "@/lib/onboarding-kati.functions";

export function OnboardingBreezewaySection({
  taskId,
  disabled,
}: {
  taskId: string;
  /** The home, kept for callers; the server reads the task's own home. */
  propertyId?: string;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const stateFn = useServerFn(onboardingBreezewayStateFn);
  const saveFn = useServerFn(saveOnboardingBreezewayFn);
  const sendFn = useServerFn(sendOnboardingWorkOrderFn);
  const key = ["onboarding-breezeway", taskId];
  const state = useQuery({ queryKey: key, queryFn: () => stateFn({ data: { taskId } }) });

  const [date, setDate] = useState("");
  const [assignee, setAssignee] = useState<string>("choose");
  const [ref, setRef] = useState("");
  useEffect(() => {
    const link = state.data?.link;
    setDate(link?.tentative_date ?? "");
    setAssignee(
      link?.assignee_choice === "person" && link.breezeway_person_id
        ? String(link.breezeway_person_id)
        : link?.assignee_choice === "unassigned"
          ? "unassigned"
          : "choose",
    );
    setRef(link?.breezeway_url ?? (link?.breezeway_task_id ? String(link.breezeway_task_id) : ""));
  }, [state.data?.link]);

  const parsed = parseBreezewayRef(ref);
  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          taskId,
          tentativeDate: date || null,
          assigneeChoice: assignee === "choose" ? null : assignee === "unassigned" ? "unassigned" : "person",
          breezewayPersonId: assignee !== "choose" && assignee !== "unassigned" ? Number(assignee) : null,
          breezewayRef: ref.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Breezeway details saved.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const send = useMutation({
    mutationFn: () => sendFn({ data: { taskId } }),
    onSuccess: (r) => {
      if (r && "ok" in r && r.ok === false) toast.error(r.message);
      else toast.success("Sent to Breezeway.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const people = state.data?.people ?? [];
  const peopleSorted = useMemo(() => people.slice().sort((a, b) => a.name.localeCompare(b.name)), [people]);
  if (state.isLoading) return <p className="text-sm text-muted-foreground">Loading Breezeway details…</p>;
  if (state.error) return <p className="text-sm text-destructive">{(state.error as Error).message}</p>;
  const data = state.data!;
  const linkedId = data.link?.breezeway_task_id ?? data.sentTaskId ?? null;
  const connection = breezewayConnection({ breezewayTaskId: linkedId, mirrored: Boolean(data.mirror) });
  const sendRefusal = sendToBreezewayRefusal({
    switchOn: data.sendSwitchOn,
    homeEligible: data.home?.eligible ?? false,
    homeReason: data.home?.reason ?? null,
    tentativeDate: data.link?.tentative_date ?? null,
    alreadyLinked: Boolean(linkedId),
  });
  const dirty =
    (date || "") !== (data.link?.tentative_date ?? "") ||
    assignee !==
      (data.link?.assignee_choice === "person" && data.link.breezeway_person_id
        ? String(data.link.breezeway_person_id)
        : data.link?.assignee_choice === "unassigned"
          ? "unassigned"
          : "choose") ||
    ref.trim() !== (data.link?.breezeway_url ?? (data.link?.breezeway_task_id ? String(data.link.breezeway_task_id) : ""));

  return (
    <section className="space-y-4 rounded-lg border border-primary/40 bg-primary/5 p-4" aria-label="Breezeway work order">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Breezeway work order</p>
        <Chip className={stateChip(connection === "connected" ? "done" : connection === "waiting_for_sync" ? "waiting" : "new")}>
          {CONNECTION_LABEL[connection]}
        </Chip>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`bz-date-${taskId}`}>Tentative date</Label>
          <Input id={`bz-date-${taskId}`} type="date" className="min-h-11" value={date} disabled={disabled}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Assign to</Label>
          <Select value={assignee} onValueChange={setAssignee} disabled={disabled}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="choose">Not chosen yet</SelectItem>
              <SelectItem value="unassigned">Leave unassigned</SelectItem>
              {peopleSorted.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`bz-ref-${taskId}`}>Breezeway task number or link</Label>
        <Input id={`bz-ref-${taskId}`} className="min-h-11" value={ref} disabled={disabled}
          placeholder="Paste it after you create the work order in Breezeway"
          onChange={(e) => setRef(e.target.value)} />
        {parsed && !parsed.ok ? <p className="text-xs text-destructive">{parsed.error}</p> : null}
      </div>
      <Button className="min-h-11 w-full sm:w-auto" disabled={disabled || save.isPending || !dirty || Boolean(parsed && !parsed.ok)}
        onClick={() => save.mutate()}>
        <Link2 className="size-4" /> {save.isPending ? "Saving…" : "Save Breezeway details"}
      </Button>

      {linkedId ? (
        <div className="space-y-2 rounded-lg border border-border bg-background/70 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{data.mirror?.name ?? `Breezeway task ${linkedId}`}</span>
            <a className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline"
              href={data.link?.breezeway_url ?? breezewayTaskUrl(linkedId)} target="_blank" rel="noopener noreferrer">
              Open in Breezeway <ExternalLink className="size-3.5" />
            </a>
          </p>
          {data.mirror ? (
            <>
              <p className="text-muted-foreground">Status: {data.mirror.stage || data.mirror.status || "Not reported"}</p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <UserCheck className="size-4 shrink-0" /> {data.mirror.assignee_names || "Not assigned in Breezeway"}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="size-4 shrink-0" />
                {data.mirror.scheduled_date ? `Scheduled ${usDate(data.mirror.scheduled_date)}` : "No date in Breezeway"}
              </p>
              {data.comments.length > 0 && (
                <div className="space-y-1">
                  <p className="eyebrow">Comments</p>
                  {data.comments.map((c, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {c.author ? `${c.author}: ` : ""}{c.body}{c.commented_at ? ` · ${usDateTime(c.commented_at)}` : ""}
                    </p>
                  ))}
                </div>
              )}
              {data.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {data.photos.filter((p) => p.url).map((p, i) => (
                    <a key={i} href={p.url!} target="_blank" rel="noopener noreferrer">
                      <img src={p.url!} alt={p.caption ?? "Breezeway photo"} className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              {data.mirror.last_synced_at ? (
                <p className="text-xs text-muted-foreground">From Breezeway {usDateTime(data.mirror.last_synced_at)}</p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">Not seen in the Breezeway sync yet. Status, comments and photos show here once it is.</p>
          )}
        </div>
      ) : null}

      <div className="space-y-1">
        <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={disabled || Boolean(sendRefusal) || send.isPending}
          onClick={() => {
            if (window.confirm("Create this work order in Breezeway now? It is sent once and cannot be recalled.")) send.mutate();
          }}>
          <Send className="size-4" /> Send to Breezeway
        </Button>
        {sendRefusal ? <p className="text-xs text-muted-foreground">{sendRefusal}</p> : null}
      </div>
      {data.history > 0 && data.link ? (
        <p className="text-xs text-muted-foreground">Last saved {usDateTime(data.link.updated_at)}</p>
      ) : null}
    </section>
  );
}

/** The home's Breezeway property, from the mirror, on the Breezeway setup steps. */
export function BreezewayHomeLink({ propertyId }: { propertyId: string }) {
  const fn = useServerFn(breezewayHomeLinkFn);
  const q = useQuery({ queryKey: ["breezeway-home-link", propertyId], queryFn: () => fn({ data: { propertyId } }) });
  if (!q.data) return null;
  const { breezewayPropertyId, mappingState, verifiedAt } = q.data;
  return (
    <section className="rounded-lg border border-border p-3 text-sm" aria-label="Breezeway property">
      <p className="eyebrow">Breezeway property</p>
      {breezewayPropertyId ? (
        <p className="mt-1">
          Breezeway home {breezewayPropertyId}
          {mappingState ? ` · ${mappingState === "verified" ? "Verified" : "Not verified yet"}` : ""}
          {verifiedAt ? ` ${usDate(verifiedAt.slice(0, 10))}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">This home is not linked to a Breezeway property yet.</p>
      )}
    </section>
  );
}
