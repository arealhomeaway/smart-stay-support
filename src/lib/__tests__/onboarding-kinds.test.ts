// Nov 12 build: kinds of onboarding Task, email fill-ins, vendor order, owner card rules.
import { describe, expect, it } from "bun:test";
import {
  completionBlock,
  drawerMiddle,
  effectiveTaskKind,
  emptyBrackets,
  fillBrackets,
  mainButtonLabel,
  orderVendors,
  type VendorRow,
} from "@/lib/onboarding-task-kinds";
import { boardGroup, cardLine, isArhaSetupStep, streetOnly } from "@/lib/owner-opportunity-board";
import { stripPlanRoleLine } from "@/lib/task-drawer";
import { suggestBreezewayHomes } from "@/lib/breezeway-match";

describe("each kind's main button and completion rule", () => {
  it("Do it: Complete; proof only when the step requires evidence", () => {
    expect(mainButtonLabel("do_it")).toBe("Complete");
    expect(completionBlock("do_it", { evidenceRequired: false })).toBeNull();
    expect(completionBlock("do_it", { evidenceRequired: true, proofNote: "abc" })).toBe("Add where the proof is, or attach a file.");
    expect(completionBlock("do_it", { evidenceRequired: true, proofNote: "in the folder" })).toBeNull();
    expect(completionBlock("do_it", { evidenceRequired: true, fileCount: 1 })).toBeNull();
  });
  it("Fill in Resolve: Save and complete once every field is filled", () => {
    expect(mainButtonLabel("fill_in")).toBe("Save and complete");
    expect(completionBlock("fill_in", { missingFields: ["Closing date"] })).toBe("Fill in Closing date.");
    expect(completionBlock("fill_in", { missingFields: [] })).toBeNull();
  });
  it("Upload files: at least one file", () => {
    expect(mainButtonLabel("upload_files")).toBe("Complete");
    expect(completionBlock("upload_files", { fileCount: 0 })).toBe("Upload at least one file.");
    expect(completionBlock("upload_files", { fileCount: 1 })).toBeNull();
  });
  it("Work order: no button; it follows Breezeway", () => {
    expect(mainButtonLabel("work_order")).toBeNull();
    expect(completionBlock("work_order", {})).toBe("Completes by itself when Breezeway marks the job done.");
  });
  it("Send to the homeowner: the main button sends", () => {
    expect(mainButtonLabel("send_to_owner")).toBe("Send to the homeowner");
    expect(completionBlock("send_to_owner", { sent: true })).toBeNull();
  });
  it("Send to the homeowner on a standard owner's home uses the step's fallback", () => {
    expect(drawerMiddle("send_to_owner", { fallback: "email" }, false)).toBe("email");
    expect(drawerMiddle("send_to_owner", { fallback: "outside_resolve" }, false)).toBe("outside_resolve");
    expect(drawerMiddle("send_to_owner", { fallback: "email" }, true)).toBe("send_to_owner");
  });
  it("Done outside Resolve: where and proof are both needed", () => {
    expect(completionBlock("outside_resolve", { where: null, outsideProof: "env 12345" })).toBe("Choose where it went.");
    expect(completionBlock("outside_resolve", { where: "docusign", outsideProof: "" })).toBe("Paste a link or envelope number, or upload a screenshot.");
    expect(completionBlock("outside_resolve", { where: "docusign", outsideProof: "env 12345" })).toBeNull();
    expect(completionBlock("outside_resolve", { where: "docusign", fileCount: 1 })).toBeNull();
  });
  it("Email: Send email; completes when it sends", () => {
    expect(mainButtonLabel("email")).toBe("Send email");
    expect(completionBlock("email", { sent: false })).toBe("Completes when the email sends.");
    expect(completionBlock("email", { sent: true })).toBeNull();
  });
  it("Vendor or team request: a reply or quote is attached", () => {
    expect(completionBlock("vendor_request", {})).toBe("Attach the reply or quote, or note it.");
    expect(completionBlock("vendor_request", { fileCount: 1 })).toBeNull();
  });
  it("Approval: Approve; completes when approved", () => {
    expect(mainButtonLabel("approval")).toBe("Approve");
    expect(completionBlock("approval", { approved: false })).toBe("Approve, or send it back with a note.");
    expect(completionBlock("approval", { approved: true })).toBeNull();
  });
  it("existing Tasks with no kind follow only the approved rule", () => {
    expect(effectiveTaskKind({ title: "Draft work order: Paint" })).toBe("work_order");
    expect(effectiveTaskKind({ title: "Work order: Fence" })).toBe("work_order");
    expect(effectiveTaskKind({ title: "Approve budget", requires_owner_approval: true })).toBe("send_to_owner");
    expect(effectiveTaskKind({ title: "Pick", owner_dependency: "business_decision" })).toBe("send_to_owner");
    expect(effectiveTaskKind({ title: "Email the owner an introduction" })).toBe("do_it");
    expect(effectiveTaskKind({ title: "x", task_kind: "email" })).toBe("email");
  });
});

