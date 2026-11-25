/**
 * Homeowner portal "Your hours": every entry she saved, newest saved first, each showing
 * "Saved [date]" and the card it belongs to, with one "[X] hrs logged" total so she never
 * re-enters work. ARHA does not review or approve owner hours (Nov 25). Hours rules are unchanged.
 * Nov 18: Edit and Add more on her own entries. The original stays on file (a change is a new entry
 * that amends it). Links in her words are clickable and counted like files.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HourEntryChangeDialog, type ChangeableEntry } from "@/components/owner/HourEntryChangeDialog";
import { REOPEN_COPY, canChangeOwnEntry } from "@/lib/homeowner-reopen";
import { entrySavedLine, hoursFromMinutes, hoursLoggedLine, loggedMinutes, type HourEntry } from "@/lib/owner-portal-look";
import { linkCount, linkCountLabel } from "@/lib/owner-links";
import { LinkedText } from "@/components/owner/LinkedText";
import { shortDate } from "@/lib/owner-opportunity-board";

type Entry = HourEntry & {
  id: string;
  created_at?: string | null;
  review_status?: string | null;
  reviewed_at?: string | null;
  attachment_paths?: unknown;
  attachment_path?: string | null;
  owner_user_id?: string | null;
};

const FIRST = 10;

function fileCount(paths: unknown, single?: string | null): number {
  const n = Array.isArray(paths) ? paths.filter((p) => typeof p === "string" && p).length : 0;
  return n || (single ? 1 : 0);
}

export function OwnerHoursList({
  entries,
  homeLabel,
  programId = null,
  userId = null,
  readOnly = true,
  onSaved,
  cardTitle,
}: {
  entries: Entry[];
  /** The card an entry belongs to, by its owner item id. */
  cardTitle?: (reviewId: string | null | undefined) => string | null | undefined;
  homeLabel: (ids: string[]) => string;
  /** Needed to change entries; without it the list is display only (staff preview). */
  programId?: string | null;
  userId?: string | null;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const [all, setAll] = useState(false);
  const [change, setChange] = useState<{ entry: ChangeableEntry; mode: "edit" | "add" } | null>(null);
  const live = entries
    .filter((e) => !e.superseded)
    .sort((a, b) => (b.created_at ?? b.entry_date ?? "").localeCompare(a.created_at ?? a.entry_date ?? ""));
  const total = loggedMinutes(live);
  const shown = all ? live : live.slice(0, FIRST);
  return (
    <section aria-label="Your hours" id="owner-hours" className="scroll-mt-24 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-portal-ink">Your hours</h2>
        <p className="numeric text-sm text-portal-muted" data-testid="hours-logged-total">
          {hoursLoggedLine(total)}
        </p>
      </div>
      {live.length === 0 ? (
        <p className="text-sm text-portal-muted">No hours saved yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {shown.map((e) => {
              const files = fileCount(e.attachment_paths, e.attachment_path);
              const mine = Boolean(programId) && canChangeOwnEntry(e, userId, readOnly);
              const changeable: ChangeableEntry = {
                id: e.id, activity: e.activity ?? "", entry_date: e.entry_date ?? "", minutes: Number(e.minutes) || 0,
                reviewed_at: e.reviewed_at ?? null, fileCount: files,
              };
              return (
                <li key={e.id} className="py-2 text-sm" data-hour-entry={e.id}>
                  <p className="font-medium text-portal-ink">
                    <span className="numeric">{hoursFromMinutes(Number(e.minutes) || 0)} hrs</span> · <LinkedText text={e.activity} className="whitespace-pre-wrap break-words" />
                  </p>
                  <p className="text-xs text-portal-muted">
                    {[
                      entrySavedLine(e),
                      cardTitle?.(e.review_id) || null,
                      e.entry_date ? `Work on ${shortDate(e.entry_date)}` : null,
                      homeLabel(e.propertyIds),
                      files ? `${files} ${files === 1 ? "file" : "files"}` : null,
                      linkCountLabel(linkCount(e.activity)),
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {mine ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setChange({ entry: changeable, mode: "edit" })}>
                        {REOPEN_COPY.edit}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setChange({ entry: changeable, mode: "add" })}>
                        {REOPEN_COPY.addMore}
                      </Button>
                    </div>
                  ) : null}
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
      {change && programId ? (
        <HourEntryChangeDialog
          key={`${change.entry.id}:${change.mode}`}
          entry={change.entry}
          mode={change.mode}
          programId={programId}
          onClose={() => setChange(null)}
          onSaved={() => onSaved?.()}
        />
      ) : null}
    </section>
  );
}
