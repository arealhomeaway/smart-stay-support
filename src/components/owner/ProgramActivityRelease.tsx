import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Route } from "lucide-react";
import { toast } from "sonner";
import { seedOwnerRoadmap } from "@/lib/owner-program.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProgramActivityRelease({ programId, expectedVersion, onRefresh }: {
  programId: string; expectedVersion: string; onRefresh: () => void;
}) {
  const release = useServerFn(seedOwnerRoadmap);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const preview = useQuery({
    queryKey: ["owner-release-preview", programId, expectedVersion],
    queryFn: () => release({ data: { programId, expectedVersion, preview: true } }),
    staleTime: 0,
  });
  const facts = preview.data?.preview;
  async function confirm() {
    if (!facts || saving) return;
    setSaving(true); setError("");
    try {
      const result = await release({ data: { programId, expectedVersion: facts.reportVersion, preview: false, expectedCount: facts.count } });
      toast.success(result.receipt?.opened ? "Activities released. One homeowner summary queued." : "All activities are released.");
      setOpen(false); onRefresh();
      void qc.invalidateQueries({ queryKey: ["owner-release-preview", programId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The activities could not be released.");
      void preview.refetch(); onRefresh();
    } finally { setSaving(false); }
  }
  return <div className="space-y-2">
    <Button size="sm" disabled={!facts || facts.count === 0 || saving} onClick={() => { setError(""); setOpen(true); void preview.refetch(); }}>
      <Route className="size-4" /> {facts?.count === 0 ? "All activities are released" : "Release activities to homeowner"}
    </Button>
    {preview.error ? <p role="alert" className="text-sm text-destructive">{preview.error.message}</p> : null}
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Release activities to homeowner</DialogTitle>
          <DialogDescription>{facts ? `This will add ${facts.count} activities for ${facts.homes.join(", ")} and send the homeowner one summary email.` : "Checking activities…"}</DialogDescription>
        </DialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saving || preview.isFetching || !facts || facts.count === 0} onClick={() => void confirm()}>{saving ? "Releasing…" : "Release activities to homeowner"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}