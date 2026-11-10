/**
 * Home: My shift (register T1, T4, S4), the lunch question (S1) and, for the
 * Operations Supervisor, time off requests in Needs you now (S4). Rules live in
 * src/lib/my-shift.ts; handoffs are written only by end_my_shift.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, CalendarOff, Coffee, LogOut, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/ui/page";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import { ShiftHandoffDialog, type WalkTicket } from "@/components/home/ShiftHandoffDialog";
import { TimeOffDialog } from "@/components/team/TimeOffDialog";
import { coverageModel } from "@/lib/coverage-admin.functions";
import { addDays, centralInstant, centralToday } from "@/lib/team-schedule";
import { buildModel } from "@/components/team/ScheduleTab";
import {
  MY_SHIFT_COPY,
  TIME_OFF_START_KEY,
  dateRangeLabel,
  handoffAt,
  lunchPrompt,
  myShiftToday,
  myTeamToday,
  shiftLine,
  ticketsToHandOff,
  timeOffOpen,
  timeOffStart,
  timeOffStatusLine,
  urgentBeforeLunch,
  type MyShiftToday,
  type ShiftOverride,
  type ShiftRole,
  type ShiftRow,
  type TimeOffRequest,
} from "@/lib/my-shift";

const FIELD = "h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";

/** Tonight's on-call night: before 8 AM Central it is still last night. */
function tonight(now = new Date()): string {
  const today = centralToday(now);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 8 ? addDays(today, -1) : today;
}

export function useMyShift(userId: string | null, isCoordinator: boolean) {
  return useQuery({
    queryKey: ["my-shift", userId, isCoordinator],
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 36 * 3600_000).toISOString();
      const to = new Date(now.getTime() + 36 * 3600_000).toISOString();
      const [roles, shifts, overrides, setting, requests] = await Promise.all([
        supabase.from("functional_roles").select("code, current_seat_holder, active"),
        supabase.from("coverage_shifts").select("role_code, weekday, start_minute, end_minute, lunch_start_minute, lunch_end_minute, active").eq("active", true),
        supabase.from("coverage_overrides").select("role_code, kind, user_id, starts_at, ends_at, created_at").lt("starts_at", to).gt("ends_at", from),
        supabase.from("app_settings").select("value").eq("key", TIME_OFF_START_KEY).maybeSingle(),
        supabase
          .from("time_off_requests")
          .select("id, user_id, starts_on, ends_on, note, status, decision_note, created_at")
          .eq("user_id", userId!)
          .gte("ends_on", addDays(centralToday(now), -14))
          .order("starts_on"),
      ]);
      for (const r of [roles, shifts, overrides]) if (r.error) throw r.error;
      const night = tonight(now);
      const oncall = await supabase.rpc("oncall_user_for_night", { _night: night });
      let oncallName: string | null = null;
      if (oncall.data) {
        const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", oncall.data as string).maybeSingle();
        oncallName = p ? displayName(p) : null;
      }
      const shift = myShiftToday({
        userId: userId!,
        isCoordinator,
        roles: (roles.data ?? []) as ShiftRole[],
        shifts: (shifts.data ?? []) as ShiftRow[],
        overrides: (overrides.data ?? []) as ShiftOverride[],
        now,
      });
      return {
        shift,
        oncallName,
        timeOffSetting: (setting.data?.value ?? null) as unknown,
        requests: (requests.data ?? []) as TimeOffRequest[],
      };
    },
  });
}

