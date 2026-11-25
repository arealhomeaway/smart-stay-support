/**
 * A completed plan card, opened from the portal's Completed group (approved mockup, Nov 16; allowed
 * change A). Shows what the owner sent, their hours for it and the card's conversation; "Edit my
 * answer" and "Add a file" save through ao_edit_card_answer, which keeps a change record and posts
 * one line in the home's owner chat. The card stays completed. Uploads use the owner upload path.
 */
import { LinkedText } from "@/components/owner/LinkedText";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadError } from "@/components/ui/page";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { OwnerItemConversation } from "@/components/owner/OwnerItemConversation";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { attachmentUrlFn, beginUploadFn, completeUploadFn, tagOwnerUploadFn } from "@/lib/attachments.functions";
import { OWNER_UPLOAD_CATEGORIES } from "@/lib/attachments";
import { editCardAnswer, loadCardAnswer } from "@/lib/ao-data";
import { parseOutputFields, submissionValues, validateSubmission, type OutputField } from "@/lib/ao-ui";
import { answerReviewLine, completedLine, entriesForCard, entrySavedLine, hoursFromMinutes, type HourEntry } from "@/lib/owner-portal-look";
import { shortDate } from "@/lib/owner-opportunity-board";

export type FileRef = { document_id: string; name: string };

