/**
 * Routine work — the four recurring controls, in one place.
 *
 * This screen is deliberately not the ticket queue. Nothing here is an
 * exception someone reported; it is the scheduled quality work the team
 * already does after every clean, every stay and every review.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/RequireCapability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FocusedAction } from "@/components/ui/workspace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { RoutineDrawer, type RoutineRow } from "@/components/routines/RoutineDrawer";
import { useDemo } from "@/components/DemoProvider";
import { useSeat } from "@/hooks/useSeat";
import {
  OUTCOME_LABELS,
  ROUTINE_CONFIG,
  ROUTINE_KINDS,
  cleaningReviewKey,
  manualKey,
  routineConfig,
  routineDueLabel,
  routineDueState,
  type RoutineKind,
  type RoutineOutcome,
} from "@/lib/routine-controls";

export const Route = createFileRoute("/_authenticated/routines")({
  head: () => ({
    meta: [
      { title: "Routine work — Resolve Operations" },
      {
        name: "description",
        content:
          "Cleaning Reviews, Guest Reviews, Checkouts and Guest Touch Bases — the recurring checks the team runs every day.",
      },
      { property: "og:title", content: "Routine work — Resolve Operations" },
      {
        property: "og:description",
        content: "The four routine controls, with what is due, what is late and what was found.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="routines" title="Routine work">
      <RoutinesPage />
    </RequireCapability>
  ),
});

/**
 * Cleaning Reviews are generated from completed departure cleans, never from
 * the clock. The event key makes generation idempotent: running this twice
 * cannot produce a second review for the same clean.
 */
function useGenerateCleaningReviews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: cleans, error } = await supabase
        .from("breezeway_work_orders")
        .select("id, name, property_id, scheduled_date, status, department")
        .eq("department", "cleaning")
        .in("status", ["finished", "completed", "complete"])
        .gte("scheduled_date", since)
        .limit(200);
      if (error) throw error;

      const rows = (cleans ?? [])
        .filter((c) => c.property_id)
        .map((c) => ({
          kind: "cleaning_review",
          event_key: cleaningReviewKey(c.id),
          property_id: c.property_id,
          title: c.name ?? "Departure clean review",
          status: "due",
          due_at: c.scheduled_date
            ? new Date(`${c.scheduled_date}T18:00:00`).toISOString()
            : new Date().toISOString(),
          team: "property_operations",
        }));
      if (rows.length === 0) return 0;

      const { error: upsertError, count } = await supabase
        .from("routine_controls")
        .upsert(rows, { onConflict: "kind,event_key", ignoreDuplicates: true, count: "exact" });
      if (upsertError) throw upsertError;
      return count ?? 0;
    },
    onSuccess: (created) => {
      if (created) qc.invalidateQueries({ queryKey: ["routine-controls"] });
    },
  });
}

function RoutinesPage() {
  const qc = useQueryClient();
  const seat = useSeat();
  const generate = useGenerateCleaningReviews();
  const [openRow, setOpenRow] = useState<RoutineRow | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [filter, setFilter] = useState<"mine" | "all">("all");

  // One idempotent generation pass when the screen opens.
  useEffect(() => {
    generate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Routine work follows the same demo lens as every other queue: demo rows
  // only inside the demo environment, live rows only outside it. Before this,
  // seeded scenarios leaked into the real routine queue.
  const { demoMode } = useDemo();
  const { data, isLoading } = useQuery({
    queryKey: ["routine-controls", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_controls")
        .select("*, properties(name, nickname)")
        .eq("is_demo", demoMode)
        .order("due_at", { ascending: true })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as RoutineRow[];
    },
  });

  const myTeamKinds = useMemo(
    () => new Set(ROUTINE_KINDS.filter((k) => !seat.team || ROUTINE_CONFIG[k].team === seat.team)),
    [seat.team],
  );

  if (isLoading || !data) return <LoadingPage tiles={0} />;

  const openRows = data.filter((r) => r.status === "due" || r.status === "in_progress");
  const visible =
    filter === "mine" ? openRows.filter((r) => myTeamKinds.has(r.kind as RoutineKind)) : openRows;
  const overdue = visible.filter((r) => routineDueState(r) === "overdue");
  const today = visible.filter((r) => routineDueState(r) === "today");
  const upcoming = visible.filter((r) => routineDueState(r) === "upcoming");
  const recent = data.filter((r) => r.status === "completed").slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Routine work"
        title={
          overdue.length
            ? `${overdue.length} routine ${overdue.length === 1 ? "check is" : "checks are"} late`
            : "Routine work is on track"
        }
        description="Cleaning Reviews, Guest Reviews, Checkouts and Guest Touch Bases. Cleaning Reviews appear on their own once a departure clean is finished."
        actions={
          <>
            <div className="flex rounded-lg border border-border p-0.5">
              {(["mine", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                    filter === f ? "bg-secondary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "mine" ? "My team" : "Everything"}
                </button>
              ))}
            </div>
            <Button className="h-10" onClick={() => setRunOpen(true)}>
              <Plus className="size-4" /> Run a routine control
            </Button>
          </>
        }
      />

      <Section
        title="Late"
        description="Past the time these were meant to be done."
        rows={overdue}
        tone="critical"
        onOpen={setOpenRow}
      />
      <Section
        title="Due today"
        description="Scheduled for today."
        rows={today}
        onOpen={setOpenRow}
      />
      <Section
        title="Coming up"
        description="Scheduled, not yet due."
        rows={upcoming}
        onOpen={setOpenRow}
      />

      <SectionCard
        title="Recently completed"
        description="What the team found."
        bodyClassName="space-y-1.5"
      >
        {recent.length === 0 ? (
          <EmptyState title="Nothing completed yet." />
        ) : (
          recent.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenRow(r)}
              className="surface-row flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left"
            >
              <CheckCircle2 className="size-4 shrink-0 text-success" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {routineConfig(r.kind).label}
                  {r.properties?.nickname || r.properties?.name
                    ? ` · ${r.properties?.nickname ?? r.properties?.name}`
                    : ""}
                </span>
              </span>
              <Badge variant="outline">
                {OUTCOME_LABELS[(r.outcome as RoutineOutcome) ?? "looks_good"]}
              </Badge>
            </button>
          ))
        )}
      </SectionCard>

      <RoutineDrawer
        row={openRow}
        open={Boolean(openRow)}
        onOpenChange={(v) => !v && setOpenRow(null)}
      />
      <RunRoutineDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["routine-controls"] })}
      />
    </div>
  );
}

