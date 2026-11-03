/** Per-person "No second look needed" switch. Admin and Directors change it; every change is kept in history. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui/page";
import { Switch } from "@/components/ui/switch";
import { readNoSecondLook, setNoSecondLook } from "@/lib/onboarding-reviews.functions";

type Person = { id: string; full_name: string | null; email: string | null };

export function NoSecondLookPanel({ people, canEdit }: { people: Person[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const read = useServerFn(readNoSecondLook);
  const save = useServerFn(setNoSecondLook);
  const q = useQuery({ queryKey: ["no-second-look"], queryFn: () => read(), retry: false });
  const m = useMutation({
    mutationFn: (v: { userId: string; on: boolean }) => save({ data: v }),
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["no-second-look"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const on = new Set(q.data ?? []);
  return (
    <SectionCard
      title="No second look needed"
      description="When this is on, steps this person finishes skip review and are recorded as skipped. Everyone else still goes to review. Only an Admin or a Director can change it."
      bodyClassName="divide-y"
    >
      {people.map((p) => (
        <label key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
          <span>{p.full_name || p.email}</span>
          <Switch checked={on.has(p.id)} disabled={!canEdit || m.isPending || q.isLoading} onCheckedChange={(v) => m.mutate({ userId: p.id, on: v })} />
        </label>
      ))}
    </SectionCard>
  );
}
