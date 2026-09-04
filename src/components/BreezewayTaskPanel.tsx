/**
 * "Send for repair" — the one visible repair path in Operations.
 *
 * Before it is sent this is a single dominant button that opens a focused
 * sheet. After it is sent the inputs collapse and the ticket shows a short
 * repair summary instead: who has it, what Breezeway says, when it is
 * scheduled, the latest update and what the coordinator does next.
 *
 * Resolve stays the source of truth. Breezeway never changes anything here,
 * and a fresh request key per composed request makes a double-click or a
 * retry incapable of producing two work orders.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Search, Send, UserCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { TaskWorkspace } from "@/components/ui/workspace";
import { SpecialHandlingNotice } from "@/components/SpecialHandlingNotice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BREEZEWAY_DEPARTMENTS,
  BREEZEWAY_PRIORITIES,
  OUTBOUND_STATUS_LABEL,
} from "@/lib/breezeway-outbound";
import {
  breezewayCreationOptions,
  breezewayOutboundState,
  createBreezewayOutboundTask,
} from "@/lib/breezeway-outbound.functions";

type Props = {
  sourceType: "ticket" | "onboarding_task";
  sourceId: string;
  defaultTitle: string;
  defaultDescription?: string | null;
  /** Live Special Handling is read straight from the property, never copied. */
  propertyId?: string | null;
  /** Spending / owner-approval result, computed by the policy engine upstream. */
  authorityNote?: string | null;
};

const STATUS_LABEL: Record<string, string> = OUTBOUND_STATUS_LABEL;

function statusVariant(status: string) {
  if (status === "error" || status === "abandoned") return "destructive" as const;
  if (status === "needs_review") return "secondary" as const;
  if (status === "creating") return "outline" as const;
  return "default" as const;
}

/** What the coordinator does next, in plain words, from the link's own state. */
function repairNextAction(link: {
  status: string;
  assigneeNames: string[];
  scheduledDate: string | null;
}) {
  if (link.status === "needs_review")
    return "Do not send this again. An admin checks Breezeway and clears it from Integrations.";
  if (link.status === "error") return "The send failed. Compose the repair again.";
  if (!link.assigneeNames.length)
    return "Nobody is assigned in Breezeway yet — chase an assignment.";
  if (!link.scheduledDate)
    return "No date is committed yet. Get a window and park this as waiting.";
  return "Watch for completion, then verify the evidence before you close.";
}

