import { useFeatureFlags } from "@/lib/feature-flags";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/vendor/")({
  component: VendorQueue,
  head: () => ({
    meta: [
      { title: "My work orders | Resolve vendor portal" },
      {
        name: "description",
        content:
          "Every work order A Real Home Away has dispatched to you, with the access details, safety steps and sign-off you need on site.",
      },
      { property: "og:title", content: "My work orders | Resolve vendor portal" },
      {
        property: "og:description",
        content: "Your dispatched work orders, access notes and required steps in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PRIORITY_TONE: Record<string, string> = {
  p1: "bg-destructive text-destructive-foreground",
  p2: "bg-amber-500 text-white",
};

function VendorQueue() {
  const { enabled: flagEnabled } = useFeatureFlags();
  const jobs = useQuery({
    queryKey: ["vendor-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, ref, title, priority, status, vendor_status, due_at, vendor_dispatched_at, properties(name, city, state)",
        )
        .eq("is_demo", false)
        .is("archived_at", null)
        .order("vendor_dispatched_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const showScorecard = flagEnabled("vendor_portal");

  const open = (jobs.data ?? []).filter((j) => j.vendor_status !== "completed" && j.status !== "closed");
  const done = (jobs.data ?? []).filter((j) => j.vendor_status === "completed" || j.status === "closed");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold">My work orders</h1>
          {showScorecard ? (
          <Link
            to="/vendor/scorecard"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent/40"
          >
            <Award className="size-4" /> My scorecard
          </Link>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Everything A Real Home Away has sent your way. Open a job for the address, access details and the steps
          we need finished before it can be closed.
        </p>
      </header>

      {jobs.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : open.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing open right now</CardTitle>
            <CardDescription>
              New work shows up here the moment a coordinator dispatches it to you.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {open.map((job) => (
            <Link
              key={job.id}
              to="/vendor/$ticketId"
              params={{ ticketId: job.id }}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={PRIORITY_TONE[job.priority ?? ""] ?? ""} variant={PRIORITY_TONE[job.priority ?? ""] ? "default" : "secondary"}>
                  {(job.priority ?? "").toUpperCase()}
                </Badge>
                <span className="font-medium">
                  #{job.ref} {job.title}
                </span>
                <Badge variant="outline" className="ml-auto capitalize">
                  {job.vendor_status === "on_site"
                    ? "On site"
                    : job.vendor_status === "accepted"
                      ? "In progress"
                      : "New"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {(job.properties as { name: string; city: string | null; state: string | null } | null)?.name ??
                  "Home to be confirmed"}
                {job.due_at ? ` · due ${new Date(job.due_at).toLocaleString()}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently finished</CardTitle>
            <CardDescription>Your last completed work orders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {done.slice(0, 10).map((job) => (
              <Link
                key={job.id}
                to="/vendor/$ticketId"
                params={{ ticketId: job.id }}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-accent/40"
              >
                <span className="font-medium">
                  #{job.ref} {job.title}
                </span>
                <span className="text-muted-foreground">
                  {(job.properties as { name: string } | null)?.name ?? "—"}
                </span>
                <Badge variant="secondary" className="ml-auto">
                  Complete
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
