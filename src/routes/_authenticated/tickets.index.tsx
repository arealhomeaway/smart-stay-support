import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  OPEN_STATUSES,
  PRIORITIES,
  STATUSES,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
  statusTone,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/tickets/")({
  head: () => ({
    meta: [
      { title: "Matters — Resolve Operations" },
      {
        name: "description",
        content: "Every guest, owner and maintenance matter across the A Real Home Away portfolio, with live SLA clocks.",
      },
      { property: "og:title", content: "Matters — Resolve Operations" },
      { property: "og:description", content: "Search and filter every matter, with live response clocks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");
  const [priority, setPriority] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname), work_types(name)")
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const tickets = (data ?? [])
    .filter((t) =>
      filter === "all"
        ? true
        : filter === "open"
          ? OPEN_STATUSES.includes(t.status)
          : !OPEN_STATUSES.includes(t.status),
    )
    .filter((t) => priority === "all" || t.priority === priority)
    .filter((t) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [t.title, t.description, t.guest_name, t.properties?.name, t.properties?.nickname, t.work_types?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Matters</h1>
          <p className="mt-1 text-muted-foreground">Every interaction, task and open issue in one place.</p>
        </div>
        <Button asChild>
          <Link to="/tickets/new">Log a matter</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search title, guest, property, work type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1 rounded-md border border-border p-1">
          {(["open", "closed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-sm capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
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
          Nothing here yet.
        </p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const sla = slaState(t);
            const live = sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;
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
                  {t.work_types?.name ?? t.category}
                  {t.guest_name ? ` · Guest: ${t.guest_name}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
