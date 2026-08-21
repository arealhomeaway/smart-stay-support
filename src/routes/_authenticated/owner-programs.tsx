import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Copy,
  FileText,
  Home,
  KeyRound,
  Plus,
  Route as RouteIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  activateOwnerProgram,
  addOwnerProgramProperty,
  completeOwnerProgram,
  confirmOwnerPropertyClosing,
  correctOwnerTimeEntry,
  createOwnerInvite,
  ownerProgramDetail,
  ownerProgramReport,
  ownerPrograms,
  ownerTaskRoadmap,
  removeOwnerProgramProperty,
  seedOwnerRoadmap,
  updateOwnerProgram,
} from "@/lib/owner-program.functions";
import { DECISION_PATHS, PHASE_LABELS, type TaskTemplate } from "@/lib/owner-program";
import {
  COMBINED_TOTAL_NOTICE,
  COVERAGE_META,
  OWNER_GOAL_HOURS,
  OWNER_GOAL_LABEL,
  PROGRAM_STATUS_META,
  PROGRAM_TOTAL_DAYS,
  PROGRESS_META,
  REPORT_DISCLAIMER,
  formatDuration,
  type CoverageState,
  type ProgramStatus,
  type ProgressState,
} from "@/lib/owner-participation";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { OwnerContactAlerts } from "@/components/OwnerContactAlerts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
          "Run the 90-day Active Owner Participation Program: enroll homes, activate one combined clock, follow pace benchmarks and generate the owner's participation report.",
      },
      { property: "og:title", content: "Owner participation programs — Resolve Operations" },
      {
        property: "og:description",
        content: "One owner, one 90-day clock, one combined participation record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerProgramsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

type ProgramRow = {
  id: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLinked: boolean;
  status: ProgramStatus;
  startedOn: string | null;
  endsOn: string | null;
  properties: { id: string; name: string; coverage: string; openTasks: number; overdue: number }[];
  day: number;
  daysLeft: number;
  reportedHours: number;
  benchmark: number;
  variance: number;
  progressState: string;
  lastOwnerActivityAt: string | null;
  openTasks: number;
  coverageConcerns: number;
  nextMilestone: { day: number; hours: number };
  badgeCount: number;
  onboardingLead: string | null;
  operationsLead: string | null;
  lastNotificationAt: string | null;
  dfyConfirmed: boolean;
};

/** Attention ordering, mirrored client-side so the queue can sort instantly. */
function attentionReason(row: ProgramRow) {
  if (row.status !== "active" && row.status !== "target_reached") return null;
  const quiet = row.lastOwnerActivityAt
    ? Math.floor((Date.now() - new Date(row.lastOwnerActivityAt).getTime()) / 86_400_000)
    : Infinity;
  const behind = -row.variance;
  if (behind >= 10) return { rank: 1, reason: "10+ hours behind pace" };
  if (behind >= 5) return { rank: 2, reason: "5+ hours behind pace" };
  if (quiet >= 7 && row.openTasks > 0) return { rank: 3, reason: "No activity for 7 days with open tasks" };
  if (row.daysLeft < 10 && row.reportedHours <= OWNER_GOAL_HOURS)
    return { rank: 4, reason: "Under 10 days remaining and not past 100 hours" };
  if (row.properties.some((p) => p.overdue > 0)) return { rank: 5, reason: "Overdue property decisions" };
  if (row.properties.some((p) => p.coverage === "no_activity"))
    return { rank: 6, reason: "A property has no owner activity yet" };
  if (behind >= 1) return { rank: 7, reason: "Slightly behind pace" };
  return null;
}

function OwnerProgramsPage() {
  return (
    <SupervisorOnly>
      <ProgramsBoard />
    </SupervisorOnly>
  );
}

function ProgramsBoard() {
  const qc = useQueryClient();
  const load = useServerFn(ownerPrograms);
  const loadRoadmap = useServerFn(ownerTaskRoadmap);
  const enroll = useServerFn(startOwnerProgramFn());

  const [selected, setSelected] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const programs = useQuery({ queryKey: ["owner-programs"], queryFn: () => load() });
  const roadmap = useQuery({ queryKey: ["owner-roadmap"], queryFn: () => loadRoadmap() });

  const rows = (programs.data?.rows ?? []) as ProgramRow[];
  const available = programs.data?.available ?? [];
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["owner-programs"] });

  const create = useMutation({
    mutationFn: () => enroll({ data: { propertyId, ownerName, ownerEmail } }),
    onSuccess: (r) => {
      toast.success(
        r.alreadyExists ? "That home is already in a program." : "Draft program created. Confirm closing, then activate.",
      );
      setPropertyId("");
      setOwnerName("");
      setOwnerEmail("");
      setSelected(r.programId);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attention = rows
    .map((r) => ({ row: r, flag: attentionReason(r) }))
    .filter((x): x is { row: ProgramRow; flag: { rank: number; reason: string } } => Boolean(x.flag))
    .sort((a, b) => a.flag.rank - b.flag.rank);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">Owner participation programs</h1>
        <p className="max-w-3xl text-muted-foreground">
          Each homeowner runs one 90-day program with a single combined goal of{" "}
          <span className="font-medium text-foreground">{OWNER_GOAL_LABEL.toLowerCase()}</span> of
          self-reported participation. {COMBINED_TOTAL_NOTICE}
        </p>
      </header>

      <OwnerContactAlerts />

      <ProgramSummary rows={rows} />

      {attention.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-4 text-amber-600" /> Owners needing attention
            </CardTitle>
            <CardDescription>Ordered by urgency. Pace first, then property coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {attention.map(({ row, flag }) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{row.ownerName || "Owner not named yet"}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.properties.map((p) => p.name).join(", ") || "No homes yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700">
                    {flag.reason}
                  </Badge>
                  <span className="text-muted-foreground">
                    {row.reportedHours} hrs · day {row.day}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="size-4" /> Create a program
          </CardTitle>
          <CardDescription>
            A program starts as a draft. Closing dates never start the clock on their own — a team
            member activates it once every home has closed and DFY has confirmed the arrangement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>First property</Label>
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
          <div className="flex items-end md:col-span-4">
            <Button onClick={() => create.mutate()} disabled={!propertyId || create.isPending}>
              {create.isPending ? "Creating…" : "Create draft program"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {programs.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No participation programs yet. Create one above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <ProgramCard
              key={row.id}
              row={row}
              available={available}
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

// Kept as a function so the import stays a value reference at module scope.
function startOwnerProgramFn() {
  return startOwnerProgramImpl;
}
import { startOwnerProgram as startOwnerProgramImpl } from "@/lib/owner-program.functions";

function ProgramSummary({ rows }: { rows: ProgramRow[] }) {
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active" || r.status === "target_reached");
    const hours = rows.reduce((n, r) => n + r.reportedHours, 0);
    const behind = active.filter((r) => r.variance < 0).length;
    const open = rows.reduce((n, r) => n + r.openTasks, 0);
    const homes = rows.reduce((n, r) => n + r.properties.length, 0);
    return { programs: rows.length, active: active.length, homes, hours: Math.round(hours), behind, open };
  }, [rows]);

  const tiles = [
    { label: "Programs", value: stats.programs },
    { label: "Running", value: stats.active },
    { label: "Homes enrolled", value: stats.homes },
    { label: "Hours reported", value: stats.hours },
    { label: "Owner tasks open", value: stats.open },
    { label: "Behind pace", value: stats.behind },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
  available,
  expanded,
  onToggle,
}: {
  row: ProgramRow;
  available: { id: string; name: string; location: string }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = PROGRAM_STATUS_META[row.status] ?? PROGRAM_STATUS_META.draft;
  const progress = PROGRESS_META[(row.progressState as ProgressState) ?? "not_started"];
  const percent = Math.min(100, Math.round((row.reportedHours / OWNER_GOAL_HOURS) * 100));

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{row.ownerName || "Owner not named yet"}</CardTitle>
            <CardDescription>
              {row.properties.length === 0
                ? "No homes yet"
                : `${row.properties.length} home${row.properties.length === 1 ? "" : "s"}: ${row.properties
                    .map((p) => p.name)
                    .join(", ")}`}
              {row.ownerLinked ? " · portal access active" : " · no portal login yet"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.tone}>
              {status.label}
            </Badge>
            <Badge variant="outline" className={progress.tone}>
              {progress.label}
            </Badge>
            <Button size="sm" variant="outline" onClick={onToggle}>
              {expanded ? "Hide" : "Manage"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="text-xl font-semibold">{row.reportedHours}</span>
              <span className="text-muted-foreground"> hours reported · benchmark {row.benchmark}</span>
            </span>
            <span className="text-muted-foreground">
              {row.startedOn
                ? `Day ${row.day} of ${PROGRAM_TOTAL_DAYS} · ${row.daysLeft} days left`
                : "Not activated"}
            </span>
          </div>
          <Progress value={percent} />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>{row.openTasks} owner tasks open</span>
            <span>
              Next milestone: day {row.nextMilestone.day} · {row.nextMilestone.hours} hrs
            </span>
            {row.coverageConcerns > 0 ? (
              <span className="font-medium text-amber-700">
                {row.coverageConcerns} propert{row.coverageConcerns === 1 ? "y" : "ies"} need attention
              </span>
            ) : null}
            {row.variance < 0 ? (
              <span className="font-medium text-destructive">{Math.abs(row.variance)} hrs behind benchmark</span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {expanded ? <ProgramDetail row={row} available={available} /> : null}
    </Card>
  );
}

function ProgramDetail({
  row,
  available,
}: {
  row: ProgramRow;
  available: { id: string; name: string; location: string }[];
}) {
  const programId = row.id;
  const qc = useQueryClient();
  const loadDetail = useServerFn(ownerProgramDetail);
  const seed = useServerFn(seedOwnerRoadmap);
  const activate = useServerFn(activateOwnerProgram);
  const addProperty = useServerFn(addOwnerProgramProperty);
  const removeProperty = useServerFn(removeOwnerProgramProperty);
  const confirmClosing = useServerFn(confirmOwnerPropertyClosing);
  const saveSettings = useServerFn(updateOwnerProgram);
  const complete = useServerFn(completeOwnerProgram);
  const correct = useServerFn(correctOwnerTimeEntry);
  const invite = useServerFn(createOwnerInvite);
  const report = useServerFn(ownerProgramReport);

  const [startOn, setStartOn] = useState(row.startedOn ?? today());
  const [newProperty, setNewProperty] = useState("");
  const [newClosing, setNewClosing] = useState(today());
  const [ownerName, setOwnerName] = useState(row.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(row.ownerEmail ?? "");
  const [onboardingLead, setOnboardingLead] = useState(row.onboardingLead ?? "");
  const [operationsLead, setOperationsLead] = useState(row.operationsLead ?? "");
  const [dfy, setDfy] = useState(row.dfyConfirmed);
  const [notes, setNotes] = useState("");

  const detail = useQuery({
    queryKey: ["owner-program", programId],
    queryFn: () => loadDetail({ data: { programId } }),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["owner-program", programId] });
    void qc.invalidateQueries({ queryKey: ["owner-programs"] });
  };
  const run = <T,>(fn: () => Promise<T>, message: string) =>
    fn()
      .then(() => {
        toast.success(message);
        refresh();
      })
      .catch((e: Error) => toast.error(e.message));

  const downloadReport = async () => {
    try {
      const data = await report({ data: { programId } });
      const blob = new Blob([JSON.stringify({ disclaimer: REPORT_DISCLAIMER, ...data }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `participation-report-${programId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Participation report downloaded.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (detail.isLoading) {
    return (
      <CardContent>
        <Skeleton className="h-40 w-full" />
      </CardContent>
    );
  }

  const properties = detail.data?.properties ?? [];
  const reviews = detail.data?.reviews ?? [];
  const entries = detail.data?.entries ?? [];
  const invites = detail.data?.invites ?? [];
  const history = detail.data?.history ?? [];
  const checklist = detail.data?.readyToComplete;
  const notActivated = !row.startedOn;

  return (
    <CardContent className="space-y-8 border-t pt-6">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Home className="size-4" /> Properties in this program
        </h3>
        <p className="text-xs text-muted-foreground">
          Every home shares the one 90-day clock and the one combined hour goal. Properties are
          measured by their tasks and decisions, never by their own hour target.
        </p>
        <div className="space-y-2">
          {properties.map((p) => {
            const meta = COVERAGE_META[p.coverage as CoverageState] ?? COVERAGE_META.in_progress;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="font-medium">
                    {p.name}
                    {p.inclusionStatus !== "included" ? " (removed)" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.address || "No address"} · added {p.addedOn} ·{" "}
                    {p.closingConfirmed ? `closed ${p.closingDate}` : "closing not confirmed"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className={meta.tone}>
                    {meta.label}
                  </Badge>
                  <span className="text-muted-foreground">
                    {p.completedTasks}/{p.requiredTasks} tasks · {p.overdueDecisions} overdue
                  </span>
                  {!p.closingConfirmed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void run(
                          () =>
                            confirmClosing({
                              data: { programId, propertyId: p.propertyId, closingDate: today() },
                            }),
                          "Closing confirmed.",
                        )
                      }
                    >
                      Confirm closing today
                    </Button>
                  )}
                  {p.inclusionStatus === "included" && properties.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void run(
                          () =>
                            removeProperty({
                              data: { programId, propertyId: p.propertyId, reason: "Removed by staff" },
                            }),
                          "Property removed. Its history is preserved.",
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 space-y-2">
            <Label>Add another home</Label>
            <Select value={newProperty} onValueChange={setNewProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a home" />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`closing-${programId}`}>Closing date</Label>
            <Input
              id={`closing-${programId}`}
              type="date"
              className="w-44"
              value={newClosing}
              onChange={(e) => setNewClosing(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!newProperty}
            onClick={() =>
              void run(
                () => addProperty({ data: { programId, propertyId: newProperty, closingDate: newClosing } }),
                "Property added. The timeline and combined goal are unchanged.",
              )
            }
          >
            Add property
          </Button>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Program setup</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Owner name</Label>
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Owner email</Label>
            <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label>Onboarding lead</Label>
            <Input value={onboardingLead} onChange={(e) => setOnboardingLead(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Operations lead</Label>
            <Input value={operationsLead} onChange={(e) => setOperationsLead(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Internal notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={2} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={dfy} onCheckedChange={(v) => setDfy(v === true)} />
          DFY has confirmed these properties run as one combined program.
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void run(
              () =>
                saveSettings({
                  data: {
                    programId,
                    ownerName,
                    ownerEmail,
                    onboardingLead: onboardingLead || null,
                    operationsLead: operationsLead || null,
                    dfyConfirmed: dfy,
                    internalNotes: notes,
                  },
                }),
              "Program details saved.",
            )
          }
        >
          Save details
        </Button>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          {notActivated ? "Activate the 90-day program" : "Timeline"}
        </h3>
        {notActivated ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor={`start-${programId}`}>Day one</Label>
              <Input
                id={`start-${programId}`}
                type="date"
                className="w-44"
                value={startOn}
                onChange={(e) => setStartOn(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() =>
                void run(
                  () => activate({ data: { programId, startedOn: startOn } }),
                  "Program activated. The 90-day clock has started.",
                )
              }
            >
              <CalendarClock className="size-4" /> Activate program
            </Button>
            <p className="text-xs text-muted-foreground">
              Requires DFY confirmation and a confirmed closing on every home.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Day {row.day} of {PROGRAM_TOTAL_DAYS} · started {row.startedOn} · ends {row.endsOn}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void run(() => seed({ data: { programId, phase: "onboarding" } }), "Onboarding activities released.")}>
            <RouteIcon className="size-4" /> Release onboarding activities
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run(() => seed({ data: { programId, phase: "ongoing" } }), "Operating activities released.")}
          >
            Release operating activities
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run(() => invite({ data: { programId, ownerEmail: row.ownerEmail ?? "" } }), "Invite code created.")}
          >
            <KeyRound className="size-4" /> Issue invite code
          </Button>
          <Button size="sm" variant="outline" onClick={() => void downloadReport()}>
            <FileText className="size-4" /> Participation report
          </Button>
        </div>
      </section>

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
                  <Badge variant="outline" className="bg-muted text-xs">
                    used
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Owner activities</h3>
        {reviews.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No activities released yet.
          </p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => {
              const path = DECISION_PATHS[r.decision_path as keyof typeof DECISION_PATHS];
              const names = r.propertyIds
                .map((id) => properties.find((p) => p.propertyId === id)?.name)
                .filter(Boolean);
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {names.length ? names.join(", ") : "Applies to the whole program"} ·{" "}
                      {PHASE_LABELS[r.phase as keyof typeof PHASE_LABELS] ?? r.phase}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {path ? (
                      <Badge variant="outline" className={path.tone}>
                        {path.label}
                      </Badge>
                    ) : null}
                    {r.respond_by ? <span className="text-muted-foreground">Respond by {r.respond_by}</span> : null}
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
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Participation log</h3>
        <p className="text-xs text-muted-foreground">
          Entries are the homeowner's own record. Corrections are added as a new amending entry with a
          reason — the original is never overwritten.
        </p>
        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No participation recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 25).map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{e.activity}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.entry_date} · {formatDuration(e.minutes)} · {e.activity_category ?? "uncategorized"}
                    {e.amends_entry_id ? " · correction" : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const raw = window.prompt("Corrected minutes for this entry", String(e.minutes));
                    if (!raw) return;
                    const minutes = Number(raw);
                    if (!Number.isFinite(minutes) || minutes < 1) return toast.error("Enter a valid number of minutes.");
                    const reason = window.prompt("Reason for the correction");
                    if (!reason) return toast.error("A correction needs a reason.");
                    void run(() => correct({ data: { entryId: e.id, minutes, reason } }), "Correction recorded.");
                  }}
                >
                  Record correction
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="size-4" /> Completion checklist
        </h3>
        <ul className="space-y-1 text-sm">
          <ChecklistItem ok={Boolean(checklist?.hoursExceeded)} label={`More than ${OWNER_GOAL_HOURS} hours reported`} />
          <ChecklistItem ok={Boolean(checklist?.propertyTasksComplete)} label="Required tasks complete on every property" />
          <ChecklistItem ok={Boolean(checklist?.decisionsReceived)} label="All owner decisions received" />
          <ChecklistItem ok={Boolean(checklist?.entriesAttributed)} label="Every entry describes its activity" />
        </ul>
        <Button
          size="sm"
          disabled={!checklist?.allClear}
          onClick={() => void run(() => complete({ data: { programId } }), "Program completed.")}
        >
          Complete program
        </Button>
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Program history</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            {history.slice(0, 15).map((h) => (
              <p key={h.id}>
                {new Date(h.created_at).toLocaleString()} — {h.summary}
                {h.reason ? ` (${h.reason})` : ""}
              </p>
            ))}
          </div>
        </section>
      )}
    </CardContent>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? "text-emerald-600" : "text-muted-foreground"}>{ok ? "✓" : "○"}</span>
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </li>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="size-4" /> The owner activity catalog
        </CardTitle>
        <CardDescription>
          The standard activity set every program is seeded from. Planning hours are an internal
          staffing estimate — they are never shown to a homeowner, so reported participation stays
          genuinely self-reported.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          Object.entries(grouped).map(([key, items]) => {
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
          })
        )}
      </CardContent>
    </Card>
  );
}
