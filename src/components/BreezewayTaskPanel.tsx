import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
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
};

const STATUS_LABEL: Record<string, string> = OUTBOUND_STATUS_LABEL;

/** Uncertain is neither success nor failure — it must not read as either. */
function statusVariant(status: string) {
  if (status === "error" || status === "abandoned") return "destructive" as const;
  if (status === "needs_review") return "secondary" as const;
  if (status === "creating") return "outline" as const;
  return "default" as const;
}

/**
 * Send-to-Breezeway control for one Resolve record.
 *
 * Resolve stays the source of truth: this creates a downstream Breezeway work order
 * and records the link. A fresh request key is minted per composed request, so
 * double-clicks and retries can never produce two Breezeway work orders — only a
 * deliberate new send does.
 */
export function BreezewayTaskPanel({
  sourceType,
  sourceId,
  defaultTitle,
  defaultDescription,
}: Props) {
  const qc = useQueryClient();
  const stateFn = useServerFn(breezewayOutboundState);
  const optionsFn = useServerFn(breezewayCreationOptions);
  const createFn = useServerFn(createBreezewayOutboundTask);

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [department, setDepartment] = useState<string>("maintenance");
  const [templateId, setTemplateId] = useState<string>("none");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [scheduledDate, setScheduledDate] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    setTitle(defaultTitle);
  }, [defaultTitle]);

  const queryKey = useMemo(() => ["breezeway-outbound", sourceType, sourceId], [sourceType, sourceId]);

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
  });
  const templates = options.data?.templates ?? [];
  const assignees = options.data?.assignees ?? [];
  const visibleTemplates = useMemo(
    () => templates.filter((t) => !t.department || !department || t.department === department),
    [templates, department],
  );

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
          templateId: templateId === "none" ? null : Number(templateId),
          assigneeIds,
          resolveEvidenceNote: evidenceNote || null,
        },
      }),
    onSuccess: (result) => {
      if (result && "ok" in result && !result.ok) {
        toast.error(result.message);
        // A definite failure created nothing in Breezeway, so the operator can
        // send again straight away without reloading the page.
        if ("retryable" in result && result.retryable) setRequestKey(crypto.randomUUID());
      } else {
        toast.success("Sent to Breezeway.");
        // A new key means the next send is a deliberate second task, not a retry.
        setRequestKey(crypto.randomUUID());
        setAssigneeIds([]);
        setEvidenceNote("");
      }
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (state.isLoading || !state.data) return null;

  const { eligibility, links } = state.data;
  const unresolved = links.find((l) => l.status === "creating" || l.status === "needs_review");
  if (!eligibility.enabled && links.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ExternalLink className="size-4" /> Breezeway
          <Badge variant={eligibility.eligible ? "default" : "secondary"}>
            {eligibility.eligible ? "Pilot property" : "Unavailable"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Creates a Breezeway work order from this record. Resolve stays the source of truth — Breezeway
          never changes anything here.
          {eligibility.reason ? ` ${eligibility.reason}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {links.length ? (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-xs"
              >
                <Badge variant={statusVariant(link.status)}>
                  {STATUS_LABEL[link.status] ?? link.status}
                </Badge>
                <span className="font-medium">{link.title}</span>
                {link.breezewayTaskId ? (
                  <span className="font-mono text-muted-foreground">#{link.breezewayTaskId}</span>
                ) : null}
                <span className="text-muted-foreground">
                  {new Date(link.createdAt).toLocaleString()}
                </span>
                {link.errorMessage ? (
                  <span
                    className={
                      link.status === "needs_review" ? "text-amber-700" : "text-destructive"
                    }
                  >
                    {link.errorMessage}
                  </span>
                ) : null}
                {link.status === "needs_review" ? (
                  <span className="w-full text-amber-700">
                    Resolve cannot confirm whether Breezeway created this task. An admin must check
                    Breezeway and resolve it from Integrations — do not send it again.
                  </span>
                ) : null}
                {link.templateName ? (
                  <span className="text-muted-foreground">Template: {link.templateName}</span>
                ) : null}
                {link.assigneeNames.length ? (
                  <span className="text-muted-foreground">
                    Assigned: {link.assigneeNames.join(", ")}
                  </span>
                ) : null}
                {link.resolveEvidenceNote ? (
                  <span className="w-full text-muted-foreground">
                    Resolve evidence (kept in Resolve, not uploaded to Breezeway):{" "}
                    {link.resolveEvidenceNote}
                  </span>
                ) : null}
                {link.reviewNote ? (
                  <span className="w-full text-muted-foreground">Review: {link.reviewNote}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {!links.length ? (
          <p className="text-xs text-muted-foreground">Not sent to Breezeway.</p>
        ) : null}

        {eligibility.eligible && !unresolved ? (
          <details className="group rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Send this to Breezeway
            </summary>
            <div className="mt-3 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bz-title">Task title</Label>
              <Input id="bz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bz-desc">Description</Label>
              <Textarea
                id="bz-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Department</Label>
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
                <Label>Priority</Label>
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
                <Label htmlFor="bz-date">Scheduled date</Label>
                <Input
                  id="bz-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Breezeway template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="No template" />
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
              <p className="text-xs text-muted-foreground">
                Templates come straight from Breezeway. Choosing one attaches its checklist to the
                work order.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>Assign to</Label>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-2">
                {assignees.length === 0 ? (
                  <p className="p-1 text-xs text-muted-foreground">
                    No Breezeway people available. The work order can still be created unassigned.
                  </p>
                ) : (
                  assignees.map((person) => {
                    const checked = assigneeIds.includes(person.id);
                    return (
                      <label
                        key={person.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted"
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
                          <span className="text-muted-foreground">{person.email}</span>
                        ) : null}
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Only real Breezeway people are listed, so an assignment here always reaches
                Breezeway.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="bz-evidence">Resolve evidence reference</Label>
              <Textarea
                id="bz-evidence"
                rows={2}
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
                placeholder="Which Resolve photos or documents support this work order"
              />
              <p className="text-xs text-muted-foreground">
                Files stay attached in Resolve. Breezeway's API does not accept file uploads from
                Resolve at creation time, so nothing here is sent to Breezeway — Breezeway-native
                task photos continue to mirror back into Resolve.
              </p>
            </div>

            <div>
              <Button disabled={send.isPending || !title.trim()} onClick={() => send.mutate()}>
                <Send className="size-4" />
                {send.isPending ? "Sending…" : "Send to Breezeway"}
              </Button>
            </div>
            </div>
          </details>
        ) : null}

        {eligibility.eligible && unresolved ? (
          <p className="text-xs text-amber-700">
            An earlier request for this record is still open. Sending is paused until it is
            resolved, so a duplicate Breezeway work order cannot be created.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
