import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  OPEN_STATUSES,
  STATUSES,
  dueLabel,
  labelFor,
  priorityTone,
  relativeTime,
  statusTone,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/tickets/")({
  head: () => ({
    meta: [
      { title: "Tickets — Resolve Operations" },
      { name: "description", content: "Every guest and maintenance ticket across the A Real Home Away portfolio." },
      { property: "og:title", content: "Tickets — Resolve Operations" },
      { property: "og:description", content: "Search and filter every guest and maintenance ticket." },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");

  const { data, isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname)")
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
    .filter((t) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [t.title, t.description, t.guest_name, t.properties?.name, t.properties?.nickname]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Tickets</h1>
          <p className="mt-1 text-muted-foreground">All guest and maintenance issues.</p>
        </div>
        <Button asChild>
          <Link to="/tickets/new">New ticket</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search title, guest, property…"
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
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No tickets here yet.
        </p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const due = dueLabel(t.due_at, t.status);
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
                    {t.priority}
                  </Badge>
                  <Badge variant="outline" className={statusTone(t.status)}>
                    {labelFor(STATUSES, t.status)}
                  </Badge>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {due ? (
                      <span className={due.overdue ? "font-medium text-danger" : ""}>{due.text}</span>
                    ) : (
                      relativeTime(t.reported_at)
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.properties?.nickname ?? t.properties?.name ?? "No property"} ·{" "}
                  {labelFor(CATEGORIES, t.category)}
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
