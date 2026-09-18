import { describe, expect, it } from "bun:test";
import {
  mergePropertyActivity,
  propertyActivityScopes,
  type PropertyActivityRow,
} from "../property-hub.server";

describe("propertyActivityScopes — a real property_id relationship, not a name match", () => {
  it("always includes the property's own direct entity_id match", () => {
    const scopes = propertyActivityScopes({
      propertyId: "prop-1",
      ticketIds: [],
      taskIds: [],
      approvalIds: [],
      handoffIds: [],
    });
    expect(scopes).toEqual([{ entityType: "property", entityIds: ["prop-1"] }]);
  });

  it("adds a scope per non-empty related-entity list, keyed by this property's own rows", () => {
    const scopes = propertyActivityScopes({
      propertyId: "prop-1",
      ticketIds: ["t-1", "t-2"],
      taskIds: ["k-1"],
      approvalIds: ["a-1"],
      handoffIds: ["h-1"],
    });
    expect(scopes).toEqual([
      { entityType: "property", entityIds: ["prop-1"] },
      { entityType: "ticket", entityIds: ["t-1", "t-2"] },
      { entityType: "onboarding_task", entityIds: ["k-1"] },
      { entityType: "approval", entityIds: ["a-1"] },
      { entityType: "property_handoff", entityIds: ["h-1"] },
    ]);
  });

  it("omits a scope entirely when this property has no rows of that kind — never an empty entity_id.in.() filter", () => {
    const scopes = propertyActivityScopes({
      propertyId: "prop-2",
      ticketIds: [],
      taskIds: ["k-9"],
      approvalIds: [],
      handoffIds: [],
    });
    expect(scopes).toEqual([
      { entityType: "property", entityIds: ["prop-2"] },
      { entityType: "onboarding_task", entityIds: ["k-9"] },
    ]);
  });

  it("never lets one property's ticket ids leak into another property's scope — each call is independent", () => {
    const propertyA = propertyActivityScopes({
      propertyId: "prop-a",
      ticketIds: ["t-a1"],
      taskIds: [],
      approvalIds: [],
      handoffIds: [],
    });
    const propertyB = propertyActivityScopes({
      propertyId: "prop-b",
      ticketIds: ["t-b1"],
      taskIds: [],
      approvalIds: [],
      handoffIds: [],
    });
    expect(propertyA.find((s) => s.entityType === "ticket")?.entityIds).toEqual(["t-a1"]);
    expect(propertyB.find((s) => s.entityType === "ticket")?.entityIds).toEqual(["t-b1"]);
  });
});

describe("mergePropertyActivity — one merged, newest-first timeline across every scope's query", () => {
  const row = (id: string, created_at: string): PropertyActivityRow => ({
    id,
    action: "ticket_status_changed",
    entity_type: "ticket",
    entity_label: `Ticket ${id}`,
    actor_label: "A. Staff",
    reason: null,
    created_at,
  });

  it("merges multiple batches (one per entity-type query) into a single newest-first list", () => {
    const merged = mergePropertyActivity([
      [row("a", "2026-09-01T00:00:00Z")],
      [row("b", "2026-09-05T00:00:00Z"), row("c", "2026-09-03T00:00:00Z")],
    ]);
    expect(merged.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("caps at the given limit", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row(`r${i}`, new Date(2026, 8, 1 + i).toISOString()),
    );
    const merged = mergePropertyActivity([rows], 25);
    expect(merged).toHaveLength(25);
    // Newest (highest day offset) first.
    expect(merged[0]?.id).toBe("r29");
  });

  it("returns an empty list when every scope's query came back empty", () => {
    expect(mergePropertyActivity([[], []])).toEqual([]);
  });
});
