import { describe, expect, test } from "bun:test";
import { csvCell, orderPlan, toCsv } from "../plan-csv";
import { accountScope } from "../onboarding-account-scope";

describe("plan CSV", () => {
  test("quotes commas, quotes and multiline text", () => {
    expect(csvCell('a, "b"\nc')).toBe('"a, ""b""\nc"');
    expect(csvCell(null)).toBe("");
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(toCsv(["x"], [["y"]]).startsWith("\uFEFFx\r\ny")).toBe(true);
  });
  test("keeps stage then task order", () => {
    const r = orderPlan(
      [
        { stage: "B", sort_order: 1, title: "b1" },
        { stage: "A", sort_order: 2, title: "a2" },
        { stage: "A", sort_order: 1, title: "a1" },
        { stage: "Z", sort_order: 1, title: "z1" },
      ],
      [{ name: "A", sort_order: 10 }, { name: "B", sort_order: 20 }],
    );
    expect(r.map((x) => `${x.stageNo}.${x.taskNo} ${x.task.title}`)).toEqual(["1.1 a1", "1.2 a2", "2.1 b1", "3.1 z1"]);
  });
});

describe("Onboarding Director account scope", () => {
  test("onboarding and homeowner accounts are in scope", () => {
    expect(accountScope({ roles: ["onboarding"], poolCodes: ["utilities"], seatCodes: [] }).inScope).toBe(true);
    expect(accountScope({ roles: ["owner"], poolCodes: [], seatCodes: [] }).inScope).toBe(true);
  });
  test("broader access stays with an administrator", () => {
    expect(accountScope({ roles: ["onboarding", "manager"], poolCodes: [], seatCodes: [] }).inScope).toBe(false);
    expect(accountScope({ roles: ["admin"], poolCodes: [], seatCodes: [] }).inScope).toBe(false);
    expect(accountScope({ roles: ["onboarding"], poolCodes: [], seatCodes: ["finance_lead"] }).inScope).toBe(false);
    expect(accountScope({ roles: ["onboarding"], poolCodes: ["po_day"], seatCodes: [] }).inScope).toBe(false);
  });
});
