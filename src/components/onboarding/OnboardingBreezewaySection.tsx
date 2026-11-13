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
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { breezewayFileRoute } from "@/lib/home-details";
import { Checkbox } from "@/components/ui/checkbox";
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
  breezewayTitleDefault,
  nextBreezewayTitle,
  parseBreezewayRef,
  sendToBreezewayRefusal,
} from "@/lib/onboarding-breezeway";
import { Textarea } from "@/components/ui/textarea";
import { SearchablePicker } from "@/components/SearchablePicker";
import { UNASSIGNED_VALUE, breezewayPersonOptions, breezewayTemplateOptions } from "@/lib/searchable-picker";
import {
  type OnboardingBreezewayState,
  breezewayHomeLinkFn,
  onboardingBreezewayStateFn,
  onboardingBreezewayTemplatesFn,
  saveOnboardingBreezewayFn,
  sendOnboardingWorkOrderFn,
} from "@/lib/onboarding-kati.functions";

const PRIORITIES = [
  { code: "low", label: "Low" },
  { code: "normal", label: "Normal" },
  { code: "high", label: "High" },
  { code: "urgent", label: "Urgent" },
  { code: "watch", label: "Watch" },
] as const;

export function OnboardingBreezewaySection({
  taskId,
  disabled,
  defaultTitle,
  defaultDescription,
  onSent,
}: {
  taskId: string;
  /** Item 35: called after Breezeway accepts the send, so the drawer can close. */
  onSent?: () => void;
  /** B2: prefilled from the Task, editable before sending. */
  defaultTitle?: string;
  defaultDescription?: string | null;
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
  // Item 33: Unassigned is a choice and the default.
  const [assignee, setAssignee] = useState<string>(UNASSIGNED_VALUE);
  const [ref, setRef] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [priority, setPriority] = useState("normal");
  // Item 37: the Title follows the chosen template until the user edits it.
  const [title, setTitle] = useState(() => breezewayTitleDefault(defaultTitle));
  const [description, setDescription] = useState(defaultDescription ?? "");
  // Part 3 (3.8): a note signed with the sender's name, and the Task's files to go with it.
  const [note, setNote] = useState("");
  const [fileIds, setFileIds] = useState<string[]>([]);
  const filesFn = useServerFn(listAttachmentsFn);
  const taskFiles = useQuery({ queryKey: ["attachments", "onboarding_task", taskId], queryFn: () => filesFn({ data: { entityType: "onboarding_task", entityId: taskId } }) });
  const templatesFn = useServerFn(onboardingBreezewayTemplatesFn);
  const templates = useQuery({ queryKey: ["onboarding-breezeway-templates"], queryFn: () => templatesFn(), staleTime: 10 * 60_000 });
  const savedAssignee = (link: OnboardingBreezewayState["link"] | undefined) =>
    link?.assignee_choice === "person" && link.breezeway_person_id
      ? String(link.breezeway_person_id)
      : link?.assignee_choice === "unassigned"
        ? UNASSIGNED_VALUE
        : null;
  const savedRef = (link: OnboardingBreezewayState["link"] | undefined) =>
    link?.breezeway_url ?? (link?.breezeway_task_id ? String(link.breezeway_task_id) : "");
  useEffect(() => {
    const link = state.data?.link;
    setDate(link?.tentative_date ?? "");
    setAssignee(savedAssignee(link) ?? UNASSIGNED_VALUE);
    setRef(savedRef(link));
    if (savedRef(link)) setPasteOpen(true);
  }, [state.data?.link]);

  const parsed = parseBreezewayRef(ref);
  const saveInput = () => ({
    taskId,
    tentativeDate: date || null,
    assigneeChoice: assignee === UNASSIGNED_VALUE ? ("unassigned" as const) : ("person" as const),
    breezewayPersonId: assignee !== UNASSIGNED_VALUE ? Number(assignee) : null,
    breezewayRef: ref.trim(),
  });
  const save = useMutation({
    mutationFn: () => saveFn({ data: saveInput() }),
    onSuccess: () => {
      toast.success("Breezeway details saved.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const send = useMutation({
    mutationFn: async () => {
      // The date and Assign to are saved with the send, so one press does both.
      if (dirty) await saveFn({ data: saveInput() });
      return sendFn({
        data: {
          taskId,
          templateId: Number(templateId),
          priority: priority as (typeof PRIORITIES)[number]["code"],
          title: title.trim(),
          description: description.trim() || null,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(fileIds.length ? { fileIds } : {}),
        },
      });
    },
    onSuccess: (r) => {
      if (r && "ok" in r && r.ok === false) toast.error(r.message);
      else {
        const missed = (r as { filesNotAdded?: string[] } | undefined)?.filesNotAdded ?? [];
        if (missed.length) toast.message(`Sent to Breezeway. Not added: ${missed.join(", ")}. Add them in Breezeway.`);
        else toast.success("Sent to Breezeway.");
        onSent?.();
      }
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: key });
    },
  });

  const people = state.data?.people ?? [];
  const personOptions = useMemo(() => breezewayPersonOptions(people), [people]);
  const templateOptions = useMemo(() => breezewayTemplateOptions(templates.data?.templates ?? []), [templates.data]);
  const templateName = (id: string | null) =>
    id ? (templates.data?.templates ?? []).find((t) => String(t.id) === id)?.name ?? null : null;
  const chooseTemplate = (id: string | null) => {
    setTitle((current) =>
      nextBreezewayTitle(current, breezewayTitleDefault(defaultTitle, templateName(templateId)), breezewayTitleDefault(defaultTitle, templateName(id))),
    );
    setTemplateId(id);
  };
  if (state.isLoading) return <p className="text-sm text-muted-foreground">Loading Breezeway details…</p>;
  if (state.error) return <p className="text-sm text-destructive">{(state.error as Error).message}</p>;
  const data = state.data!;
  const linkedId = data.link?.breezeway_task_id ?? data.sentTaskId ?? null;
  const connection = breezewayConnection({ breezewayTaskId: linkedId, mirrored: Boolean(data.mirror) });
  const sendRefusal =
    sendToBreezewayRefusal({
      switchOn: data.sendSwitchOn,
      homeEligible: data.home?.eligible ?? false,
      homeReason: data.home?.reason ?? null,
      tentativeDate: date || null,
      alreadyLinked: Boolean(linkedId),
    }) ??
    (!templateId ? "Choose a Breezeway template." : null) ??
    (title.trim().length < 3 ? "Give the work order a title." : null);
  const dirty =
    (date || "") !== (data.link?.tentative_date ?? "") ||
    assignee !== savedAssignee(data.link) ||
    ref.trim() !== savedRef(data.link);

  return (
    <section className="space-y-4 rounded-lg border border-primary/40 bg-primary/5 p-4" aria-label="Breezeway work order">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Breezeway work order</p>
        <Chip className={stateChip(connection === "connected" ? "done" : connection === "waiting_for_sync" ? "waiting" : "new")}>
          {CONNECTION_LABEL[connection]}
        </Chip>
      </div>

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
              <p className="text-muted-foreground">Breezeway number {linkedId} · Status: {data.mirror.stage || data.mirror.status || "Not reported"}</p>
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

      {/* Item 33: template, Assign to, Tentative date, Priority, Title, Description, then Send. */}
      <div className="space-y-3">
        {!linkedId ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`bz-template-${taskId}`}>Breezeway template</Label>
            <SearchablePicker
              id={`bz-template-${taskId}`}
              label="Breezeway template"
              value={templateId}
              options={templateOptions}
              onChange={chooseTemplate}
              placeholder="Choose a template"
              searchPlaceholder="Type part of the template name"
              loading={templates.isLoading}
              disabled={disabled}
            />
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor={`bz-assign-${taskId}`}>Assign to</Label>
          <SearchablePicker
            id={`bz-assign-${taskId}`}
            label="Assign to"
            value={assignee}
            options={personOptions}
            onChange={setAssignee}
            placeholder="Unassigned"
            searchPlaceholder="Type part of a name"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`bz-date-${taskId}`}>Tentative date</Label>
          <Input id={`bz-date-${taskId}`} type="date" className="min-h-11" value={date} disabled={disabled}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        {!linkedId ? (
          <>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority} disabled={disabled}>
                <SelectTrigger className="min-h-11" aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`bz-title-${taskId}`}>Title</Label>
              <Input id={`bz-title-${taskId}`} className="min-h-11" value={title} disabled={disabled} maxLength={200}
                onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`bz-desc-${taskId}`}>Description</Label>
              <Textarea id={`bz-desc-${taskId}`} rows={3} value={description} disabled={disabled} maxLength={4000}
                onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`bz-note-${taskId}`}>Your note (optional)</Label>
              <Textarea id={`bz-note-${taskId}`} rows={2} value={note} disabled={disabled} maxLength={1000}
                placeholder="Added under the description with your name"
                onChange={(e) => setNote(e.target.value)} />
            </div>
            {(taskFiles.data?.files ?? []).length ? (
              <fieldset className="grid gap-1.5">
                <legend className="text-sm font-medium">Files to send</legend>
                {((taskFiles.data?.files ?? []) as { id: string; title: string | null; original_filename: string | null; mime_type: string | null; size_bytes: number | null }[]).map((f) => (
                  <label key={f.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <Checkbox
                      checked={fileIds.includes(f.id)}
                      disabled={disabled}
                      onCheckedChange={(v) => setFileIds((cur) => (v ? [...cur, f.id] : cur.filter((x) => x !== f.id)))}
                    />
                    <span className="min-w-0 flex-1 truncate">{f.original_filename ?? f.title}</span>
                    <span className="text-xs text-muted-foreground">{breezewayFileRoute(f) === "upload" ? "Photo" : "Sent as a link"}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="space-y-1">
        <Button className="min-h-11 w-full sm:w-auto" disabled={disabled || Boolean(sendRefusal) || send.isPending}
          onClick={() => {
            if (window.confirm("Create this work order in Breezeway now? It is sent once and cannot be recalled.")) send.mutate();
          }}>
          <Send className="size-4" /> {send.isPending ? "Sending…" : "Send to Breezeway"}
        </Button>
        {sendRefusal ? <p className="text-xs text-muted-foreground">{sendRefusal}</p> : null}
      </div>

      {/* Item 33: pasting a number made in Breezeway is a small link under the button. */}
      {!pasteOpen ? (
        <Button variant="link" className="h-auto min-h-11 px-0 text-sm" disabled={disabled} aria-expanded={false}
          onClick={() => setPasteOpen(true)}>
          Already made it in Breezeway? Paste its number
        </Button>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor={`bz-ref-${taskId}`}>Breezeway number or link</Label>
          <Input id={`bz-ref-${taskId}`} className="min-h-11" value={ref} disabled={disabled}
            placeholder="For example 81234567"
            onChange={(e) => setRef(e.target.value)} />
          {parsed && !parsed.ok ? <p className="text-xs text-destructive">{parsed.error}</p> : null}
          <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={disabled || save.isPending || !dirty || Boolean(parsed && !parsed.ok)}
            onClick={() => save.mutate()}>
            <Link2 className="size-4" /> {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
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
