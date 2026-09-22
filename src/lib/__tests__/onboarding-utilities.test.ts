import { describe, expect, it } from "bun:test";
import {
  boardSummary,
  buildUtilityBoard,
  filterUtilityBoard,
  CORE_UTILITIES,
  type BoardAccount,
  type BoardProperty,
} from "../onboarding-utilities";

const property: BoardProperty = {
  id: "p1",
  name: "Willow Creek Cottage",
  nickname: null,
  city: "Edmond",
  state: "OK",
  lifecycle_status: "onboarding",
  is_demo: false,
};

const account = (over: Partial<BoardAccount>): BoardAccount => ({
  id: "a1",
  property_id: "p1",
  utility_type: "electric",
  provider: "OG&E",
  account_label: "44-1029",
  status: "active",
  responsible: "arha",
  credential_id: null,
  service_start_on: "2026-10-01",
  notes: null,
  ...over,
});

function board(accounts: BoardAccount[] = [], extra: Partial<BoardProperty> = {}) {
  return buildUtilityBoard({
    properties: [{ ...property, ...extra }],
    accounts,
    credentials: [{ id: "c1", label: "OG&E login", username: "ops@arha", instructions: null }],
    meters: [
      { id: "m1", property_id: "p1", name: "Electric meter", kind: "meter", location: "South wall" },
    ],
    documents: [
      { id: "d1", property_id: "p1", title: "Electric transfer confirmation", uploaded_at: null },
      { id: "d2", property_id: "p1", title: "Furniture manifest", uploaded_at: null },
    ],
  });
}

describe("utilities board", () => {
  it("shows every core service at a home, even before an account exists", () => {
    const [home] = board();
    expect(home!.cards.map((c) => c.utilityType)).toEqual([...CORE_UTILITIES]);
    expect(home!.cards.every((c) => c.status === "needed")).toBe(true);
    expect(home!.outstanding).toBe(5);
  });

  it("surfaces only account-setup detail: provider, number, transfer date, credential, meter, confirmation", () => {
    const [home] = board([account({ credential_id: "c1", notes: "Call to transfer" })]);
    const electric = home!.cards.find((c) => c.utilityType === "electric")!;
    expect(electric.provider).toBe("OG&E");
    expect(electric.accountNumber).toBe("44-1029");
    expect(electric.transferDate).toBe("2026-10-01");
    expect(electric.setupNotes).toBe("Call to transfer");
    expect(electric.credential?.label).toBe("OG&E login");
    expect(electric.meters.map((m) => m.location)).toEqual(["South wall"]);
    expect(electric.documents.map((d) => d.title)).toEqual(["Electric transfer confirmation"]);
    expect(electric.outstanding).toBe(false);
  });

  it("treats owner-held and closed services as nothing ARHA still owes", () => {
    const [home] = board([
      account({ utility_type: "gas", responsible: "owner", status: "needed" }),
      account({ id: "a2", utility_type: "trash", status: "closed" }),
    ]);
    expect(home!.cards.find((c) => c.utilityType === "gas")!.outstanding).toBe(false);
    expect(home!.cards.find((c) => c.utilityType === "trash")!.outstanding).toBe(false);
  });

  it("filters by status, service and search, dropping homes with nothing left", () => {
    const homes = board([account({ status: "pending_transfer" })]);
    expect(filterUtilityBoard(homes, { status: "outstanding" })[0]!.cards.length).toBe(5);
    expect(filterUtilityBoard(homes, { utilityType: "electric" })[0]!.cards.length).toBe(1);
    expect(filterUtilityBoard(homes, { status: "active" })).toEqual([]);
    expect(filterUtilityBoard(homes, { find: "og&e" }).length).toBe(1);
    expect(filterUtilityBoard(homes, { find: "birch" })).toEqual([]);
  });

  it("hides demo homes unless asked, and counts each status once", () => {
    const homes = board([account({})], { is_demo: true });
    expect(filterUtilityBoard(homes, {})).toEqual([]);
    expect(filterUtilityBoard(homes, { showTest: true }).length).toBe(1);
    const summary = boardSummary(homes);
    expect(summary.total).toBe(5);
    expect(summary.byStatus.find((s) => s.status === "active")!.count).toBe(1);
    expect(summary.outstanding).toBe(4);
  });
});
