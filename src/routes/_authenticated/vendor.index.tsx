import { useFeatureFlags } from "@/lib/feature-flags";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Chip, EmptyState, LoadingRows, PageHeader, SectionBand } from "@/components/ui/page";
import { usDateTime } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/vendor/")({
  component: VendorQueue,
  head: () => ({
    meta: [
      { title: "My Work Orders | Resolve vendor portal" },
      {
        name: "description",
        content:
          "Every Work Order A Real Home Away has dispatched to you, with the access details, safety steps and sign-off you need on site.",
      },
      { property: "og:title", content: "My Work Orders | Resolve vendor portal" },
      {
        property: "og:description",
        content: "Your dispatched Work Orders, access notes and required steps in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const VENDOR_STATE: Record<string, { label: string; tone: StatusTone }> = {
  on_site: { label: "On site", tone: "progress" },
  accepted: { label: "In progress", tone: "progress" },
  dispatched: { label: "New", tone: "waiting" },
  completed: { label: "Complete", tone: "resolved" },
};

function vendorState(status: string | null | undefined) {
  return VENDOR_STATE[status ?? ""] ?? { label: "New", tone: "waiting" as StatusTone };
}

function nextAction(job: { vendor_status: string | null; due_at: string | null }) {
  if (job.vendor_status === "on_site" || job.vendor_status === "accepted") {
    return "Finish the required steps and mark it complete.";
  }
  if (job.due_at && new Date(job.due_at).getTime() < Date.now()) {
    return "Past due — accept the job and head over.";
  }
  return "Accept the job to let the team know you're on it.";
}

function VendorQueue() {
  const { enabled: flagEnabled } = useFeatureFlags();
  const jobs = useQuery({
    queryKey: ["vendor-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, ref, title, priority, status, category, vendor_status, due_at, vendor_dispatched_at, properties(name, address_line1, unit, city, state, postal_code, primary_photo_url)",
        )
        .eq("is_demo", false)
        .is("archived_at", null)
        .order("vendor_dispatched_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const showScorecard = flagEnabled("vendor_portal");

  const open = (jobs.data ?? []).filter(
    (j) => j.vendor_status !== "completed" && j.status !== "closed",
  );
  const done = (jobs.data ?? []).filter(
    (j) => j.vendor_status === "completed" || j.status === "closed",
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Vendor portal"
        title="My Work Orders"
        description="Everything A Real Home Away has sent your way. Open a job for the address, access details and the steps we need finished before it can be closed."
        actions={
          showScorecard ? (
            <Link
              to="/vendor/scorecard"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent/40"
            >
              <Award className="size-4" /> My scorecard
            </Link>
          ) : undefined
        }
      />

      {jobs.isLoading ? (
        <LoadingRows rows={3} />
      ) : open.length === 0 ? (
        <EmptyState
          title="Nothing open right now"
          hint="New work shows up here the moment a coordinator dispatches it to you."
        />
      ) : (
        <div className="space-y-2">
          {open.map((job) => {
            const property = job.properties as {
              name: string;
              city: string | null;
              state: string | null;
              primary_photo_url: string | null;
            } | null;
            const state = vendorState(job.vendor_status);
            return (
              <Link
                key={job.id}
                to="/vendor/$ticketId"
                params={{ ticketId: job.id }}
                className="surface-row flex items-start gap-3 py-3 pl-4 pr-4"
              >
                <PropertyPhoto
                  url={property?.primary_photo_url}
                  name={formatPropertyLabel(property).primary}
                  className="mt-0.5 size-12"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip
                      className={
                        job.priority === "p1"
                          ? "border-danger/40 bg-danger/10 text-danger"
                          : undefined
                      }
                    >
                      {(job.priority ?? "").toUpperCase()}
                    </Chip>
                    <span className="numeric text-xs text-muted-foreground">#{job.ref}</span>
                    <span className="font-medium">{job.title}</span>
                    <StatusBadge tone={state.tone} className="ml-auto">
                      {state.label}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPropertyLabel(property).primary} ·{" "}
                    {(job.category ?? "").replace(/_/g, " ")}
                    {job.due_at ? ` · due ${usDateTime(job.due_at)}` : ""}
                  </p>
                  <p className="mt-1 text-[0.8125rem] font-medium text-foreground/80">
                    {nextAction(job)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-3">
          <SectionBand title="Recently finished" hint="Your last completed Work Orders." />
          <div className="space-y-1.5">
            {done.slice(0, 10).map((job) => {
              const property = job.properties as { name: string } | null;
              return (
                <Link
                  key={job.id}
                  to="/vendor/$ticketId"
                  params={{ ticketId: job.id }}
                  className="surface-row flex flex-wrap items-center gap-2 py-2.5 pl-4 pr-4 text-sm"
                >
                  <span className="font-medium">
                    #{job.ref} {job.title}
                  </span>
                  <span className="text-muted-foreground">{formatPropertyLabel(property).primary}</span>
                  <StatusBadge tone="resolved" className="ml-auto">
                    Complete
                  </StatusBadge>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
