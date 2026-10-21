import { describe, expect, it } from "bun:test";
import { showsBreezeway, taskKind, uploadTitle } from "../onboarding-task-kind";

describe("what kind of work a step is", () => {
  it("treats a filing step as documents, with no dispatch tools", () => {
    const step = { title: "Confirm HOA covenant documents are stored in ARHA OneDrive" };
    expect(taskKind(step)).toBe("document");
    expect(showsBreezeway(step)).toBe(false);
    expect(uploadTitle(taskKind(step))).toBe("Documents for this step");
  });

  it("treats a dispatched job as vendor work and offers Breezeway", () => {
    const step = { title: "Create Work Order for installation of locks" };
    expect(taskKind(step)).toBe("vendor");
    expect(showsBreezeway(step)).toBe(true);
  });

  it("recognises utility and purchase steps", () => {
    expect(taskKind({ title: "Transfer trash service" })).toBe("utility");
    expect(taskKind({ title: "Purchase curtain panels" })).toBe("purchase");
  });

  it("does not offer Breezeway on a step that only mentions the word in passing", () => {
    expect(showsBreezeway({ title: "Send introduction e-mail to prospective owner" })).toBe(false);
  });
});
