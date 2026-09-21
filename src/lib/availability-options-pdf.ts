import { PDFDocument, PDFString, StandardFonts, rgb } from "pdf-lib";
import { externalAvailabilityText, verifiedPublicListingUrl, type AvailabilityResult } from "./availability-finder";
import { ARHA_WHITE_LOGO_BASE64 } from "./arha-brand-logo";

function ascii(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "-");
}

/** Generates external-only wording. Internal conflict dates never enter this document. */
export async function propertyOptionsPdf(results: AvailabilityResult[], stay: { checkIn: string; checkOut: string; location: string }) {
  // A home with no verified public listing may still be included; its page simply carries no link.
  if (!results.length || results.some((result) => result.status === "unavailable" || (result.bookingUrl && !verifiedPublicListingUrl(result.bookingUrl))))
    throw new Error("Select Available or Conditional properties.");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.09, 0.18, 0.27);
  const teal = rgb(0.02, 0.43, 0.43);
  const brandLogo = await pdf.embedPng(ARHA_WHITE_LOGO_BASE64);
  for (const [index, result] of results.entries()) {
    const page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: navy });
    if (brandLogo) page.drawImage(brandLogo, { x: 38, y: 749, width: 54, height: 36 });
    page.drawText("A REAL HOME AWAY", { x: brandLogo ? 105 : 38, y: 761, size: 17, font: bold, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 38, y: 725, width: 42, height: 3, color: rgb(0.72, 0.39, 0.21) });
    page.drawText("PROPERTY OPTIONS", { x: 38, y: 709, size: 21, font: bold, color: navy });
    page.drawText(ascii(`${stay.checkIn} to ${stay.checkOut}  |  Near ${stay.location}`), { x: 38, y: 683, size: 11, font: regular });
    page.drawText(ascii(result.name).slice(0, 72), { x: 38, y: 640, size: 17, font: bold, color: teal });
    page.drawText(ascii(result.address).slice(0, 95), { x: 38, y: 620, size: 11, font: regular });
    page.drawText(`${result.distanceMiles.toFixed(1)} miles from requested location`, { x: 38, y: 600, size: 11, font: regular });
    let y = 580;
    if (result.imageUrl) {
      try {
        const response = await fetch(result.imageUrl);
        if (response.ok) {
          const bytes = await response.arrayBuffer();
          const type = response.headers.get("content-type") ?? "";
          const image = type.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const scale = Math.min(500 / image.width, 290 / image.height);
          const width = image.width * scale, height = image.height * scale;
          page.drawImage(image, { x: 38, y: y - height, width, height });
          if (result.bookingUrl) {
            const imageLink = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [38, y - height, 38 + width, y], Border: [0, 0, 0],
              A: { Type: "Action", S: "URI", URI: PDFString.of(result.bookingUrl) } });
            page.node.addAnnot(pdf.context.register(imageLink));
          }
          y -= height + 20;
        }
      } catch { /* The PDF stays useful when the image host blocks cross-origin fetches. */ }
    }
    page.drawText(`Bedrooms: ${result.bedrooms ?? "Not listed"}    Bathrooms: ${result.bathrooms ?? "Not listed"}    Guests: ${result.maxGuests ?? "Not listed"}`, {
      x: 38, y, size: 11, font: regular,
    });
    y -= 24;
    page.drawText(externalAvailabilityText(result), { x: 38, y, size: 11, font: bold, color: teal });
    y -= 30;
    if (result.bookingUrl) {
      const label = "View Property & Photos";
      page.drawRectangle({ x: 38, y: y - 7, width: 190, height: 29, color: teal });
      page.drawText(label, { x: 50, y: y + 2, size: 11, font: bold, color: rgb(1, 1, 1) });
      const annotation = pdf.context.obj({
        Type: "Annot", Subtype: "Link", Rect: [38, y - 7, 228, y + 22], Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(result.bookingUrl) },
      });
      page.node.addAnnot(pdf.context.register(annotation));
      y -= 25;
      page.drawText(ascii(result.bookingUrl).slice(0, 95), { x: 38, y, size: 8, font: regular, color: teal });
    } else {
      page.drawText("Photos and full details available on request.", { x: 38, y, size: 11, font: regular, color: navy });
    }
    page.drawText(`Option ${index + 1} of ${results.length}  |  Every home. Every guest. Every time.`, {
      x: 38, y: 34, size: 9, font: regular, color: navy,
    });
  }
  return pdf.save();
}
