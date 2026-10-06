import { expect, it } from "bun:test";
import { propertyWindowMinutes, combinedWindowMinutes } from "../owner-participation";
it("example", () => {
  const e = [{entry_date:"2026-10-10",minutes:120},{entry_date:"2026-11-05",minutes:180}];
  const t="2026-12-01";
  expect(propertyWindowMinutes(e,"2026-10-01",t)).toBe(300);
  expect(propertyWindowMinutes(e,"2026-11-01",t)).toBe(180);
  expect(combinedWindowMinutes(e,["2026-10-01","2026-11-01"],t)).toBe(300);
  expect(combinedWindowMinutes([...e,{entry_date:"2027-03-01",minutes:60}],["2026-10-01","2027-06-01"],"2027-12-31")).toBe(300);
});
