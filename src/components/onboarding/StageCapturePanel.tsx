import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ONBOARDING_STAGES } from "@/lib/onboarding";
import { getStageCaptures, saveStageCaptureFn } from "@/lib/onboarding-stage.functions";
import type { StageAction } from "@/lib/onboarding-stage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StageCapturePanel({
  propertyId,
  canEdit,
  canReview,
  documents,
}: {
  propertyId: string;
  canEdit: boolean;
  canReview: boolean;
  documents: { id: string; title: string }[];
}) {
  const qc = useQueryClient();
  const load = useServerFn(getStageCaptures);
  const { data = [], error } = useQuery({
    queryKey: ["onboarding-stages", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });
  const [stage, setStage] = useState<string>(ONBOARDING_STAGES[0]!.value);
  const [draft, setDraft] = useState<{
    observation: string;
    evidenceIds: string[];
    revision: number;
  } | null>(null);
  const [reason, setReason] = useState("");
  const revisions = data.filter((c) => c.stage === stage).sort((a, b) => b.revision - a.revision);
  const current = revisions[0];
  const values = draft ?? {
    observation: current?.observation ?? "",
    evidenceIds: current?.evidenceIds ?? [],
    revision: current?.revision ?? 0,
  };
  const locked = current?.status === "complete" || current?.status === "awaiting_review";
  const save = useMutation({
    mutationFn: useServerFn(saveStageCaptureFn),
    onSuccess: () => {
      setDraft(null);
      setReason("");
      toast.success("Stage revision recorded.");
      void qc.invalidateQueries({ queryKey: ["onboarding-stages", propertyId] });
      void qc.invalidateQueries({ queryKey: ["onboarding-project", propertyId] });
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function act(action: StageAction) {
    save.mutate({
      data: {
        propertyId,
        stage,
        action,
        expectedRevision: values.revision,
        observation: values.observation,
        evidenceIds: values.evidenceIds,
        reason,
      },
    });
  }
  if (error)
    return (
      <p role="alert" className="text-sm">
        Stage capture could not be loaded. Refresh before continuing.
      </p>
    );
  return (
    <section className="surface space-y-4 p-4">
      <div>
        <h3 className="font-semibold">Stage capture and review</h3>
        <p className="text-sm text-muted-foreground">
          Record guest-readiness findings, link evidence, and submit the completed stage for review.
          Previous revisions remain in History.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="capture-stage">Stage</Label>
        <select
          id="capture-stage"
          className="min-h-12 w-full rounded-md border bg-background px-3 text-base"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setDraft(null);
            setReason("");
          }}
        >
          {ONBOARDING_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm">
        {current
          ? `${current.status.replaceAll("_", " ")} · Revision ${current.revision}`
          : "No capture recorded"}
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          act("save");
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="stage-findings">Findings and observations</Label>
          <Textarea
            id="stage-findings"
            name="findings"
            rows={4}
            maxLength={6000}
            disabled={!canEdit || locked || save.isPending}
            value={values.observation}
            onChange={(e) => setDraft({ ...values, observation: e.target.value })}
          />
        </div>
        <fieldset className="space-y-2" disabled={!canEdit || locked || save.isPending}>
          <legend className="text-sm font-medium">
            Evidence already attached to this property
          </legend>
          {documents.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Attach files through the existing Files area, then select their metadata here.
            </p>
          )}
          {documents.map((d) => (
            <label key={d.id} className="flex min-h-12 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.evidenceIds.includes(d.id)}
                onChange={(e) =>
                  setDraft({
                    ...values,
                    evidenceIds: e.target.checked
                      ? [...values.evidenceIds, d.id]
                      : values.evidenceIds.filter((id) => id !== d.id),
                  })
                }
              />
              {d.title}
            </label>
          ))}
        </fieldset>
        <div className="space-y-1">
          <Label htmlFor="stage-review-reason">Review note or correction reason</Label>
          <Textarea
            id="stage-review-reason"
            name="reason"
            maxLength={1000}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={save.isPending || (!canEdit && !canReview)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <>
              <Button type="submit" disabled={!canEdit || save.isPending}>
                Save capture
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canEdit || save.isPending}
                onClick={() => act("submit")}
              >
                Submit for review
              </Button>
            </>
          )}
          {canReview && current?.status === "awaiting_review" && (
            <>
              <Button type="button" disabled={save.isPending} onClick={() => act("approve")}>
                Approve stage
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => act("return")}
              >
                Return for corrections
              </Button>
            </>
          )}
          {canReview && current?.status === "complete" && (
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => act("reopen")}
            >
              Reopen stage
            </Button>
          )}
        </div>
      </form>
      {revisions.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">
            Revision history ({revisions.length})
          </summary>
          <ol className="mt-3 space-y-3">
            {revisions.map((r) => (
              <li key={r.id} className="border-l-2 pl-3 text-sm">
                <p>
                  Revision {r.revision} · {r.status.replaceAll("_", " ")} ·{" "}
                  {r.recordedAt.slice(0, 10)}
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.observation}</p>
                {r.reason && <p>{r.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
