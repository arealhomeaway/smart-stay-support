import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { buildLinkedSections, linkedFilesAllowed, resolveTemplateLinks, validateSources, type SourceFile } from "@/lib/step-file-links";

const A = "home-a";
const recv = { id: "pm", property_id: A };
const design = { id: "design", property_id: A, title: "Create the TV mount instructions", archived_at: null };
const link = (src: string, home = A) => ({ receiving_task_id: "pm", source_task_id: src, property_id: home, removed_at: null });
const file = (id: string, entity = "design", name = "tv-mounts.pdf"): SourceFile => ({
  id, entity_type: "onboarding_task", entity_id: entity, original_filename: name, title: name,
  uploaded_by_name: "Designer", uploaded_at: "2026-10-27T15:00:00Z", created_at: "2026-10-27T15:00:00Z",
  mime_type: "application/pdf", size_bytes: 10, kind: "document",
});

describe("Files flow between steps", () => {
  it("upload on the source appears on the receiver for the same home", () => {
    const s = buildLinkedSections(recv, [link("design")], [design], new Map([["design", [file("f1")]]]));
    expect(s).toHaveLength(1);
    expect(s[0]!.sourceTitle).toBe("Create the TV mount instructions");
    expect(s[0]!.files.map((f) => f.original_filename)).toEqual(["tv-mounts.pdf"]);
  });

  it("never shows a source on another home", () => {
    const other = { ...design, id: "other", property_id: "home-b" };
    expect(buildLinkedSections(recv, [link("other")], [other], new Map([["other", [file("f9", "other")]]]))).toEqual([]);
    expect(buildLinkedSections(recv, [link("design", "home-b")], [design], new Map([["design", [file("f1")]]]))).toEqual([]);
  });

  it("replaced file shows the latest; deleted file disappears (live list, no copies)", () => {
    const before = buildLinkedSections(recv, [link("design")], [design], new Map([["design", [file("v1", "design", "v1.pdf")]]]));
    expect(before[0]!.files.map((f) => f.id)).toEqual(["v1"]);
    const after = buildLinkedSections(recv, [link("design")], [design], new Map([["design", [file("v2", "design", "v2.pdf")]]]));
    expect(after[0]!.files.map((f) => f.id)).toEqual(["v2"]);
    const gone = buildLinkedSections(recv, [link("design")], [design], new Map([["design", []]]));
    expect(gone[0]!.files).toEqual([]);
  });

  it("receiver can never delete or re-share the source's files", () => {
    const s = buildLinkedSections(recv, [link("design")], [design], new Map([["design", [{ ...file("f1"), can_delete: true } as SourceFile]]]));
    expect(s[0]!.files[0]!.can_delete).toBe(false);
    expect(s[0]!.files[0]!.can_share).toBe(false);
  });

  it("permission matches the source: only files the viewer already sees on the source are passed in", () => {
    const s = buildLinkedSections(recv, [link("design")], [design], new Map());
    expect(s[0]!.files).toEqual([]);
  });

  it("homeowners and vendors never get linked files", () => {
    expect(linkedFilesAllowed(["owner"])).toBe(false);
    expect(linkedFilesAllowed(["vendor"])).toBe(false);
    expect(linkedFilesAllowed([])).toBe(false);
    expect(linkedFilesAllowed(["onboarding"])).toBe(true);
  });

  it("owner portal, Opportunities and vendor screens never include the linked-files section", () => {
    for (const f of [
      "src/lib/attachments.server.ts",
      "src/lib/v2-workflow.functions.ts",
      "src/components/onboarding/OwnerCollaboration.tsx",
    ]) expect(readFileSync(f, "utf8")).not.toContain("step-file-links");
  });

  it("no recursive chains: only the source's own uploads appear", () => {
    const s = buildLinkedSections(recv, [link("design")], [design], new Map([["design", [file("own"), file("shown-from-elsewhere", "third")]]]));
    expect(s[0]!.files.map((f) => f.id)).toEqual(["own"]);
  });

  it("no self-links and each source shown once", () => {
    expect(validateSources(recv, ["pm"], [design]).ok).toBe(false);
    const self = { ...design, id: "pm" };
    expect(buildLinkedSections(recv, [link("pm"), link("design"), link("design")], [self, design], new Map())).toHaveLength(1);
  });

  it("archived source shows 'Source step was removed'", () => {
    const s = buildLinkedSections(recv, [link("design")], [{ ...design, archived_at: "2026-10-27" }], new Map([["design", [file("f1")]]]));
    expect(s[0]).toMatchObject({ removed: true, files: [] });
  });

  it("manual link on an in-progress home validates same-home and live Tasks", () => {
    expect(validateSources(recv, ["design"], [design])).toEqual({ ok: true, ids: ["design"] });
    expect(validateSources(recv, ["x"], [{ ...design, id: "x", property_id: "home-b" }]).ok).toBe(false);
  });

  it("new home from template: step links map to that home's own Tasks only", () => {
    const made = new Map([["s-design", "t-design"], ["s-pm", "t-pm"]]);
    expect(resolveTemplateLinks([{ id: "s-design" }, { id: "s-pm", show_files_from: ["s-design", "s-pm", "s-missing"] }], made))
      .toEqual([{ receiving_task_id: "t-pm", source_task_id: "t-design" }]);
  });
});
