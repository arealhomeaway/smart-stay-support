import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MapPinned, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { jobMap, geocodeProperties } from "@/lib/geo.functions";
import type { MapPin } from "@/lib/geo";
import { priorityMeta, priorityTone, relativeTime } from "@/lib/tickets";
import { JobMap } from "@/components/JobMap";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Work map — Resolve Operations" },
      {
        name: "description",
        content: "See every managed home on a map with its open work, so you can dispatch by who is closest.",
      },
      { property: "og:title", content: "Work map — Resolve Operations" },
      { property: "og:description", content: "Managed homes and open work plotted for smarter dispatch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <MapPage />
    </SupervisorOnly>
  ),
});

function MapPage() {
  const qc = useQueryClient();
  const load = useServerFn(jobMap);
  const geocode = useServerFn(geocodeProperties);
  const [selected, setSelected] = useState<MapPin | null>(null);

  const map = useQuery({ queryKey: ["job-map"], queryFn: () => load() });

  const run = useMutation({
    mutationFn: (force: boolean) => geocode({ data: { force } }),
    onSuccess: (r) => {
      toast.success(
        `${r.located} home${r.located === 1 ? "" : "s"} pinned` +
          (r.failed ? ` · ${r.failed} address${r.failed === 1 ? "" : "es"} we couldn't find` : "") +
          (r.skipped ? ` · ${r.skipped} missing a street address` : "") +
          (r.capped ? " · run again to continue" : ""),
      );
      void qc.invalidateQueries({ queryKey: ["job-map"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not look up addresses"),
  });

  const pins = map.data?.pins ?? [];
  const unpinned = map.data?.unpinned ?? 0;
  const openCount = pins.reduce((n, p) => n + p.openJobs.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <MapPinned className="size-6" /> Job map
          </h1>
          <p className="text-sm text-muted-foreground">
            Every managed home with a pin, sized and coloured by the work waiting there. Use it to dispatch the
            partner who is already nearby instead of the one who answers first.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => run.mutate(false)}
          disabled={run.isPending}
          className="gap-2"
        >
          <RefreshCw className={`size-4 ${run.isPending ? "animate-spin" : ""}`} />
          {run.isPending ? "Looking up addresses…" : `Pin ${unpinned || "new"} home${unpinned === 1 ? "" : "s"}`}
        </Button>
      </header>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>{pins.length} homes pinned</span>
        <span>·</span>
        <span>{openCount} open tickets on the map</span>
        {unpinned > 0 && (
          <>
            <span>·</span>
            <span className="text-warning-foreground">
              {unpinned} home{unpinned === 1 ? "" : "s"} still need an address lookup
            </span>
          </>
        )}
      </div>

      {map.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : pins.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No pins yet</CardTitle>
            <CardDescription>
              Homes need a street address before they can be placed. Add addresses on the Properties page, then
              run the lookup above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/properties" className="text-sm font-medium underline underline-offset-4">
              Go to Properties
            </Link>
          </CardContent>
        </Card>
      ) : (
        <JobMap pins={pins} onSelect={setSelected} />
      )}

      {selected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{selected.name}</CardTitle>
            <CardDescription>{selected.address || "No address on file"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selected.openJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing open here right now.</p>
            ) : (
              selected.openJobs.map((job) => (
                <Link
                  key={job.id}
                  to="/tickets/$ticketId"
                  params={{ ticketId: job.id }}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/40"
                >
                  <Badge className={priorityTone(job.priority)}>{priorityMeta(job.priority).label}</Badge>
                  <span className="font-medium">#{job.ref}</span>
                  <span className="truncate">{job.title}</span>
                  <span className="ml-auto text-muted-foreground">
                    {job.vendorName ? `${job.vendorName} · ` : ""}
                    {job.dueAt ? `due ${relativeTime(job.dueAt)}` : job.status}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
