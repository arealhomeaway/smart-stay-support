/**
 * Homeowner replies Resolve could not place with certainty.
 *
 * Rather than attach an answer to the wrong decision, Resolve holds the reply
 * here and asks a person to say which decision it answers. Nothing is decided
 * by placing it — the decision itself is still recorded by hand afterwards.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/tickets";
import { unplacedOwnerRepliesFn, placeOwnerReplyFn } from "@/lib/owner-response.functions";

type Candidate = { id: string; ref: number | null; title: string };

export function UnplacedOwnerReplies({ onOpenApproval }: { onOpenApproval?: (id: string) => void }) {
  const load = useServerFn(unplacedOwnerRepliesFn);
  const place = useServerFn(placeOwnerReplyFn);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["unplaced-owner-replies"], queryFn: () => load() });

  const link = useMutation({
    mutationFn: (vars: { responseId: string; approvalId: string }) => place({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success("Reply filed on that decision");
      void qc.invalidateQueries({ queryKey: ["unplaced-owner-replies"] });
      onOpenApproval?.(vars.approvalId);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not file that reply."),
  });

  const rows = q.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Homeowner replies waiting to be placed</CardTitle>
        <CardDescription>
          Resolve could not tell which decision these answer. Say which one, then record the answer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const candidates = (r.candidates ?? []) as unknown as Candidate[];
          return (
            <div key={r.id} className="rounded-md border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {r.from_name || r.from_address || "Homeowner"}
                </span>
                <span>{relativeTime(r.received_at)}</span>
              </div>
              {r.subject ? <p className="mt-1 font-medium">{r.subject}</p> : null}
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {(r.body_text ?? "").slice(0, 400)}
              </p>
              {candidates.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {candidates.slice(0, 6).map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant="outline"
                      disabled={link.isPending}
                      onClick={() => link.mutate({ responseId: r.id, approvalId: c.id })}
                    >
                      {c.ref ? `APR-${c.ref} · ` : ""}
                      {c.title}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No open homeowner decision matches this reply.
                </p>
              )}
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
          );
        })}
      </CardContent>
    </Card>
  );
}
