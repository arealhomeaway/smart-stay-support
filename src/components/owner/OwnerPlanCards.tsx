import { useEffect, useState } from "react";
import { ownerSaveMessage, OWNER_SAVE_FALLBACK } from "@/lib/owner-save-error";
import { Paperclip, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/page";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { useOwnerCardUpload, type FileRef } from "@/components/owner/CompletedCardPanel";
import { loadOwnerPlan, submitCard } from "@/lib/ao-data";
import { ownerPace } from "@/lib/ao-engine";
import {
  groupPlanByHome, paceSentence, portalCardView, submissionValues, validateSubmission, type OutputField, type PortalPlanCard,
} from "@/lib/ao-ui";

/** Homeowner plan cards, grouped under each home. Hidden entirely while the plan engine is not set up. */
export function OwnerPlanCards({ programId, readOnly, homes = [] }: { programId: string; readOnly: boolean; homes?: { propertyId: string; name: string }[] }) {
  const q = useQuery({ queryKey: ["ao-owner-plan", programId], queryFn: () => loadOwnerPlan(programId), retry: false });
  if (!q.data?.available || q.data.data.length === 0) return null;
  const groups = groupPlanByHome(q.data.data, homes);
  return (
    <SectionCard title="Your homeowner plan">
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.propertyId ?? "home"} className="space-y-2" aria-label={g.name}>
            {groups.length > 1 || homes.length > 1 ? <h3 className="text-sm font-semibold">{g.name}</h3> : null}
            <ul className="space-y-3">
              {g.cards.map((c) => <li key={c.plan_card_id}><PlanCardItem card={c} programId={programId} readOnly={readOnly} /></li>)}
            </ul>
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

export function PlanCardItem({ card, programId, readOnly }: { card: PortalPlanCard; programId: string; readOnly: boolean }) {
  const view = portalCardView(card);
  return (
    <div className="rounded-md border p-3" data-state={view.kind}>
      <p className="font-medium">{card.title}</p>
      {view.kind === "locked" ? <p className="text-sm text-muted-foreground">{view.text}</p> : null}
      {view.kind === "done" ? <p className="text-sm text-muted-foreground">Done. Thank you.</p> : null}
      {view.kind === "closed" ? <p className="text-sm text-muted-foreground">This item has closed. ARHA is taking care of it.</p> : null}
      {view.kind === "open" ? (
        <>
          {card.what_text ? <p className="text-sm text-muted-foreground">{card.what_text}</p> : null}
          <PlanCardForm planCardId={card.plan_card_id} programId={programId} propertyId={card.property_id ?? null} title={card.title} fields={view.fields} readOnly={readOnly} />
        </>
      ) : null}
    </div>
  );
}

/**
 * The owner's answer on an open plan card. Text and files are kept on this device while she types
 * (cleared once saved), so closing the panel or a failed save never loses them. Files use the owner
 * upload path and save with the answer (ao_submit_card with files). A clear "Saved" or "Not saved"
 * message follows each try.
 */
export function PlanCardForm({ planCardId, programId, propertyId = null, title = "", fields, readOnly }: { planCardId: string; programId: string; propertyId?: string | null; title?: string; fields: OutputField[]; readOnly: boolean }) {
  const qc = useQueryClient();
  const draftKey = `resolve.card-draft:${planCardId}`;
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [restored, setRestored] = useState(false);
  const uploadOne = useOwnerCardUpload(propertyId);

  // Restore a draft after hydration; then keep it current while she types.
  useEffect(() => {
    if (readOnly) { setRestored(true); return; }
    const d = readCardDraft(draftKey);
    if (d) { setValues(d.values); setFiles(d.files); }
    setRestored(true);
  }, [draftKey, readOnly]);
  useEffect(() => {
    if (!restored || readOnly) return;
    writeCardDraft(draftKey, { values, files });
  }, [draftKey, values, files, restored, readOnly]);

  const submit = useMutation({
    mutationFn: () => {
      const err = validateSubmission(fields, values);
      if (err) throw new Error(err);
      return submitCard(planCardId, submissionValues(fields, values), files);
    },
    onSuccess: () => {
      clearCardDraft(draftKey);
      toast.success(`Saved: your answer${title ? ` to "${title}"` : ""}${files.length ? ` with ${files.length === 1 ? "1 file" : `${files.length} files`}` : ""}. It is under Completed, and your team has it.`);
      void qc.invalidateQueries({ queryKey: ["ao-owner-plan", programId] });
      void qc.invalidateQueries({ queryKey: ["ao-card-answer", planCardId] });
    },
    onError: (e: Error) => { const m = ownerSaveMessage(e); toast.error(m === OWNER_SAVE_FALLBACK ? m : `Not saved: ${m}`); },
  });
  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
      {fields.map((f) => {
        const id = `${planCardId}-${f.key}`;
        const set = (v: string) => setValues((prev) => ({ ...prev, [f.key]: v }));
        return (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={id}>{f.label}</Label>
            {f.type === "long_text" ? <Textarea id={id} value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} disabled={readOnly} />
              : f.type === "yes_no" ? (
                <select id={id} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} disabled={readOnly}>
                  <option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
              ) : <Input id={id} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} disabled={readOnly} />}
          </div>
        );
      })}
      {files.length ? (
        <ul className="space-y-1" aria-label="Files with your answer">
          {files.map((f) => (
            <li key={f.document_id} className="flex items-center gap-2 text-sm">
              <Paperclip className="size-3.5" aria-hidden="true" /> {f.name || "File"}
              <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-label={`Remove ${f.name || "file"}`} disabled={readOnly || submit.isPending} onClick={() => setFiles((prev) => prev.filter((x) => x.document_id !== f.document_id))}>
                <X className="size-4" aria-hidden="true" /> Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {propertyId && !readOnly ? (
        <MultiFileUpload
          autoStart
          upload={uploadOne}
          onBusyChange={setUploading}
          onResults={(r) => {
            setFiles((prev) => [...prev, ...r.filter((x) => !prev.some((p) => p.document_id === x.document_id))]);
            if (r.length) toast.success(`${r.length === 1 ? "1 file is" : `${r.length} files are`} ready. They save with your answer when you press Send to ARHA.`);
          }}
          label="Add a file"
        />
      ) : null}
      {submit.isError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          Not saved: {submit.error.message} What you typed is still here. Try Send to ARHA again.
        </p>
      ) : null}
      <Button type="submit" size="sm" className="min-h-11" disabled={readOnly || submit.isPending || uploading}>{submit.isPending ? "Saving…" : "Send to ARHA"}</Button>
    </form>
  );
}

type CardDraft = { values: Record<string, string>; files: FileRef[] };
function readCardDraft(key: string): CardDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<CardDraft>;
    const values = d.values && typeof d.values === "object" ? Object.fromEntries(Object.entries(d.values).filter(([, v]) => typeof v === "string")) as Record<string, string> : {};
    const files = Array.isArray(d.files) ? d.files.filter((f): f is FileRef => Boolean(f && typeof f.document_id === "string")) : [];
    return { values, files };
  } catch { return null; }
}
function writeCardDraft(key: string, d: CardDraft) {
  try {
    if (Object.values(d.values).every((v) => !v) && d.files.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(d));
  } catch { /* storage full or blocked: the form still holds the answer */ }
}
function clearCardDraft(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* nothing to clear */ }
}

/** Owner pace: weekly hours needed to reach 100 by the program end date. */
export function OwnerPaceCard({ loggedHours, endsOn, endLabel, now = new Date() }: { loggedHours: number; endsOn: string | null; endLabel: string; now?: Date }) {
  if (!endsOn) return null;
  const end = new Date(`${endsOn.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const pace = ownerPace(loggedHours, now, end);
  return (
    <div className="rounded-md border p-3" data-testid="owner-pace">
      <p className="text-sm">{paceSentence(pace.weeklyNeeded, endLabel)}</p>
      <p className="text-sm font-medium">{pace.label}</p>
    </div>
  );
}