/** The My shift card: today's hours, on call tonight, Request time off and End my shift. */
export function MyShiftCard({
  userId,
  isCoordinator,
  rows,
  demoMode,
}: {
  userId: string;
  isCoordinator: boolean;
  rows: WalkTicket[];
  demoMode: boolean;
}) {
  const q = useMyShift(userId, isCoordinator);
  const [walking, setWalking] = useState(false);
  const [asking, setAsking] = useState(false);
  const shift = q.data?.shift;
  const at = useMemo(() => (shift ? handoffAt("end_of_shift", shift) : new Date().toISOString()), [shift, walking]);
  const untilMs = Date.parse(at) + 2 * 3600_000;
  const tickets = useMemo(() => ticketsToHandOff(rows, userId, untilMs), [rows, userId, untilMs]);

  if (!q.data || !shift?.worksShifts) return null;
  const open = timeOffOpen(q.data.timeOffSetting);
  const start = timeOffStart(q.data.timeOffSetting);

  return (
    <SectionCard title={MY_SHIFT_COPY.title} description={MY_SHIFT_COPY.hint} bodyClassName="space-y-3">
      <div data-my-shift className="space-y-2">
        <p className="flex items-center gap-2 text-[15px] font-semibold" data-shift-line>
          <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {shiftLine(shift)}
        </p>
        <p className="flex items-center gap-2 text-[15px]" data-oncall-line>
          <Moon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {MY_SHIFT_COPY.onCall(q.data.oncallName)}
        </p>
      </div>

      {q.data.requests.length > 0 && (
        <div className="space-y-1" data-time-off-status>
          <p className="text-sm font-semibold">{MY_SHIFT_COPY.timeOffMine}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {q.data.requests.map((r) => (
              <li key={r.id}>{timeOffStatusLine(r)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={!open}
          onClick={() => setAsking(true)}
          data-request-time-off={open ? "open" : "not-yet"}
        >
          <CalendarOff className="size-4" aria-hidden="true" />
          {open ? MY_SHIFT_COPY.requestTimeOff : MY_SHIFT_COPY.timeOffNotYet(start)}
        </Button>
        <Button className="min-h-11" onClick={() => setWalking(true)} data-end-shift>
          <LogOut className="size-4" aria-hidden="true" />
          {MY_SHIFT_COPY.endShift}
        </Button>
      </div>

      <ShiftHandoffDialog
        open={walking}
        onClose={() => setWalking(false)}
        kind="end_of_shift"
        tickets={tickets}
        at={at}
        myTeam={myTeamToday(shift)}
        userId={userId}
        demoMode={demoMode}
        untilMs={untilMs}
      />
      {open && <RequestTimeOffDialog open={asking} onClose={() => setAsking(false)} demoMode={demoMode} />}
    </SectionCard>
  );
}

function RequestTimeOffDialog({ open, onClose, demoMode }: { open: boolean; onClose: () => void; demoMode: boolean }) {
  const qc = useQueryClient();
  const today = centralToday();
  const [first, setFirst] = useState(today);
  const [last, setLast] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("request_time_off", { _starts: first, _ends: last < first ? first : last, _note: note, _demo: demoMode });
      if (error) throw new Error(error.message);
      toast.success(MY_SHIFT_COPY.timeOffSent);
      await qc.invalidateQueries({ queryKey: ["my-shift"] });
      setNote("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{MY_SHIFT_COPY.timeOffTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{MY_SHIFT_COPY.timeOffFirst}</span>
            <input type="date" className={FIELD} min={today} value={first} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{MY_SHIFT_COPY.timeOffLast}</span>
            <input type="date" className={FIELD} min={first} value={last} onChange={(e) => setLast(e.target.value)} />
          </label>
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{MY_SHIFT_COPY.timeOffNote}</span>
          <textarea rows={2} maxLength={400} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose}>Cancel</Button>
          <Button className="min-h-11" onClick={send} disabled={busy}>{MY_SHIFT_COPY.timeOffSend}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const lunchKey = (userId: string, date: string) => `resolve:lunch-asked:${userId}:${date}`;

/** Register S1: before the lunch hour, ask about Right now and time sensitive work. Never blocks. */
export function LunchPrompt({ userId, isCoordinator, rows, demoMode }: { userId: string; isCoordinator: boolean; rows: WalkTicket[]; demoMode: boolean }) {
  const q = useMyShift(userId, isCoordinator);
  const [dismissed, setDismissed] = useState<string | null>("loading");
  useEffect(() => {
    setDismissed(window.localStorage.getItem(lunchKey(userId, centralToday())));
  }, [userId]);
  const [walking, setWalking] = useState(false);
  const shift: MyShiftToday | undefined = q.data?.shift;
  const lunch = shift ? lunchPrompt(shift) : null;
  const lunchEndMs = shift && lunch ? Date.parse(centralInstant(shift.date, lunch.lunchEnd)) : 0;
  const urgent = useMemo(() => (lunch ? urgentBeforeLunch(rows, userId, lunchEndMs) : []), [rows, userId, lunchEndMs, lunch]);
  if (!shift || !lunch || dismissed) return null;
  const close = () => {
    window.localStorage.setItem(lunchKey(userId, shift.date), "1");
    setDismissed("1");
  };
  return (
    <section className="surface border-warning/45 space-y-3 p-4" aria-label="Before lunch" data-lunch-prompt>
      <p className="flex items-start gap-2 text-[15px] font-semibold">
        <Coffee className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden="true" />
        {MY_SHIFT_COPY.lunchAsk(lunch.lunchStart)}
      </p>
      <p className="text-sm text-muted-foreground" data-lunch-count={urgent.length}>
        {urgent.length ? MY_SHIFT_COPY.lunchUrgent(urgent.length) : MY_SHIFT_COPY.lunchClear}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {urgent.length > 0 && (
          <Button className="min-h-11" onClick={() => setWalking(true)} data-lunch-handoff>
            {MY_SHIFT_COPY.lunchHandOff}
          </Button>
        )}
        <Button variant="outline" className="min-h-11" onClick={close}>
          {urgent.length ? MY_SHIFT_COPY.lunchSkip : MY_SHIFT_COPY.lunchOk}
        </Button>
      </div>
      <ShiftHandoffDialog
        open={walking}
        onClose={() => {
          setWalking(false);
          close();
        }}
        kind="lunch"
        tickets={urgent}
        at={handoffAt("lunch", shift)}
        myTeam={myTeamToday(shift)}
        userId={userId}
        demoMode={demoMode}
        untilMs={lunchEndMs}
      />
    </section>
  );
}


/** Needs you now, for the Operations Supervisor: time off requests waiting for a decision. */
export function TimeOffRequestsWaiting({ userId, demoMode }: { userId: string; demoMode: boolean }) {
  const qc = useQueryClient();
  const { data: staff } = useStaffDirectory();
  const supervisor = useQuery({
    queryKey: ["ops-supervisor-now"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("seat_holder_at", { _role_code: "ops_supervisor" });
      return (data as string | null) ?? null;
    },
  });
  const isSupervisor = supervisor.data === userId;
  const pending = useQuery({
    queryKey: ["time-off-pending", demoMode],
    enabled: isSupervisor,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("id, user_id, starts_on, ends_on, note, status, decision_note, created_at")
        .eq("status", "pending")
        .eq("is_demo", demoMode)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TimeOffRequest[];
    },
  });
  const [approving, setApproving] = useState<TimeOffRequest | null>(null);
  const [declining, setDeclining] = useState<TimeOffRequest | null>(null);
  const [reason, setReason] = useState("");
  const loadModel = useServerFn(coverageModel);
  const model = useQuery({ queryKey: ["coverage-model-home"], enabled: Boolean(approving), queryFn: () => loadModel() });

  if (!isSupervisor || !(pending.data ?? []).length) return null;

  const decide = async (r: TimeOffRequest, decision: "approved" | "declined", note: string) => {
    const { error } = await supabase.rpc("decide_time_off", { _id: r.id, _decision: decision, _note: note });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(decision === "approved" ? "Time off approved." : "Time off declined.");
    await qc.invalidateQueries({ queryKey: ["time-off-pending"] });
    return true;
  };
  const who = (id: string) => displayName((staff ?? []).find((p) => p.id === id));
  const m = model.data ? buildModel(model.data as never) : null;

  return (
    <>
      {(pending.data ?? []).map((r) => (
        <div key={r.id} className="surface-row flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center" data-time-off-request={r.id}>
          <CalendarOff className="hidden size-4 shrink-0 text-primary sm:block" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{MY_SHIFT_COPY.timeOffNeedsYou}: {who(r.user_id)}</span>
            <span className="block text-sm text-muted-foreground">
              {dateRangeLabel(r.starts_on, r.ends_on)}
              {r.note ? ` · ${r.note}` : ""}
            </span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" className="min-h-11" onClick={() => setApproving(r)}>{MY_SHIFT_COPY.approve}</Button>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => { setDeclining(r); setReason(""); }}>{MY_SHIFT_COPY.decline}</Button>
          </div>
        </div>
      ))}

      {approving && m && (
        <TimeOffDialog
          open
          onClose={() => setApproving(null)}
          onSaved={() => void decide(approving, "approved", "")}
          people={m.shiftPeople}
          roles={m.roles}
          roster={m.roster}
          overrides={m.overrides}
          pattern={m.pattern}
          defaultUserId={approving.user_id}
          defaultStartDate={approving.starts_on}
          defaultEndDate={approving.ends_on}
          defaultNote={approving.note ?? ""}
        />
      )}

      <Dialog open={Boolean(declining)} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{MY_SHIFT_COPY.decline}</DialogTitle>
            <DialogDescription>{declining ? `${who(declining.user_id)}: ${dateRangeLabel(declining.starts_on, declining.ends_on)}` : ""}</DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{MY_SHIFT_COPY.declineReason}</span>
            <textarea rows={2} maxLength={400} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px]" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setDeclining(null)}>Cancel</Button>
            <Button
              className="min-h-11"
              disabled={!reason.trim()}
              onClick={async () => {
                if (declining && (await decide(declining, "declined", reason))) setDeclining(null);
              }}
            >
              {MY_SHIFT_COPY.declineConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
