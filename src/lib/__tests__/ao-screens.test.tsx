import { describe, expect, it as test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import {
  NOT_SET_UP, addField, canEditCardLibrary, canToggleHomeAutomation, canViewContributions, filterCards, filterContributions,
  isMissingDbObject, moveField, paceSentence, portalCardView, previewSummary, removeField, runAoClocksGuarded, showVerifyBadge,
  statusActions, submissionValues, unwrap, validateSubmission,
} from "@/lib/ao-ui";
import { canSendToActiveOwner, contributionsCsv, ownerPace } from "@/lib/ao-engine";
import { OwnerPaceCard, PlanCardItem } from "@/components/owner/OwnerPlanCards";

const wrap = (el: React.ReactElement) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>);
const missingFn = { code: "PGRST202", message: "Could not find the function public.ao_process_clocks" };
const missingTable = { code: "PGRST205", message: "Could not find the table 'public.ao_library_cards'" };

describe("graceful degradation while staged objects are missing", () => {
  test("missing function/table are recognised; real errors are not", () => {
    expect(isMissingDbObject(missingFn)).toBe(true);
    expect(isMissingDbObject(missingTable)).toBe(true);
    expect(isMissingDbObject({ code: "42501", message: "Not allowed" })).toBe(false);
  });
  test("unwrap returns not available instead of throwing", () => {
    expect(unwrap({ data: null, error: missingTable })).toEqual({ available: false });
    expect(() => unwrap({ data: null, error: { code: "42501", message: "Not allowed" } })).toThrow("Not allowed");
    expect(unwrap({ data: [1], error: null })).toEqual({ available: true, data: [1] });
  });
  test("not set up wording", () => expect(NOT_SET_UP).toBe("Not set up yet"));
});

describe("job guard", () => {
  test("skips silently when ao_process_clocks does not exist", async () => {
    expect(await runAoClocksGuarded({ rpc: (async () => ({ data: null, error: missingFn })) as never })).toEqual({ skipped: true });
  });
  test("runs when present", async () => {
    const r = await runAoClocksGuarded({ rpc: (async () => ({ data: { reminders: 1 }, error: null })) as never });
    expect(r).toEqual({ skipped: false, result: { reminders: 1 } });
  });
  test("other failures are reported", async () => {
    await expect(runAoClocksGuarded({ rpc: (async () => ({ data: null, error: { code: "XX000", message: "boom" } })) as never })).rejects.toThrow("boom");
  });
  test("wired last into the 5-minute job", () => {
    const src = readFileSync("src/routes/api/public/hooks/owner-notify.ts", "utf8");
    expect(src.indexOf('name: "ao_clocks"')).toBeGreaterThan(src.indexOf('name: "welcomes"'));
  });
});

describe("screen visibility", () => {
  const admin = { isAdmin: true, isOnboardingDirector: false };
  const od = { isAdmin: false, isOnboardingDirector: true };
  const staff = { isAdmin: false, isOnboardingDirector: false, isStaff: true };
  test("card library and home switch: Admin and Onboarding Director only", () => {
    expect([canEditCardLibrary(admin), canEditCardLibrary(od), canEditCardLibrary(staff)]).toEqual([true, true, false]);
    expect(canToggleHomeAutomation(staff)).toBe(false);
  });
  test("contributions: Admin, Onboarding Director, Directors", () => {
    expect(canViewContributions({ ...staff, isOpsDirector: true })).toBe(true);
    expect(canViewContributions(staff)).toBe(false);
    expect(canViewContributions(od)).toBe(true);
  });
  test("Send to Active Owner gate", () => {
    expect(canSendToActiveOwner("active")).toBe(true);
    // Build 17 finding 5: live programs (paused, goal reached) keep it; closed, archived or none hide it.
    for (const s of ["paused", "complete"]) expect(canSendToActiveOwner(s)).toBe(true);
    for (const s of ["closed", "archived", null, undefined]) expect(canSendToActiveOwner(s)).toBe(false);
  });
  test("verify badge only after homeowner completion", () => {
    expect(showVerifyBadge(null)).toBe(false);
    expect(showVerifyBadge({ owner_completed_at: null })).toBe(false);
    expect(showVerifyBadge({ owner_completed_at: "2026-10-31T00:00:00Z" })).toBe(true);
  });
});

describe("card library editing", () => {
  const rows = [
    { id: "1", code: "C01", title: "Utility list", card_group: "Setup", lane: "critical", stage_window: "onboarding_early", status: "draft" },
    { id: "2", code: "N14", title: "Neighborhood sheet", card_group: "New project", lane: "flexible", stage_window: "anytime", status: "released" },
  ];
  test("filters and search", () => {
    const all = { group: "all", lane: "all", stage: "all", status: "all", q: "" };
    expect(filterCards(rows, { ...all, lane: "flexible" }).map((r) => r.code)).toEqual(["N14"]);
    expect(filterCards(rows, { ...all, q: "c01" }).map((r) => r.code)).toEqual(["C01"]);
    expect(filterCards(rows, { ...all, status: "retired" })).toEqual([]);
  });
  test("output fields add, reorder, remove", () => {
    let f = addField([], "Provider", "text");
    f = addField(f, "Provider", "number");
    expect(f.map((x) => x.key)).toEqual(["provider", "provider_2"]);
    f = moveField(f, "provider_2", -1);
    expect(f[0]!.key).toBe("provider_2");
    expect(removeField(f, "provider").map((x) => x.key)).toEqual(["provider_2"]);
  });
  test("status buttons", () => {
    expect(statusActions("draft").map((a) => a.label)).toEqual(["Release", "Retire"]);
    expect(statusActions("released").map((a) => a.label)).toEqual(["Retire", "Back to Draft"]);
    expect(statusActions("retired").map((a) => a.label)).toEqual(["Back to Draft"]);
  });
  test("join preview summary", () => {
    expect(previewSummary({ open: 3, locked: 2 })).toBe("3 open, 2 locked, 0 already covered, 0 skipped, stage passed");
  });
});

