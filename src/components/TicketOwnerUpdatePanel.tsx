import { useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ticketOwnerUpdates, saveTicketOwnerUpdate } from "@/lib/ticket-owner-updates.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  issue: string;
  workPerformed: string;
  outcome: string;
  expectedTicketUpdatedAt: string;
  expectedRevision: number;
  expectedOwnerId: string;
  reviewed: boolean;
};

export function TicketOwnerUpdatePanel({ ticketId }: { ticketId: string }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const load = useServerFn(ticketOwnerUpdates);
  const save = useServerFn(saveTicketOwnerUpdate);
  const qc = useQueryClient();
  const key = ["ticket-owner-updates", user.id, ticketId];
  const context = useQuery({ queryKey: key, queryFn: () => load({ data: { ticketId } }) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const latest = context.data?.history[0];
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
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["owner-home"] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Owner update">
      <h3 className="font-semibold">Owner update</h3>
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
            mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending} className="space-y-3">
            <legend className="sr-only">Review an owner update</legend>
            <p id={`owner-update-help-${ticketId}`} className="text-sm text-muted-foreground">
              Exclude guest names/contact details, private staff notes, door codes, credentials, and
              other restricted information. This does not approve spending or change the Ticket's
              status.
            </p>
            {(
              [
                ["issue", "Issue", 2000, 10],
                ["workPerformed", "Work performed or current progress", 3000, 10],
                ["outcome", "Outcome, if known", 2000, 0],
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
            {mutation.error && <p role="alert">{mutation.error.message}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!draft.reviewed || changed}>
                {mutation.isPending ? "Saving…" : "Save owner update"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Cancel
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
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
