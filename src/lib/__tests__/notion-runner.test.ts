import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BATCH_LEASE_MS,
  NOTION_IMPORT_COPY,
  RUN_BUTTONS,
  STALE_AFTER_MS,
  RunnerRuleError,
  claimBatch,
  countOutcome,
  effectiveStatus,
  emptyBatch,
  emptyDryRun,
  emptyState,
  explainNotionProblem,
  failBatch,
  finishBatch,
  leftInGroup,
  parseState,
  planTicketWrite,
  requestStop,
  resumeJob,
  retryDelayMs,
  startJob,
  type RunnerState,
} from "@/lib/notion-import/runner";
import { ASSIGNEE_REASON_LABELS, IMPORT_GROUP_LABELS, mapNotionPage, recentCutoff, type NotionPage } from "@/lib/notion-import/mapping";
import { NOTION_GROUP_COPY } from "@/components/operations/NotionImportedGroup";
import { activityAuthorLabel, cleanNotionText, notionStatusLabel } from "@/lib/notion-ticket-display";

const T0 = Date.parse("2026-11-08T13:00:00Z");
const started = (kind: "dry_run" | "run" = "run") =>
  startJob(emptyState(), { kind, group: kind === "run" ? "recent_open" : null, runId: "run-0001", now: T0 });
const batch = (done = 1, skipped = 0, failed = 0) => ({ ...emptyBatch(), counts: { done, skipped, failed } });

