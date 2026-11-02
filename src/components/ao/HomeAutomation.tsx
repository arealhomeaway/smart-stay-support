import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { loadHomePlan, previewHomeAutomation, setHomeAutomation, unlockNow } from "@/lib/ao-data";
import { useRole } from "@/hooks/useRole";
import { NOT_SET_UP, canToggleHomeAutomation, OUTCOME_LABEL, previewSummary } from "@/lib/ao-ui";
import { usDate } from "@/lib/ao-format";
import { coveredReasonLabel } from "@/lib/ao-dedupe";

/** "Automated homeowner plan" on the property's Active Owner section. Staff view; editors switch. */
export function HomeAutomation({ propertyId }: { propertyId: string }) {
  const role = useRole();
  const canToggle = !role.readOnly && canToggleHomeAutomation(role);
  const qc = useQueryClient();
  const key = ["ao-home-plan", propertyId];
  const q = useQuery({ queryKey: key, queryFn: () => loadHomePlan(propertyId), retry: false });
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const preview = useQuery({
    queryKey: ["ao-home-preview", propertyId],
    queryFn: () => previewHomeAutomation(propertyId),
    enabled: confirm === true,
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const toggle = useMutation({
    mutationFn: (on: boolean) => setHomeAutomation(propertyId, on),
    onSuccess: () => { toast.success("Automated plan updated"); setConfirm(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlock = useMutation({
    mutationFn: (id: string) => unlockNow(id),
    onSuccess: () => { toast.success("Card unlocked"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return null;
  if (q.error) return <p className="text-sm text-muted-foreground">Could not load the automated plan.</p>;
  if (!q.data || !q.data.available) {
    return (
      <div className="rounded-md border p-3" data-testid="ao-home-not-set-up">
        <p className="text-sm font-medium">Automated homeowner plan</p>
        <p className="text-sm text-muted-foreground">{NOT_SET_UP}</p>
      </div>
    );
  }
  const { automated, plan, history } = q.data;
  const pv = preview.data;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`ao-auto-${propertyId}`} className="font-medium">Automated homeowner plan</Label>
        <Switch
          id={`ao-auto-${propertyId}`}
          checked={automated}
          disabled={!canToggle || toggle.isPending}
          onCheckedChange={(v) => setConfirm(v)}
        />
      </div>
      {!canToggle ? <p className="text-xs text-muted-foreground">Admin or the Onboarding Director can switch this.</p> : null}

      {plan.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1 pr-2">Card</th><th className="pr-2">Outcome</th><th className="pr-2">Unlocked</th><th className="pr-2">Due</th><th className="pr-2">Reminder sent</th><th className="pr-2">Expired</th><th className="pr-2">Completed</th><th /></tr>
            </thead>
            <tbody>
              {plan.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-1 pr-2">{p.card ? `${p.card.code} ${p.card.title}` : "Card"}</td>
                  <td className="pr-2">
                    {OUTCOME_LABEL[p.join_outcome] ?? p.join_outcome}
                    {p.join_outcome === "already_covered" && p.covered_reason ? (
                      <span className="block text-xs text-muted-foreground">{coveredReasonLabel(p.covered_reason)}</span>
                    ) : null}
                  </td>
                  <td className="pr-2">{usDate(p.unlocked_at)}</td>
                  <td className="pr-2">{usDate(p.deadline_at)}</td>
                  <td className="pr-2">{usDate(p.reminder_sent_at)}</td>
                  <td className="pr-2">{usDate(p.expired_at)}</td>
                  <td className="pr-2">{usDate(p.owner_completed_at)}</td>
                  <td>
                    {canToggle && p.join_outcome === "locked" && !p.unlocked_at ? (
                      <Button size="sm" variant="outline" disabled={unlock.isPending} onClick={() => unlock.mutate(p.id)}>Unlock now</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No plan cards for this home yet.</p>
      )}

      {history.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">History</p>
          <ul className="text-xs text-muted-foreground">
            {history.map((h) => <li key={h.id}>{usDate(h.changed_at)}: turned {h.automated ? "on" : "off"}</li>)}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? "Turn on the automated plan?" : "Turn off the automated plan?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === false
                ? "No new cards will be added. Cards already on the plan stay as they are."
                : preview.isLoading
                  ? "Checking what this home would get..."
                  : !pv || !pv.available
                    ? NOT_SET_UP
                    : !pv.data.ready
                      ? pv.data.reason
                      : `This home would get: ${previewSummary(pv.data.outcomes)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm === true && pv?.available && pv.data.ready && (pv.data.covered?.length ?? 0) > 0 ? (
            <div className="max-h-48 overflow-y-auto text-sm">
              <p className="font-medium">Already covered</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {pv.data.covered!.map((c) => (
                  <li key={c.code}><span className="font-mono">{c.code}</span> {c.title}: {coveredReasonLabel(c.reason, c.item_title)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={toggle.isPending || (confirm === true && !(pv?.available && pv.data.ready))}
              onClick={(e) => { e.preventDefault(); if (confirm !== null) toggle.mutate(confirm); }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
