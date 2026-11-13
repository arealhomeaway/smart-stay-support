import { describe, expect, it } from "bun:test";
import { HISTORY_MISSED, savedToast, writeHistoryLine } from "../history-line";

describe("writeHistoryLine: a save never says done when its history line is lost", () => {
  it("saved on the first try: true, one write", async () => {
    let n = 0;
    expect(await writeHistoryLine(async () => (n++, { error: null }))).toBe(true);
    expect(n).toBe(1);
  });

  it("refused once, saved on the second try: true, two writes", async () => {
    let n = 0;
    expect(await writeHistoryLine(async () => (n++ === 0 ? { error: { message: "timeout" } } : { error: null }))).toBe(true);
    expect(n).toBe(2);
  });

  it("refused twice: false, and never more than two writes", async () => {
    let n = 0;
    expect(await writeHistoryLine(async () => (n++, { error: { message: "denied" } }))).toBe(false);
    expect(n).toBe(2);
  });

  it("a network failure counts as not saved", async () => {
    expect(await writeHistoryLine(async () => { throw new Error("offline"); })).toBe(false);
  });
});

describe("savedToast", () => {
  it("history saved: a plain success", () => {
    expect(savedToast("Claim updated", true)).toEqual({ tone: "success", message: "Claim updated." });
  });

  it("history lost: a warning that names it, never a plain success", () => {
    expect(savedToast("Claim updated", false)).toEqual({ tone: "warning", message: `Claim updated, but ${HISTORY_MISSED}.` });
  });

  it("plain words, no long dashes", () => {
    expect(savedToast("Handoff sent. You stay responsible until it is accepted", false).message).not.toContain("—");
  });
});
