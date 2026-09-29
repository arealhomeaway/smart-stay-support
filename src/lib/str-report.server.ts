import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DRAFT_LABEL, hrs, timeLabel, totalText, type StrReport } from "./str-report";

const TEAL = rgb(0.075, 0.455, 0.478);
const INK = rgb(0.067, 0.09, 0.098);
const MUTED = rgb(0.42, 0.45, 0.46);
const GOLD = rgb(0.722, 0.573, 0.306);
const RED = rgb(0.7, 0.15, 0.15);

/** Owner-safe export: never carries internal refs, notes or safeguard data. */
export function ownerSafe(r: StrReport): StrReport {
  return { ...r, rows: r.rows.map(({ internal: _i, ...row }) => row) };
}

export async function strReportPdf(r: StrReport, opts: { appendix: boolean }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 44;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, (c) => (c === "—" || c === "–" ? "-" : ""));
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
    if (r.draft) page.drawText(DRAFT_LABEL.replace("—", "-"), { x: M, y: H - 26, size: 9, font: bold, color: RED });
  };
  const space = (n: number) => {
    if (y - n < M + 20) newPage();
    y -= n;
  };
  const text = (s: string, o: { size?: number; f?: typeof font; color?: typeof INK; x?: number } = {}) =>
    page.drawText(clean(s), { x: o.x ?? M, y, size: o.size ?? 9, font: o.f ?? font, color: o.color ?? INK });
  const fit = (s: string, w: number, size = 7.5) => {
    s = clean(s);
    if (font.widthOfTextAtSize(s, size) <= w) return s;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > w) s = s.slice(0, -1);
    return `${s}...`;
  };
  const para = (s: string, size = 8.5, color = MUTED) => {
    let line = "";
    const flush = () => {
      space(size + 3);
      text(line, { size, color });
      line = "";
    };
    for (const word of clean(s).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > W - M * 2 && line) {
        flush();
        line = word;
      } else line = next;
    }
    if (line) flush();
  };
  const heading = (s: string) => {
    if (y - 50 < M + 20) newPage();
    space(22);
    text(s, { size: 11.5, f: bold, color: TEAL });
    space(7);
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: GOLD });
  };

  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: TEAL });
  page.drawText("A REAL HOME AWAY", { x: M, y: H - 44, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText("STR Property Participation & Work Activity Report", {
    x: M, y: H - 64, size: 11, font, color: rgb(0.9, 0.96, 0.96),
  });
  y = H - 116;
  if (r.draft) {
    text(DRAFT_LABEL.replace("—", "-"), { size: 12, f: bold, color: RED });
    space(16);
  }
  text(r.property.name, { size: 14, f: bold });
  if (r.property.address) {
    space(13);
    text(r.property.address, { color: MUTED });
  }
  const meta: [string, string][] = [
    ["Owner", r.owner.name],
    ["Program period", `${r.program.startedOn ?? "n/a"} to ${r.program.endsOn ?? "n/a"}`],
    ["Reporting period", `${r.period.from} to ${r.period.to}`],
    ["Report version", r.draft ? "Internal draft" : `Version ${r.version ?? 1}`],
    ["Generated", (r.generatedAt ?? new Date().toISOString()).slice(0, 10)],
  ];
  for (const [k, v] of meta) {
    space(12);
    text(k, { f: bold });
    text(v, { x: M + 110 });
  }

  if (r.include.owner) {
    heading("Owner participation");
    const o = r.summary.filter((s) => s.personKind === "owner");
    space(12);
    text(`Total recorded owner participation: ${hrs(r.totals.ownerMinutes)!.toFixed(2)} hrs across ${r.totals.ownerEntries} entries`, { f: bold });
    const byActivity = new Map<string, { n: number; m: number }>();
    for (const row of r.rows.filter((x) => x.personKind === "owner")) {
      const a = byActivity.get(row.description) ?? { n: 0, m: 0 };
      a.n += 1;
      a.m += Number(row.minutes ?? 0);
      byActivity.set(row.description, a);
    }
    for (const [k, v] of byActivity) {
      space(11);
      text(fit(k, 330, 8.5), { size: 8.5, x: M + 10 });
      text(`${v.n} entries`, { size: 8.5, x: M + 360 });
      text(`${hrs(v.m)!.toFixed(2)} hrs`, { size: 8.5, x: M + 440 });
    }
    if (o.length === 0) para("No owner participation entries in this period.");
  }

  heading("Summary");
  const cols = [M, M + 150, M + 270, M + 330, M + 430] as const;
  space(12);
  ["Person", "Work type", "Activities", "Time type", "Total"].forEach((h, i) =>
    text(h, { size: 8, f: bold, x: cols[i] }),
  );
  for (const s of r.summary) {
    space(11);
    text(fit(s.person, 145), { size: 7.5, x: cols[0] });
    text(fit(s.workType, 115), { size: 7.5, x: cols[1] });
    text(String(s.activities) + (s.underReview ? ` (+${s.underReview} under review)` : ""), { size: 7.5, x: cols[2] });
    text(fit(timeLabel(s), 98), { size: 7.5, x: cols[3] });
    text(fit(totalText(s), 110), { size: 7.5, x: cols[4] });
  }
  if (r.summary.length === 0) para("No activity recorded in this period.");
  if (r.underReviewNote) {
    space(6);
    para(r.underReviewNote, 8.5, INK);
  }

  if (opts.appendix) {
    heading("Detailed activity appendix");
    const c = [M, M + 52, M + 150, M + 225, M + 370, M + 470] as const;
    space(12);
    ["Date", "Person", "Work type", "Reference", "Time type", "Duration"].forEach((h, i) =>
      text(h, { size: 7.5, f: bold, x: c[i] }),
    );
    for (const x of r.rows) {
      space(10);
      text(x.date, { size: 7, x: c[0] });
      text(fit(x.person, 94, 7), { size: 7, x: c[1] });
      text(fit(x.workType, 72, 7), { size: 7, x: c[2] });
      text(fit(x.reference + (x.correction ? " (corrected)" : ""), 140, 7), { size: 7, x: c[3] });
      text(fit(timeLabel(x), 96, 7), { size: 7, x: c[4] });
      text(
        x.status === "provisional" ? "Under review" : x.minutes == null ? "-" : `${hrs(x.minutes)!.toFixed(2)} h`,
        { size: 7, x: c[5], color: x.status === "provisional" ? MUTED : INK },
      );
    }
  }

  heading("Disclaimer");
  para(r.disclaimer, 8.5, INK);
  return doc.save();
}
