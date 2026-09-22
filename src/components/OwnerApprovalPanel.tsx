/**
 * Homeowner approval decisions.
 *
 * Shows only the approval requests addressed to the signed-in homeowner for a
 * home or program they are authorised for (enforced server-side and by RLS).
 * A decision is single-shot: once recorded it is shown as history and can no
 * longer be resubmitted or overwritten. Nothing here awards participation
 * hours or sends live notifications.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouteContext } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { decideOwnerApproval, ownerApprovals } from "@/lib/owner-portal.functions";
import { captureOwnerDecisionVersion } from "@/lib/owner-approval-context";
import { usDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const KIND_LABEL: Record<string, string> = {
  estimate: "Repair estimate",
  spend: "Spending approval",
  vendor: "Vendor selection",
  scope: "Scope of work",
  access: "Property access",
  onboarding_task: "Onboarding item",
  other: "Decision",
};

function money(amount: number | null, currency: string) {
  if (amount === null || amount === undefined) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function OwnerApprovalPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  return <AccountApprovals key={user.id} userId={user.id} readOnly={readOnly} />;
}

function AccountApprovals({ userId, readOnly }: { userId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(ownerApprovals);
  const decide = useServerFn(decideOwnerApproval);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<
    Record<string, ReturnType<typeof captureOwnerDecisionVersion>>
  >({});
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["owner-approvals", userId], queryFn: () => load() });

  const submit = useMutation({
    mutationFn: (input: {
      approvalId: string;
      expectedUpdatedAt: string;
      publicationId: string;
      decision: "approved" | "declined";
    }) => decide({ data: { ...input, comment: notes[input.approvalId] ?? "" } }),
    onMutate: (v) => setBusy(v.approvalId),
    onSettled: () => setBusy(null),
    onSuccess: (_r, v) => {
      toast.success(
        v.decision === "approved"
          ? "Decision recorded — thank you."
          : "Sent back to the team with your note.",
      );
      setNotes((n) => ({ ...n, [v.approvalId]: "" }));
      setVersions((current) => {
        const next = { ...current };
        delete next[v.approvalId];
        return next;
      });
      void qc.invalidateQueries({ queryKey: ["owner-approvals"] });
      void qc.invalidateQueries({ queryKey: ["owner-home"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ["owner-approvals", userId] });
    },
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.error) return <p role="alert">{q.error.message}</p>;

  // Onboarding items have their own section, with the shared design files.
  const all = (q.data?.approvals ?? []).filter((a) => a.entity_type !== "onboarding_task");
  const pending = all.filter((a) => a.status === "pending");
  const decided = all.filter((a) => a.status !== "pending");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          Decisions for your approval
        </CardTitle>
        <CardDescription>
          Each item shows what is being approved. Your name, the time and any note you add are
          recorded with the decision.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing is waiting for your approval right now.
          </p>
        )}

        {pending.map((a) => {
          const amount = money(a.amount, a.currency);
          const version = versions[a.id] ?? captureOwnerDecisionVersion(a);
          const changed =
            version.updatedAt !== a.updated_at || version.publicationId !== a.publication_id;
          return (
            <div key={a.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{KIND_LABEL[a.kind] ?? a.kind}</Badge>
                {a.property_name && (
                  <span className="text-xs text-muted-foreground">{a.property_name}</span>
                )}
                {a.active_owner && (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    Active Owner Program
                  </Badge>
                )}
                {amount && <span className="text-sm font-medium">{amount}</span>}
                {a.due_on && (
                  <span className="text-xs text-muted-foreground">Needed by {a.due_on}</span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium">{a.title}</p>
              {a.detail && (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.detail}</p>
              )}
              {a.evidence_url && (
                <a
                  className="mt-1 inline-block text-sm underline"
                  href={a.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View the attached details
                </a>
              )}
              {a.blocked_reason && (
                <p className="mt-2 text-sm" role="status">
                  {a.blocked_reason}
                </p>
              )}
              <Textarea
                className="mt-3"
                rows={2}
                placeholder="Add a note (required if you request changes)"
                aria-label={`Your response to ${a.title}`}
                value={notes[a.id] ?? ""}
                onChange={(e) => {
                  setNotes((n) => ({ ...n, [a.id]: e.target.value }));
                  setVersions((current) => ({
                    ...current,
                    [a.id]: current[a.id] ?? captureOwnerDecisionVersion(a),
                  }));
                }}
                disabled={readOnly || !a.can_respond}
              />
              {changed && (
                <div className="mt-2 space-y-2" role="status">
                  <p className="text-sm">
                    This request changed while you were responding. Review the updated details
                    above; your note has been kept.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={readOnly || busy === a.id}
                    onClick={() =>
                      setVersions((current) => ({
                        ...current,
                        [a.id]: captureOwnerDecisionVersion(a),
                      }))
                    }
                  >
                    I have reviewed the updated request
                  </Button>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={
                    readOnly || busy === a.id || changed || !a.can_respond || !version.publicationId
                  }
                  onClick={() =>
                    submit.mutate({
                      approvalId: a.id,
                      expectedUpdatedAt: version.updatedAt,
                      publicationId: version.publicationId!,
                      decision: "approved",
                    })
                  }
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    readOnly || busy === a.id || changed || !a.can_respond || !version.publicationId
                  }
                  onClick={() =>
                    submit.mutate({
                      approvalId: a.id,
                      expectedUpdatedAt: version.updatedAt,
                      publicationId: version.publicationId!,
                      decision: "declined",
                    })
                  }
                >
                  <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
                  Request changes
                </Button>
              </div>
              {readOnly && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Preview only — decisions can only be recorded by the homeowner.
                </p>
              )}
            </div>
          );
        })}

        {decided.length > 0 && (
          <div className="pt-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Decision history
            </p>
            <div className="space-y-2">
              {decided.map((a) => (
                <div key={a.id} className="rounded-md border border-border/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={a.status === "approved" ? "default" : "outline"}>
                      {a.status === "approved" ? "Approved" : "Changes requested"}
                    </Badge>
                    <span className="font-medium">{a.title}</span>
                    {a.decided_at && (
                      <span className="text-xs text-muted-foreground">
                        {usDateTime(a.decided_at)}
                      </span>
                    )}
                  </div>
                  {!a.recorded_by_owner && (
                    <p className="mt-1 text-xs text-muted-foreground">Recorded by ARHA</p>
                  )}
                  {a.amount !== null && (
                    <p className="mt-1 text-sm">Requested amount: {money(a.amount, a.currency)}</p>
                  )}
                  {a.detail && <p className="mt-2 whitespace-pre-line">{a.detail}</p>}
                  {a.revision && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reviewed summary revision {a.revision}
                    </p>
                  )}
                  {a.blocked_reason && <p className="mt-1 text-sm">{a.blocked_reason}</p>}
                  {a.decision_note && (
                    <p className="mt-1 text-muted-foreground">{a.decision_note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
