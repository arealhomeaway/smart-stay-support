/**
 * Contextual Email Composer.
 *
 * Opens on the record the employee is already working: the people it knows
 * about are offered as recipients, the shared templates fill the words, and
 * everything sent from that record stays visible underneath.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, Mail, Paperclip, Send, X } from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  EMPTY_RECIPIENTS,
  RECIPIENT_FIELD_LABELS,
  SEND_TIME_ZONES,
  addRecipients,
  isEmailAddress,
  removeRecipient,
  scheduleProblems,
  sendGate,
  unresolvedFields,
  withSignature,
  zonedToInstant,
  type RecipientField,
  type RecipientLists,
  type RecipientSuggestion,
  type ComposerContext,
  type MessageAudience,
} from "@/lib/email-composer";
import { RecipientCombobox } from "@/components/RecipientCombobox";
import {
  getComposerContext,
  getMessageHistory,
  retireEmailTemplate,
  saveEmailTemplate,
  saveMySignature,
  sendComposedEmail,
} from "@/lib/email-composer.functions";
import { clearDraft, loadDraft, saveDraft } from "@/lib/email-draft-store";

type Props = {
  context: ComposerContext;
  recordId: string;
  /** Optional trigger label; defaults to "Write an email". */
  label?: string;
  /** Pre-written subject, e.g. a property options summary. Still fully editable. */
  initialSubject?: string;
  /** Pre-written body. Still fully editable. */
  initialBody?: string;
  disabled?: boolean;
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