function Section({
  title,
  description,
  rows,
  tone,
  onOpen,
}: {
  title: string;
  description: string;
  rows: RoutineRow[];
  tone?: "critical";
  onOpen: (r: RoutineRow) => void;
}) {
  return (
    <SectionCard
      title={`${title} · ${rows.length}`}
      description={description}
      tone={tone && rows.length > 0 ? "critical" : "default"}
      bodyClassName="space-y-1.5"
    >
      {rows.length === 0 ? (
        <EmptyState title={`Nothing ${title.toLowerCase()}.`} />
      ) : (
        rows.map((r) => {
          const config = routineConfig(r.kind);
          const late = routineDueState(r) === "overdue";
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r)}
              className="surface-row flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
            >
              <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{r.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {config.label}
                  {r.properties?.nickname || r.properties?.name
                    ? ` · ${r.properties?.nickname ?? r.properties?.name}`
                    : ""}
                </span>
              </span>
              <span
                className={`rounded-md px-2 py-1 text-sm font-medium ${
                  late ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground"
                }`}
              >
                {routineDueLabel(r)}
              </span>
            </button>
          );
        })
      )}
    </SectionCard>
  );
}

function RunRoutineDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<RoutineKind>("checkout");
  const [propertyId, setPropertyId] = useState("");
  const [query, setQuery] = useState("");
  const [guest, setGuest] = useState("");
  const { demoMode } = useDemo();

  const { data: properties } = useQuery({
    queryKey: ["routine-properties"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname")
        .eq("active", true)
        .order("name")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const matches = (properties ?? [])
    .filter((p) =>
      query.trim()
        ? `${p.nickname ?? ""} ${p.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    )
    .slice(0, 8);

  const create = useMutation({
    mutationFn: async () => {
      const config = ROUTINE_CONFIG[kind];
      const { data: auth } = await supabase.auth.getUser();
      const day = new Date().toISOString().slice(0, 10);
      const chosen = (properties ?? []).find((p) => p.id === propertyId);
      const { error } = await supabase.from("routine_controls").insert({
        kind,
        event_key: manualKey(kind, propertyId || null, `${day}:${Date.now()}`),
        property_id: propertyId || null,
        title: chosen ? `${config.label} — ${chosen.nickname ?? chosen.name}` : config.label,
        guest_name: guest.trim() || null,
        status: "due",
        due_at: new Date().toISOString(),
        team: config.team,
        assigned_to: auth.user?.id ?? null,
        created_by: auth.user?.id ?? null,
        is_demo: demoMode,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to routine work.");
      onCreated();
      onOpenChange(false);
      setPropertyId("");
      setQuery("");
      setGuest("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <FocusedAction
      open={open}
      onOpenChange={onOpenChange}
      title="Run a routine control"
      description="Pick the check you are about to do."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Start it
          </Button>
        </>
      }
    >
      <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {ROUTINE_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  kind === k ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                }`}
              >
                <span className="block text-sm font-semibold">{ROUTINE_CONFIG[k].label}</span>
                <span className="block text-xs text-muted-foreground">
                  {ROUTINE_CONFIG[k].teamLabel}
                </span>
              </button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">{ROUTINE_CONFIG[kind].purpose}</p>

          <div className="space-y-1.5">
            <Label htmlFor="routine-property">Which home?</Label>
            <Input
              id="routine-property"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPropertyId("");
              }}
              placeholder="Start typing a property name"
            />
            {query.trim() && !propertyId && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPropertyId(p.id);
                      setQuery(p.nickname ?? p.name ?? "");
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    {p.nickname ?? p.name}
                  </button>
                ))}
                {matches.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No match.</p>
                )}
              </div>
            )}
          </div>

          {ROUTINE_CONFIG[kind].team === "guest_experience" && (
            <div className="space-y-1.5">
              <Label htmlFor="routine-guest">Guest name (optional)</Label>
              <Input id="routine-guest" value={guest} onChange={(e) => setGuest(e.target.value)} />
            </div>
          )}
      </div>
    </FocusedAction>
  );
}
