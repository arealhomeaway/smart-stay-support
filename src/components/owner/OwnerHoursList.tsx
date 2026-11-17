/**
 * Homeowner portal "Your hours" (Admin, Nov 17): every entry she saved, newest saved first, each
 * marked "Waiting for review" or "Reviewed by your team [date]", with Reviewed and Waiting totals
 * shown separately so she never re-enters work. Display only; hours rules are unchanged.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { entryStatusLine, hoursByReview, hoursFromMinutes, type HourEntry } from "@/lib/owner-portal-look";
import { shortDate } from "@/lib/owner-opportunity-board";

type Entry = HourEntry & {
  id: string;
  created_at?: string | null;
  review_status?: string | null;
  reviewed_at?: string | null;
  attachment_paths?: unknown;
};

const FIRST = 10;

function fileCount(paths: unknown): number {
  return Array.isArray(paths) ? paths.filter((p) => typeof p === "string" && p).length : 0;
}

export function OwnerHoursList({ entries, homeLabel }: { entries: Entry[]; homeLabel: (ids: string[]) => string }) {
  const [all, setAll] = useState(false);
  const live = entries
    .filter((e) => !e.superseded)
    .sort((a, b) => (b.created_at ?? b.entry_date ?? "").localeCompare(a.created_at ?? a.entry_date ?? ""));
  const { reviewedMinutes, waitingMinutes } = hoursByReview(live);
  const shown = all ? live : live.slice(0, FIRST);
  return (
    <section aria-label="Your hours" id="owner-hours" className="scroll-mt-24 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-portal-ink">Your hours</h2>
        <p className="numeric text-sm text-portal-muted" data-testid="hours-by-review">
          Reviewed {hoursFromMinutes(reviewedMinutes)} hrs · Waiting for review {hoursFromMinutes(waitingMinutes)} hrs
        </p>
      </div>
      {live.length === 0 ? (
        <p className="text-sm text-portal-muted">No hours saved yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {shown.map((e) => {
              const files = fileCount(e.attachment_paths);
              return (
                <li key={e.id} className="py-2 text-sm" data-hour-entry={e.id}>
                  <p className="font-medium text-portal-ink">
                    <span className="numeric">{hoursFromMinutes(Number(e.minutes) || 0)} hrs</span> · {e.activity}
                  </p>
                  <p className="text-xs text-portal-muted">
                    {[
                      e.entry_date ? `Work on ${shortDate(e.entry_date)}` : null,
                      homeLabel(e.propertyIds),
                      files ? `${files} ${files === 1 ? "file" : "files"}` : null,
                      entryStatusLine(e),
                    ].filter(Boolean).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
          {live.length > FIRST ? (
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all (${live.length})`}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
