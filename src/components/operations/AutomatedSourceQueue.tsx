/**
 * Team Queue: tickets from the info inbox, OwnerRez and Breezeway wait here with no owner
 * (register T15), in their team's group under From email, From OwnerRez and From Breezeway.
 * A coordinator presses Take it. Rules in src/lib/automated-sources.ts.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PriorityRail } from "@/components/ui/page";
import { formatPropertyLabel, type PropertyLabelFields } from "@/lib/property-label";
import { relativeTime } from "@/lib/tickets";
import {
  AUTOMATED_QUEUE_COPY,
  automatedQueueGroups,
  takeTicketPatch,
  type AutomatedTicket,
} from "@/lib/automated-sources";

type Row = AutomatedTicket & {
  ref?: number | null;
  title?: string | null;
  priority?: string | null;
  properties?: PropertyLabelFields | null;
};

type Db = { from: (t: string) => any };

export function AutomatedSourceQueue({
  rows,
  userId,
  canTake,
  originSearch,
  onTaken,
}: {
  rows: Row[];
  userId: string | null;
  canTake: boolean;
  originSearch: { from: string };
  onTaken: () => unknown;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const groups = automatedQueueGroups(rows);
  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.sources.reduce((m, s) => m + s.rows.length, 0), 0);

  async function take(t: Row) {
    if (!userId) return;
    setBusy(t.id);
    try {
      const db = supabase as unknown as Db;
      const { data, error } = await db
        .from("tickets")
        .update(takeTicketPatch(t, userId))
        .eq("id", t.id)
        .is("assigned_to", null)
        .is("current_action_owner", null)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error(AUTOMATED_QUEUE_COPY.alreadyTaken);
      } else {
        await db.from("ticket_activity").insert({
          ticket_id: t.id,
          author_id: userId,
          kind: "assignment",
          event_type: "assigned",
          body: "Picked this ticket up.",
          internal: false,
          mentions: [],
        });
        toast.success(AUTOMATED_QUEUE_COPY.taken);
      }
      await onTaken();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label={AUTOMATED_QUEUE_COPY.title} className="space-y-3 rounded-lg border border-border bg-card p-3" data-testid="automated-source-queue">
      <h2 className="text-sm font-semibold">
        {AUTOMATED_QUEUE_COPY.title} <span className="numeric text-muted-foreground">· {total}</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label} className="space-y-2">
            <h3 className="text-sm font-semibold">{g.label}</h3>
            {g.sources.map((s) => (
              <div key={s.source} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {s.label} <span className="numeric">· {s.rows.length}</span>
                </p>
                <ul className="space-y-1.5">
                  {s.rows.map((t) => (
                    <li key={t.id} className="relative flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border py-2 pl-4 pr-2 text-sm">
                      <PriorityRail priority={t.priority ?? "p3"} />
                      <Link
                        to="/tickets/$ticketId"
                        params={{ ticketId: t.id }}
                        search={originSearch}
                        className="min-w-0 flex-1 hover:underline"
                      >
                        <span className="block truncate font-medium">{t.title ?? "Ticket"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatPropertyLabel(t.properties).primary}
                          {t.reported_at ? ` · ${relativeTime(t.reported_at)}` : ""}
                        </span>
                      </Link>
                      {canTake && userId ? (
                        <Button size="sm" className="min-h-11 px-4" disabled={busy !== null} onClick={() => take(t)}>
                          {busy === t.id ? AUTOMATED_QUEUE_COPY.taking : AUTOMATED_QUEUE_COPY.take}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
