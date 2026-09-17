import { describe, expect, it } from "bun:test";
import { saveOwnerReportFile } from "../owner-report-download";

describe("participation report downloads", () => {
  for (const [filename, mime] of [
    ["participation.pdf", "application/pdf"],
    ["participation.csv", "text/csv"],
  ] as const) {
    it(`keeps ${filename} available for asynchronous browser consumption`, async () => {
      const saved = [
        [globalThis, "document"],
        [globalThis, "setTimeout"],
        [URL, "createObjectURL"],
        [URL, "revokeObjectURL"],
      ].map(([target, key]) => ({
        target: target as object,
        key: key as string,
        descriptor: Object.getOwnPropertyDescriptor(target, key as string),
      }));
      const blobs = new Map<string, Blob>();
      const pending: (() => void)[] = [];
      let attached = false;
      let clicked = false;
      const link = {
        href: "",
        download: "",
        hidden: false,
        click() {
          expect(attached).toBe(true);
          expect(blobs.has(this.href)).toBe(true);
          clicked = true;
        },
        remove() {
          attached = false;
        },
      };
      const replace = (target: object, key: string, value: unknown) =>
        Object.defineProperty(target, key, { configurable: true, writable: true, value });
      try {
        replace(globalThis, "document", {
          createElement: () => link,
          body: {
            appendChild: () => {
              attached = true;
            },
          },
        });
        replace(globalThis, "setTimeout", (callback: () => void, delay: number) => {
          expect(delay).toBeGreaterThan(999);
          pending.push(callback);
        });
        replace(URL, "createObjectURL", (blob: Blob) => {
          blobs.set("blob:participation", blob);
          return "blob:participation";
        });
        replace(URL, "revokeObjectURL", (url: string) => blobs.delete(url));

        saveOwnerReportFile({ filename, mime, base64: "AID/Cg==" });

        expect(clicked).toBe(true);
        expect(link.download).toBe(filename);
        expect(link.hidden).toBe(true);
        // The browser can resolve the URL after the handler has already returned.
        const file = blobs.get(link.href);
        expect(file?.type).toBe(mime);
        expect(Array.from(new Uint8Array(await file!.arrayBuffer()))).toEqual([0, 128, 255, 10]);
        expect(attached).toBe(true);
        expect(pending.length).toBe(1);
        pending[0]!();
        expect(attached).toBe(false);
        expect(blobs.size).toBe(0);
      } finally {
        for (const { target, key, descriptor } of saved) {
          if (descriptor) Object.defineProperty(target, key, descriptor);
          else Reflect.deleteProperty(target, key);
        }
      }
    });
  }
});
