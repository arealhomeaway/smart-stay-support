import { unzipSync, strFromU8 } from "fflate";
import { validateSopFile } from "./sop-upload";

/** Browser-only parsing. Originals go to SharePoint, not attachment storage. */
export async function readSopText(file: File): Promise<string> {
  validateSopFile(file);
  let text = "";
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.docx$/i.test(file.name)) {
      const xml = unzipSync(bytes, { filter: (entry) => {
        if (entry.name === "word/document.xml" && entry.originalSize > 30 * 1024 * 1024) throw new Error("Document too large");
        return entry.name === "word/document.xml";
      } });
      const document = xml["word/document.xml"];
      if (!document || document.length > 30 * 1024 * 1024) throw new Error("Invalid document");
      const parsed = new DOMParser().parseFromString(strFromU8(document), "application/xml");
      if (parsed.querySelector("parsererror")) throw new Error("Invalid document");
      text = Array.from(parsed.getElementsByTagNameNS("*", "p")).map((p) => p.textContent ?? "").join("\n");
    } else {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => "str" in item ? item.str : "").join(" ") + "\n";
        }
      } finally { await pdf.destroy(); }
    }
  } catch { throw new Error("This document could not be read. Choose a readable Word or PDF file. Saved nothing."); }
  if (!text.trim()) throw new Error("This PDF has no readable text. Choose a text-based PDF or Word file. Saved nothing.");
  if (text.length > 180000) throw new Error("This SOP has too much text to read at once. Split it into smaller SOPs. Saved nothing.");
  return text.trim();
}