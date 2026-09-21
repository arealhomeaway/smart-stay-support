/**
 * Contextual Email Composer.
 *
 * Opens on the record the employee is already working: the people it knows
 * about are offered as recipients, the shared templates fill the words, and
 * everything sent from that record stays visible underneath.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { usDateTime } from "@/lib/dates";
import {
  AUDIENCE_LABELS,
  CONTEXT_LABELS,
  MERGE_FIELDS,
  applyMergeFields,
  draftProblems,
  missingOwnerDetails,
  unresolvedFields,
  type ComposerContext,
  type MessageAudience,
} from "@/lib/email-composer";
import {
  getComposerContext,
  getMessageHistory,
  retireEmailTemplate,
  saveEmailTemplate,
  sendComposedEmail,
} from "@/lib/email-composer.functions";

type Props = {
  context: ComposerContext;
  recordId: string;
  /** Optional trigger label; defaults to "Write an email". */
  label?: string;
};

type TemplateRow = {
  id: string;
  name: string;
  audience: string;
  contexts: string[];
  subject: string;
  body: string;
};

const CUSTOM = "__custom__";
const BLANK = "__blank__";

export function EmailComposer({ context, recordId, label = "Write an email" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Mail className="size-4" aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(760px,95vw)] max-w-[95vw] overflow-y-auto">
        {open ? <ComposerBody context={context} recordId={recordId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ComposerBody({ context, recordId }: { context: ComposerContext; recordId: string }) {
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getComposerContext);
  const loadHistory = useServerFn(getMessageHistory);
  const send = useServerFn(sendComposedEmail);

  const ctx = useQuery({
    queryKey: ["composer-context", context, recordId],
    queryFn: () => loadContext({ data: { context, recordId } }),
  });
  const history = useQuery({
    queryKey: ["composer-history", context, recordId],
    queryFn: () => loadHistory({ data: { context, recordId } }),
  });

  const recipients = ctx.data?.recipients ?? [];
  const templates = (ctx.data?.templates ?? []) as TemplateRow[];
  const mergeValues = ctx.data?.mergeValues ?? {};

  const [recipientKey, setRecipientKey] = useState<string>("");
  const [customTo, setCustomTo] = useState("");
  const [templateId, setTemplateId] = useState<string>(BLANK);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<MessageAudience>("guest");

  // Pick the first known contact as soon as the record answers.
  useEffect(() => {
    if (!recipientKey && recipients[0]) {
      setRecipientKey(recipients[0].email);
      setAudience(recipients[0].audience);
    }
  }, [recipients, recipientKey]);

  const to = recipientKey === CUSTOM ? customTo : recipientKey;
  const recipientName =
    recipients.find((r) => r.email === to)?.name ?? null;

  function chooseTemplate(id: string) {
    setTemplateId(id);
    if (id === BLANK) return;
    const picked = templates.find((t) => t.id === id);
    if (!picked) return;
    setSubject(applyMergeFields(picked.subject, mergeValues));
    setBody(applyMergeFields(picked.body, mergeValues));
    setAudience(picked.audience as MessageAudience);
    const match = recipients.find((r) => r.audience === picked.audience);
    if (match) setRecipientKey(match.email);
  }

  const missing = useMemo(() => {
    const picked = templates.find((t) => t.id === templateId);
    if (!picked) return [];
    return unresolvedFields(`${picked.subject}\n${picked.body}`, mergeValues);
  }, [templateId, templates, mergeValues]);

  // A homeowner letter with no home or no homeowner name on it must not go out.
  const detailGaps = useMemo(
    () => missingOwnerDetails(mergeValues, audience),
    [mergeValues, audience],
  );

  const problems = [...draftProblems({ to, subject, body }), ...detailGaps];

  const sending = useMutation({
    mutationFn: () =>
      send({
        data: {
          context,
          recordId,
          to: to.trim(),
          subject,
          body,
          audience,
          templateId: templateId === BLANK ? null : templateId,
        },
      }),
    onSuccess: (result) => {
      if (result.status === "sent") {
        toast.success("Message sent.");
        setSubject("");
        setBody("");
        setTemplateId(BLANK);
      } else {
        toast.error(result.error ?? "The message did not go out.");
      }
      void queryClient.invalidateQueries({ queryKey: ["composer-history", context, recordId] });
      void history.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Email — {ctx.data?.heading ?? CONTEXT_LABELS[context]}</DialogTitle>
        <DialogDescription>
          Sent from the shared A Real Home Away inbox. Replies come back to the team.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="write" className="mt-2">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="history">Sent ({history.data?.rows.length ?? 0})</TabsTrigger>
          {ctx.data?.canManageTemplates ? (
            <TabsTrigger value="templates">Templates</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="write" className="space-y-4 pt-4">
          <div className="grid gap-2">
            <Label>To</Label>
            <Select
              value={recipientKey}
              onValueChange={(value) => {
                setRecipientKey(value);
                const match = recipients.find((r) => r.email === value);
                if (match) setAudience(match.audience);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose who this goes to" />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((r) => (
                  <SelectItem key={r.email} value={r.email}>
                    {r.label} · {r.email}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>Someone else…</SelectItem>
              </SelectContent>
            </Select>
            {recipientKey === CUSTOM ? (
              <Input
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                placeholder="name@example.com"
              />
            ) : null}
            {recipients.length === 0 && ctx.isSuccess ? (
              <p className="text-sm text-muted-foreground">
                This record has no contact on file yet — type an address above.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={chooseTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Start from a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BLANK}>Start blank</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {AUDIENCE_LABELS[t.audience as MessageAudience]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {missing.length > 0 ? (
              <p className="text-sm text-amber-700">
                This record could not fill in: {missing.join(", ").replace(/_/g, " ")} — please
                complete those lines yourself.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="composer-subject">Subject</Label>
            <Input
              id="composer-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="composer-body">Message</Label>
            <Textarea
              id="composer-body"
              value={body}
              rows={12}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the message. Edit anything the template filled in — every word is yours to change."
            />
          </div>

          {/* Exactly what leaves the inbox, read-only, before anyone presses Send. */}
          <section className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="eyebrow">Preview — exactly as it will arrive</p>
            {problems.length > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Finish the message below and the preview appears here.
              </p>
            ) : (
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">To</dt>
                  <dd className="break-all">
                    {recipientName ? `${recipientName} · ` : ""}
                    {to.trim()}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">Subject</dt>
                  <dd className="font-medium">{subject.trim()}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">Message</dt>
                  <dd className="whitespace-pre-wrap">{body.trim()}</dd>
                </div>
              </dl>
            )}
          </section>

          {problems.length > 0 ? (
            <ul className="text-sm text-muted-foreground">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}


          <div className="flex justify-end">
            <Button
              className="gap-2"
              disabled={problems.length > 0 || sending.isPending}
              onClick={() => sending.mutate()}
            >
              <Send className="size-4" aria-hidden />
              {sending.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3 pt-4">
          {(history.data?.rows.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been emailed about this yet.</p>
          ) : (
            history.data?.rows.map((row) => (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{row.subject}</p>
                  <StatusBadge
                    tone={
                      row.status === "sent"
                        ? "resolved"
                        : row.status === "failed"
                          ? "escalated"
                          : "waiting"
                    }
                  >
                    {row.status === "sent" ? "Sent" : row.status === "failed" ? "Failed" : "Not sent"}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">
                  To {row.recipient} · {usDateTime(row.sent_at ?? row.created_at)}
                </p>
                {row.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{row.body}</p>
                ) : null}
                {row.error_message ? (
                  <p className="mt-2 text-sm text-destructive">{row.error_message}</p>
                ) : null}
              </div>
            ))
          )}
        </TabsContent>

        {ctx.data?.canManageTemplates ? (
          <TabsContent value="templates" className="pt-4">
            <TemplateManager
              templates={templates}
              onChanged={() => {
                void ctx.refetch();
              }}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

function TemplateManager({
  templates,
  onChanged,
}: {
  templates: TemplateRow[];
  onChanged: () => void;
}) {
  const save = useServerFn(saveEmailTemplate);
  const retire = useServerFn(retireEmailTemplate);

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<MessageAudience>("guest");
  const [contexts, setContexts] = useState<ComposerContext[]>(["ticket"]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function edit(template: TemplateRow | null) {
    setEditing(template);
    setName(template?.name ?? "");
    setAudience((template?.audience as MessageAudience) ?? "guest");
    setContexts((template?.contexts as ComposerContext[]) ?? ["ticket"]);
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
  }

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: { id: editing?.id ?? null, name, audience, contexts, subject, body },
      }),
    onSuccess: () => {
      toast.success("Template saved.");
      edit(null);
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const retiring = useMutation({
    mutationFn: (id: string) => retire({ data: { id } }),
    onSuccess: () => {
      toast.success("Template retired.");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-muted-foreground">
                {AUDIENCE_LABELS[t.audience as MessageAudience]} ·{" "}
                {t.contexts.map((c) => CONTEXT_LABELS[c as ComposerContext]).join(", ")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => edit(t)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => retiring.mutate(t.id)}>
                Retire
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="font-medium">{editing ? `Editing ${editing.name}` : "New template"}</p>
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Who it is for</Label>
          <Select value={audience} onValueChange={(v) => setAudience(v as MessageAudience)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AUDIENCE_LABELS).map(([value, text]) => (
                <SelectItem key={value} value={value}>
                  {text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Where it can be used</Label>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(CONTEXT_LABELS) as ComposerContext[]).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={contexts.includes(value)}
                  onCheckedChange={(checked) =>
                    setContexts((prev) =>
                      checked ? [...new Set([...prev, value])] : prev.filter((c) => c !== value),
                    )
                  }
                />
                {CONTEXT_LABELS[value]}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Body</Label>
          <Textarea value={body} rows={10} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Fill-in fields: {MERGE_FIELDS.map((f) => `{{${f.key}}}`).join("  ")}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          {editing ? (
            <Button variant="ghost" onClick={() => edit(null)}>
              Cancel
            </Button>
          ) : null}
          <Button disabled={saving.isPending} onClick={() => saving.mutate()}>
            {saving.isPending ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
