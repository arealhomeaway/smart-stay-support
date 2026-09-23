/**
 * Hours & Participation Report.
 *
 * Built entirely from saved participation records — no staff assembly, no
 * upload, no email. Ownership is enforced by the caller (the server function
 * resolves the program from the signed-in homeowner's own account), and the
 * file bytes are returned through that authenticated call, never a public URL.
 *
 * Counting rules mirror the portal exactly (see owner-participation.server):
 * minutes live on the entry, shared properties never multiply an entry, a
 * superseded entry is replaced by its amendment, and a returned entry does
 * not count until the homeowner corrects it.
 */

import { reviewedOwnerUpdateText } from "./owner-reviewed-update";
import { loadOwnerResponseReceipts } from "./owner-response-history.server";
import { readOwnerParticipation } from "./owner-participation-reader.server";
import { ownerReportAction } from "./owner-report-action";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Client } from "./owner-participation.server";
import { loadProgramAggregate, combinedMinutes } from "./owner-participation.server";
import {
  hoursFromMinutes,
  participationWindowEnd,
  inParticipationWindow,
} from "./owner-participation";

export type ReportEntry = {
  reviewedUpdate?: string;
  id: string;
  date: string;
  activity: string;
  detail: string;
  minutes: number;
  hours: number;
  properties: string[];
  shared: boolean;
  status: string;
  counts: boolean;
  reason: string;
  inPeriod: boolean;
  /** Owner-facing participation type, from the linked opportunity. */
  action: string;
  /** Onboarding, Operations, Program — or "Legacy" for pre-opportunity records. */
  source: string;
  opportunity: string;
  /** Receipt or photo the homeowner attached when logging this entry. */
  evidence: string;
};

export type ReportAction = {
  date: string;
  kind: string;
  summary: string;
  document: string;
};

export type OwnerReport = Awaited<ReturnType<typeof buildOwnerReport>>;

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved by ARHA",
  pending: "Awaiting review",
  submitted: "Awaiting review",
  returned: "Returned for correction",
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

function fileName(base: string, ext: string) {
  return `${base
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}.${ext}`;
}

