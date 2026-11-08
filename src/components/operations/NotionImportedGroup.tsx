/**
 * Team Queue: open tickets imported from Notion in the last 30 days, collapsed
 * by default and grouped Team A, Team B and Unassigned. Quiet on purpose: not
 * counted anywhere, no clocks and no alerts. Rules in notion-ticket-display.ts.
 */
import { Link } from "@tanstack/react-router";
import { formatPropertyLabel, type PropertyLabelFields } from "@/lib/property-label";
import { usDate } from "@/lib/dates";
import {
  NOTION_GROUPS,
  notionQueueGroups,
  parseNotionBlock,
  type NotionTicketLike,
} from "@/lib/notion-ticket-display";
import { withoutImportHeld } from "@/lib/import-hold";

export const NOTION_GROUP_COPY = {
  title: "Imported from Notion",
  hint: "Open tickets brought over from Notion in the last 30 days. Open one and press Take this ticket to make it yours.",
  empty: "None here.",
} as const;

type Row = NotionTicketLike & {
  id: string;
  ref?: number | null;
  title?: string | null;
  description?: string | null;
  import_hold?: string | null;
  properties?: PropertyLabelFields | null;
};

export function NotionImportedGroup({
  rows,
  staff,
  homeTeamOf,
  originSearch,
}: {
  rows: Row[];
  staff: { id: string; full_name: string | null }[];
  homeTeamOf: (userId: string | null) => string | null;
  originSearch: { from: string };
}) {
  const groups = notionQueueGroups(withoutImportHeld(rows), staff, homeTeamOf);
  const total = groups.team_a.length + groups.team_b.length + groups.unassigned.length;
  if (total === 0) return null;
  return (
    <details className="group rounded-lg border border-border bg-card px-4 py-2" data-testid="notion-imported-group">
      <summary className="cursor-pointer py-1 font-medium">
        {NOTION_GROUP_COPY.title} <span className="numeric text-muted-foreground">· {total}</span>
      </summary>
      <p className="pb-2 text-sm text-muted-foreground">{NOTION_GROUP_COPY.hint}</p>
      <div className="grid gap-3 pb-2 md:grid-cols-3">
        {NOTION_GROUPS.map((g) => (
          <section key={g.value} aria-label={g.label} className="space-y-1.5">
            <h3 className="text-sm font-semibold">
              {g.label} <span className="numeric text-muted-foreground">· {groups[g.value].length}</span>
            </h3>
            {groups[g.value].length === 0 ? (
              <p className="text-xs text-muted-foreground">{NOTION_GROUP_COPY.empty}</p>
            ) : (
              groups[g.value].map((t) => {
                const assignee = parseNotionBlock(t.description).assigneeName;
                return (
                  <Link
                    key={t.id}
                    to="/tickets/$ticketId"
                    params={{ ticketId: t.id }}
                    search={originSearch}
                    className="surface-row block px-3 py-2 text-sm"
                  >
                    <span className="block truncate font-medium">{t.title ?? "Imported ticket"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatPropertyLabel(t.properties).full}
                      {t.reported_at ? ` · Created ${usDate(t.reported_at)}` : ""}
                      {assignee ? ` · In Notion: ${assignee}` : ""}
                    </span>
                  </Link>
                );
              })
            )}
          </section>
        ))}
      </div>
    </details>
  );
}
