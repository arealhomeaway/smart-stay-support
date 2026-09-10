import { describe, expect, it } from "bun:test";
import {
  DEFAULT_TEAM_QUEUE_FILTERS,
  applyTeamQueueFilters,
  type TeamQueueFilters,
  type TeamQueueTicket,
} from "../team-queue";

const ticket = (over: Partial<TeamQueueTicket>): TeamQueueTicket => ({
  id: crypto.randomUUID(),
  priority: "p3",
  status: "open",
  ...over,
});

const filters = (over: Partial<TeamQueueFilters> = {}): TeamQueueFilters => ({
  ...DEFAULT_TEAM_QUEUE_FILTERS,
  ...over,
});

const homeTeamOf = () => null;

describe("applyTeamQueueFilters — status: 'closed', the value the new Closed chip sets", () => {
  const rows = [
    ticket({ status: "open" }),
    ticket({ status: "in_progress" }),
    ticket({ status: "resolved" }),
    ticket({ status: "closed" }),
  ];

  it("the default ('active') view excludes both resolved and closed tickets, matching the old behavior", () => {
    const visible = applyTeamQueueFilters(rows, filters(), homeTeamOf);
    expect(visible.map((t) => t.status).sort()).toEqual(["in_progress", "open"]);
  });

  it("status: 'closed' shows only closed tickets — not resolved, not the open ones", () => {
    const visible = applyTeamQueueFilters(rows, filters({ status: "closed" }), homeTeamOf);
    expect(visible.map((t) => t.status)).toEqual(["closed"]);
  });

  it("status: 'all' still includes closed tickets alongside everything else", () => {
    const visible = applyTeamQueueFilters(rows, filters({ status: "all" }), homeTeamOf);
    expect(visible).toHaveLength(4);
  });

  it("composes with another filter — closed AND a specific priority", () => {
    const mixed = [
      ticket({ status: "closed", priority: "p1" }),
      ticket({ status: "closed", priority: "p3" }),
      ticket({ status: "open", priority: "p1" }),
    ];
    const visible = applyTeamQueueFilters(
      mixed,
      filters({ status: "closed", priority: "p1" }),
      homeTeamOf,
    );
    expect(visible).toHaveLength(1);
    expect(visible[0]?.status).toBe("closed");
    expect(visible[0]?.priority).toBe("p1");
  });
});
