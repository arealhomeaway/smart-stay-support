import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, UserCheck, Utensils } from "lucide-react";
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
import { TEAMS } from "@/lib/tickets";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { TeamAccessPanel } from "@/components/TeamAccessPanel";
import { TeamInvitePanel } from "@/components/TeamInvitePanel";
import { VendorScoreboardPanel } from "@/components/VendorScoreboardPanel";
import { CoverageSchedulePanel } from "@/components/CoverageSchedulePanel";
import { AssignmentExceptionQueue } from "@/components/AssignmentExceptionQueue";
import { OwnerDirectoryPanel } from "@/components/OwnerDirectoryPanel";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Seats & coverage — Resolve Operations" },
      {
        name: "description",
        content:
          "Work routes to permanent functional seats, not names. Set who holds each seat, the coverage window, lunch cover and the backup role.",
      },
      { property: "og:title", content: "Seats & coverage — Resolve Operations" },
      {
        property: "og:description",
        content: "Change the seat holder, not the operating system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <TeamPage />
    </SupervisorOnly>
  ),
  errorComponent: () => <p className="text-muted-foreground">Seats could not be loaded.</p>,
});

function TeamPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["functional-roles-full"],
    queryFn: async () => {
      const [roles, people, tickets] = await Promise.all([
        supabase.from("functional_roles").select("*").order("sort_order"),
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase
          .from("tickets")
          .select("id, functional_role_code, status, priority")
          .eq("is_demo", false)
          .is("archived_at", null),
      ]);
      if (roles.error) throw roles.error;
      return { roles: roles.data, people: people.data ?? [], tickets: tickets.data ?? [] };
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const openByRole = (code: string) =>
    data.tickets.filter(
      (t) => t.functional_role_code === code && !["resolved", "closed", "cancelled"].includes(t.status),
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Seats &amp; coverage</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Work routes to a permanent seat, never to a name. When someone changes role, update the seat holder
          here — the routing rules, queues and playbooks stay exactly as they are.
        </p>
      </div>

      <TeamInvitePanel />

      <TeamAccessPanel />

      <CoverageSchedulePanel />

      <AssignmentExceptionQueue />

      <OwnerDirectoryPanel />

      <VendorScoreboardPanel />


      {TEAMS.map((team) => {
        const roles = data.roles.filter((r) => r.team === team.value);
        if (roles.length === 0) return null;
        return (
          <div key={team.value} className="space-y-3">
            <h2 className="text-lg font-semibold">{team.label}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {roles.map((role) => {
                const open = openByRole(role.code);
                const p1 = open.filter((t) => t.priority === "p1").length;
                const backup = data.roles.find((r) => r.code === role.backup_role_code);
                return (
                  <Card key={role.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{role.name}</CardTitle>
                          <CardDescription className="font-mono text-xs">{role.code}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {p1 > 0 && (
                            <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
                              {p1} P1
                            </Badge>
                          )}
                          <Badge variant="outline">{open.length} open</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <Row
                        icon={<UserCheck className="size-4" />}
                        label="Current seat holder"
                        value={
                          role.current_seat_holder
                            ? (role.current_seat_name ??
                              data.people.find((p) => p.id === role.current_seat_holder)?.full_name ??
                              "Unassigned")
                            : role.current_seat_name
                              ? `${role.current_seat_name} — invitation pending`
                              : "Unassigned"
                        }
                      />
                      <Row
                        icon={<Clock className="size-4" />}
                        label="Coverage window"
                        value={role.coverage_window ?? "—"}
                      />
                      <Row
                        icon={<Utensils className="size-4" />}
                        label="Lunch"
                        value={role.lunch_window ?? "—"}
                      />
                      <p className="text-muted-foreground">
                        During lunch, new P1 and time-sensitive P2 work is covered by{" "}
                        <span className="font-medium text-foreground">{role.lunch_coverage ?? "the on-duty seat"}</span>.
                        Backup / coverage seat:{" "}
                        <span className="font-medium text-foreground">{backup?.name ?? "—"}</span>.
                      </p>

                      {editing === role.id ? (
                        <SeatEditor
                          role={role}
                          people={data.people}
                          onDone={async () => {
                            setEditing(null);
                            await qc.invalidateQueries({ queryKey: ["functional-roles-full"] });
                            await qc.invalidateQueries({ queryKey: ["functional-roles"] });
                          }}
                        />
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setEditing(role.id)}>
                          Update seat &amp; coverage
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Single-PC coverage rule</CardTitle>
          <CardDescription>
            When only one coordinator is working, that person monitors both queues: acknowledge urgent messages,
            begin action on urgent tasks, prevent guest-service failures, document incomplete work, and hand
            unresolved tasks to the next responsible seat. Routine admin never delays urgent guest, access,
            maintenance, booking or cleaning action.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function SeatEditor({
  role,
  people,
  onDone,
}: {
  role: {
    id: string;
    current_seat_holder: string | null;
    current_seat_name: string | null;
    coverage_window: string | null;
    lunch_window: string | null;
    lunch_coverage: string | null;
  };
  people: { id: string; full_name: string | null; email: string | null }[];
  onDone: () => Promise<void>;
}) {
  const [holder, setHolder] = useState(role.current_seat_holder ?? "");
  const [coverage, setCoverage] = useState(role.coverage_window ?? "");
  const [lunch, setLunch] = useState(role.lunch_window ?? "");
  const [lunchCover, setLunchCover] = useState(role.lunch_coverage ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const person = people.find((p) => p.id === holder);
    const { error } = await supabase
      .from("functional_roles")
      .update({
        current_seat_holder: holder || null,
        current_seat_name: person?.full_name ?? person?.email ?? null,
        coverage_window: coverage.trim() || null,
        lunch_window: lunch.trim() || null,
        lunch_coverage: lunchCover.trim() || null,
      })
      .eq("id", role.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Seat updated. Routing rules were not touched.");
    await onDone();
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-1.5">
        <Label>Current seat holder</Label>
        <Select value={holder} onValueChange={setHolder}>
          <SelectTrigger>
            <SelectValue placeholder="Who holds this seat today?" />
          </SelectTrigger>
          <SelectContent>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Coverage window</Label>
          <Input value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="Mon–Fri 8a–5p" />
        </div>
        <div className="space-y-1.5">
          <Label>Lunch window</Label>
          <Input value={lunch} onChange={(e) => setLunch(e.target.value)} placeholder="1:00–2:00 p.m." />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Who covers new P1 / time-sensitive P2 during lunch</Label>
        <Input
          value={lunchCover}
          onChange={(e) => setLunchCover(e.target.value)}
          placeholder="On-duty Guest Experience or Evening/Weekend Property Ops role"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save seat"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void onDone()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
