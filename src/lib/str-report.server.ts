import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PROGRAM_LEVEL_NOTE, ownerBreakdown, DRAFT_LABEL, hrs, timeLabel, totalText, type StrReport } from "./str-report";

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
  // Helvetica (WinAnsi) covers Latin-1, so accented names print as written.
  const clean = (s: string) =>
    s
      .replace(/[—–]/g, "-")
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, (c) => c.normalize("NFD").replace(/[^\x20-\x7E]/g, ""));
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
  const wrap = (s: string, w: number, size: number, f = font) => {
    const out: string[] = [];
    let line = "";
    for (const word of clean(s).split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > w && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  };
  /** A table row whose cells wrap instead of truncating. */
  const row = (cells: { s: string; x: number; w: number; f?: typeof font; color?: typeof INK }[], size: number) => {
    const lines = cells.map((c) => wrap(c.s, c.w, size, c.f));
    const n = Math.max(...lines.map((l) => l.length));
    const lh = size + 2.5;
    if (y - (n * lh + 2) < M + 20) newPage();
    y -= 2;
    for (let i = 0; i < n; i++) {
      y -= lh;
      cells.forEach((c, k) => {
        const t = lines[k]![i];
        if (t) page.drawText(t, { x: c.x, y, size, font: c.f ?? font, color: c.color ?? INK });
      });
    }
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
  /** `keep` reserves room so a short section never splits from its heading. */
  const heading = (s: string, keep = 0) => {
    if (y - 50 - keep < M + 20) newPage();
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
    for (const [k, v] of ownerBreakdown(r)) {
      space(12);
      text(k, { f: bold });
      text(v, { x: M + 260, f: bold });
    }
    space(4);
    para(r.programLevelNote ?? PROGRAM_LEVEL_NOTE);
    space(4);
    const byActivity = new Map<string, { n: number; m: number }>();
    for (const row of r.rows.filter((x) => x.personKind === "owner")) {
      const a = byActivity.get(row.description) ?? { n: 0, m: 0 };
      a.n += 1;
      a.m += Number(row.minutes ?? 0);
      byActivity.set(row.description, a);
    }
    for (const [k, v] of byActivity)
      row(
        [
          { s: k, x: M + 10, w: 340 },
          { s: `${v.n} ${v.n === 1 ? "entry" : "entries"}`, x: M + 360, w: 70 },
          { s: `${hrs(v.m)!.toFixed(2)} hrs`, x: M + 440, w: 80 },
        ],
        8.5,
      );
    if (o.length === 0) para("No owner participation entries in this period.");
  }

  heading("Summary");
  const cols = [M, M + 150, M + 270, M + 330, M + 430] as const;
  space(12);
  ["Person", "Work type", "Activities", "Time type", "Total"].forEach((h, i) =>
    text(h, { size: 8, f: bold, x: cols[i]! }),
  );
  for (const s of r.summary)
    row(
      [
        { s: s.person, x: cols[0], w: 140 },
        { s: s.workType, x: cols[1], w: 112 },
        { s: String(s.activities) + (s.underReview ? ` (+${s.underReview} under review)` : ""), x: cols[2], w: 55 },
        { s: timeLabel(s), x: cols[3], w: 95 },
        { s: totalText(s), x: cols[4], w: W - M - cols[4] },
      ],
      7.5,
    );
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
      text(h, { size: 7.5, f: bold, x: c[i]! }),
    );
    for (const x of r.rows)
      row(
        [
          { s: x.date, x: c[0], w: 48 },
          { s: x.person, x: c[1], w: 92 },
          { s: x.workType, x: c[2], w: 70 },
          { s: x.reference + (x.correction ? " (corrected)" : ""), x: c[3], w: 140 },
          { s: timeLabel(x), x: c[4], w: 95 },
          {
            s: x.status === "provisional" ? "Under review" : x.minutes == null ? "-" : `${hrs(x.minutes)!.toFixed(2)} h`,
            x: c[5],
            w: W - M - c[5],
            color: x.status === "provisional" ? MUTED : INK,
          },
        ],
        7,
      );
  }

  heading("Disclaimer", wrap(r.disclaimer, W - M * 2, 8.5).length * 11.5);
  para(r.disclaimer, 8.5, INK);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `A Real Home Away  |  ${clean(r.property.name)}  |  Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: M, y: 24, size: 7, font, color: MUTED });
  });
  return doc.save();
}
