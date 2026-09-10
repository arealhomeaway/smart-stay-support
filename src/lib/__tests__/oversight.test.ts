import { describe, expect, it } from "bun:test";
import { workloadByPerson } from "../oversight";

const nameFor = (id: string) => ({ "user-1": "A. Rivera", "user-2": "B. Chen" })[id] ?? "Unknown";

describe("workloadByPerson — the ids Oversight's bars now link into Team Queue with", () => {
  it("groups by current_action_owner, falling back to assigned_to", () => {
    const rows = workloadByPerson(
      [
        { current_action_owner: "user-1", assigned_to: null },
        { current_action_owner: null, assigned_to: "user-1" },
        { current_action_owner: "user-2", assigned_to: "user-1" },
      ],
      nameFor,
    );
    expect(rows).toEqual([
      { id: "user-1", who: "A. Rivera", count: 2 },
      { id: "user-2", who: "B. Chen", count: 1 },
    ]);
  });

  it("sorts most-loaded first", () => {
    const rows = workloadByPerson(
      [
        { current_action_owner: "user-2", assigned_to: null },
        { current_action_owner: "user-1", assigned_to: null },
        { current_action_owner: "user-1", assigned_to: null },
      ],
      nameFor,
    );
    expect(rows.map((r) => r.id)).toEqual(["user-1", "user-2"]);
  });

  it("groups unowned work under the literal 'unassigned' id — Team Queue's own filter value, not a display label", () => {
    const rows = workloadByPerson(
      [
        { current_action_owner: null, assigned_to: null },
        { current_action_owner: null, assigned_to: null },
      ],
      nameFor,
    );
    expect(rows).toEqual([{ id: "unassigned", who: "Unassigned", count: 2 }]);
  });

  it("returns an empty list for no open work", () => {
    expect(workloadByPerson([], nameFor)).toEqual([]);
  });
});
