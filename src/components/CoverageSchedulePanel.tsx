import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Moon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/hooks/useRole";

/**
 * Machine-readable coverage: the weekly shift windows each seat is on duty
 * for (America/Chicago, evaluated by the database so daylight saving is
 * handled), plus the admin-managed overnight on-call roster.
 *
 * Nothing here reassigns existing work. Coverage only decides who NEW
 * eligible work routes to; tickets already owned by a person keep that owner.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clock(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "a.m." : "p.m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}

/** Collapse identical windows into a readable day range list. */
function summarise(rows: { weekday: number; start_minute: number; end_minute: number }[]) {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const key = `${r.start_minute}-${r.end_minute}`;
    groups.set(key, [...(groups.get(key) ?? []), r.weekday]);
  }
  return Array.from(groups.entries()).map(([key, days]) => {
    const [start, end] = key.split("-").map(Number) as [number, number];
    const ordered = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return {
      days: ordered.map((d) => DAYS[d]!.slice(0, 3)).join(", "),
      window: `${clock(start)}–${clock(end)}`,
    };
  });
}

/** Today in America/Chicago, as yyyy-mm-dd, without pulling in a date library. */
function chicagoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

export function CoverageSchedulePanel() {
  const qc = useQueryClient();
  const { isSupervisor, readOnly } = useRole();
  const canEdit = isSupervisor && !readOnly;

  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [person, setPerson] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["coverage-model"],
    queryFn: async () => {
      const [shifts, roles, roster, eligible] = await Promise.all([
        supabase.from("coverage_shifts").select("*").eq("active", true),
        supabase.from("functional_roles").select("code, name, current_seat_name, current_seat_holder").order("sort_order"),
        supabase.from("oncall_roster").select("*").order("starts_on"),
        supabase.from("profiles").select("id, full_name, email").eq("oncall_eligible", true).order("full_name"),
      ]);
      if (shifts.error) throw shifts.error;
      return {
        shifts: shifts.data ?? [],
        roles: roles.data ?? [],
        roster: roster.data ?? [],
        eligible: eligible.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <Skeleton className="h-72 w-full" />;

  const today = chicagoToday();
  const onCallToday = data.roster.find((r) => r.starts_on <= today && r.ends_on >= today);
  const coveredToday = Boolean(onCallToday);
  const nameOf = (id: string) => {
    const p = data.eligible.find((e) => e.id === id);
    return p?.full_name ?? p?.email ?? "Unknown";
  };

  async function addPeriod() {
    if (!startsOn || !endsOn || !person) {
      toast.error("Pick a start date, an end date and one person.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("oncall_roster").insert({
      starts_on: startsOn,
      ends_on: endsOn,
      user_id: person,
      label: "On-call — coverage window pending business input",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStartsOn("");
    setEndsOn("");
    setPerson("");
    toast.success("On-call period saved.");
    await qc.invalidateQueries({ queryKey: ["coverage-model"] });
  }

  async function removePeriod(id: string) {
    const { error } = await supabase.from("oncall_roster").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["coverage-model"] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" /> Coverage windows
          </CardTitle>
          <CardDescription>
            The hours each seat is on duty, in Central time and adjusted automatically for daylight saving. New
            eligible work only routes to a seat inside its window — a schedule change never moves work that
            somebody already owns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.roles.map((role) => {
            const rows = data.shifts.filter((s) => s.role_code === role.code);
            return (
              <div key={role.code} className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{role.name}</p>
                  <p className="text-muted-foreground">
                    {role.current_seat_name ?? (
                      <span className="text-danger">Seat unfilled — work cannot route here</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {rows.length === 0 ? (
                    <span className="text-muted-foreground">No schedule — available by exception</span>
                  ) : (
                    summarise(rows).map((s) => (
                      <p key={`${s.days}${s.window}`}>
                        <span className="text-muted-foreground">{s.days}</span> {s.window}
                      </p>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="size-4" /> After-hours on-call roster
          </CardTitle>
          <CardDescription>
            One named person per date. Guests reach the on-call person on the ARHA Grasshopper number; the work
            itself is recorded and managed here in Resolve. The after-hours start and end times are not yet
            defined, so nothing routes automatically on this roster yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">On call today ({today})</p>
            <p className="text-lg font-semibold">
              {onCallToday ? nameOf(onCallToday.user_id) : "No one scheduled"}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>Coverage window: not configured.</strong> The imported schedule is date-based only and does
              not define after-hours start/end times. Until those hours are set by the business, after-hours
              auto-routing and the overnight handoff view stay off and existing escalation procedures apply.
            </p>
          </div>

          {!coveredToday && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                No on-call person is scheduled for {today}. Add a dated entry to close the gap.
              </p>
            </div>
          )}

          {data.roster.length === 0 ? (
            <p className="text-muted-foreground">No on-call periods have been entered.</p>
          ) : (
            <ul className="space-y-2">
              {data.roster.map((r) => {
                const current = r.starts_on <= today && r.ends_on >= today;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                    <span>
                      <span className="font-medium">{nameOf(r.user_id)}</span>{" "}
                      <span className="text-muted-foreground">
                        {r.starts_on} → {r.ends_on}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {current && <Badge variant="outline">On call now</Badge>}
                      {canEdit && (
                        <Button size="icon" variant="ghost" onClick={() => void removePeriod(r.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {canEdit && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Period starts</Label>
                  <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Period ends</Label>
                  <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>On-call person</Label>
                  <Select value={person} onValueChange={setPerson}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.eligible.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name ?? p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={() => void addPeriod()} disabled={saving}>
                {saving ? "Saving…" : "Add on-call period"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Only people approved for overnight on-call appear here. If someone is missing, they need a Resolve
                account and an administrator approval first.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
