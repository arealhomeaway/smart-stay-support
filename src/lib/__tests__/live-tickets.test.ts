/**
 * Regression tests for the Track 0 archived/demo reporting exclusion.
 *
 * excludeNonLiveTicketRows is the one piece of non-trivial logic behind the
 * fix: tables like vendor_job_ratings carry no is_demo/archived_at column of
 * their own, so the only way to keep a demo or pre-launch-archived ticket's
 * rating out of vendor KPIs (src/lib/scorecard.server.ts,
 * src/lib/command-center.server.ts) is to check the ticket it references.
 * Every other Track 0 fix (team.tsx, vendor.index.tsx, geo.server.ts,
 * properties.tsx, owner-portal.server.ts, tickets.$ticketId.tsx,
 * inbound.functions.ts, quarterly.server.ts, vendor.server.ts) is a plain
 * `.eq("is_demo", false).is("archived_at", null)` addition to a Supabase
 * query builder chain — verified by direct code review, since this sandbox
 * has no live Supabase/PostgREST instance to execute those queries against.
 */
import { describe, expect, it } from "bun:test";
import { excludeNonLiveTicketRows } from "@/lib/live-tickets";

type Row = { ticket_id: string; label: string };

describe("excludeNonLiveTicketRows", () => {
  it("excludes a row referencing an archived ticket", () => {
    const rows: Row[] = [
      { ticket_id: "archived-ticket", label: "pre-launch import" },
      { ticket_id: "live-ticket", label: "real beta activity" },
    ];
    const liveTicketIds = new Set(["live-ticket"]); // archived-ticket is NOT live
    expect(excludeNonLiveTicketRows(rows, liveTicketIds)).toEqual([
      { ticket_id: "live-ticket", label: "real beta activity" },
    ]);
  });

  it("excludes a row referencing a demo ticket", () => {
    const rows: Row[] = [
      { ticket_id: "demo-ticket", label: "walkthrough" },
      { ticket_id: "live-ticket", label: "real beta activity" },
    ];
    const liveTicketIds = new Set(["live-ticket"]); // demo-ticket is NOT live
    expect(excludeNonLiveTicketRows(rows, liveTicketIds)).toEqual([
      { ticket_id: "live-ticket", label: "real beta activity" },
    ]);
  });

  it("keeps every row for a legitimate, live, post-beta ticket", () => {
    const rows: Row[] = [
      { ticket_id: "live-a", label: "one" },
      { ticket_id: "live-b", label: "two" },
    ];
    const liveTicketIds = new Set(["live-a", "live-b"]);
    expect(excludeNonLiveTicketRows(rows, liveTicketIds)).toEqual(rows);
  });

  it("returns an empty array, never throws, when nothing is live", () => {
    const rows: Row[] = [{ ticket_id: "demo-ticket", label: "x" }];
    expect(excludeNonLiveTicketRows(rows, new Set())).toEqual([]);
  });

  it("does not mutate the input array (the underlying rows are never deleted, only excluded from this view)", () => {
    const rows: Row[] = [
      { ticket_id: "archived-ticket", label: "pre-launch import" },
      { ticket_id: "live-ticket", label: "real beta activity" },
    ];
    const original = [...rows];
    excludeNonLiveTicketRows(rows, new Set(["live-ticket"]));
    expect(rows).toEqual(original);
  });
});