describe("stop and resume", () => {
  it("runs batch by batch, saving the cursor each time, and finishes when Notion has no more", () => {
    let s = started();
    s = claimBatch(s, "run-0001", T0 + 1000);
    s = finishBatch(s, "run-0001", batch(3), "cursor-2", T0 + 2000);
    expect(s.job!.status).toBe("running");
    expect(s.job!.cursor).toBe("cursor-2");
    s = claimBatch(s, "run-0001", T0 + 3000);
    s = finishBatch(s, "run-0001", batch(2, 1), null, T0 + 4000);
    expect(s.job!.status).toBe("done");
    expect(s.progress.recent_open).toMatchObject({ done: 5, skipped: 1, failed: 0 });
  });

  it("Stop lets the batch in flight finish, then saves it as stopped at the next cursor", () => {
    let s = claimBatch(started(), "run-0001", T0 + 1000);
    s = requestStop(s, T0 + 1500);
    expect(s.job!.status).toBe("stopping");
    s = finishBatch(s, "run-0001", batch(3), "cursor-2", T0 + 2000);
    expect(s.job!.status).toBe("stopped");
    expect(s.job!.cursor).toBe("cursor-2");
    expect(() => claimBatch(s, "run-0001", T0 + 2500)).toThrow(RunnerRuleError);
  });

  it("Resume carries on from the saved cursor with the same counts and 30 day line", () => {
    let s = finishBatch(requestStop(claimBatch(started(), "run-0001", T0), T0), "run-0001", batch(3), "cursor-2", T0 + 1);
    const cutoff = s.job!.cutoff;
    s = resumeJob(s, T0 + 86_400_000);
    expect(s.job!.status).toBe("running");
    expect(s.job!.cursor).toBe("cursor-2");
    expect(s.job!.cutoff).toBe(cutoff);
    expect(s.progress.recent_open.done).toBe(3);
  });

  it("a crash (no batch for a while) shows as stopped unexpectedly and can be resumed", () => {
    const s = claimBatch(started(), "run-0001", T0);
    expect(effectiveStatus(s, T0 + 1000)).toBe("running");
    expect(effectiveStatus(s, T0 + STALE_AFTER_MS + 1)).toBe("crashed");
    const r = resumeJob(s, T0 + STALE_AFTER_MS + 1);
    expect(r.job!.status).toBe("running");
    expect(r.job!.batchUntil).toBeNull();
    expect(r.job!.cursor).toBeNull();
  });

  it("a failed batch keeps its cursor so Resume redoes it", () => {
    let s = finishBatch(claimBatch(started(), "run-0001", T0), "run-0001", batch(3), "cursor-2", T0 + 1);
    s = failBatch(claimBatch(s, "run-0001", T0 + 2), "run-0001", "Notion could not be reached", T0 + 3);
    expect(s.job!.status).toBe("failed");
    expect(s.job!.cursor).toBe("cursor-2");
    expect(s.lastError).toBe("Notion could not be reached");
    expect(resumeJob(s, T0 + 4).job!.cursor).toBe("cursor-2");
  });

  it("two batches cannot run at once, and a second run cannot start while one is going", () => {
    const s = claimBatch(started(), "run-0001", T0);
    expect(() => claimBatch(s, "run-0001", T0 + 10)).toThrow(/already in progress/);
    expect(() => claimBatch(s, "run-0001", T0 + BATCH_LEASE_MS + 10)).not.toThrow();
    expect(() => startJob(s, { kind: "run", group: "closed", runId: "run-0002", now: T0 + 10 })).toThrow(/already going/);
    expect(() => claimBatch(s, "run-other", T0 + BATCH_LEASE_MS + 10)).toThrow(/replaced/);
  });

  it("left is the dry run count minus done and skipped; unknown before a dry run", () => {
    let s: RunnerState = started();
    expect(leftInGroup(s, "recent_open")).toBeNull();
    s = { ...s, dryRun: { ...emptyDryRun(), finishedAt: "2026-11-08", groups: { recent_open: 10, older_open: 5, closed: 20 } } };
    s = finishBatch(claimBatch(s, "run-0001", T0), "run-0001", batch(3, 2, 1), "c", T0 + 1);
    expect(leftInGroup(s, "recent_open")).toBe(5);
    expect(leftInGroup(s, "closed")).toBe(20);
  });

  it("a saved state that is missing parts still reads", () => {
    expect(parseState(null).job).toBeNull();
    expect(parseState({ job: null, progress: {} }).progress.closed.done).toBe(0);
  });

  it("failed files are listed and cleared once they copy", () => {
    let s = claimBatch(started(), "run-0001", T0);
    const f = { pageId: "p1", ticketId: "t1", key: "notion:b1", name: "photo.jpg", error: "download failed [500]", at: "x" };
    s = finishBatch(s, "run-0001", { ...batch(1), failedFiles: [f] }, "c", T0 + 1);
    expect(s.failedFiles.map((x) => x.key)).toEqual(["notion:b1"]);
    s = finishBatch(claimBatch(s, "run-0001", T0 + 2), "run-0001", { ...batch(0, 1), filesCleared: ["p1"] }, "d", T0 + 3);
    expect(s.failedFiles).toEqual([]);
  });
});

describe("duplicate guard and reopen protection", () => {
  const mapped = { external_synced_at: "2026-11-01T00:00:00Z" };
  it("one ticket per Notion page ID: new creates, unchanged skips, changed updates", () => {
    expect(planTicketWrite(null, mapped)).toBe("create");
    expect(planTicketWrite({ id: "t", external_status: "In progress", external_synced_at: "2026-11-01T00:00:00+00:00" }, mapped)).toBe("unchanged");
    expect(planTicketWrite({ id: "t", external_status: "In progress", external_synced_at: "2026-10-01T00:00:00Z" }, mapped)).toBe("update");
  });
  it("a ticket reopened or taken in Resolve is never written again", () => {
    expect(planTicketWrite({ id: "t", external_status: "reopened_in_resolve", external_synced_at: "2026-10-01T00:00:00Z" }, mapped)).toBe("keep_live");
  });
});

