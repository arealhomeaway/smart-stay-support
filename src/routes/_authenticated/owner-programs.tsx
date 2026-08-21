import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ClipboardCheck, Copy, KeyRound, Plus, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createOwnerInvite,
  ownerProgramDetail,
  ownerPrograms,
  ownerTaskRoadmap,
  seedOwnerRoadmap,
  setOwnerProgramStart,
  startOwnerProgram,
} from "@/lib/owner-program.functions";
import {
  DECISION_PATHS,
  PACE_LABELS,
  PHASE_LABELS,
  PROGRAM_DAYS,
  PROGRAM_STATUS_LABELS,
  daysRemaining,
  formatHours,
  hoursFromMinutes,
  paceState,
  programDay,
  type ProgramRow,
  type TaskTemplate,
} from "@/lib/owner-program";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/owner-programs")({
  head: () => ({
    meta: [
      { title: "Owner participation programs — Resolve Operations" },
      {
        name: "description",
        content:
          "Run the 90-day Active Owner Participation Program: enroll a home, set the clock, seed the owner task roadmap and track self-reported participation hours.",
      },
      { property: "og:title", content: "Owner participation programs — Resolve Operations" },
      {
        property: "og:description",
        content: "The 90-day owner participation roadmap, one home at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerProgramsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function OwnerProgramsPage() {
  const { isSupervisor, isLoading } = useRole();
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!isSupervisor) return <SupervisorOnly />;
  return <ProgramsBoard />;
}

function ProgramsBoard() {
  const qc = useQueryClient();
  const load = useServerFn(ownerPrograms);
  const loadRoadmap = useServerFn(ownerTaskRoadmap);
  const enroll = useServerFn(startOwnerProgram);

  const [selected, setSelected] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [startedOn, setStartedOn] = useState(today());

  const programs = useQuery({ queryKey: ["owner-programs"], queryFn: () => load() });
  const roadmap = useQuery({ queryKey: ["owner-roadmap"], queryFn: () => loadRoadmap() });

  const rows = programs.data?.rows ?? [];
  const available = programs.data?.available ?? [];
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["owner-programs"] });

  const create = useMutation({
    mutationFn: () => enroll({ data: { propertyId, ownerName, ownerEmail, startedOn: startedOn || null } }),
    onSuccess: (r) => {
      toast.success(r.alreadyExists ? "That home is already enrolled." : "Program started. Seed the roadmap next.");
      setPropertyId("");
      setOwnerName("");
      setOwnerEmail("");
      setSelected(r.programId);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">Owner participation programs</h1>
        <p className="max-w-3xl text-muted-foreground">
          The Active Owner Participation Program is a 90-day operating window per home. ARHA sets the
          roadmap of owner tasks; the homeowner completes them and self-reports the time they actually
          spent. Target is 100+ hours — {" "}
          <span className="font-medium text-foreground">60 through onboarding and launch</span>, then{" "}
          <span className="font-medium text-foreground">40+ through ongoing operations</span>.
        </p>
      </header>

      <ProgramSummary rows={rows} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="size-4" /> Enroll a home
          </CardTitle>
          <CardDescription>
            Start the clock the day the owner onboarding meeting happens. You can move it later if closing slips.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder={available.length ? "Choose a home" : "Every active home is enrolled"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.location ? ` · ${p.location}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerName">Owner name</Label>
            <Input id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerEmail">Owner email</Label>
            <Input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startedOn">Day one</Label>
            <Input id="startedOn" type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
          </div>
          <div className="flex items-end md:col-span-4">
            <Button onClick={() => create.mutate()} disabled={!propertyId || create.isPending}>
              {create.isPending ? "Starting…" : "Start the 90-day program"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {programs.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No homes enrolled yet. Enroll one above to build its owner roadmap.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <ProgramCard
              key={row.id}
              row={row}
              expanded={selected === row.id}
              onToggle={() => setSelected(selected === row.id ? null : row.id)}
            />
          ))}
        </div>
      )}

      <RoadmapCatalog templates={roadmap.data?.templates ?? []} loading={roadmap.isLoading} />
    </div>
  );
}

function ProgramSummary({ rows }: { rows: ProgramRow[] }) {
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    const minutes = rows.reduce((n, r) => n + r.reportedMinutes, 0);
    const behind = active.filter((r) => {
      const pace = paceState(r.startedOn, r.reportedMinutes, r.targetHours);
      return pace.state === "behind" || pace.state === "slipping";
    }).length;
    const open = rows.reduce((n, r) => n + r.openReviewCount, 0);
    return { enrolled: rows.length, active: active.length, hours: hoursFromMinutes(minutes), behind, open };
  }, [rows]);

  const tiles = [
    { label: "Homes enrolled", value: stats.enrolled },
    { label: "Programs running", value: stats.active },
    { label: "Owner hours reported", value: stats.hours },
    { label: "Owner tasks open", value: stats.open },
    { label: "Off pace", value: stats.behind },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="space-y-1 py-5">
            <p className="text-2xl font-semibold">{t.value}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProgramCard({
  row,
  expanded,
  onToggle,
}: {
  row: ProgramRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pace = paceState(row.startedOn, row.reportedMinutes, row.targetHours);
  const paceInfo = PACE_LABELS[pace.state];
  const status = PROGRAM_STATUS_LABELS[row.status];
  const hours = hoursFromMinutes(row.reportedMinutes);
  const percent = Math.min(100, Math.round((hours / row.targetHours) * 100));
  const day = programDay(row.startedOn);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{row.propertyName}</CardTitle>
            <CardDescription>
              {row.ownerName || "Owner not named yet"}
              {row.location ? ` · ${row.location}` : ""}
              {row.ownerLinked ? " · portal access active" : " · no portal login yet"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.tone}>
              {status.label}
            </Badge>
            <Badge variant="outline" className={paceInfo.tone}>
              {paceInfo.label}
            </Badge>
            <Button size="sm" variant="outline" onClick={onToggle}>
              {expanded ? "Hide" : "Manage"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="text-xl font-semibold">{hours}</span>
              <span className="text-muted-foreground"> of {row.targetHours} hours reported</span>
            </span>
            <span className="text-muted-foreground">
              {row.startedOn
                ? `Day ${day} of ${PROGRAM_DAYS} · ${daysRemaining(row.startedOn)} days left`
                : "Clock not started"}
            </span>
          </div>
          <Progress value={percent} />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              {PHASE_LABELS.onboarding}: {formatHours(row.onboardingMinutes)} of {row.onboardingTargetHours}
            </span>
            <span>
              {PHASE_LABELS.ongoing}: {formatHours(row.ongoingMinutes)} of {row.ongoingTargetHours}
            </span>
            <span>
              {row.openReviewCount} of {row.reviewCount} owner tasks open
            </span>
            {pace.state === "behind" || pace.state === "slipping" ? (
              <span className="font-medium text-destructive">
                {pace.gapHours} hrs behind the calendar
              </span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {expanded ? <ProgramDetail programId={row.id} startedOn={row.startedOn} ownerEmail={row.ownerEmail} /> : null}
    </Card>
  );
}

function ProgramDetail({
  programId,
  startedOn,
  ownerEmail,
}: {
  programId: string;
  startedOn: string | null;
  ownerEmail: string | null;
}) {
  const qc = useQueryClient();
  const loadDetail = useServerFn(ownerProgramDetail);
  const seed = useServerFn(seedOwnerRoadmap);
  const setStart = useServerFn(setOwnerProgramStart);
  const invite = useServerFn(createOwnerInvite);
  const [start, setStartValue] = useState(startedOn ?? today());

  const detail = useQuery({
    queryKey: ["owner-program", programId],
    queryFn: () => loadDetail({ data: { programId } }),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["owner-program", programId] });
    void qc.invalidateQueries({ queryKey: ["owner-programs"] });
  };

  const seedPhase = useMutation({
    mutationFn: (phase: "onboarding" | "ongoing" | "all") => seed({ data: { programId, phase } }),
    onSuccess: (r) => {
      toast.success(r.added ? `${r.added} owner tasks added to the roadmap.` : "Roadmap already up to date.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStart = useMutation({
    mutationFn: () => setStart({ data: { programId, startedOn: start } }),
    onSuccess: () => {
      toast.success("Program clock updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeInvite = useMutation({
    mutationFn: () => invite({ data: { programId, ownerEmail: ownerEmail ?? "" } }),
    onSuccess: (r) => {
      toast.success(`Invite code ${r.code} created.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) return <CardContent><Skeleton className="h-40 w-full" /></CardContent>;

  const reviews = detail.data?.reviews ?? [];
  const invites = detail.data?.invites ?? [];
  const grouped = reviews.reduce<Record<string, typeof reviews>>((acc, r) => {
    const key = `${r.phase}::${r.stage}`;
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <CardContent className="space-y-6 border-t pt-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={`start-${programId}`}>Day one</Label>
          <Input
            id={`start-${programId}`}
            type="date"
            value={start}
            onChange={(e) => setStartValue(e.target.value)}
            className="w-44"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => moveStart.mutate()} disabled={moveStart.isPending}>
          <CalendarClock className="size-4" /> Set the clock
        </Button>
        <Separator orientation="vertical" className="hidden h-9 sm:block" />
        <Button size="sm" onClick={() => seedPhase.mutate("onboarding")} disabled={seedPhase.isPending}>
          <RouteIcon className="size-4" /> Seed onboarding tasks
        </Button>
        <Button size="sm" variant="outline" onClick={() => seedPhase.mutate("ongoing")} disabled={seedPhase.isPending}>
          Seed ongoing tasks
        </Button>
        <Button size="sm" variant="outline" onClick={() => makeInvite.mutate()} disabled={makeInvite.isPending}>
          <KeyRound className="size-4" /> Issue invite code
        </Button>
      </div>

      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Self-signup codes</p>
          <div className="flex flex-wrap gap-2">
            {invites.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(i.code);
                  toast.success("Code copied.");
                }}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-sm hover:bg-accent"
              >
                {i.code}
                <Copy className="size-3.5 text-muted-foreground" />
                {i.redeemed_at ? (
                  <Badge variant="outline" className="bg-muted text-xs">used</Badge>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No owner tasks on this roadmap yet. Seed the onboarding phase to build the first 60 hours of work.
        </p>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([key, items]) => {
            const [phase, stage] = key.split("::");
            return (
              <div key={key} className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {PHASE_LABELS[phase as keyof typeof PHASE_LABELS]} · {stage}
                </p>
                {items.map((r) => {
                  const path = DECISION_PATHS[r.decision_path as keyof typeof DECISION_PATHS];
                  return (
                    <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                      <div className="space-y-1">
                        <p className="font-medium">{r.title}</p>
                        {r.impact ? <p className="text-sm text-muted-foreground">{r.impact}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {path ? (
                          <Badge variant="outline" className={path.tone}>
                            {path.label}
                          </Badge>
                        ) : null}
                        {r.respond_by ? (
                          <span className="text-xs text-muted-foreground">Respond by {r.respond_by}</span>
                        ) : null}
                        {r.owner_decision ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700">
                            {r.owner_decision}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  );
}

function RoadmapCatalog({ templates, loading }: { templates: TaskTemplate[]; loading: boolean }) {
  const grouped = useMemo(() => {
    return templates.reduce<Record<string, TaskTemplate[]>>((acc, t) => {
      const key = `${t.phase}::${t.stage}`;
      (acc[key] ||= []).push(t);
      return acc;
    }, {});
  }, [templates]);

  const planned = templates.reduce(
    (acc, t) => {
      acc[t.phase] += (t.planning_hours_low + t.planning_hours_high) / 2;
      return acc;
    },
    { onboarding: 0, ongoing: 0 } as Record<string, number>,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="size-4" /> The owner task roadmap
        </CardTitle>
        <CardDescription>
          The standard task set every program is seeded from. Planning hours are an internal staffing
          estimate — they are never shown to a homeowner, so reported participation stays genuinely
          self-reported.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                {PHASE_LABELS.onboarding}: ~{Math.round(planned.onboarding)} planned hrs
              </span>
              <span>
                {PHASE_LABELS.ongoing}: ~{Math.round(planned.ongoing)} planned hrs
              </span>
            </div>
            {Object.entries(grouped).map(([key, items]) => {
              const [phase, stage] = key.split("::");
              return (
                <div key={key} className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {PHASE_LABELS[phase as keyof typeof PHASE_LABELS]} · {stage}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map((t) => (
                      <div key={t.id} className="space-y-1 rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{t.title}</p>
                          <Badge variant="outline" className={DECISION_PATHS[t.decision_path].tone}>
                            {DECISION_PATHS[t.decision_path].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{t.owner_action}</p>
                        <p className="text-xs text-muted-foreground">
                          Internal plan {t.planning_hours_low}–{t.planning_hours_high} hrs · respond within{" "}
                          {t.respond_within_days} days
                          {t.recurring ? " · recurring" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
