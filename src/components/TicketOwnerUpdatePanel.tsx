import { useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ticketOwnerUpdates, saveTicketOwnerUpdate } from "@/lib/ticket-owner-updates.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_TYPE_META } from "@/lib/owner-opportunity";
import {
  REVIEWED_TICKET_REQUEST_TYPES,
  reviewedTicketRequestTypeSchema,
  reviewedTicketRequestText,
  type ReviewedTicketRequestType,
} from "@/lib/owner-ticket-intent";

type Draft = {
  issue: string;
  workPerformed: string;
  outcome: string;
  ownerRequestType: ReviewedTicketRequestType;
  ownerRequestWhy: string;
  expectedTicketUpdatedAt: string;
  expectedRevision: number;
  expectedOwnerId: string;
  reviewed: boolean;
};

export function TicketOwnerUpdatePanel({ ticketId, wizard }: { ticketId: string; wizard?: { onBack: () => void; onSent: () => void } }) {
  return <TicketOwnerUpdateEditor key={ticketId} ticketId={ticketId} wizard={wizard} />;
}

function TicketOwnerUpdateEditor({ ticketId, wizard }: { ticketId: string; wizard?: { onBack: () => void; onSent: () => void } | undefined }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const load = useServerFn(ticketOwnerUpdates);
  const save = useServerFn(saveTicketOwnerUpdate);
  const qc = useQueryClient();
  const key = ["ticket-owner-updates", user.id, ticketId];
  const context = useQuery({ queryKey: key, queryFn: () => load({ data: { ticketId } }) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const latest = context.data?.history[0];
  if(wizard && !draft && context.data && !mutationPendingPlaceholder()) {
    // The shared editor opens directly at Fill in when used by the sending window.
  }
  const changed = Boolean(
    draft &&
    context.data &&
    (draft.expectedOwnerId !== context.data.ownerRecordId ||
      draft.expectedTicketUpdatedAt !== context.data.ticket.updated_at ||
      draft.expectedRevision !== (latest?.revision ?? 0)),
  );
  const mutation = useMutation({
    mutationFn: async () => {
      if (!draft?.reviewed || changed)
        throw new Error("Review the current Ticket and owner update before saving.");
      return save({ data: { ticketId, ...draft, reviewed: true } });
    },
    onSuccess: () => {
      setDraft(null);
      wizard?.onSent();
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["owner-home"] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Owner update">
      <h3 className="font-semibold">{wizard ? `${preview ? '3. Preview' : '2. Fill in'}: Ticket update` : 'Owner update'}</h3>
      <p className="text-sm text-muted-foreground">
        Explain the issue, what ARHA did, and the outcome. Enrolled owners see this reviewed update
        alongside the current approval requirements.
      </p>
      {context.isPending && <p role="status">Loading owner updates…</p>}
      {context.error && <p role="alert">{context.error.message}</p>}
      {latest && (
        <div className="space-y-2 whitespace-pre-wrap text-sm">
          <p>{latest.issue}</p>
          <p>{latest.work_performed}</p>
          {latest.outcome && <p>{latest.outcome}</p>}
          {reviewedTicketRequestText(latest) && <p>{reviewedTicketRequestText(latest)}</p>}
          <p className="text-muted-foreground">
            Revision {latest.revision} · {latest.reviewed_at.slice(0, 10)}
          </p>
        </div>
      )}
      {!draft && context.data && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            mutation.reset();
            setDraft({
              issue: latest?.issue ?? "",
              workPerformed: latest?.work_performed ?? "",
              outcome: latest?.outcome ?? "",
              ownerRequestType:
                reviewedTicketRequestTypeSchema.safeParse(latest?.owner_request_type).data ??
                    "information_only",
              ownerRequestWhy: latest?.owner_request_why ?? "For your information. No response is needed.",
              expectedTicketUpdatedAt: context.data.ticket.updated_at,
              expectedOwnerId: context.data.ownerRecordId,
              expectedRevision: latest?.revision ?? 0,
              reviewed: false,
            });
          }}
        >
          Write owner update
        </Button>
      )}
      {draft && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (wizard && !preview) setPreview(true);
            else mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending} className="space-y-3">
            {preview && wizard ? <section aria-label="Homeowner preview" className="space-y-3 whitespace-pre-wrap"><h3 className="font-semibold">Ticket update</h3><p>{draft.issue}</p><p>{draft.workPerformed}</p><p>{draft.outcome}</p><p>{reviewedTicketRequestText({owner_request_type:draft.ownerRequestType,owner_request_why:draft.ownerRequestWhy})}</p></section> : null}
            <div className={preview && wizard ? 'hidden' : 'space-y-3'}>
            <legend className="sr-only">Review an owner update</legend>
            <p id={`owner-update-help-${ticketId}`} className="text-sm text-muted-foreground">
              Exclude guest names/contact details, private staff notes, door codes, credentials, and
              other restricted information. This does not approve spending or change the Ticket's
              status.
            </p>
            <div className="space-y-1">
              <Label htmlFor={`${ticketId}-owner-request-type`}>
                What does the owner need to do?
              </Label>
              <select
                id={`${ticketId}-owner-request-type`}
                name="ownerRequestType"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={draft.ownerRequestType}
                required
                aria-describedby={`${ticketId}-owner-request-help`}
                onChange={(event) => {
                  const type = reviewedTicketRequestTypeSchema.parse(event.target.value);
                  setDraft({ ...draft, ownerRequestType: type, reviewed: false });
                }}
              >
                {REVIEWED_TICKET_REQUEST_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACTION_TYPE_META[type].label}
                  </option>
                ))}
              </select>
              <p id={`${ticketId}-owner-request-help`} className="text-sm text-muted-foreground">
                Spending approval is determined by the current approval request. Choose Information
                only when no other action remains. A new reviewed update replaces the current
                request; earlier revisions stay in participation history. Owner reports of action or
                payment require staff verification and do not certify completion.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ticketId}-owner-request-why`}>Why this request or review?</Label>
              <Textarea
                id={`${ticketId}-owner-request-why`}
                name="ownerRequestWhy"
                value={draft.ownerRequestWhy}
                minLength={10}
                maxLength={1000}
                required
                aria-describedby={`owner-update-help-${ticketId}`}
                onChange={(event) =>
                  setDraft({ ...draft, ownerRequestWhy: event.target.value, reviewed: false })
                }
              />
            </div>
            {(
              [
                ["issue", wizard ? "What happened" : "Issue", 2000, 10],
                ["workPerformed", wizard ? "What we did" : "Work performed or current progress", 3000, 10],
                ["outcome", wizard ? "What's next" : "Outcome, if known", 2000, 0],
              ] as const
            ).map(([field, label, max, min]) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`${ticketId}-${field}`}>{label}</Label>
                <Textarea
                  id={`${ticketId}-${field}`}
                  name={field}
                  aria-describedby={`owner-update-help-${ticketId}`}
                  value={draft[field]}
                  minLength={min}
                  maxLength={max}
                  required={min > 0}
                  onChange={(event) =>
                    setDraft({ ...draft, [field]: event.target.value, reviewed: false })
                  }
                />
              </div>
            ))}
            {changed && (
              <div className="space-y-2" role="alert">
                <p>
                  The Ticket or owner update changed. Your draft is preserved. Review the latest
                  information above before continuing.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (context.data)
                      setDraft({
                        ...draft,
                        expectedTicketUpdatedAt: context.data.ticket.updated_at,
                        expectedOwnerId: context.data.ownerRecordId,
                        expectedRevision: latest?.revision ?? 0,
                        reviewed: false,
                      });
                  }}
                >
                  I reviewed the current Ticket and update
                </Button>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="reviewed"
                checked={draft.reviewed}
                onChange={(event) => setDraft({ ...draft, reviewed: event.target.checked })}
                required
              />
              <span>
                I reviewed this text and confirm it is appropriate for the property's owner.
              </span>
            </label>
            </div>
            {mutation.error && <p role="alert">{mutation.error.message}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!draft.reviewed || changed}>
                {mutation.isPending ? "Saving..." : wizard ? preview ? 'Send' : 'Preview' : "Save owner update"}
              </Button>
              <Button type="button" variant="outline" onClick={() => wizard ? preview ? setPreview(false) : wizard.onBack() : setDraft(null)}>
                {wizard ? 'Back' : 'Cancel'}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {context.data && context.data.history.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer">Previous owner updates</summary>
          <ol className="mt-2 space-y-3">
            {context.data.history.slice(1).map((update) => (
              <li key={update.id} className="whitespace-pre-wrap border-t pt-2">
                <p>
                  Revision {update.revision} · {update.reviewed_at.slice(0, 10)}
                </p>
                <p>{update.issue}</p>
                <p>{update.work_performed}</p>
                <p>{update.outcome}</p>
                {reviewedTicketRequestText(update) && <p>{reviewedTicketRequestText(update)}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
