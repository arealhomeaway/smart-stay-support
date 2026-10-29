import { Unzip, UnzipInflate } from "fflate";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, validateFile } from "./attachments";

export const ZIP_OPEN_ERROR = "Resolve couldn't open this ZIP here. Try on a computer, or unzip it and select the files.";
export const ZIP_SINGLE_ERROR = "This spot takes one file. Choose the file you need, or unzip and pick one.";
const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const isZip = (file: { name: string; type: string }) => /\.zip$/i.test(file.name) || ["application/zip", "application/x-zip-compressed"].includes(file.type);

/** Read chunks rather than buffering the ZIP. Blobs retain only extracted, supported file bytes. */
export async function openZip(archive: Blob, multiple = true): Promise<{ files: File[]; skipped: number }> {
  const files: File[] = [];
  let skipped = 0;
  try {
    // Require a complete central directory; fflate alone accepts some truncated archives.
    const tail = new Uint8Array(await archive.slice(Math.max(0, archive.size - 65557)).arrayBuffer());
    const view = new DataView(tail.buffer);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === tail.length) { end = i; break; }
    }
    if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new Error();
    const count = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
    if (count === 65535 || offset + directorySize > archive.size - tail.length + end) throw new Error();
    const directory = new DataView(await archive.slice(offset, offset + directorySize).arrayBuffer());
    let cursor = 0;
    for (let i = 0; i < count; i++) {
      if (directory.getUint32(cursor, true) !== 0x02014b50 || (directory.getUint16(cursor + 8, true) & 1)) throw new Error();
      cursor += 46 + directory.getUint16(cursor + 28, true) + directory.getUint16(cursor + 30, true) + directory.getUint16(cursor + 32, true);
    }
    if (cursor !== directorySize) throw new Error();
    const unzip = new Unzip(entry => {
      const parts = entry.name.replace(/\\/g, "/").split("/");
      const name = parts.at(-1) ?? "";
      if (!name || parts.some(part => part === "__MACOSX" || part.startsWith("."))) return;
      const type = mimeByExtension[name.split(".").at(-1)?.toLowerCase() ?? ""] ?? "";
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(type)) { skipped++; return; }
      const position = files.length;
      const placeholder = new File([], name, { type });
      files.push(placeholder);
      let size = 0;
      const chunks: BlobPart[] = [];
      entry.ondata = (error, chunk, final) => {
        if (error) throw error;
        size += chunk.length;
        if (size <= MAX_FILE_BYTES) chunks.push(new Uint8Array(chunk).buffer);
        if (final) {
          const file = size <= MAX_FILE_BYTES ? new File(chunks, name, { type }) : placeholder;
          if (size > MAX_FILE_BYTES) Object.defineProperty(file, "size", { value: size });
          validateFile(file); // The queue renders size/empty validation failures using the same rule.
          files[position] = file;
        }
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    // Slices also work on older mobile browsers without Blob.stream().
    for (let at = 0; at < archive.size; at += 65536) {
      const endAt = Math.min(archive.size, at + 65536);
      unzip.push(new Uint8Array(await archive.slice(at, endAt).arrayBuffer()), endAt === archive.size);
    }
    if (!multiple && files.length > 1) throw new Error(ZIP_SINGLE_ERROR);
    return { files, skipped };
  } catch (error) {
    throw new Error(error instanceof Error && error.message === ZIP_SINGLE_ERROR ? ZIP_SINGLE_ERROR : ZIP_OPEN_ERROR);
  }
}

export async function prepareUploadSelection(selection: File[], multiple: boolean) {
  const files: File[] = [], messages: string[] = [];
  let skipped = 0;
  for (const file of multiple ? selection : selection.slice(0, 1)) {
    if (!isZip(file)) { files.push(file); continue; }
    try { const opened = await openZip(file, multiple); files.push(...opened.files); skipped += opened.skipped; }
    catch (error) { messages.push(error instanceof Error ? error.message : ZIP_OPEN_ERROR); }
  }
  if (skipped) messages.push(`${skipped} files skipped: not a supported type.`);
  return { files, messages: [...new Set(messages)] };
}