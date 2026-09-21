import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { documentCompletionBoard, documentRetire } from "@/lib/sync-review.functions";
import { usShortDate } from "@/lib/dates";

type Board = Awaited<ReturnType<typeof documentCompletionBoard>>;

function stateTone(state: string) {
  if (state === "expired" || state === "unusable") return "destructive" as const;
  if (state === "expiring") return "secondary" as const;
  return "outline" as const;
}

/**
 * What paperwork is missing, expired or unreadable — and the files carried over
 * from the old tools that can be put out of the way. Retiring keeps a document
 * readable; nothing is ever deleted here.
 */
export function DocumentCompletionPanel() {
  const load = useServerFn(documentCompletionBoard);
  const retire = useServerFn(documentRetire);
  const queryClient = useQueryClient();

  const board = useQuery<Board>({
    queryKey: ["document-completion-board"],
    queryFn: () => load({ data: undefined }),
  });

  const retireMutation = useMutation({
    mutationFn: (documentId: string) => retire({ data: { documentId, note: "" } }),
    onSuccess: () => {
      toast.success("Retired — still readable, out of the way.");
      void queryClient.invalidateQueries({ queryKey: ["document-completion-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vendors = (board.data?.vendors ?? []).filter((v) => !v.complete);
  const retirable = board.data?.retirable ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="h-4 w-4" /> Document completion
        </CardTitle>
        <CardDescription>
          Paperwork that is missing, expired or has nothing attached, plus leftovers from the tools
          Resolve replaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {board.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
        {board.error ? (
          <p className="text-xs text-destructive">{(board.error as Error).message}</p>
        ) : null}

        <section className="space-y-2">
          <h4 className="text-sm font-medium">Vendors needing paperwork ({vendors.length})</h4>
          {vendors.length === 0 ? (
            <p className="text-xs text-muted-foreground">Every vendor is up to date.</p>
          ) : (
            <ul className="space-y-2">
              {vendors.map((v) => (
                <li key={v.orgId} className="rounded-md border p-3 text-xs">
                  <p className="font-medium">{v.orgName}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {v.rows
                      .filter((r) => r.state !== "current")
                      .map((r) => (
                        <Badge key={r.code} variant={stateTone(r.state)}>
                          {r.label}: {r.stateLabel}
                          {r.expiresOn ? ` (${usShortDate(r.expiresOn)})` : ""}
                        </Badge>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Archive className="h-3.5 w-3.5" /> Leftovers that can be retired ({retirable.length})
          </h4>
          {retirable.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing left to tidy.</p>
          ) : (
            <ul className="space-y-2">
              {retirable.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-xs"
                >
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-muted-foreground">{d.reason}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retireMutation.isPending}
                    onClick={() => retireMutation.mutate(d.id)}
                  >
                    Retire
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