describe("Notion rate limit", () => {
  it("waits as Notion asks, otherwise backs off 1, 2, 4 seconds up to 30", () => {
    expect(retryDelayMs(0, "3", 0)).toBe(3000);
    expect(retryDelayMs(0, null, 0)).toBe(1000);
    expect(retryDelayMs(2, null, 0)).toBe(4000);
    expect(retryDelayMs(10, null, 0)).toBe(30_000);
    expect(retryDelayMs(0, null, 0.999)).toBeLessThan(1500);
  });
  it("explains why the connection cannot read the database and what to do", () => {
    expect(explainNotionProblem(404, '{"code":"object_not_found"}').reason).toMatch(/not shared with the Notion connection/);
    expect(explainNotionProblem(404, "").fix).toMatch(/Connections/);
    expect(explainNotionProblem(null, "The Notion connection is not linked (NOTION_API_KEY missing)").reason).toMatch(/not linked/);
    expect(explainNotionProblem(401, "unauthorized").fix).toMatch(/Reconnect/);
  });
});

describe("dry run counts", () => {
  it("counts per group and per rule", () => {
    const page = (status: string, created: string | null, assignee: string | null, claim = "No"): NotionPage =>
      ({
        id: `${status}-${created}-${assignee}`,
        created_time: "2025-01-01T00:00:00Z",
        last_edited_time: "2026-11-01T00:00:00Z",
        properties: {
          "Issue Status": { type: "status", status: { name: status } },
          "Created Date": { type: "date", date: created ? { start: created } : null },
          Assignee: { type: "select", select: assignee ? { name: assignee } : null },
          Priority: { type: "select", select: { name: "Urgent" } },
          "Will this be a claim?": { type: "select", select: { name: claim } },
          "Property Address": { type: "relation", relation: [] },
        },
      }) as NotionPage;
    const ctx = { staff: [{ id: "pat", full_name: "Pat Example" }], pidOwnerRez: new Map(), propertyByOwnerRez: new Map(), cutoff: recentCutoff(T0) };
    let sum = emptyDryRun();
    for (const p of [page("In progress", "2026-11-01", "Pat Example"), page("In progress", null, null), page("Done", "2026-11-01", "General", "Yes")]) {
      sum = countOutcome(sum, mapNotionPage(p, ctx));
    }
    expect(sum.total).toBe(3);
    expect(sum.groups).toEqual({ recent_open: 1, older_open: 1, closed: 1 });
    expect(sum.priority.p1).toBe(3);
    expect(sum.blankCreatedDate).toBe(1);
    expect(sum.claims).toBe(1);
    expect(sum.needsHome).toBe(3);
  });
});

describe("word check", () => {
  const BANNED = [/\bseats?\b/i, /\bhit\b/i, /\bmedian\b/i, /pending claim review/i, /\u2014/];
  const screenStrings = [
    ...Object.values(NOTION_IMPORT_COPY),
    ...Object.values(NOTION_GROUP_COPY),
    ...Object.values(IMPORT_GROUP_LABELS),
    ...Object.values(ASSIGNEE_REASON_LABELS),
    ...RUN_BUTTONS.map((b) => b.label),
    ...[401, 403, 404, 429, 500, null].flatMap((s) => Object.values(explainNotionProblem(s, ""))),
  ];
  it("no label or message on the import screens uses a banned word, the claim status or a long dash", () => {
    for (const s of screenStrings) for (const re of BANNED) expect({ s, hit: re.test(s) }).toEqual({ s, hit: false });
  });
  it("the page text itself has no banned word", () => {
    for (const f of ["src/routes/_authenticated/integrations_.notion-import.tsx", "src/components/operations/NotionImportedGroup.tsx"]) {
      const visible = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/^\s*import /.test(l))
        .join("\n");
      const text = [...visible.matchAll(/"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "").join("\n");
      for (const re of BANNED.slice(0, 4)) expect({ f, hit: re.test(text) }).toEqual({ f, hit: false });
    }
  });
  it("the Notion claim status with a person's name never reaches a screen", () => {
    expect(notionStatusLabel("Pending Claim Review with Pat")).toBe("Claim review");
    expect(cleanNotionText("Moved to Pending Claim Review with Pat today")).toBe("Moved to Claim review today");
  });
  it("imported comments keep the original author as text", () => {
    expect(activityAuthorLabel({ external_author_name: "Pat Example", author: null })).toBe("Pat Example in Notion");
    expect(activityAuthorLabel({ author: { full_name: "Sam Sample" } })).toBe("Sam Sample");
  });
});