export function BreezewayTaskPanel({
  sourceType,
  sourceId,
  defaultTitle,
  defaultDescription,
  propertyId,
  authorityNote,
}: Props) {
  const qc = useQueryClient();
  const stateFn = useServerFn(breezewayOutboundState);
  const optionsFn = useServerFn(breezewayCreationOptions);
  const createFn = useServerFn(createBreezewayOutboundTask);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [department, setDepartment] = useState<string>("maintenance");
  const [templateId, setTemplateId] = useState<string>("none");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [scheduledDate, setScheduledDate] = useState("");
  // Vendors commit to a window, not a day. The time is stored with the task so
  // the checkpoint and the "past the committed date" read agree.
  const [scheduledTime, setScheduledTime] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    setTitle(defaultTitle);
  }, [defaultTitle]);

  const queryKey = useMemo(
    () => ["breezeway-outbound", sourceType, sourceId],
    [sourceType, sourceId],
  );

  const state = useQuery({
    queryKey,
    queryFn: () => stateFn({ data: { sourceType, sourceId } }),
  });

  // Breezeway's own directories — never a hardcoded list, so a renamed template
  // or a deactivated worker disappears here too.
  const options = useQuery({
    queryKey: ["breezeway-create-options"],
    queryFn: () => optionsFn({ data: undefined as never }),
    staleTime: 10 * 60_000,
    enabled: open,
  });
  const templates = options.data?.templates ?? [];
  const assignees = options.data?.assignees ?? [];
  const visibleTemplates = useMemo(
    () => templates.filter((t) => !t.department || !department || t.department === department),
    [templates, department],
  );
  const matchingAssignees = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return assignees.slice(0, 12);
    return assignees
      .filter((p) => `${p.name} ${p.email ?? ""}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [assignees, assigneeSearch]);

  const send = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          sourceType,
          sourceId,
          requestKey,
          title,
          description: description || null,
          department,
          priority,
          scheduledDate: scheduledDate || null,
          scheduledTime: scheduledTime || null,
          templateId: templateId === "none" ? null : Number(templateId),
          assigneeIds,
          resolveEvidenceNote: evidenceNote || null,
        },
      }),
    onSuccess: (result) => {
      if (result && "ok" in result && !result.ok) {
        toast.error(result.message);
        if ("retryable" in result && result.retryable) setRequestKey(crypto.randomUUID());
      } else {
        toast.success("Sent for repair.");
        setRequestKey(crypto.randomUUID());
        setAssigneeIds([]);
        setEvidenceNote("");
        setScheduledDate("");
        setScheduledTime("");
        setOpen(false);
      }
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (state.isLoading || !state.data) return null;

  const { eligibility, links } = state.data;
  const unresolved = links.find((l) => l.status === "creating" || l.status === "needs_review");
  if (!eligibility.enabled && links.length === 0) return null;

  const latest = links[0] ?? null;
  const canSend = eligibility.eligible && !unresolved;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="size-4" /> Repair
        </CardTitle>
        <CardDescription>
          {latest
            ? "This is with the field team. Resolve keeps the ticket; Breezeway does the work."
            : eligibility.eligible
              ? "Send this to the field team and Resolve tracks it from here."
              : `Repair sending is unavailable for this property. ${eligibility.reason ?? ""}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* After creation the inputs are gone: a short summary replaces them. */}
        {latest && (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(latest.status)}>
                {STATUS_LABEL[latest.status] ?? latest.status}
              </Badge>
              <span className="font-medium">{latest.title}</span>
              {latest.breezewayTaskId ? (
                <span className="font-mono text-xs text-muted-foreground">
                  #{latest.breezewayTaskId}
                </span>
              ) : null}
            </div>
            <p className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="size-4 shrink-0" />
              {latest.assigneeNames.length ? latest.assigneeNames.join(", ") : "Not assigned yet"}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="size-4 shrink-0" />
              {latest.scheduledDate
                ? `Scheduled ${new Date(latest.scheduledDate).toLocaleDateString()}${latest.scheduledTime ? ` at ${latest.scheduledTime.slice(0, 5)}` : ""}`
                : "No date committed"}
            </p>
            <p className="text-xs text-muted-foreground">
              Latest update{" "}
              {new Date(
                latest.lastWebhookAt ?? latest.lastSyncedAt ?? latest.createdAt,
              ).toLocaleString()}
              {latest.errorMessage ? ` · ${latest.errorMessage}` : ""}
              {latest.reviewNote ? ` · ${latest.reviewNote}` : ""}
            </p>
            <p className="rounded-md bg-background/70 p-2 text-sm">
              <span className="font-medium">Next: </span>
              {repairNextAction(latest)}
            </p>
          </div>
        )}

        {links.length > 1 && (
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Earlier repair requests ({links.length - 1})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {links.slice(1).map((link) => (
                <li key={link.id}>
                  {STATUS_LABEL[link.status] ?? link.status} · {link.title} ·{" "}
                  {new Date(link.createdAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </details>
        )}

        {canSend && (
          <Button className="w-full" size="lg" onClick={() => setOpen(true)}>
            <Wrench className="size-4" /> {latest ? "Send another repair" : "Send for repair"}
          </Button>
        )}

        {eligibility.eligible && unresolved ? (
          <p className="text-xs text-warning-foreground">
            An earlier request for this record is still open. Sending is paused until it is
            resolved, so a duplicate work order cannot be created.
          </p>
        ) : null}
      </CardContent>

      <TaskWorkspace
        open={open}
        onOpenChange={setOpen}
        title="Send for repair"
        subtitle="You already own this ticket. This is who does the field work, and when."
      >
        <div className="space-y-5 text-sm">
          <SpecialHandlingNotice propertyId={propertyId} moment="maintenance" />

          {authorityNote ? (
            <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              {authorityNote}
            </p>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="bz-title">What needs fixing</Label>
            <Input id="bz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              id="bz-desc"
              rows={3}
              placeholder="Scope: what is wrong, what you already checked, what done looks like"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Trade</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREEZEWAY_DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Urgency</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREEZEWAY_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bz-date">Scheduled / due</Label>
              <Input
                id="bz-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bz-time">Committed time (optional)</Label>
              <Input
                id="bz-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={!scheduledDate}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Checklist template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {visibleTemplates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Who is doing the work</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search Breezeway people and vendors"
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
              />
            </div>
            <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {options.isLoading && (
                <p className="p-2 text-xs text-muted-foreground">Loading people…</p>
              )}
              {!options.isLoading && matchingAssignees.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">
                  No match. The repair can still be sent unassigned.
                </p>
              )}
              {matchingAssignees.map((person) => {
                const checked = assigneeIds.includes(person.id);
                return (
                  <label
                    key={person.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary ${
                      checked ? "bg-secondary" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setAssigneeIds((prev) =>
                          checked ? prev.filter((id) => id !== person.id) : [...prev, person.id],
                        )
                      }
                    />
                    <span>{person.name}</span>
                    {person.email ? (
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {person.email}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Evidence is attached once, here, in the same flow. Breezeway-native
                task photos continue to mirror back onto this record. */}
          <div className="space-y-2">
            <AttachmentsPanel
              entityType={sourceType === "ticket" ? "ticket" : "onboarding_task"}
              entityId={sourceId}
              title="Photos for the field team"
            />
            <Textarea
              rows={2}
              placeholder="Anything the photos do not show"
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={send.isPending || !title.trim()}
            onClick={() => send.mutate()}
          >
            <Send className="size-4" />
            {send.isPending ? "Sending…" : "Send to Breezeway"}
          </Button>
        </div>
      </TaskWorkspace>
    </Card>
  );
}
