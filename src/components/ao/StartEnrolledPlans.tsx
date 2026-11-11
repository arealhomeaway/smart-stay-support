/**
 * Program oversight, Admin only (Active Owner fix, Fix 4 and Fix 3):
 * Start plans for enrolled homes shows a preview first and writes nothing; Turn on then starts every
 * listed home in one step, all or none. A home that cannot start blocks the button until fixed.
 * The daily homeowner email time is set here too. Hidden until the staged change is applied.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/page";
import { useRole } from "@/hooks/useRole";
import { loadOwnerDigestTime, previewEnrolledHomes, setOwnerDigestTime, startEnrolledHomes } from "@/lib/ao-data";

const STAGE: Record<string, string> = { onboarding_early: "Early onboarding", onboarding_launch: "Launch", operations: "Operations" };

export function StartEnrolledPlans() {
  const role = useRole();
  const qc = useQueryClient();
  const [asked, setAsked] = useState(false);
  const preview = useQuery({ queryKey: ["ao-enrolled-preview"], queryFn: previewEnrolledHomes, enabled: role.isAdmin && asked, retry: false });
  const start = useMutation({
    mutationFn: (token: string) => startEnrolledHomes(token),
    onSuccess: (r) => {
      toast.success(`Plans started for ${r.started} home${r.started === 1 ? "" : "s"}. Each homeowner gets one plan is ready email.`);
      setAsked(false);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!role.isAdmin) return null;
  const data = preview.data?.available ? preview.data.data : null;
  const notSetUp = preview.data && !preview.data.available;

  return (
    <SectionCard
      title="Start plans for enrolled homes"
      description="For homes already enrolled before plans started by themselves. Preview first; nothing is written until you turn them on."
    >
      <div className="space-y-4">
        {!asked ? (
          <Button className="min-h-11" variant="outline" onClick={() => setAsked(true)}>Preview</Button>
        ) : preview.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading the preview...</p>
        ) : notSetUp ? (
          <p className="text-sm text-muted-foreground">Not set up yet.</p>
        ) : preview.error ? (
          <p className="text-sm text-destructive">{(preview.error as Error).message}</p>
        ) : data && data.homes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every enrolled home already has its plan.</p>
        ) : data ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2 pr-3">Home</th><th className="pr-3">Stage</th><th className="pr-3">Open</th><th className="pr-3">Locked</th><th className="pr-3">Already covered</th><th className="pr-3">Skipped</th></tr>
                </thead>
                <tbody>
                  {data.homes.map((h) => (
                    <tr key={h.property_id} className="border-t">
                      <td className="py-2 pr-3 font-medium">{h.home}</td>
                      {h.reason ? (
                        <td className="pr-3 text-destructive" colSpan={5}>{h.reason}</td>
                      ) : (
                        <>
                          <td className="pr-3">{STAGE[h.stage] ?? h.stage}</td>
                          <td className="numeric pr-3">{h.open}</td>
                          <td className="numeric pr-3">{h.locked}</td>
                          <td className="numeric pr-3">{h.already_covered}</td>
                          <td className="numeric pr-3">{h.skipped}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.blocked ? <p className="text-sm text-muted-foreground">Fix the homes listed with a reason, then preview again.</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11" disabled={data.blocked || start.isPending} onClick={() => start.mutate(data.token)}>
                Turn on plans for {data.homes.length} home{data.homes.length === 1 ? "" : "s"}
              </Button>
              <Button className="min-h-11" variant="ghost" onClick={() => setAsked(false)}>Cancel</Button>
            </div>
          </>
        ) : null}
        <DigestTime />
      </div>
    </SectionCard>
  );
}

function DigestTime() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["owner-digest-time"], queryFn: loadOwnerDigestTime });
  const [value, setValue] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => setOwnerDigestTime(value ?? q.data ?? "09:00"),
    onSuccess: (t) => { toast.success(`Daily homeowner email time saved: ${t} Central`); setValue(null); void qc.invalidateQueries({ queryKey: ["owner-digest-time"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-4">
      <div className="space-y-1">
        <Label htmlFor="owner-digest-time">Daily homeowner email time (Central)</Label>
        <Input id="owner-digest-time" type="time" className="min-h-11 w-36" value={value ?? q.data ?? "09:00"} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button className="min-h-11" variant="outline" disabled={value === null || save.isPending} onClick={() => save.mutate()}>Save time</Button>
    </div>
  );
}
