/**
 * Actual closing date for a home, with the Director/Manager correction path.
 * Permission is enforced by the database (`correct_actual_closing`); this only
 * hides the form from people who would be refused. Disagreeing stored dates
 * are shown, never silently resolved.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ActualClosingCorrection({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const facts = useQuery({
    queryKey: ["actual-closing", propertyId],
    queryFn: async () => {
      const [home, enr, can] = await Promise.all([
        supabase.from("properties").select("planned_closing_on, actual_closing_on").eq("id", propertyId).maybeSingle(),
        supabase
          .from("owner_program_properties")
          .select("closing_date, closing_confirmed")
          .eq("property_id", propertyId)
          .eq("inclusion_status", "included")
          .is("archived_at", null),
        supabase.rpc("can_correct_actual_closing"),
      ]);
      if (home.error) throw home.error;
      const enrolled = [
        ...new Set((enr.data ?? []).filter((r) => r.closing_confirmed && r.closing_date).map((r) => r.closing_date as string)),
      ];
      return {
        planned: home.data?.planned_closing_on ?? null,
        actual: home.data?.actual_closing_on ?? null,
        enrolled,
        canCorrect: can.data === true,
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("correct_actual_closing", {
        _property_id: propertyId,
        _new_date: date,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Actual closing corrected. Logged hours were kept.");
      setOpen(false);
      setReason("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const f = facts.data;
  if (!f) return null;
  const values = [...new Set([f.actual, ...f.enrolled].filter(Boolean))];
  const conflict = values.length > 1;

  return (
    <div className="mt-4 space-y-2 border-t pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <span>
          <span className="text-muted-foreground">Actual closing: </span>
          {f.actual ?? "Not recorded"}
        </span>
        <span>
          <span className="text-muted-foreground">Planned closing: </span>
          {f.planned ?? "—"}
        </span>
        {f.canCorrect && !open ? (
          <Button size="sm" variant="outline" onClick={() => { setDate(f.actual ?? ""); setOpen(true); }}>
            Correct actual closing
          </Button>
        ) : null}
      </div>
      {conflict ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
          Closing dates disagree: {values.join(" vs ")}. Nothing has been chosen automatically — a
          Director or Manager should correct the actual closing.
        </p>
      ) : null}
      {open ? (
        <div className="space-y-2 rounded-md border p-3">
          <label className="block text-xs text-muted-foreground">
            Corrected actual closing
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-48" />
          </label>
          <label className="block text-xs text-muted-foreground">
            Reason (kept in history)
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" rows={2} />
          </label>
          <p className="text-xs text-muted-foreground">
            Updates the home and its Active Owner enrollment. Planned closing is unchanged. Logged
            hours are never deleted; which hours count follows the new date.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={!date || !reason.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save correction"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
