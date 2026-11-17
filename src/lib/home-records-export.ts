/**
 * Monthly home records: the printed record for one home's month (for the owner statement).
 * Same lines, statuses and totals as the screen and the CSV. No pay date is printed (BN12).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  HR_COPY, SECTIONS, STATUS_LABEL, homeTotals, missingLines, moneyText, monthLabel, sortLines, usDay, type RecordLine,
} from "./home-records";

function ascii(value: string): string {
  return value.replace(/[\u00b7\u2022]/g, "|").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "-");
}
function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = ascii(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

export async function homeRecordPdf(
  home: string,
  month: string,
  lines: RecordLine[],
  opts: { onboardingHome: boolean; generatedOn?: Date } = { onboardingHome: false },
): Promise<Uint8Array> {
  const generatedOn = opts.generatedOn ?? new Date();
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.09, 0.18, 0.27);
  const muted = rgb(0.38, 0.4, 0.44);
  const rule = rgb(0.8, 0.82, 0.85);
  const W = 792;
  const sorted = sortLines(lines);
  const totals = homeTotals(sorted);

  let page: PDFPage = pdf.addPage([W, 612]);
  let y = 0;
  const header = () => {
    page.drawRectangle({ x: 0, y: 566, width: W, height: 46, color: navy });
    page.drawText("MONTHLY HOME RECORD", { x: 38, y: 588, size: 13, font: bold, color: rgb(1, 1, 1) });
    page.drawText(fit(`${home}  |  ${monthLabel(month)}`, regular, 10.5, 560), { x: 38, y: 573, size: 10.5, font: regular, color: rgb(1, 1, 1) });
    const made = `Made ${usDay(generatedOn.toISOString().slice(0, 10))}`;
    page.drawText(made, { x: W - 38 - regular.widthOfTextAtSize(made, 9), y: 588, size: 9, font: regular, color: rgb(1, 1, 1) });
    y = 545;
  };
  const room = (need: number) => {
    if (y - need < 40) {
      page = pdf.addPage([W, 612]);
      header();
    }
  };
  const text = (t: string, x: number, size: number, font: PDFFont = regular, color = rgb(0, 0, 0), width = W - 76) =>
    page.drawText(fit(t, font, size, width), { x, y, size, font, color });
  header();

  // Totals
  const boxes: [string, number][] = [
    ["Billed to owner", totals.billedToOwner], ["Paid by ARHA", totals.paidByArha], ["Refunds and credits", totals.refunds],
    ["Recovered", totals.recovered], [HR_COPY.netLine, totals.net],
  ];
  boxes.forEach(([label, v], i) => {
    const x = 38 + i * 145;
    page.drawRectangle({ x, y: y - 30, width: 137, height: 40, borderColor: rule, borderWidth: 0.8 });
    page.drawText(fit(label, regular, 8.5, 127), { x: x + 6, y: y - 2, size: 8.5, font: regular, color: muted });
    page.drawText(moneyText(v), { x: x + 6, y: y - 21, size: 12, font: bold, color: navy });
  });
  y -= 44;
  text(`${HR_COPY.netLine}: ${HR_COPY.netHow}. Estimates are not counted.`, 38, 8.5, regular, muted);
  y -= 20;

  // What's missing
  const missing = missingLines(sorted);
  text(HR_COPY.missingTitle, 38, 11, bold, navy);
  y -= 14;
  if (!missing.length) {
    text(HR_COPY.nothingMissing, 38, 9.5);
    y -= 14;
  }
  for (const l of missing) {
    room(14);
    text(`- ${l.what}: ${l.note ?? "Missing"}${l.link ? ` (${l.link.label})` : ""}`, 44, 9.5);
    y -= 13;
  }
  y -= 8;

  if (!sorted.length) {
    room(20);
    text(HR_COPY.noRecords, 38, 11, bold);
    return pdf.save();
  }

  const cols = [38, 92, 300, 372, 462, 530, 612, 700] as const;
  const widths = [50, 202, 68, 86, 64, 78, 84, 54];
  const heads = ["Date", "What it was", "Ticket or Task", "Vendor", "Amount", "Billed to", "Approval", "Status"];
  for (const s of SECTIONS) {
    const own = sorted.filter((l) => l.section === s.key);
    // Onboarding costs show for homes in onboarding, as on screen.
    if (s.key === "onboarding" && !opts.onboardingHome && !own.length) continue;
    room(48);
    text(s.label, 38, 11, bold, navy);
    y -= 14;
    if (!own.length) {
      text(HR_COPY.noRecords, 38, 9, regular, muted);
      y -= 18;
      continue;
    }
    const heading = () => {
      heads.forEach((h, i) => page.drawText(h, { x: cols[i]!, y, size: 8.5, font: bold, color: navy }));
      y -= 5;
      page.drawLine({ start: { x: 38, y }, end: { x: W - 38, y }, thickness: 0.6, color: rule });
      y -= 12;
    };
    heading();
    for (const l of own) {
      if (y - 26 < 40) {
        page = pdf.addPage([W, 612]);
        header();
        text(`${s.label} (continued)`, 38, 11, bold, navy);
        y -= 14;
        heading();
      }
      const values = [
        l.date ? usDay(l.date) : "", l.what, l.link?.label ?? "", l.vendor ?? "", moneyText(l.amount), l.billedTo ?? HR_COPY.notRecorded,
        l.approval ?? "", STATUS_LABEL[l.status],
      ];
      values.forEach((v, i) => page.drawText(fit(v, regular, 8.5, widths[i]!), { x: cols[i]!, y, size: 8.5, font: regular }));
      y -= 11;
      const extra = [
        l.note,
        l.estimate != null ? `Estimate ${moneyText(l.estimate)}` : null,
        l.approved != null ? `Approved ${moneyText(l.approved)}` : null,
        l.paidBack != null ? `Paid back ${moneyText(l.paidBack)}` : null,
      ].filter(Boolean).join("  |  ");
      if (extra) {
        page.drawText(fit(extra, regular, 8, W - 168), { x: 92, y, size: 8, font: regular, color: muted });
        y -= 11;
      }
      y -= 3;
    }
    y -= 8;
  }
  return pdf.save();
}
