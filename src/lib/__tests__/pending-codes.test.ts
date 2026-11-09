import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { codeCheckedText, pendingCodesLine, showPendingCodes } from "@/lib/pending-codes";
import { canManageCredentials } from "@/lib/credentials.server";

// Emily, Nov 9: the old panel's waiting-for-review line, Mark current and Archive
// come back as a Pending codes line in Entry & Access Details, only for the roles
// that could use them before; codes stay behind the logged Show.

describe("Pending codes", () => {
  it("is for the same roles as before: Admin, Supervisor and Onboarding accounts", () => {
    expect(canManageCredentials({ userId: "u", roles: ["admin"] })).toBe(true);
    expect(canManageCredentials({ userId: "u", roles: ["manager"] })).toBe(true);
    expect(canManageCredentials({ userId: "u", roles: ["onboarding"] })).toBe(true);
    expect(canManageCredentials({ userId: "u", roles: ["tech"] })).toBe(false);
    expect(canManageCredentials({ userId: "u", roles: ["accounting"] })).toBe(false);
  });
  it("is hidden from everyone else and while viewing as someone else", () => {
    expect(showPendingCodes({ canManageCodes: true, readOnly: false })).toBe(true);
    expect(showPendingCodes({ canManageCodes: false, readOnly: false })).toBe(false);
    expect(showPendingCodes({ canManageCodes: true, readOnly: true })).toBe(false);
  });
  it("counts the import's codes waiting for review", () => {
    expect(pendingCodesLine(0)).toBe("Nothing waiting for review");
    expect(pendingCodesLine(1)).toBe("1 code from the import waiting for review");
    expect(pendingCodesLine(3)).toBe("3 codes from the import waiting for review");
  });
  it("shows when a code was last marked current", () => {
    expect(codeCheckedText(null)).toBe("Never checked");
    expect(codeCheckedText("2026-03-04")).toBe("Checked 3/4/2026");
  });
  it("sits inside Entry & Access Details and never reveals a code", () => {
    const src = readFileSync("src/components/property/HomeProfileTab.tsx", "utf8");
    expect(src).toContain('extra={section.id === "entry" ? pendingCodes : null}');
    const block = src.slice(src.indexOf("function PendingCodes("), src.indexOf("/** Scroll to an item"));
    expect(block).not.toContain("revealCredentialFn");
    expect(block).not.toContain("reveal(");
  });
});