/** Owner-visible report model. Internal notes and other owners never appear. */
export async function buildOwnerReport(supabase: Client, programId: string) {
  const agg = await loadProgramAggregate(supabase, programId, { ownerView: true });
  const p = agg.program;

  const propNames = new Map(agg.properties.map((x) => [x.propertyId, x.name] as const));
  const startedOn = p.startedOn;
  const endsOn = participationWindowEnd(startedOn, p.endsOn);
  const today = new Date().toISOString().slice(0, 10);
  const windowClosed = Boolean(endsOn && endsOn < today) || p.status === "completed";
  const kind: "progress" | "final" = windowClosed ? "final" : "progress";

  const { actionLabel, sourceLabel } = await import("./owner-opportunity");
  const opportunities = new Map(agg.reviews.map((r) => [r.id, r] as const));

  const superseded = new Set(agg.entries.filter((e) => e.superseded).map((e) => e.id));

  const entries: ReportEntry[] = agg.entries.map((e) => {
    const isSuperseded = superseded.has(e.id);
    const opp = e.review_id ? opportunities.get(e.review_id) : undefined;
    // Logged time counts immediately; only a later correction replaces it.
    const counts = !isSuperseded;
    const inPeriod = inParticipationWindow(e.entry_date, startedOn, endsOn, today);
    return {
      id: e.id,
      date: e.entry_date,
      activity: e.activity,
      detail: [e.output, e.comments, reviewedOwnerUpdateText(e.owner_update_snapshot)]
        .filter(Boolean)
        .join(" — "),
      reviewedUpdate: reviewedOwnerUpdateText(e.owner_update_snapshot),
      minutes: e.minutes,
      hours: hoursFromMinutes(e.minutes),
      properties: e.propertyIds.map((id) => propNames.get(id) ?? "Property"),
      shared: e.propertyIds.length > 1,
      status: isSuperseded ? "Superseded by a correction" : "Logged",
      counts,
      reason: e.correction_reason ?? "",
      inPeriod,
      action: opp ? actionLabel(opp.owner_action_type) : (e.activity_category ?? "Participation"),
      source: opp ? sourceLabel(opp.source_type) : "Legacy / Unlinked",
      opportunity: opp ? opp.title : "",
      evidence: e.attachment_path ? e.attachment_path.split("/").pop()! : "",
    };
  });

  const inPeriod = entries.filter((e) => e.inPeriod);
  const outsidePeriod = entries.filter((e) => !e.inPeriod);
  const countable = inPeriod.filter((e) => e.counts);

  const totals = {
    reportedMinutes: combinedMinutes(countable),
    approvedMinutes: combinedMinutes(
      countable.filter((e) => e.status === STATUS_LABEL["approved"]),
    ),
    pendingMinutes: combinedMinutes(countable.filter((e) => e.status !== STATUS_LABEL["approved"])),
    returnedMinutes: combinedMinutes(
      inPeriod.filter((e) => !e.counts && e.status !== "Superseded by a correction"),
    ),
    supersededMinutes: combinedMinutes(
      inPeriod.filter((e) => e.status === "Superseded by a correction"),
    ),
    outsidePeriodMinutes: combinedMinutes(outsidePeriod.filter((e) => e.counts)),
    sharedEntries: countable.filter((e) => e.shared).length,
  };

  // Participation actions: approvals, returns and revisions. These are a
  // record of what happened — they never add hours on the owner's behalf.
  const events = await readOwnerParticipation(supabase, "events", programId);
  if (events.error) throw events.error;
  const responses = (await loadOwnerResponseReceipts(supabase, programId, { ownerView: true })).map(
    (receipt) => ({
      ...receipt,
      propertyName: receipt.propertyId
        ? (propNames.get(receipt.propertyId) ?? "Previously enrolled property")
        : "Program opportunity",
      inPeriod: inParticipationWindow(receipt.createdAt.slice(0, 10), startedOn, endsOn, today),
    }),
  );
  const retainedReviewIds = new Set(responses.map((receipt) => receipt.reviewId));

  const actions: ReportAction[] = (events.data ?? [])
    .map(ownerReportAction)
    .filter((action): action is ReportAction => action !== null);

  const decisions = agg.reviews
    .filter((r) => r.responded_at && !retainedReviewIds.has(r.id))
    .map((r) => ({
      date: (r.responded_at ?? "").slice(0, 10),
      kind: "owner decision",
      summary: `${r.title} — ${r.owner_decision ?? r.outcome ?? "responded"}`,
      document: r.attachment_path ? r.attachment_path.split("/").pop()! : "",
    }));

  const allActions = [...actions, ...decisions].sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    kind,
    generatedAt: new Date().toISOString(),
    program: {
      id: p.id,
      ownerName: p.ownerName ?? "Homeowner",
      status: p.status,
      startedOn,
      endsOn,
      day: agg.snapshot.day,
      totalDays: agg.snapshot.totalDays,
    },
    properties: agg.includedProperties.map((x) => ({ name: x.name, address: x.address })),
    totals: {
      ...totals,
      reportedHours: hoursFromMinutes(totals.reportedMinutes),
      approvedHours: hoursFromMinutes(totals.approvedMinutes),
      pendingHours: hoursFromMinutes(totals.pendingMinutes),
      returnedHours: hoursFromMinutes(totals.returnedMinutes),
      supersededHours: hoursFromMinutes(totals.supersededMinutes),
      outsidePeriodHours: hoursFromMinutes(totals.outsidePeriodMinutes),
    },
    entries: inPeriod,
    outsidePeriod,
    actions: allActions,
    responses,
  };
}