export function CompletedCardPanel({
  planCardId, programId, propertyId, title, home, typeLabel, cover, completedAt, outputFields, reviewId, entries, readOnly, onClose, onChangeHours,
}: {
  planCardId: string;
  programId: string;
  propertyId: string | null;
  title: string;
  home: string;
  typeLabel: string | null;
  cover: string;
  completedAt: string | null;
  outputFields: unknown;
  reviewId: string | null;
  entries: HourEntry[];
  readOnly: boolean;
  onClose: () => void;
  onChangeHours?: (() => void) | undefined;
}) {
  const qc = useQueryClient();
  const fields = useMemo(() => parseOutputFields(outputFields), [outputFields]);
  const answer = useQuery({ queryKey: ["ao-card-answer", planCardId], queryFn: () => loadCardAnswer(planCardId), retry: false });
  const mine = entriesForCard(entries, { title, reviewId, propertyIds: propertyId ? [propertyId] : [] });
  const minutes = mine.reduce((n, e) => n + (Number(e.minutes) || 0), 0);
  const lastDay = mine.map((e) => e.entry_date ?? "").filter(Boolean).sort().at(-1) ?? null;

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const startEdit = (withUpload: boolean) => {
    const a = answer.data;
    setValues(Object.fromEntries(fields.map((f) => [f.key, asText(f, a?.values[f.key])])));
    setFiles(a?.files ?? []);
    setShowUpload(withUpload);
    setEditing(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const err = validateSubmission(fields, values);
      if (err) throw new Error(err);
      return editCardAnswer(planCardId, submissionValues(fields, values), files);
    },
    onSuccess: async () => {
      setEditing(false);
      setShowUpload(false);
      toast.success(`Saved: your change to "${title}". Your team sees it in your home's chat.`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ao-card-answer", planCardId] }),
        qc.invalidateQueries({ queryKey: ["home-chat"] }),
        qc.invalidateQueries({ queryKey: ["home-chat-inbox"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadOne = useOwnerCardUpload(propertyId);

  const openFile = useOpenOwnerFile();

  const shown = editing ? files : answer.data?.files ?? [];
  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="[&_.text-muted-foreground]:text-portal-muted flex w-full max-w-none flex-col gap-0 overflow-y-auto p-0 sm:max-w-[520px] [&>button.absolute]:hidden">
        <SheetHeader className="space-y-1 px-5 pb-3 pt-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <p className="numeric pt-3 text-xs font-semibold text-portal-muted">{completedLine(completedAt, minutes)}</p>
            <Button type="button" variant="ghost" className="min-h-11 text-portal-primary" onClick={onClose}>Close</Button>
          </div>
          <SheetTitle className="text-left font-display text-2xl font-normal leading-snug text-portal-ink">{title}</SheetTitle>
          <SheetDescription className="text-left text-portal-muted">{[home, typeLabel].filter(Boolean).join(" · ")}</SheetDescription>
          <p className="text-sm font-medium text-portal-ink" data-testid="card-review-status">
            {completedAt ? `Finished ${shortDate(completedAt)} · ` : ""}{answerReviewLine(null)}
          </p>
        </SheetHeader>
        <img src={cover} alt="" width={912} height={736} className="h-[120px] w-full object-cover" />
        <div className="flex-1 space-y-6 px-5 py-5">
          <section aria-label="What you sent" className="space-y-2">
            <h3 className="text-sm font-semibold text-portal-ink">What you sent</h3>
            {answer.isError ? (
              <LoadError what="Your answer" onRetry={() => void answer.refetch()} />
            ) : answer.isPending ? (
              <p className="text-sm text-portal-muted">Loading…</p>
            ) : editing ? (
              <div className="space-y-3">
                {fields.map((f) => (
                  <FieldInput key={f.key} id={`${planCardId}-${f.key}`} field={f} value={values[f.key] ?? ""} onChange={(v) => setValues({ ...values, [f.key]: v })} />
                ))}
              </div>
            ) : !answer.data ? (
              // Finished with nothing saved: she can still add her answer or a file (Nov 18).
              <p className="text-sm text-portal-muted" data-testid="card-nothing-saved">
                Nothing was saved with this card yet. Use Edit my answer or Add a file to add it now.
              </p>
            ) : fields.length ? (
              <dl className="space-y-2 text-sm">
                {fields.map((f) => (
                  <div key={f.key}>
                    <dt className="text-portal-muted">{f.label}</dt>
                    <dd className="whitespace-pre-wrap break-words text-portal-ink"><LinkedText text={asText(f, answer.data?.values[f.key]) || "Not answered"} /></dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-portal-muted">Done. Thank you.</p>
            )}
            {shown.length ? (
              <ul className="space-y-1">
                {shown.map((f) => (
                  <li key={f.document_id} className="flex items-center gap-2">
                    <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm text-portal-primary underline-offset-4 hover:underline" onClick={() => void openFile(f)}>
                      <Paperclip className="size-3.5" aria-hidden="true" /> {f.name || "File"}
                    </button>
                    {editing ? (
                      <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-label={`Remove ${f.name || "file"}`} onClick={() => setFiles(files.filter((x) => x.document_id !== f.document_id))}>
                        <X className="size-4" aria-hidden="true" /> Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {editing && showUpload && propertyId ? (
              <MultiFileUpload
                autoStart
                upload={uploadOne}
                onBusyChange={setUploading}
                onResults={(r) => setFiles((prev) => [...prev, ...r.filter((x) => !prev.some((p) => p.document_id === x.document_id))])}
                label="Add a file"
              />
            ) : null}
          </section>

          <section aria-label="Your hours for this" className="space-y-1">
            <h3 className="text-sm font-semibold text-portal-ink">Your hours for this</h3>
            <p className="numeric text-sm text-portal-ink">
              {hoursFromMinutes(minutes)} hrs{lastDay ? ` · ${shortDate(lastDay)}` : ""}
            </p>
            {mine.length ? (
              <ul className="space-y-0.5 text-sm text-portal-muted" aria-label="Your saved entries">
                {mine.map((e, i) => (
                  <li key={`${e.entry_date ?? ""}-${i}`} className="numeric">
                    {hoursFromMinutes(Number(e.minutes) || 0)} hrs{e.entry_date ? ` · ${shortDate(e.entry_date)}` : ""}
                    {` · ${entrySavedLine(e)}`}
                  </li>
                ))}
              </ul>
            ) : null}
            {onChangeHours ? (
              <button type="button" className="min-h-11 text-sm text-portal-primary underline-offset-4 hover:underline" onClick={onChangeHours}>
                Change hours
              </button>
            ) : null}
          </section>

          {reviewId ? (
            <section aria-label="Conversation with your team" className="space-y-2">
              <h3 className="text-sm font-semibold text-portal-ink">Conversation with your team</h3>
              <OwnerItemConversation reviewId={reviewId} side="owner" readOnly={readOnly} />
            </section>
          ) : null}
        </div>
        <div className="space-y-3 border-t border-portal-border px-5 py-4">
          {editing && save.isError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              Not saved: {save.error.message} Your changes are still here. Try Save again.
            </p>
          ) : null}
          {editing ? (
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11 bg-portal-primary text-portal-primary-foreground hover:bg-portal-primary/90" disabled={save.isPending || uploading} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              {!showUpload ? (
                <Button variant="outline" className="min-h-11 border-portal-primary text-portal-primary" onClick={() => setShowUpload(true)}>Add a file</Button>
              ) : null}
              <Button variant="ghost" className="min-h-11" disabled={save.isPending || uploading} onClick={() => { setEditing(false); setShowUpload(false); }}>Cancel</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11 bg-portal-primary text-portal-primary-foreground hover:bg-portal-primary/90" disabled={readOnly || answer.isPending || answer.isError} onClick={() => startEdit(false)}>
                Edit my answer
              </Button>
              <Button variant="outline" className="min-h-11 border-portal-primary text-portal-primary" disabled={readOnly || answer.isPending || answer.isError || !propertyId} onClick={() => startEdit(true)}>
                Add a file
              </Button>
            </div>
          )}
          <p className="text-xs text-portal-muted">
            Edit opens your answer just as you sent it. When you save, your team sees the update in your home's chat, and the card keeps a note of each change.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The owner upload path: one home's property file, tagged as the owner's upload. Shared by the
 * open-card answer form and the completed-card editor. */
export function useOwnerCardUpload(propertyId: string | null) {
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const tag = useServerFn(tagOwnerUploadFn);
  const internal = OWNER_UPLOAD_CATEGORIES.find((c) => c.value === "participation")?.internal ?? "other";
  const makeIntent = (file: File, key: string) => ({
    entityType: "property" as const, entityId: propertyId ?? "", uploadKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size, note: null, category: internal, fulfilsRequestId: null,
  });
  // The latest home, read at upload time.
  const intent = useRef(makeIntent);
  intent.current = makeIntent;
  const [upload] = useState(() => createAttachmentUploader(begin, complete, (file, key) => intent.current(file, key)));
  return async (file: File, progress: (pct: number) => void, key: string): Promise<FileRef> => {
    const documentId = await upload(file, progress, key);
    await tag({ data: { documentId, ownerCategory: "participation", workItemId: null } });
    return { document_id: documentId, name: file.name };
  };
}

/** Opens one of the owner's files in a new tab through a short-lived link. */
export function useOpenOwnerFile() {
  const urlFor = useServerFn(attachmentUrlFn);
  return async (f: FileRef) => {
    const w = window.open("", "_blank");
    try {
      const { url } = await urlFor({ data: { documentId: f.document_id } });
      if (w) w.location.href = url;
    } catch (e) {
      w?.close();
      toast.error(e instanceof Error ? e.message : "Could not open that file.");
    }
  };
}

/** What the owner sent on a plan card, read back from her saved answer. Read only. */
export function SentAnswer({ planCardId, outputFields }: { planCardId: string; outputFields: unknown }) {
  const fields = useMemo(() => parseOutputFields(outputFields), [outputFields]);
  const answer = useQuery({ queryKey: ["ao-card-answer", planCardId], queryFn: () => loadCardAnswer(planCardId), retry: false });
  const openFile = useOpenOwnerFile();
  if (answer.isError) return <LoadError what="Your answer" onRetry={() => void answer.refetch()} />;
  if (answer.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!answer.data) return <p className="text-sm text-muted-foreground">Done. Thank you.</p>;
  return (
    <section aria-label="What you sent" className="space-y-2">
      <p className="text-sm font-medium text-portal-ink">Saved {shortDate(answer.data.submittedAt)}. Your team has your answer.</p>
      {fields.length ? (
        <dl className="space-y-2 text-sm">
          {fields.map((f) => (
            <div key={f.key}>
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="whitespace-pre-wrap break-words"><LinkedText text={asText(f, answer.data?.values[f.key]) || "Not answered"} /></dd>
            </div>
          ))}
        </dl>
      ) : null}
      {answer.data.files.length ? (
        <ul className="space-y-1">
          {answer.data.files.map((f) => (
            <li key={f.document_id}>
              <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm text-portal-primary underline-offset-4 hover:underline" onClick={() => void openFile(f)}>
                <Paperclip className="size-3.5" aria-hidden="true" /> {f.name || "File"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function asText(f: OutputField, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (f.type === "yes_no") return v === true || v === "yes" ? "yes" : v === false || v === "no" ? "no" : String(v);
  return String(v);
}

function FieldInput({ id, field, value, onChange }: { id: string; field: OutputField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === "long_text" ? (
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "yes_no" ? (
        <select id={id} className="h-11 w-full rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      ) : (
        <Input id={id} className="h-11" type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
