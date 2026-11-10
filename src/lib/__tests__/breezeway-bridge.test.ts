import { describe, expect, it } from "bun:test";
import {
  bridgeEventTime,
  bridgeMirrorFields,
  bridgeSkipReason,
  breezewayTaskLink,
  breezewayUtc,
  creatorKind,
  isFinishedMaintenance,
  isNewHouse,
  rawIsFinishedMaintenance,
  reportedIssuePriority,
  reviewDueAt,
  sweepBridgeCandidate,
} from "@/lib/breezeway-bridge";

/** Fake Breezeway task objects shaped like the real GET /task/{id} replies (Nov 10 sample). */
const issue = {
  id: 172480884,
  name: "Inspect and repair bathtub leak",
  home_id: 768854,
  type_department: "maintenance",
  type_priority: "normal",
  type_task_status: { code: "created", name: "Created", stage: "new" },
  created_at: "2026-11-16T15:00:00",
  finished_at: null,
  created_by: { id: 55, name: "Field person" },
  requested_by: null,
  reported_issue: true,
  report_url: "https://portal.breezeway.io/task/report/abc",
  tags: ["Plumbing"],
  task_tags: [{ id: 1, name: "Urgent look" }],
};
const lawn = {
  id: 172480900,
  name: "Lawn Care",
  home_id: 768854,
  type_department: "maintenance",
  type_task_status: { code: "finished", name: "Finished", stage: "finished" },
  finished_at: "2026-11-16T18:30:00",
  reported_issue: false,
};

