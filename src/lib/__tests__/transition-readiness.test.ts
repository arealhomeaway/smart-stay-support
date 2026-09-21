import { describe, expect, it } from "bun:test";
import {
  countByHolder,
  filterQueue,
  homeItem,
  ownerItem,
  sortQueue,
  type HomeTransitionInput,
  type OwnerTransitionInput,
} from "@/lib/transition-readiness";

const home = (over: Partial<HomeTransitionInput> = {}): HomeTransitionInput => ({
  propertyId: "p1",
  name: "Willow",
  lifecycleStatus: "onboarding",
  accessConfirmed: true,
  openTasks: 0,
  corrections: 0,
  openApprovals: 0,
  projectStarted: true,
  handoff: null,
  isTest: false,
  ...over,
});

const owner = (over: Partial<OwnerTransitionInput> = {}): OwnerTransitionInput => ({
  programId: "g1",
  ownerName: "Dana Reyes",
  ownerEmail: "dana@example.com",
  status: "enrolled",
  startedOn: "2026-01-01",
  dfyConfirmed: true,
  properties: [
    { propertyId: "p1", name: "Willow", inclusionStatus: "included", closingConfirmed: true },
  ],
  isTest: false,
  ...over,
});

describe("a home cannot clear a gate it has not actually passed", () => {
  it("holds a home with open work with its project manager", () => {
    const item = homeItem(home({ openTasks: 3 }));
    expect(item.ready).toBe(false);
    expect(item.holder).toBe("project_manager");
    expect(item.openGates.some((g) => g.key === "work_complete")).toBe(true);
  });

  it("hands a finished home to the Director of Onboarding once submitted", () => {
    const item = homeItem(
      home({
        handoff: {
          gateStep: "kati_review",
          katiDecision: null,
          micahDecision: null,
          acceptedAt: null,
          liveConfirmedAt: null,
        },
      }),
    );
    expect(item.holder).toBe("director_onboarding");
  });

  it("treats an accepted, live home as fully cleared", () => {
    const item = homeItem(
      home({
        lifecycleStatus: "active_operations",
        handoff: {
          gateStep: "complete",
          katiDecision: "accepted",
          micahDecision: "accepted",
          acceptedAt: "2026-01-02",
          liveConfirmedAt: "2026-01-03",
        },
      }),
    );
    expect(item.ready).toBe(true);
    expect(item.holder).toBeNull();
  });

  it("never lets a home without an onboarding project read as ready", () => {
    const item = homeItem(home({ projectStarted: false }));
    expect(item.ready).toBe(false);
    expect(item.openGates[0]?.key).toBe("project_started");
  });
});

describe("owner enrollment gates", () => {
  it("waits on the homeowner when a closing is unconfirmed", () => {
    const item = ownerItem(
      owner({
        properties: [
          { propertyId: "p1", name: "Willow", inclusionStatus: "included", closingConfirmed: false },
        ],
      }),
    );
    expect(item.holder).toBe("homeowner");
  });

  it("waits on staff when no home is included", () => {
    const item = ownerItem(owner({ properties: [] }));
    expect(item.openGates.some((g) => g.key === "properties_included")).toBe(true);
    expect(item.holder).toBe("onboarding_staff");
  });

  it("is ready once the program is running", () => {
    expect(ownerItem(owner({ status: "active" })).ready).toBe(true);
  });
});

describe("one queue, filtered by who is holding it up", () => {
  const items = [homeItem(home({ openTasks: 2 })), ownerItem(owner({ properties: [] }))];

  it("filters by transition and by holder", () => {
    expect(filterQueue(items, { kind: "owner_to_active" }).length).toBe(1);
    expect(filterQueue(items, { holder: "project_manager" }).length).toBe(1);
    expect(filterQueue(items, { state: "ready" }).length).toBe(0);
    expect(filterQueue(items, { find: "dana" }).length).toBe(1);
  });

  it("puts the most blocked first and counts each holder", () => {
    expect(sortQueue(items)[0]?.openGates.length).toBeGreaterThan(0);
    expect(countByHolder(items).length).toBe(2);
  });
});
