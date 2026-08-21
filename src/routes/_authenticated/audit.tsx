import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireCapability } from "@/components/RequireCapability";
import { getAuditLog } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit history — Resolve" },
      {
        name: "description",
        content:
          "Append-only record of role changes, lifecycle moves, handoff decisions and material edits across A Real Home Away.",
      },
      { property: "og:title", content: "Audit history — Resolve" },
      { property: "og:description", content: "Who changed what, when, and why." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="audit_history" title="Audit history is for leadership">
      <AuditPage />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">Audit history could not be loaded.</p>,
});

function AuditPage() {
  const load = useServerFn(getAuditLog);
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["audit-log"], queryFn: () => load() });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const q = filter.trim().toLowerCase();
  const entries = q
    ? data.entries.filter((e) =>
        [e.action, e.entity_type, e.entity_label, e.actor, e.reason]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : data.entries;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Controls</p>
        <h1 className="font-display text-3xl font-semibold">Audit history</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Append-only. Nothing here can be edited or deleted — role changes, lifecycle moves, handoff
          decisions and material record edits are recorded with the person, the time and the reason.
        </p>
      </header>

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by person, action, record or reason"
        className="max-w-md"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>{entries.length} entries</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {entries.map((e) => (
            <div key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium">
                  {e.actor} · <span className="font-normal">{e.action.replace(/_/g, " ")}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.entity_type}
                  {e.entity_label ? ` — ${e.entity_label}` : ""}
                </p>
                {e.reason && <p className="text-xs italic text-muted-foreground">Reason: {e.reason}</p>}
              </div>
              <Badge variant="outline">{new Date(e.created_at as string).toLocaleString()}</Badge>
            </div>
          ))}
          {!entries.length && <p className="py-3 text-sm text-muted-foreground">Nothing recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