describe("email fill-ins", () => {
  it("fills known [brackets] from the home and sender", () => {
    const out = fillBrackets("Hi [Owner first name], about [Property address]. [Your name]", {
      owner_first_name: "Ana",
      property_address: "101 Willow Way",
      sender_name: "Sam",
    });
    expect(out).toBe("Hi Ana, about 101 Willow Way. Sam");
    expect(emptyBrackets(out)).toEqual([]);
  });
  it("an empty [bracket] stays and blocks Send", () => {
    const out = fillBrackets("Hi [Owner first name], your inspection is [inspection date].", { owner_first_name: "Ana" });
    expect(emptyBrackets(out)).toEqual(["[inspection date]"]);
  });
});

describe("vendor list order", () => {
  const v = (name: string, first: boolean): VendorRow => ({
    orgId: name, name, contact: null, phone: null, email: null, usesBreezeway: false, homeFirstChoice: first, note: null,
  });
  it("the home's first-choice vendors come first, then by name", () => {
    expect(orderVendors([v("Acme", false), v("Zed", true), v("Bolt", false), v("Ace", true)]).map((r) => r.name)).toEqual([
      "Ace", "Zed", "Acme", "Bolt",
    ]);
  });
});

describe("owner portal fixes", () => {
  it("fix 25: an item the owner answered moves to With ARHA, not Needs your answer", () => {
    expect(boardGroup({ finished: false, locked: false, needsAnswer: true, newReply: false, optional: false, withArha: true })).toBe("with_arha");
    expect(boardGroup({ finished: false, locked: false, needsAnswer: true, newReply: true, optional: false, withArha: false })).toBe("answer");
  });
  it("fix 2: one short line, the first sentence cut at 90 characters", () => {
    expect(cardLine("Pick a paint color. Then tell us more.")).toBe("Pick a paint color.");
    const long = cardLine("a".repeat(120));
    expect(long.length).toBe(90);
  });
  it("fix 3: the street address only", () => {
    expect(streetOnly("101 Willow Way, Tulsa, OK 74104")).toBe("101 Willow Way");
  });
  it("fix 5: ARHA's setup step is not owner work", () => {
    expect(isArhaSetupStep("Activate your homeowner workspace")).toBe(true);
    expect(isArhaSetupStep("Choose your paint")).toBe(false);
  });
  it("fix 14: the plan role line is never shown", () => {
    expect(stripPlanRoleLine("Project plan role: Utilities\n\nCall the city.")).toBe("Call the city.");
  });
});

describe("B3 Breezeway match suggestions", () => {
  it("suggests only an active Breezeway home with the same street address that no home holds", () => {
    const homes = [
      { id: 1, name: null, address: "624 Daniel Ct", city: "X", status: "active" },
      { id: 2, name: null, address: "624 Daniel Court", city: "X", status: "inactive" },
      { id: 3, name: null, address: "625 Daniel Court", city: "X", status: "active" },
    ];
    expect(suggestBreezewayHomes("624 Daniel Court", homes, new Set()).map((h) => h.id)).toEqual([1]);
    expect(suggestBreezewayHomes("624 Daniel Court", homes, new Set(["1"]))).toEqual([]);
  });
});