const NOTES = [
  "Reported hours are the homeowner's own record of participation, entered manually by the homeowner. ARHA does not certify or approve these hours.",
  "Entries replaced by a correction, and entries returned for a data-quality question, are excluded from the total.",
  "An activity shared across several homes is counted once in the combined total; the homes are listed for attribution only.",
  "Every hour is the homeowner's own record, entered manually. Approvals and revisions are logged as actions and never create hours.",
  "This report is an operational record of reported participation. It is not a tax certification and not a guarantee of any tax treatment.",
];

export function reportCsv(report: OwnerReport) {
  const esc = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
  const head = [
    "entry_date",
    "activity",
    "participation_opportunity",
    "action_type",
    "source",
    "detail",
    "duration_minutes",
    "duration_hours",
    "properties",
    "shared_activity",
    "review_status",
    "counts_toward_reported_hours",
    "within_program_period",
    "note",
    "evidence_file",
    "record_type",
    "record_id",
    "response_recorded_at",
    "property_id",
    "ticket_id",
    "review_id",
    "narrative_revision",
  ];
  const rows = [...report.entries, ...report.outsidePeriod].map((e) =>
    [
      e.date,
      e.activity,
      e.opportunity,
      e.action,
      e.source,
      e.detail,
      e.minutes,
      e.hours,
      e.properties.join(" | "),
      e.shared ? "yes" : "no",
      e.status,
      e.counts && e.inPeriod ? "yes" : "no",
      e.inPeriod ? "yes" : "no",
      e.reason,
      e.evidence,
      "time_entry",
      e.id,
      "",
      "",
      "",
      "",
      "",
    ]
      .map(esc)
      .join(","),
  );
  const responseRows = report.responses.map((receipt) =>
    [
      "",
      "Review response",
      "",
      "Review",
      "Participation history",
      [receipt.response, reviewedOwnerUpdateText(receipt.ownerUpdate)].filter(Boolean).join(" — "),
      "",
      "",
      receipt.propertyName,
      "no",
      "Recorded response",
      "no",
      receipt.inPeriod ? "yes" : "no",
      "Response history only; no participation hours added.",
      "",
      "review_response",
      receipt.id,
      receipt.createdAt,
      receipt.propertyId ?? "",
      receipt.ticketId ?? "",
      receipt.reviewId ?? "",
      receipt.ownerUpdate?.revision ?? "",
    ]
      .map(esc)
      .join(","),
  );
  const meta = [
    `# ARHA Hours & Participation Report (${report.kind === "final" ? "end of period" : "progress"})`,
    `# Owner,${report.program.ownerName}`,
    `# Program period,${report.program.startedOn ?? "not started"} to ${report.program.endsOn ?? "n/a"}`,
    `# Figures as of,${report.generatedAt}`,
    `# Reported hours,${report.totals.reportedHours}`,
    `# Awaiting review hours,${report.totals.pendingHours}`,
    `# Returned hours (not counted),${report.totals.returnedHours}`,
    `# Superseded hours (not counted),${report.totals.supersededHours}`,
    ...NOTES.map((n) => `# ${n.replace(/,/g, ";")}`),
  ];
  return [...meta, head.join(","), ...rows, ...responseRows].join("\n");
}

const TEAL = rgb(0.075, 0.455, 0.478);
const INK = rgb(0.067, 0.09, 0.098);
const MUTED = rgb(0.42, 0.45, 0.46);
const GOLD = rgb(0.722, 0.573, 0.306);

