/**
 * Exports for the Active Owner oversight dashboard.
 *
 * Whatever the supervisor is looking at on screen is what leaves the app: the
 * filtered rows, in the order they are sorted. Two shapes are offered — one
 * line per enrolled homeowner, and one line per enrolled home — plus a printed
 * summary. Nothing here says anything about tax treatment or suggests hours.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { usDate } from "./dates";
import { oversightSummary, daysSinceContact, type OversightRow } from "./owner-oversight";

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

function contactLabel(row: OversightRow, now: Date): string {
  const days = daysSinceContact(row, now);
  if (days === null) return "No contact yet";
  return `${usDate(row.lastContactAt!.slice(0, 10))} (${days} days ago)`;
}

function checkpointLabel(row: OversightRow): string {
  if (row.openCheckpoint) return `Day ${row.openCheckpoint.day} check-in open now`;
  return `Day ${row.nextCheckpoint.day} in ${row.nextCheckpoint.daysAway} days`;
}

/** One line per enrolled homeowner — the dashboard as a spreadsheet. */
export function oversightCsv(rows: OversightRow[], now: Date = new Date()): string {
  return toCsv(
    [
      "Homeowner",
      "Email",
      "Homes",
      "Enrolled",
      "Day in program",
      "Days left",
      "Hours reported",
      "Target hours",
      "Pace benchmark today",
      "Pacing",
      "Hours behind benchmark",
      "Next checkpoint",
      "Checkpoint due soon",
      "Waiting on the owner",
      "Last contact",
      "Days since contact",
      "Resolve login",
    ],
    rows.map((r) => [
      r.ownerName ?? "Unnamed homeowner",
      r.ownerEmail ?? "",
      r.properties.map((p) => p.name).join("; "),
      r.startedOn ? usDate(r.startedOn) : "",
      r.day,
      r.daysLeft,
      r.reportedHours,
      r.targetHours,
      r.benchmark,
      r.health.label,
      r.health.behindHours,
      checkpointLabel(r),
      r.reviewDueSoon ? "Yes" : "No",
      r.openTasks,
      r.lastContactAt ? usDate(r.lastContactAt.slice(0, 10)) : "No contact yet",
      daysSinceContact(r, now) ?? "",
      r.ownerLinked ? "Yes" : "No",
    ]),
  );
}

/** One line per enrolled home, for people who work property-by-property. */
export function oversightPropertiesCsv(rows: OversightRow[], now: Date = new Date()): string {
  const lines: (string | number | null)[][] = [];
  for (const r of rows) {
    const homes = r.properties.length ? r.properties : [{ id: "", name: "No home linked yet" }];
    for (const home of homes) {
      lines.push([
        home.name,
        r.ownerName ?? "Unnamed homeowner",
        r.ownerEmail ?? "",
        r.startedOn ? usDate(r.startedOn) : "",
        r.day,
        r.daysLeft,
        r.reportedHours,
        r.targetHours,
        r.health.label,
        checkpointLabel(r),
        r.openTasks,
        contactLabel(r, now),
      ]);
    }
  }
  return toCsv(
    [
      "Home",
      "Homeowner",
      "Email",
      "Enrolled",
      "Day in program",
      "Days left",
      "Hours reported",
      "Target hours",
      "Pacing",
      "Next checkpoint",
      "Waiting on the owner",
      "Last contact",
    ],
    lines,
  );
}

function ascii(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "-");
}

/** A printable snapshot of exactly the rows on screen. */
export async function oversightPdf(
  rows: OversightRow[],
  meta: { filterLabel: string; generatedOn?: Date } = { filterLabel: "All enrolled" },
): Promise<Uint8Array> {
  const now = meta.generatedOn ?? new Date();
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.09, 0.18, 0.27);
  const muted = rgb(0.38, 0.4, 0.44);
  const summary = oversightSummary(rows);

  let page = pdf.addPage([792, 612]);
  let y = 560;
  const header = () => {
    page.drawRectangle({ x: 0, y: 566, width: 792, height: 46, color: navy });
    page.drawText("ACTIVE OWNER PROGRAM OVERSIGHT", {
      x: 38,
      y: 582,
      size: 15,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(ascii(`${meta.filterLabel}  |  ${usDate(now.toISOString().slice(0, 10))}`), {
      x: 520,
      y: 583,
      size: 10,
      font: regular,
      color: rgb(1, 1, 1),
    });
  };
  header();

  page.drawText(
    ascii(
      `${summary.enrolled} enrolled  |  ${summary.onPace} on pace  |  ${summary.behind} behind pace  |  ` +
        `${summary.totalHours} hours reported  |  ${summary.reviewsDueSoon} checkpoints within 7 days  |  ` +
        `${summary.awaitingOwner} waiting on a homeowner`,
    ),
    { x: 38, y, size: 10, font: regular, color: muted },
  );
  y -= 26;

  const cols = [38, 220, 330, 415, 500, 600] as const;
  const heads = ["Homeowner / homes", "Hours", "Day", "Pacing", "Next checkpoint", "Last contact"];
  const drawHeadRow = () => {
    heads.forEach((h, i) => {
      page.drawText(h, { x: cols[i]!, y, size: 9, font: bold, color: navy });
    });
    y -= 6;
    page.drawLine({
      start: { x: 38, y },
      end: { x: 754, y },
      thickness: 0.6,
      color: rgb(0.8, 0.82, 0.85),
    });
    y -= 14;
  };
  drawHeadRow();

  for (const r of rows) {
    if (y < 60) {
      page = pdf.addPage([792, 612]);
      y = 560;
      header();
      drawHeadRow();
    }
    const values = [
      ascii(r.ownerName ?? "Unnamed homeowner").slice(0, 34),
      `${r.reportedHours} / ${r.targetHours} hrs`,
      `${r.day} of 90`,
      ascii(r.health.label),
      ascii(checkpointLabel(r)).slice(0, 26),
      ascii(contactLabel(r, now)).slice(0, 24),
    ];
    values.forEach((v, i) => {
      page.drawText(v, { x: cols[i]!, y, size: 9.5, font: regular });
    });
    y -= 12;
    const sub = `${r.properties.map((p) => p.name).join(" · ") || "No home linked yet"}${
      r.openTasks > 0 ? `  —  ${r.openTasks} waiting on the owner` : ""
    }`;
    page.drawText(ascii(sub).slice(0, 96), { x: 38, y, size: 8.5, font: regular, color: muted });
    y -= 16;
  }

  if (!rows.length) {
    page.drawText("No homeowner matches this view.", { x: 38, y, size: 10, font: regular });
  }

  return pdf.save();
}

/** Start a browser download for text or binary export content. */
export function downloadExport(filename: string, mime: string, body: string | Uint8Array) {
  const blob = new Blob([body as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.hidden = true;
  try {
    document.body.appendChild(a);
    a.click();
  } finally {
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 40_000);
  }
}
