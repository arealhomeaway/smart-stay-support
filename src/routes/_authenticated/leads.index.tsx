/**
 * Leads — ARHA's mid-term direct-booking requests.
 *
 * One list, four filters: Open, Booked, Lost, and Follow-up due. Each row
 * shows the region, the stay, who asked, the last home offered and what
 * happened to it. The old stage data stays stored; it just no longer drives
 * this view.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows, PageHeader, SectionCard, SegmentedControl, StatTile } from "@/components/ui/page";
import { LeadListSection, useLeads } from "@/components/leads/LeadList";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { followUpBucket, isOpen } from "@/lib/leads";
import { followUpDue, leadOutcome } from "@/lib/lead-offers";

export const Route = createFileRoute("/_authenticated/leads/")({
  component: LeadsHome,
});

type Filter = "open" | "booked" | "lost" | "due";

function LeadsHome() {
  const leads = useLeads();
  const userId = useCurrentUserId();
  const { readOnly } = useRole();
  const [filter, setFilter] = useState<Filter>("open");

  const all = leads.data ?? [];
  const counts = useMemo(() => {
    const open = all.filter((l) => leadOutcome(l) === "open");
    return {
      open: open.length,
      booked: all.filter((l) => leadOutcome(l) === "booked").length,
      lost: all.filter((l) => leadOutcome(l) === "lost").length,
      due: open.filter((l) => followUpDue(l) || followUpBucket(l) === "overdue" || followUpBucket(l) === "today").length,
    };
  }, [all]);

  const rows = useMemo(() => {
    if (filter === "booked") return all.filter((l) => leadOutcome(l) === "booked");
    if (filter === "lost") return all.filter((l) => leadOutcome(l) === "lost");
    if (filter === "due")
      return all.filter((l) => leadOutcome(l) === "open" && (followUpDue(l) || followUpBucket(l) === "overdue" || followUpBucket(l) === "today"));
    return all.filter((l) => leadOutcome(l) === "open");
  }, [all, filter]);

  const mine = all.filter((l) => isOpen(l.stage) && l.assigned_to === userId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Bookings & Leads"
        title="Leads"
        description="Mid-term direct-booking requests: who asked, the stay they need, and the homes offered to them."
        actions={
          !readOnly ? (
            <Button asChild className="resolve-press">
              <Link to="/leads/new">
                <Plus className="size-4" aria-hidden="true" /> New lead
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open" value={counts.open} />
        <StatTile label="Follow-up due" value={counts.due} tone={counts.due ? "attention" : "neutral"} />
        <StatTile label="Booked" value={counts.booked} />
        <StatTile label="My open leads" value={mine.length} hint="Assigned to you" />
      </div>

      <SegmentedControl
        ariaLabel="Lead filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "open", label: "Open", count: counts.open },
          { value: "due", label: "Follow-up due", count: counts.due },
          { value: "booked", label: "Booked", count: counts.booked },
          { value: "lost", label: "Lost", count: counts.lost },
        ]}
      />

      {leads.isLoading ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filter === "open" ? "No open leads" : "Nothing here"}
          hint={filter === "open" ? "New enquiries appear here, and offering a home from the Availability Finder creates one." : "Try another filter."}
          action={
            !readOnly && filter === "open" ? (
              <Button asChild size="sm" className="resolve-press">
                <Link to="/leads/new">Log the first lead</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SectionCard
          title={filter === "open" ? "Open leads" : filter === "due" ? "Follow-up due" : filter === "booked" ? "Booked" : "Lost"}
          description={`${rows.length} lead${rows.length === 1 ? "" : "s"}`}
          tone={filter === "due" && rows.length ? "critical" : "default"}
        >
          <LeadListSection leads={rows} canEdit={!readOnly} />
        </SectionCard>
      )}
    </div>
  );
}
