import { describe, expect, test } from "bun:test";
import {
  clearDraft,
  draftIsFresh,
  draftIsWorthKeeping,
  draftKey,
  loadDraft,
  parseDraft,
  saveDraft,
  type EmailDraft,
} from "@/lib/email-draft-store";

function memoryStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const base: Omit<EmailDraft, "savedAt"> = {
  recipientKey: "owner@example.com",
  customTo: "",
  templateId: "t1",
  subject: "Roof repair",
  body: "We scheduled the roofer for Tuesday.",
  audience: "owner",
  mergeValues: { property: "Blue House" },
};

describe("email draft rescue", () => {
  test("keys are per record", () => {
    expect(draftKey("ticket", "a")).not.toBe(draftKey("ticket", "b"));
  });

  test("an empty draft is not worth keeping", () => {
    expect(draftIsWorthKeeping({ subject: "  ", body: "", customTo: "" })).toBe(false);
    expect(draftIsWorthKeeping({ subject: "", body: "hi", customTo: "" })).toBe(true);
  });

  test("saves and recovers every field, merge values included", () => {
    const s = memoryStore();
    saveDraft("ticket", "t-1", base, s);
    const back = loadDraft("ticket", "t-1", s);
    expect(back?.subject).toBe("Roof repair");
    expect(back?.recipientKey).toBe("owner@example.com");
    expect(back?.templateId).toBe("t1");
    expect(back?.audience).toBe("owner");
    expect(back?.mergeValues["property"]).toBe("Blue House");
  });

  test("an emptied draft removes the stored one", () => {
    const s = memoryStore();
    saveDraft("ticket", "t-1", base, s);
    saveDraft("ticket", "t-1", { ...base, subject: "", body: "", customTo: "" }, s);
    expect(loadDraft("ticket", "t-1", s)).toBeNull();
  });

  test("clearing after a send leaves nothing behind", () => {
    const s = memoryStore();
    saveDraft("ticket", "t-1", base, s);
    clearDraft("ticket", "t-1", s);
    expect(loadDraft("ticket", "t-1", s)).toBeNull();
  });

  test("unreadable or stale drafts are ignored", () => {
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(null)).toBeNull();
    const stale = JSON.stringify({ ...base, savedAt: "2020-01-01T00:00:00.000Z" });
    expect(parseDraft(stale)).toBeNull();
    expect(draftIsFresh({ savedAt: new Date().toISOString() })).toBe(true);
    expect(draftIsFresh({ savedAt: "nonsense" })).toBe(false);
  });

  test("a draft from another record is never offered", () => {
    const s = memoryStore();
    saveDraft("ticket", "t-1", base, s);
    expect(loadDraft("ticket", "t-2", s)).toBeNull();
  });
});
