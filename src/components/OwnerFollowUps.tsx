import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { closeOwnerFollowUp, myOwnerFollowUps } from "@/lib/owner-followups.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** My Work: homeowners who are behind and need a teammate to reach out. */
export function OwnerFollowUps() {
  const qc = useQueryClient();
  const load = useServerFn(myOwnerFollowUps);
  const close = useServerFn(closeOwnerFollowUp);
  const q = useQuery({ queryKey: ["owner-followups"], queryFn: () => load() });
  const done = useMutation({
    mutationFn: (id: string) => close({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked as reached out.");
      void qc.invalidateQueries({ queryKey: ["owner-followups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = q.data?.rows ?? [];
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Homeowner follow-ups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <a href={r.link_path} className="flex-1 text-sm font-medium text-primary underline">
              {r.title}
            </a>
            <Button size="sm" onClick={() => done.mutate(r.id)} disabled={done.isPending}>
              Reached out
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
