/**
 * What the homeowner actually said, and the person who records it.
 *
 * A standard homeowner answers by email. Resolve files that reply against the
 * decision it answers and shows it here in the homeowner's own words. It does
 * not decide anything: a coordinator reads the reply and records Approved,
 * Declined or Changes requested on the same decision an Active Owner would have
 * answered in their portal.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { relativeTime } from "@/lib/tickets";
import {
  ownerRepliesForApprovalFn,
  recordOwnerReplyDecisionFn,
} from "@/lib/owner-response.functions";

type Decision = "approved" | "declined" | "changes_requested";

const DECISIONS: { value: Decision; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "changes_requested", label: "Changes requested" },
];

export function OwnerReplies({
  approvalId,
  pending,
  onRecorded,
}: {
  approvalId: string;
  pending: boolean;
  onRecorded?: () => void;
}) {
  const loadReplies = useServerFn(ownerRepliesForApprovalFn);
  const record = useServerFn(recordOwnerReplyDecisionFn);
  const qc = useQueryClient();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");

  const replies = useQuery({
    queryKey: ["owner-replies", approvalId],
    queryFn: () => loadReplies({ data: { approvalId } }),
  });

  const save = useMutation({
    mutationFn: () =>
      record({
        data: {
          approvalId,
          decision: decision as Decision,
          note,
          responseId: replies.data?.[0]?.id ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Homeowner response recorded");
      setDecision(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["approval-detail", approvalId] });
      void qc.invalidateQueries({ queryKey: ["owner-replies", approvalId] });
      onRecorded?.();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save that."),
  });

  const rows = replies.data ?? [];

  return (
    <div className="space-y-3">
      {rows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Homeowner response received</p>
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-border/60 bg-secondary/40 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {r.from_name || r.from_address || "Homeowner"}
                </span>
                <span>{relativeTime(r.received_at)}</span>
                {r.has_attachments ? <Chip>Attachment sent</Chip> : null}
              </div>
              {r.subject ? <p className="mt-1 text-xs text-muted-foreground">{r.subject}</p> : null}
              <p className="mt-2 whitespace-pre-wrap">{(r.body_text ?? "").slice(0, 2000)}</p>
              {r.web_link ? (
                <a
                  href={r.web_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Open the original email
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {pending ? (
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <p className="text-sm font-medium">Record homeowner response</p>
          <p className="text-xs text-muted-foreground">
            Resolve never decides this for the homeowner. Choose what they said and save it.
          </p>
          <div className="flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <Button
                key={d.value}
                size="sm"
                variant={decision === d.value ? "default" : "outline"}
                onClick={() => setDecision(d.value)}
              >
                {d.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What the homeowner said, and where the answer came from."
            rows={3}
          />
          <Button
            size="sm"
            disabled={!decision || note.trim().length < 3 || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save the homeowner's answer"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
