import { describe, expect, it } from "bun:test";
import { DEFAULT_WELCOME, readWelcomeTemplate, renderWelcome, unknownPlaceholders } from "../owner-welcome";

const base = { ownerName: "Matthew Linder", propertyNames: ["1399 Foxtail"], portalLink: "https://x/owner" };

describe("owner welcome", () => {
  it("leaves the video line out when no video is set", () => {
    const m = renderWelcome(DEFAULT_WELCOME, { ...base, videoLink: null });
    expect(m.body).not.toContain("video");
    expect(m.body).not.toContain("{{");
  });
  it("includes the video link when set", () => {
    const m = renderWelcome(DEFAULT_WELCOME, { ...base, videoLink: "https://v/1" });
    expect(m.body).toContain("https://v/1");
  });
  it("greets by first name and lists every home", () => {
    const m = renderWelcome(DEFAULT_WELCOME, { ...base, propertyNames: ["A", "B"], videoLink: null });
    expect(m.body.startsWith("Hi Matthew,")).toBe(true);
    expect(m.body).toContain("ready for A and B");
  });
  it("starts as an unapproved draft", () => {
    expect(readWelcomeTemplate(null).review).toBe("draft");
  });
  it("rejects non-https video links", () => {
    expect(readWelcomeTemplate({ video: { kind: "link", url: "http://x" } }).video).toBeNull();
  });
  it("flags unknown fill-ins", () => {
    expect(unknownPlaceholders("Hi {{owner_name}}")).toEqual(["{{owner_name}}"]);
  });
});
