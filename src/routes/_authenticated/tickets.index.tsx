import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useCurrentUserId, useStaffDirectory, displayName } from "@/hooks/useTeam";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  OPEN_STATUSES,
  PRIORITIES,
  SOURCE_CHANNELS,
  STATUSES,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
  statusTone,
} from "@/lib/tickets";
import { QUEUE_TABS, currentOwnerId, matchesTab, queueSort, type QueueTab } from "@/lib/matters";

export const Route = createFileRoute("/_authenticated/tickets/")({
  head: () => ({
    meta: [
      { title: "Matters queue — Resolve Operations" },
      {
        name: "description",
        content:
          "One searchable queue for every guest, owner and maintenance matter across the A Real Home Away portfolio, with live response clocks.",
      },
      { property: "og:title", content: "Matters queue — Resolve Operations" },
      { property: "og:description", content: "My work, team queue, unassigned and escalated matters in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<QueueTab>("mine");
  const [priority, setPriority] = useState<string>("all");
  const { demoMode } = useDemo();
  const userId = useCurrentUserId();
  const { data: staff } = useStaffDirectory();

  const people = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff]);

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname), work_types(name)")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const all = data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of QUEUE_TABS) c[t.value] = all.filter((x) => matchesTab(x, t.value, userId)).length;
    return c;
  }, [all, userId]);

  const tickets = all
    .filter((t) => matchesTab(t, tab, userId))
    .filter((t) => priority === "all" || t.priority === priority)
    .filter((t) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [
        t.ref,
        t.title,
        t.description,
        t.guest_name,
        t.properties?.name,
        t.properties?.nickname,
        t.work_types?.name,
        displayName(people.get(currentOwnerId(t) ?? "")),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    })
    .sort(queueSort);

  const activeTab = QUEUE_TABS.find((t) => t.value === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Matters</h1>
          <p className="mt-1 text-muted-foreground">{activeTab?.hint}</p>
        </div>
        <Button asChild>
          <Link to="/tickets/new">Log a matter</Link>
        </Button>
      </div>

      {demoMode && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
          <span className="font-medium">Demo data.</span> These matters are seeded examples. They are excluded from
          production analytics and never trigger emails, texts or integrations.
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-md border border-border p-1">
        {QUEUE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              tab === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
            <span className="ml-2 text-xs opacity-70">{counts[t.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search reference, title, guest, property, work type, owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1 rounded-md border border-border p-1">
          {["all", ...PRIORITIES.map((p) => p.value)].map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`rounded px-3 py-1 text-sm uppercase transition-colors ${
                priority === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Nothing here. {tab === "mine" ? "You are clear — check the team queue for unassigned work." : "Nothing matches."}
        </p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const sla = slaState(t);
            const live = sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;
            const ownerId = currentOwnerId(t);
            return (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{t.ref}</span>
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline" className={priorityTone(t.priority)}>
                    {priorityMeta(t.priority).short}
                  </Badge>
                  <Badge variant="outline" className={statusTone(t.status)}>
                    {labelFor(STATUSES, t.status)}
                  </Badge>
                  {sla.escalation && (
                    <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
                      Escalated
                    </Badge>
                  )}
                  {t.handoff_status === "pending" && (
                    <Badge variant="outline" className="border-info/40 bg-info/10 text-info">
                      Handoff pending
                    </Badge>
                  )}
                  {t.is_demo && (
                    <Badge variant="outline" className="border-warning/40 bg-warning/10">
                      Demo
                    </Badge>
                  )}
                  <span className="ml-auto text-sm text-muted-foreground">
                    {live ? (
                      <span className={live.breached ? "font-medium text-danger" : ""}>{live.label}</span>
                    ) : (
                      relativeTime(t.reported_at)
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.properties?.nickname ?? t.properties?.name ?? "No property"} ·{" "}
                  {t.work_types?.name ?? t.category} ·{" "}
                  <span className={ownerId ? "" : "text-danger"}>
                    {ownerId ? displayName(people.get(ownerId)) : "Unassigned"}
                  </span>
                  {" · "}
                  {labelFor(SOURCE_CHANNELS, t.source_channel)}
                  {t.guest_name ? ` · Guest: ${t.guest_name}` : ""}
                  {!OPEN_STATUSES.includes(t.status) && t.resolved_at
                    ? ` · closed ${relativeTime(t.resolved_at)}`
                    : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