describe("owner portal", () => {
  const base = { plan_card_id: "p1", title: "Utility list", what_text: "List providers", opens_text: "set up utilities.", output_fields: [{ key: "provider", label: "Provider", type: "text" }, { key: "cost", label: "Monthly cost", type: "number" }], join_outcome: "locked", unlocked_at: null, expired_at: null, owner_completed_at: null };
  test("locked card is visible but not actionable", () => {
    expect(portalCardView(base)).toEqual({ kind: "locked", text: "Coming soon: waiting on ARHA to set up utilities", actionable: false });
    const html = wrap(<PlanCardItem card={base} programId="g" readOnly={false} />);
    expect(html).toContain("Coming soon: waiting on ARHA to set up utilities");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<button");
  });
  test("open card renders its output fields as a form", () => {
    const html = wrap(<PlanCardItem card={{ ...base, unlocked_at: "2026-10-30T00:00:00Z" }} programId="g" readOnly={false} />);
    expect(html).toContain("<form");
    expect(html).toContain("Provider");
    expect(html).toContain("Monthly cost");
    expect(html).toContain("Send to ARHA");
  });
  test("done and closed cards have no form", () => {
    expect(wrap(<PlanCardItem card={{ ...base, unlocked_at: "x", owner_completed_at: "y" }} programId="g" readOnly={false} />)).not.toContain("<form");
    expect(wrap(<PlanCardItem card={{ ...base, unlocked_at: "x", expired_at: "y" }} programId="g" readOnly={false} />)).not.toContain("<form");
  });
  test("submit validation and values", () => {
    const v = portalCardView({ ...base, unlocked_at: "x" });
    const fields = v.kind === "open" ? v.fields : [];
    expect(validateSubmission(fields, { provider: "CPS" })).toBe("Please fill in Monthly cost");
    expect(validateSubmission(fields, { provider: "CPS", cost: "abc" })).toBe("Monthly cost must be a number");
    expect(validateSubmission(fields, { provider: "CPS", cost: "80" })).toBeNull();
    expect(submissionValues(fields, { provider: " CPS ", cost: "80" })).toEqual({ provider: "CPS", cost: 80 });
  });
  test("pace card", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    const html = wrap(<OwnerPaceCard loggedHours={60} endsOn="2026-12-31" endLabel="Dec 31, 2026" now={now} />);
    const p = ownerPace(60, now, new Date("2026-12-31T23:59:59"));
    expect(html).toContain(paceSentence(p.weeklyNeeded, "Dec 31, 2026"));
    expect(html).toContain(p.label);
    expect(wrap(<OwnerPaceCard loggedHours={60} endsOn={null} endLabel="" />)).toBe("");
  });
});

describe("contributions export", () => {
  const rows = [
    { id: "1", card: "Utility list", cardCode: "C01", home: "12 Oak St", member: "Rachel", submittedAt: "2026-10-30T10:00:00Z", values: { provider: "CPS, Energy" } },
    { id: "2", card: "Neighborhood", cardCode: "N14", home: "4 Elm St", member: "Ryan", submittedAt: "2026-10-31T10:00:00Z", values: { topic: "Schools" } },
  ];
  test("filters by card, home, date and search", () => {
    const all = { card: "all", home: "all", from: "", to: "", q: "" };
    expect(filterContributions(rows, { ...all, card: "N14" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterContributions(rows, { ...all, home: "12 Oak St" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterContributions(rows, { ...all, from: "2026-10-31" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterContributions(rows, { ...all, q: "rachel" }).map((r) => r.id)).toEqual(["1"]);
  });
  test("CSV keeps attribution and escapes", () => {
    const csv = contributionsCsv(rows.slice(0, 1).map((r) => ({ card: r.card, home: r.home, member: r.member, submittedAt: r.submittedAt, values: r.values })));
    expect(csv.split("\n")[0]).toBe("Card,Home,Submitted by,Submitted at,provider");
    expect(csv.split("\n")[1]).toBe('Utility list,12 Oak St,Rachel,2026-10-30T10:00:00Z,"CPS, Energy"');
  });
});

describe("staged 03 is read-only and adds no anon access", () => {
  const sql = readFileSync("docs/pending/ao-engine/03_screen_reads.sql", "utf8").replace(/--.*$/gm, "");
  test("no writes", () => expect(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(sql)).toBe(false));
  test("anon and PUBLIC revoked; authenticated granted", () => {
    expect(sql).toContain("FROM PUBLIC, anon");
    expect(/GRANT EXECUTE[\s\S]*TO authenticated;/.test(sql)).toBe(true);
    expect(/TO\s+anon/i.test(sql)).toBe(false);
  });
  test("undo drops exactly the two functions", () => {
    const undo = readFileSync("docs/pending/ao-engine/undo/03_screen_reads.sql", "utf8");
    expect(undo.match(/DROP FUNCTION/g)?.length).toBe(2);
  });
});
