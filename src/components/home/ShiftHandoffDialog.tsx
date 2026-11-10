/**
 * End my shift and Hand off before lunch (register T6, S1): one walk through the
 * person's open tickets. Each goes to the next person on shift (from routing) with
 * what is done so far, the next step and when it is due, or the whole list is
 * Nothing to hand off. Confirm writes everything at once through end_my_shift;
 * ownership moves only when the receiver accepts on the ticket.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import {
  MY_SHIFT_COPY,
  RECEIVER_ROLES,
  defaultDue,
  defaultReceiver,
  draftProblem,
  isRightNow,
  isTimeSensitiveToday,
  itemFor,
  type HandoffDefault,
  type HandoffDraft,
  type HandoffTicket,
} from "@/lib/my-shift";
import { cn } from "@/lib/utils";

const FIELD = "h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";

export type WalkTicket = HandoffTicket & { homeLabel?: string };

/** ISO to the browser's datetime-local value (same as the ticket Hand off form). */
function localValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShiftHandoffDialog({
  open,
  onClose,
  kind,
  tickets,
  at,
  myTeam,
  userId,
  demoMode,
  untilMs,
}: {
  open: boolean;
  onClose: () => void;
  kind: "end_of_shift" | "lunch";
  tickets: WalkTicket[];
  /** When the handoff is planned for (the end of the shift or the lunch start). */
  at: string;
  myTeam: string | null;
  userId: string;
  demoMode: boolean;
  untilMs: number;
}) {
  const qc = useQueryClient();
  const { data: staff } = useStaffDirectory();
  const defaults = useQuery({
    queryKey: ["shift-handoff-defaults", at],
    enabled: open,
    queryFn: async (): Promise<HandoffDefault[]> => {
      const { data, error } = await supabase.rpc("shift_handoff_defaults", { _at: at });
      if (error) throw error;
      return (data ?? []) as HandoffDefault[];
    },
  });
  const [nothing, setNothing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, HandoffDraft>>({});
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Fill each ticket's defaults once the routing answer is in.
  useEffect(() => {
    if (!open) return;
    setDrafts((prev) => {
      const next: Record<string, HandoffDraft> = {};
      for (const t of tickets) {
        const d = defaultReceiver(t, defaults.data ?? [], myTeam);
        next[t.id] = prev[t.id] ?? {
          ticketId: t.id,
          receiver: d?.user_id ? `user:${d.user_id}` : "",
          done: "",
          nextStep: t.next_action ?? "",
          dueAt: localValue(defaultDue(t)),
        };
        if (!next[t.id]!.receiver && d?.user_id) next[t.id] = { ...next[t.id]!, receiver: `user:${d.user_id}` };
      }
      return next;
    });
  }, [open, tickets, defaults.data, myTeam]);

  useEffect(() => {
    if (!open) {
      setNothing(false);
      setShowErrors(false);
      setDrafts({});
    }
  }, [open]);

  const people = useMemo(() => (staff ?? []).filter((p) => p.id !== userId), [staff, userId]);
  const nameOf = (id: string | null | undefined) => displayName(people.find((p) => p.id === id));
  const set = (id: string, patch: Partial<HandoffDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id]!, ...patch } }));

  const none = tickets.length === 0;
  const finishing = none || nothing;
  const problems = tickets.map((t) => (drafts[t.id] ? draftProblem(drafts[t.id]!) : MY_SHIFT_COPY.needReceiver));
  const ready = finishing || problems.every((p) => p === null);

  const submit = async () => {
    if (!ready) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const items = finishing ? [] : tickets.map((t) => itemFor(drafts[t.id]!));
      const { data, error } = await supabase.rpc("end_my_shift", {
        _kind: kind,
        _at: at,
        _items: items as never,
        _nothing: finishing,
        _demo: demoMode,
      });
      if (error) throw new Error(error.message);
      const n = Number((data as { handoffs?: number } | null)?.handoffs ?? 0);
      toast.success(kind === "lunch" ? MY_SHIFT_COPY.lunchDone(n) : MY_SHIFT_COPY.ended(n));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["home-my-work"] }),
        qc.invalidateQueries({ queryKey: ["my-shift"] }),
      ]);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const title = kind === "lunch" ? MY_SHIFT_COPY.lunchTitle : MY_SHIFT_COPY.walkTitle;
  const hint = kind === "lunch" ? MY_SHIFT_COPY.lunchHint : MY_SHIFT_COPY.walkHint;
  const confirm = finishing
    ? kind === "lunch" ? MY_SHIFT_COPY.lunchOk : MY_SHIFT_COPY.finish
    : kind === "lunch" ? MY_SHIFT_COPY.confirmLunch(tickets.length) : MY_SHIFT_COPY.confirm(tickets.length);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-shift-walk={kind}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>

        {none ? (
          <p className="rounded-lg border border-border p-3 text-[15px]" data-nothing-open>
            {MY_SHIFT_COPY.nothingOpen}
          </p>
        ) : (
          <div className="space-y-3">
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-[15px]">
              <input type="checkbox" className="size-5" checked={nothing} onChange={(e) => setNothing(e.target.checked)} data-nothing-toggle />
              {MY_SHIFT_COPY.nothing}
            </label>
            {!nothing && (
              <ol className="space-y-3">
                {tickets.map((t, i) => {
                  const d = drafts[t.id];
                  const def = defaultReceiver(t, defaults.data ?? [], myTeam);
                  const tag = isRightNow(t) ? MY_SHIFT_COPY.rightNow : isTimeSensitiveToday(t, untilMs) ? MY_SHIFT_COPY.timeSensitive : null;
                  const problem = showErrors ? problems[i] : null;
                  return (
                    <li key={t.id} className={cn("space-y-2 rounded-lg border p-3", problem ? "border-danger/50" : "border-border")} data-walk-ticket={t.id}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold">{t.ref ? `#${t.ref} ` : ""}{t.title ?? "Ticket"}</span>
                        {tag && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{tag}</span>}
                      </div>
                      {t.homeLabel && <p className="text-sm text-muted-foreground">{t.homeLabel}</p>}
                      <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground">{MY_SHIFT_COPY.receiver}</span>
                        <select className={FIELD} value={d?.receiver ?? ""} onChange={(e) => set(t.id, { receiver: e.target.value })} aria-label={`${MY_SHIFT_COPY.receiver}: ticket ${t.ref ?? ""}`}>
                          <option value="">Choose</option>
                          {def?.user_id && (
                            <option value={`user:${def.user_id}`}>
                              {nameOf(def.user_id)} ({MY_SHIFT_COPY.next})
                            </option>
                          )}
                          <optgroup label="A role">
                            {RECEIVER_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="A person">
                            {people
                              .filter((p) => p.id !== def?.user_id)
                              .map((p) => (
                                <option key={p.id} value={`user:${p.id}`}>{displayName(p)}</option>
                              ))}
                          </optgroup>
                        </select>
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground">{MY_SHIFT_COPY.done}</span>
                        <textarea
                          rows={2}
                          className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px]"
                          value={d?.done ?? ""}
                          onChange={(e) => set(t.id, { done: e.target.value })}
                        />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block space-y-1 text-sm">
                          <span className="text-muted-foreground">{MY_SHIFT_COPY.nextStep}</span>
                          <input className={FIELD} value={d?.nextStep ?? ""} onChange={(e) => set(t.id, { nextStep: e.target.value })} />
                        </label>
                        <label className="block space-y-1 text-sm">
                          <span className="text-muted-foreground">{MY_SHIFT_COPY.due}</span>
                          <input type="datetime-local" className={FIELD} value={d?.dueAt ?? ""} onChange={(e) => set(t.id, { dueAt: e.target.value })} />
                        </label>
                      </div>
                      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="min-h-11" onClick={submit} disabled={saving} data-walk-confirm>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