export function EmailComposer({
  context,
  recordId,
  label = "Write an email",
  initialSubject,
  initialBody,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          <Mail className="size-4" aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(760px,95vw)] max-w-[95vw] overflow-y-auto">
        {open ? (
          <ComposerBody
            context={context}
            recordId={recordId}
            {...(initialSubject === undefined ? {} : { initialSubject })}
            {...(initialBody === undefined ? {} : { initialBody })}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ComposerBody({
  context,
  recordId,
  initialSubject,
  initialBody,
}: {
  context: ComposerContext;
  recordId: string;
  initialSubject?: string;
  initialBody?: string;
}) {
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
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [audience, setAudience] = useState<MessageAudience>("guest");
  const [signature, setSignature] = useState("");

  // The writer's own sign-off, loaded once and then theirs to edit. It goes on
  // the foot of the draft automatically, and never twice.
  const signatureLoaded = useRef(false);
  useEffect(() => {
    const saved = ctx.data?.signature;
    if (signatureLoaded.current || saved === undefined) return;
    signatureLoaded.current = true;
    setSignature(saved ?? "");
    if (saved) setBody((current) => withSignature(current, saved));
  }, [ctx.data?.signature]);

  const persistSignature = useServerFn(saveMySignature);
  const saveSignature = useMutation({
    mutationFn: (value: string) => persistSignature({ data: { signature: value } }),
    onSuccess: () => {
      toast.success("Signature saved.");
      void queryClient.invalidateQueries({ queryKey: ["composer-context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Pick the first known contact as soon as the record answers.
  useEffect(() => {
    if (!recipientKey && recipients[0]) {
      setRecipientKey(recipients[0].email);
      setAudience(recipients[0].audience);
    }
  }, [recipients, recipientKey]);

  // Anything typed before is offered back rather than silently reinstated,
  // so nobody sends a half-message they had already abandoned.
  const [recovered, setRecovered] = useState<ReturnType<typeof loadDraft>>(null);
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    setRecovered(loadDraft(context, recordId));
  }, [context, recordId]);

  function restoreDraft() {
    if (!recovered) return;
    setRecipientKey(recovered.recipientKey);
    setCustomTo(recovered.customTo);
    setTemplateId(recovered.templateId || BLANK);
    setSubject(recovered.subject);
    setBody(recovered.body);
    setAudience(recovered.audience as MessageAudience);
    setRecovered(null);
  }

  function discardDraft() {
    clearDraft(context, recordId);
    setRecovered(null);
  }

  // Kept on this device as they type, a beat behind so typing stays smooth.
  useEffect(() => {
    if (recovered) return;
    const timer = setTimeout(() => {
      saveDraft(context, recordId, {
        recipientKey,
        customTo,
        templateId,
        subject,
        body,
        audience,
        mergeValues,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    recovered,
    context,
    recordId,
    recipientKey,
    customTo,
    templateId,
    subject,
    body,
    audience,
    mergeValues,
  ]);

  const to = recipientKey === CUSTOM ? customTo : recipientKey;
  const recipientName =
    recipients.find((r) => r.email === to)?.name ?? null;

  function chooseTemplate(id: string) {
    setTemplateId(id);
    if (id === BLANK) return;
    const picked = templates.find((t) => t.id === id);
    if (!picked) return;
    setSubject(applyMergeFields(picked.subject, mergeValues));
    setBody(withSignature(applyMergeFields(picked.body, mergeValues), signature));
    setAudience(picked.audience as MessageAudience);
    const match = recipients.find((r) => r.audience === picked.audience);
    if (match) setRecipientKey(match.email);
  }

  const missing = useMemo(() => {
    const picked = templates.find((t) => t.id === templateId);
    if (!picked) return [];
    return unresolvedFields(`${picked.subject}\n${picked.body}`, mergeValues);
  }, [templateId, templates, mergeValues]);

  // One rule for the button, the preview and the messages under each box.
  // A homeowner letter with no home or no homeowner name on it must not go out.
  const gate = useMemo(
    () => sendGate({ to, subject, body }, mergeValues, audience),
    [to, subject, body, mergeValues, audience],
  );
  const fieldProblems = gate.fields;

  // Keyboard users get sent to the box that needs them, not left hunting for it.
  const toRef = useRef<HTMLButtonElement>(null);
  const customToRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const toDescribedBy =
    [
      fieldProblems.to ? "composer-to-error" : null,
      recipients.length === 0 && ctx.isSuccess ? "composer-to-hint" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const bodyDescribedBy =
    [
      fieldProblems.body ? "composer-body-error" : null,
      fieldProblems.unfilled.length > 0 ? "composer-body-blanks" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  function focusProblem(problem: string) {
    if (problem === fieldProblems.subject) subjectRef.current?.focus();
    else if (problem === fieldProblems.body) bodyRef.current?.focus();
    else if (problem === fieldProblems.to)
      (customToRef.current ?? toRef.current)?.focus();
    else toRef.current?.focus();
  }

  // Extra people on the message, each one a chip you can take off again.
  const [extra, setExtra] = useState<RecipientLists>(EMPTY_RECIPIENTS);
  const [chipDraft, setChipDraft] = useState<Record<RecipientField, string>>({
    to: "",
    cc: "",
    bcc: "",
  });
  const [chipError, setChipError] = useState<string | null>(null);

  function commitChips(field: RecipientField) {
    const raw = chipDraft[field];
    if (!raw.trim()) return;
    const withPrimary: RecipientLists = {
      ...extra,
      to: [...(isEmailAddress(to) ? [to.trim()] : []), ...extra.to],
    };
    const result = addRecipients(withPrimary, field, raw);
    setChipError(result.errors[0] ?? null);
    if (result.added.length > 0) {
      setExtra({
        to: result.lists.to.filter((a) => a.toLowerCase() !== to.trim().toLowerCase()),
        cc: result.lists.cc,
        bcc: result.lists.bcc,
      });
      setChipDraft((d) => ({ ...d, [field]: "" }));
    }
  }

  function dropChip(field: RecipientField, address: string) {
    setExtra((lists) => removeRecipient(lists, field, address));
    setChipError(null);
  }

  /** Someone clicked an address in the dropdown instead of typing it out. */
  function pickChip(field: RecipientField, email: string) {
    const withPrimary: RecipientLists = {
      ...extra,
      to: [...(isEmailAddress(to) ? [to.trim()] : []), ...extra.to],
    };
    const result = addRecipients(withPrimary, field, email);
    setChipError(result.errors[0] ?? null);
    if (result.added.length > 0) {
      setExtra({
        to: result.lists.to.filter((a) => a.toLowerCase() !== to.trim().toLowerCase()),
        cc: result.lists.cc,
        bcc: result.lists.bcc,
      });
    }
  }

  // Everything the person can pick from without typing: the contacts on this
  // record, plus addresses this mailbox has written to before.
  const previous = ctx.data?.previousContacts ?? [];
  const suggestionList: RecipientSuggestion[] = [
    ...recipients.map((r) => ({ email: r.email, name: r.label, group: "record" as const })),
    ...previous.map((p) => ({
      email: p.email,
      group: "previous" as const,
      lastSentAt: p.lastSentAt,
    })),
  ];

  // Anything typed into a recipient box but not yet turned into a chip still
  // has to be a real address — half-typed text must not slip out with the send.
  const pendingChipProblems = (["to", "cc", "bcc"] as RecipientField[]).flatMap((field) =>
    chipDraft[field]
      .split(/[,;\s]+/)
      .map((piece) => piece.trim())
      .filter(Boolean)
      .filter((piece) => !isEmailAddress(piece))
      .map((piece) => `${piece} is not a valid email address.`),
  );
  const invalidChipProblems = [...extra.to, ...extra.cc, ...extra.bcc]
    .filter((address) => !isEmailAddress(address))
    .map((address) => `${address} is not a valid email address.`);
  const recipientListProblems = [...new Set([...pendingChipProblems, ...invalidChipProblems])];

  // Files ride along with the message; they are read only when Send is pressed.
  const [files, setFiles] = useState<File[]>([]);
  const attachmentBytes = files.reduce((n, f) => n + f.size, 0);
  const attachmentProblem =
    attachmentBytes > 3_000_000 ? "Attachments must add up to less than 3 MB." : null;

  // Send later, in the time zone the person means.
  const [scheduled, setScheduled] = useState(false);
  const [sendDate, setSendDate] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [timeZone, setTimeZone] = useState(SEND_TIME_ZONES[0] as string);
  const scheduleIssues = scheduled
    ? scheduleProblems({ date: sendDate, time: sendTime, timeZone })
    : [];

  async function readAttachments() {
    return Promise.all(
      files.map(
        (file) =>
          new Promise<{ name: string; contentType: string; contentBytes: string }>(
            (resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
              reader.onload = () =>
                resolve({
                  name: file.name,
                  contentType: file.type || "application/octet-stream",
                  contentBytes: String(reader.result).split(",")[1] ?? "",
                });
              reader.readAsDataURL(file);
            },
          ),
      ),
    );
  }

  const problems = [
    ...gate.blockers,
    ...recipientListProblems,
    ...(attachmentProblem ? [attachmentProblem] : []),
    ...scheduleIssues,
  ];

  const sending = useMutation({
    mutationFn: async () => {
      const attachments = await readAttachments();
      const when = scheduled
        ? zonedToInstant({ date: sendDate, time: sendTime, timeZone })
        : null;
      return send({
        data: {
          context,
          recordId,
          to: to.trim(),
          toAdditional: extra.to,
          cc: extra.cc,
          bcc: extra.bcc,
          subject,
          body,
          audience,
          templateId: templateId === BLANK ? null : templateId,
          attachments,
          scheduledFor: when ? when.toISOString() : null,
          scheduledTimeZone: when ? timeZone : null,
        },
      });
    },
    onSuccess: (result) => {
      if (result.status === "sent" || result.status === "scheduled") {
        toast.success(result.status === "scheduled" ? "Message scheduled." : "Message sent.");
        setFiles([]);
        setExtra(EMPTY_RECIPIENTS);
        setScheduled(false);
        setSubject("");
        setBody("");
        setTemplateId(BLANK);
        clearDraft(context, recordId);
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
          {mailbox.data && !mailbox.data.connected ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <p>
                The shared inbox ({mailbox.data.mailbox}) is not connected, so this message will be
                saved but not delivered. Reconnect it on the Integrations page, then send again.
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/integrations">Open Integrations</a>
              </Button>
            </div>
          ) : null}

          {recovered ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm"
            >
              <p>
                You have an unsent message saved from{" "}
                {usDateTime(recovered.savedAt)} — {recovered.subject.trim() || "no subject yet"}.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={restoreDraft}>
                  Bring it back
                </Button>
                <Button size="sm" variant="ghost" onClick={discardDraft}>
                  Start fresh
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label id="composer-to-label" htmlFor="composer-to">
              To
            </Label>
            <Select
              value={recipientKey}
              onValueChange={(value) => {
                setRecipientKey(value);
                const match = recipients.find((r) => r.email === value);
                if (match) setAudience(match.audience);
              }}
            >
              <SelectTrigger
                id="composer-to"
                ref={toRef}
                aria-labelledby="composer-to-label"
                aria-describedby={toDescribedBy}
                aria-invalid={Boolean(fieldProblems.to)}
              >
                <SelectValue placeholder="Choose who this goes to" />
              </SelectTrigger>
              <SelectContent>
                {recipients.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Contacts on this record</SelectLabel>
                    {recipients.map((r) => (
                      <SelectItem key={r.email} value={r.email}>
                        {r.label} · {r.email}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {previous.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Previously emailed</SelectLabel>
                    {previous.map((p) => (
                      <SelectItem key={p.email} value={p.email}>
                        {p.email}
                        {p.lastSentAt ? ` · last ${usDateTime(p.lastSentAt)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                <SelectItem value={CUSTOM}>Someone else — type an address…</SelectItem>
              </SelectContent>
            </Select>
            {recipientKey === CUSTOM ? (
              <>
                <Label htmlFor="composer-custom-to" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="composer-custom-to"
                  ref={customToRef}
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  placeholder="name@example.com"
                  aria-describedby={toDescribedBy}
                  aria-invalid={Boolean(fieldProblems.to)}
                />
              </>
            ) : null}
            {fieldProblems.to ? (
              <p id="composer-to-error" role="alert" className="text-sm text-destructive">
                {fieldProblems.to}
              </p>
            ) : null}
            {recipients.length === 0 && ctx.isSuccess ? (
              <p id="composer-to-hint" className="text-sm text-muted-foreground">
                This record has no contact on file yet — type an address above.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label id="composer-template-label" htmlFor="composer-template">
              Template
            </Label>
            <Select value={templateId} onValueChange={chooseTemplate}>
              <SelectTrigger
                id="composer-template"
                aria-labelledby="composer-template-label"
                aria-describedby={missing.length > 0 ? "composer-template-note" : undefined}
              >
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
              <p id="composer-template-note" role="status" className="text-sm text-amber-700">
                This record could not fill in: {missing.join(", ").replace(/_/g, " ")} — please
                complete those lines yourself.
              </p>
            ) : null}
          </div>

          {/* Anyone else on the message, one chip each, easy to take off. */}
          <div className="grid gap-2">
            {(["to", "cc", "bcc"] as RecipientField[]).map((field) => (
              <RecipientCombobox
                key={field}
                id={`composer-chips-${field}`}
                label={field === "to" ? "Also to" : RECIPIENT_FIELD_LABELS[field]}
                chips={extra[field]}
                draft={chipDraft[field]}
                onDraftChange={(value) => setChipDraft((d) => ({ ...d, [field]: value }))}
                onCommit={() => commitChips(field)}
                onPick={(email) => pickChip(field, email)}
                onRemove={(address) => dropChip(field, address)}
                suggestions={suggestionList}
                alreadyOnMessage={[
                  ...(isEmailAddress(to) ? [to.trim()] : []),
                  ...extra.to,
                  ...extra.cc,
                  ...extra.bcc,
                ]}
                invalid={pendingChipProblems.length > 0}
              />
            ))}
            {recipientListProblems.map((problem) => (
              <p key={problem} role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            ))}
            {chipError ? (
              <p role="alert" className="text-sm text-destructive">
                {chipError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="composer-subject">Subject</Label>
            <Input
              id="composer-subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-invalid={Boolean(fieldProblems.subject)}
              aria-describedby={fieldProblems.subject ? "composer-subject-error" : undefined}
            />
            {fieldProblems.subject ? (
              <p id="composer-subject-error" role="alert" className="text-sm text-destructive">
                {fieldProblems.subject}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="composer-body">Message</Label>
            <Textarea
              id="composer-body"
              ref={bodyRef}
              value={body}
              rows={12}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the message. Edit anything the template filled in — every word is yours to change."
              aria-invalid={Boolean(fieldProblems.body)}
              aria-describedby={bodyDescribedBy}
            />
            {fieldProblems.body ? (
              <p id="composer-body-error" role="alert" className="text-sm text-destructive">
                {fieldProblems.body}
              </p>
            ) : null}
            {fieldProblems.unfilled.length > 0 ? (
              <p id="composer-body-blanks" className="text-sm text-amber-700">
                Still blank: {fieldProblems.unfilled.join(", ").replace(/_/g, " ")}.
              </p>
            ) : null}
          </div>

          {/* Each person signs their own messages. */}
          <div className="grid gap-2">
            <Label htmlFor="composer-signature">Your signature</Label>
            <Textarea
              id="composer-signature"
              value={signature}
              rows={4}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={`${ctx.data?.senderName ?? "Your name"}\nA Real Home Away\n(555) 555-5555`}
              aria-describedby="composer-signature-hint"
            />
            <p id="composer-signature-hint" className="text-sm text-muted-foreground">
              Added to the foot of this message. Save it once and it is waiting on every email you write.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBody((current) => withSignature(current, signature))}
                disabled={!signature.trim()}
              >
                Add to this message
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => saveSignature.mutate(signature)}
                disabled={saveSignature.isPending}
              >
                {saveSignature.isPending ? "Saving…" : "Save as my signature"}
              </Button>
            </div>
          </div>

          {/* Files ride along with the message. */}
          <div className="grid gap-2">
            <Label htmlFor="composer-files" className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Attachments
            </Label>
            <input
              id="composer-files"
              type="file"
              multiple
              className="text-sm"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {files.map((f) => f.name).join(", ")} —{" "}
                {(attachmentBytes / 1_000_000).toFixed(1)} MB in total
              </p>
            ) : null}
            {attachmentProblem ? (
              <p role="alert" className="text-sm text-destructive">
                {attachmentProblem}
              </p>
            ) : null}
          </div>

          {/* Send later, in the time zone the person means. */}
          <div className="grid gap-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={scheduled}
                onChange={(e) => setScheduled(e.target.checked)}
              />
              <Clock className="h-4 w-4" /> Send later
            </label>
            {scheduled ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  type="date"
                  aria-label="Send date"
                  value={sendDate}
                  onChange={(e) => setSendDate(e.target.value)}
                />
                <Input
                  type="time"
                  aria-label="Send time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                />
                <select
                  aria-label="Time zone"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="rounded-md border bg-background px-2 text-sm"
                >
                  {SEND_TIME_ZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace("America/", "").replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {scheduleIssues.map((issue) => (
              <p key={issue} role="alert" className="text-sm text-destructive">
                {issue}
              </p>
            ))}
          </div>

          {/* Exactly what leaves the inbox, read-only, before anyone presses Send. */}
          <section
            aria-labelledby="composer-preview-heading"
            className="rounded-lg border border-border bg-muted/30 p-3"
          >
            <p id="composer-preview-heading" className="eyebrow">
              Preview — exactly as it will arrive
            </p>
            {problems.length > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Finish the message above and the preview appears here.
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

          {/* Announced as it changes, and every line jumps to the box it belongs to. */}
          <div id="composer-problems" role="status" aria-live="polite">
            {problems.length > 0 ? (
              <>
                <p className="text-sm font-medium">
                  {problems.length === 1
                    ? "One thing to finish before this can be sent:"
                    : `${problems.length} things to finish before this can be sent:`}
                </p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {problems.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        className="text-left underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => focusProblem(p)}
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
              disabled={problems.length > 0 || sending.isPending}
              aria-describedby={problems.length > 0 ? "composer-problems" : undefined}
              onClick={() => sending.mutate()}
            >
              <Send className="size-4" aria-hidden />
              {sending.isPending
                ? scheduled
                  ? "Scheduling…"
                  : "Sending…"
                : scheduled
                  ? "Schedule"
                  : "Send"}
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