export async function reportPdf(report: OwnerReport) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const H = 792;
  const M = 48;
  let page = doc.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const space = (n: number) => {
    if (y - n < M + 24) newPage();
    y -= n;
  };
  const text = (
    s: string,
    opts: { size?: number; f?: typeof font; color?: typeof INK; x?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    page.drawText(s, {
      x: opts.x ?? M,
      y,
      size,
      font: opts.f ?? font,
      color: opts.color ?? INK,
    });
  };
  const wrap = (s: string, width: number, size: number, f = font) => {
    const out: string[] = [];
    let line = "";
    for (const word of s.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  const para = (s: string, size = 9, color = MUTED) => {
    for (const line of wrap(s, W - M * 2, size)) {
      space(size + 3);
      text(line, { size, color });
    }
  };
  const heading = (s: string) => {
    if (y - 56 < M + 24) newPage();
    space(24);
    text(s, { size: 12, f: bold, color: TEAL });
    space(8);
    page.drawLine({
      start: { x: M, y },
      end: { x: W - M, y },
      thickness: 0.7,
      color: GOLD,
    });
  };

  // Masthead
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: TEAL });
  page.drawText("A REAL HOME AWAY", {
    x: M,
    y: H - 46,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    report.kind === "final"
      ? "Hours & Participation Report — End of 90-day period"
      : "Hours & Participation Report — Progress",
    { x: M, y: H - 66, size: 11, font, color: rgb(0.9, 0.96, 0.96) },
  );
  page.drawText("Every home. Every guest. Every time.", {
    x: M,
    y: H - 82,
    size: 8,
    font,
    color: rgb(0.8, 0.92, 0.92),
  });
  y = H - 120;

  text(report.program.ownerName, { size: 14, f: bold });
  space(16);
  text(
    `Program period: ${report.program.startedOn ?? "not started"} to ${report.program.endsOn ?? "n/a"} · Day ${report.program.day} of ${report.program.totalDays}`,
    { size: 9, color: MUTED },
  );
  space(13);
  text(`Figures as of: ${report.generatedAt.replace("T", " ").slice(0, 16)} UTC`, {
    size: 9,
    color: MUTED,
  });

  heading("Participating properties");
  if (report.properties.length === 0) para("No properties are attached to this program yet.");
  for (const prop of report.properties) {
    space(13);
    text(`• ${prop.name}${prop.address ? ` — ${prop.address}` : ""}`, { size: 9.5 });
  }

  heading("Totals");
  const totals: [string, string, string][] = [
    [
      "Reported hours",
      `${report.totals.reportedHours}`,
      "Approved entries plus entries awaiting review",
    ],
    [
      "Returned entries",
      `${report.totals.returnedHours}`,
      "Not counted until the homeowner corrects and resubmits",
    ],
    [
      "Superseded by corrections",
      `${report.totals.supersededHours}`,
      "Replaced by an amending entry; never counted twice",
    ],
    [
      "Outside program period",
      `${report.totals.outsidePeriodHours}`,
      "Listed separately; excluded from the totals above",
    ],
  ];
  for (const [label, value, note] of totals) {
    space(14);
    text(label, { size: 9.5, f: bold });
    text(`${value} hrs`, { size: 9.5, f: bold, x: 210 });
    text(note, { size: 8.5, color: MUTED, x: 275 });
  }

  heading("Participation detail");
  para(
    `${report.entries.length} entries within the program period. Shared activities (${report.totals.sharedEntries}) are counted once in the combined total and list every home they covered.`,
  );
  space(8);
  const cols = [M, M + 56, M + 232, M + 316, M + 356, M + 440] as const;
  const fit = (s: string, maxWidth: number, size = 8) => {
    if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
    let out = s;
    while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) {
      out = out.slice(0, -1);
    }
    return `${out}...`;
  };

  const shortStatus = (s: string) => (s.startsWith("Superseded") ? "Superseded" : s);
  const rowHead = () => {
    space(14);
    text("Date", { size: 8, f: bold, x: cols[0] });
    text("Activity", { size: 8, f: bold, x: cols[1] });
    text("Type", { size: 8, f: bold, x: cols[2] });
    text("Hours", { size: 8, f: bold, x: cols[3] });
    text("Homes", { size: 8, f: bold, x: cols[4] });
    text("Status", { size: 8, f: bold, x: cols[5] });
  };
  rowHead();
  for (const e of report.entries) {
    space(12);
    text(e.date, { size: 8, x: cols[0] });
    text(fit(e.activity, 168), { size: 8, x: cols[1] });
    text(fit(`${e.action} · ${e.source}`, 78), { size: 8, color: MUTED, x: cols[2] });
    text(String(e.hours), { size: 8, x: cols[3] });
    text(e.shared ? `${e.properties.length} shared` : fit(e.properties[0] ?? "—", 78), {
      size: 8,
      x: cols[4],
    });
    text(fit(shortStatus(e.status), 84), {
      size: 8,
      x: cols[5],
      color: e.counts ? INK : MUTED,
    });
  }

  if (report.entries.length === 0) para("No entries recorded in this period yet.");

  if (report.outsidePeriod.length > 0) {
    heading("Entries outside the program period");
    para(
      "Recorded by the homeowner but dated outside the configured window. Excluded from all totals above.",
    );
    rowHead();
    for (const e of report.outsidePeriod) {
      space(12);
      text(e.date, { size: 8, x: cols[0] });
      text(fit(e.activity, 168), { size: 8, x: cols[1] });
      text(fit(`${e.action} · ${e.source}`, 78), { size: 8, color: MUTED, x: cols[2] });
      text(String(e.hours), { size: 8, x: cols[3] });
      text("—", { size: 8, x: cols[4] });
      text("Outside period", { size: 8, x: cols[5], color: MUTED });
    }
  }

  const reviewedEntries = [...report.entries, ...report.outsidePeriod].filter(
    (entry) => entry.reviewedUpdate,
  );
  if (reviewedEntries.length) {
    heading("Owner updates retained with participation");
    for (const entry of reviewedEntries) {
      para(`${entry.date} · ${entry.activity} · ${entry.status}`, 9);
      para(entry.reviewedUpdate!, 9);
    }
  }

  heading("Recorded participation actions");
  para(
    "Approvals, returns, corrections and owner decisions. These are a record of review activity and never generate hours.",
  );
  for (const a of report.actions) {
    para(`${a.date} · ${a.kind}: ${a.summary}`, 9);
    if (a.document) para(a.document, 8);
  }
  if (report.actions.length === 0) para("No review actions recorded yet.");

  heading("Retained owner review responses");
  para(
    "These responses retain the narrative reviewed at the time. They add no participation hours.",
  );
  for (const receipt of report.responses) {
    const paragraphs: [string, number][] = [
      [
        `${receipt.createdAt.slice(0, 10)} · ${receipt.propertyName}${receipt.inPeriod ? "" : " · Outside program period"}`,
        9,
      ],
      ...(receipt.ticketId ? [[`Ticket: ${receipt.ticketId}`, 8] as [string, number]] : []),
      [receipt.response || "Review acknowledged without a note.", 9],
      [
        reviewedOwnerUpdateText(receipt.ownerUpdate) ||
          "No narrative revision was retained with this response.",
        9,
      ],
    ];
    const height = paragraphs.reduce(
      (total, [value, size]) => total + wrap(value, W - M * 2, size).length * (size + 3),
      8,
    );
    // Keep short receipts together; long narratives may continue across pages without truncation.
    if (height <= H - M * 2 - 24 && y - height < M + 24) newPage();
    for (const [value, size] of paragraphs) para(value, size);
    space(8);
  }
  if (report.responses.length === 0) para("No review responses recorded yet.");

  heading("How to read this report");
  for (const n of NOTES) para(`• ${n}`, 8.5);

  const bytes = await doc.save();
  return bytes;
}

export function reportFileNames(report: OwnerReport) {
  const base = `arha-participation-${report.kind}-${report.program.ownerName}-${report.generatedAt.slice(0, 10)}`;
  return { pdf: fileName(base, "pdf"), csv: fileName(base, "csv") };
}
