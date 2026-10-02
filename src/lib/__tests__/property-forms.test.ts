import { describe, it, expect } from "vitest";
import { formKeyForTitle, propertyForms } from "../property-forms";
import { ownerPreviewBuckets } from "../owner-view-preview";
const t = (id: string, title: string, status = "todo") => ({ id, title, status, assigned_to: null, updated_at: "2026-10-01", completed_at: null });
describe("property forms", () => {
  it("maps real template titles", () => {
    expect(formKeyForTitle("14. Complete Pre-Work review")).toBe("pre_work");
    expect(formKeyForTitle("15. Complete Standard installation and safety review")).toBe("standard");
    expect(formKeyForTitle("Complete New House Handoff form")).toBe("handoff_form");
  });
  it("returns the same task ids it was given", () => {
    const f = propertyForms([t("a", "16. Conduct the Mid-Project Review", "complete")]);
    const mid = f.find((x) => x.key === "mid_project")!;
    expect(mid.tasks[0].id).toBe("a");
    expect(mid.status).toBe("complete");
  });
});
describe("owner preview", () => {
  it("hides drafts and approvals on draft tasks", () => {
    const b = ownerPreviewBuckets(
      [{ id: "1", title: "D", owner_content: null, status: "draft", source: "arha", source_task_id: "T" },
       { id: "2", title: "V", owner_content: null, status: "sent", source: "arha", source_task_id: null }],
      [{ id: "p", title: "A", detail: null, entity_id: "T" }],
    );
    expect(b.visible.map((v) => v.id)).toEqual(["2"]);
    expect(b.draft.map((v) => v.id)).toEqual(["1"]);
  });
});