describe("Breezeway bridge rules (T15, C6)", () => {
  it("reads Breezeway's offset-less times as UTC", () => {
    expect(breezewayUtc("2026-11-16T18:30:00")).toBe("2026-11-16T18:30:00.000Z");
    expect(breezewayUtc("2026-11-16T18:30:00+00:00")).toBe("2026-11-16T18:30:00.000Z");
    expect(breezewayUtc("")).toBeNull();
  });

  it("stores tags, creator, reported issue marker and report link from the task", () => {
    const f = bridgeMirrorFields(issue, null, "2026-11-16T15:05:00.000Z");
    expect(f.tags).toEqual(["Plumbing", "Urgent look"]);
    expect(f.created_by_id).toBe("55");
    expect(f.created_by_name).toBe("Field person");
    expect(f.reported_issue).toBe(true);
    expect(f.report_url).toBe("https://portal.breezeway.io/task/report/abc");
    expect(f.finished_at).toBeNull();
  });

  it("a finish time: what Breezeway says, else the first time Resolve saw it finished, kept once set", () => {
    expect(bridgeMirrorFields(lawn, null, "2026-11-16T19:00:00.000Z").finished_at).toBe("2026-11-16T18:30:00.000Z");
    const noTime = { ...lawn, finished_at: null };
    expect(bridgeMirrorFields(noTime, null, "2026-11-16T19:00:00.000Z").finished_at).toBe("2026-11-16T19:00:00.000Z");
    expect(bridgeMirrorFields(noTime, "2026-11-16T18:45:00.000Z", "2026-11-16T19:00:00.000Z").finished_at).toBe("2026-11-16T18:45:00.000Z");
  });

  it("a field Breezeway did not send keeps what the mirror has (older rows stay empty, never wiped)", () => {
    const f = bridgeMirrorFields({ id: 1, type_task_status: { stage: "new" } }, null, "2026-11-16T19:00:00.000Z");
    expect("tags" in f).toBe(false);
    expect("reported_issue" in f).toBe(false);
    expect("report_url" in f).toBe(false);
    expect("created_by_id" in f).toBe(false);
  });

  it("who created it: a guest request, a person, or unknown", () => {
    expect(creatorKind({ id: 1, requested_by: "guest", created_by: null })).toBe("guest");
    expect(creatorKind(issue)).toBe("person");
    expect(creatorKind({ id: 1, created_by: null, requested_by: null })).toBe("unknown");
  });

  it("finished maintenance includes lawn and the Approved and Closed statuses; cleaning and inspection never count", () => {
    expect(rawIsFinishedMaintenance(lawn)).toBe(true);
    expect(isFinishedMaintenance({ department: "maintenance", status: "Approved", stage: "finished" })).toBe(true);
    expect(isFinishedMaintenance({ department: "maintenance", status: "Closed", stage: null })).toBe(true);
    expect(isFinishedMaintenance({ department: "maintenance", status: "In Progress", stage: "in_progress" })).toBe(false);
    expect(isFinishedMaintenance({ department: "housekeeping", status: "Finished", stage: "finished" })).toBe(false);
    expect(isFinishedMaintenance({ department: "inspection", status: "Finished", stage: "finished" })).toBe(false);
  });

  it("skip order: off, before the start line, not a verified home", () => {
    const line = "2026-11-16T14:00:00.000Z";
    const ok = { bridgeOn: true, startLine: line, at: "2026-11-16T15:00:00.000Z", propertyId: "p", mappingState: "verified" };
    expect(bridgeSkipReason(ok)).toBeNull();
    expect(bridgeSkipReason({ ...ok, bridgeOn: false })).toBe("the bridge is off");
    expect(bridgeSkipReason({ ...ok, at: "2026-11-16T13:59:59.000Z" })).toBe("before the bridge started");
    expect(bridgeSkipReason({ ...ok, startLine: null })).toBe("before the bridge started");
    expect(bridgeSkipReason({ ...ok, propertyId: null })).toBe("not a verified Resolve home");
    expect(bridgeSkipReason({ ...ok, mappingState: "mismatch" })).toBe("not a verified Resolve home");
  });

  it("old work first seen late stays old: the event time is never later than Breezeway's last update", () => {
    expect(bridgeEventTime("2026-11-16T15:00:00.000Z", "2026-11-10T09:00:00.000Z")).toBe("2026-11-10T09:00:00.000Z");
    expect(bridgeEventTime("2026-11-16T15:00:00.000Z", "2026-11-16T16:00:00.000Z")).toBe("2026-11-16T15:00:00.000Z");
    expect(bridgeEventTime(null, "2026-11-16T16:00:00.000Z")).toBeNull();
  });

  it("New House by the home tag, a task tag or the name", () => {
    const base = { homeTags: [], taskTags: [], homeName: "Maple", homeNickname: null };
    expect(isNewHouse(base)).toBe(false);
    expect(isNewHouse({ ...base, homeTags: ["New House"] })).toBe(true);
    expect(isNewHouse({ ...base, taskTags: ["new house"] })).toBe(true);
    expect(isNewHouse({ ...base, homeName: "New House Setup Oak" })).toBe(true);
  });

  it("priority from the issue: urgent Right now, high Today, else Routine", () => {
    expect(reportedIssuePriority("urgent")).toBe("p1");
    expect(reportedIssuePriority("high")).toBe("p2");
    expect(reportedIssuePriority("normal")).toBe("p3");
    expect(reportedIssuePriority(null)).toBe("p3");
  });

  it("the review is due 24 hours after the finish time and carries the Breezeway link", () => {
    expect(reviewDueAt("2026-11-16T18:30:00.000Z")).toBe("2026-11-17T18:30:00.000Z");
    expect(breezewayTaskLink(172480900, null)).toBe("https://app.breezeway.io/task/172480900");
    expect(breezewayTaskLink(172480884, issue.report_url)).toBe(issue.report_url);
  });

  it("the sweep keeps only post-start issues and post-start finished maintenance", () => {
    const line = "2026-11-16T14:00:00.000Z";
    expect(sweepBridgeCandidate(issue, line)).toBe(true);
    expect(sweepBridgeCandidate({ ...issue, created_at: "2026-11-01T10:00:00" }, line)).toBe(false);
    expect(sweepBridgeCandidate(lawn, line)).toBe(true);
    expect(sweepBridgeCandidate({ ...lawn, finished_at: "2026-11-15T10:00:00" }, line)).toBe(false);
    expect(sweepBridgeCandidate(lawn, null)).toBe(false);
  });
});
