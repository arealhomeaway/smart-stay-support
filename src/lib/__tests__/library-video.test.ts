import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  LIBRARY_VIDEO_MAX_BYTES, isLibraryVideoPath, libraryVideoPath, msUntilRefresh, shouldRefreshSignedUrl,
  validateVideoFile, videoForOpportunity,
} from "../library-video";
import { VideoElement } from "../../components/owner/LibraryVideoPlayer";

const MB = 1024 * 1024;
describe("library video upload rule", () => {
  it("accepts a 129 MB MP4 and exactly 250 MB", () => {
    expect(validateVideoFile({ name: "journey.mp4", type: "video/mp4", size: 129 * MB })).toEqual({ ok: true, mime: "video/mp4" });
    expect(validateVideoFile({ name: "a.mov", type: "video/quicktime", size: LIBRARY_VIDEO_MAX_BYTES }).ok).toBe(true);
    expect(validateVideoFile({ name: "a.webm", type: "video/webm", size: 10 }).ok).toBe(true);
  });
  it("rejects anything over 250 MB", () => {
    expect(validateVideoFile({ name: "a.mp4", type: "video/mp4", size: LIBRARY_VIDEO_MAX_BYTES + 1 })).toEqual({ ok: false, reason: "Videos can be up to 250 MB." });
  });
  it("rejects the wrong type", () => {
    expect(validateVideoFile({ name: "a.pdf", type: "application/pdf", size: 10 }).ok).toBe(false);
    expect(validateVideoFile({ name: "a.avi", type: "video/x-msvideo", size: 10 }).ok).toBe(false);
  });
  it("uses the extension when the browser gives no type", () => {
    expect(validateVideoFile({ name: "clip.MOV", type: "", size: 10 })).toEqual({ ok: true, mime: "video/quicktime" });
  });
  it("keeps files inside the item's own private folder", () => {
    const p = libraryVideoPath("lib-1", "f", "video/mp4");
    expect(p).toBe("owner-library-video/lib-1/f.mp4");
    expect(isLibraryVideoPath("lib-1", p)).toBe(true);
    expect(isLibraryVideoPath("lib-2", p)).toBe(false);
    expect(isLibraryVideoPath("lib-1", "owner-library-video/lib-1/../x")).toBe(false);
  });
});

describe("playback link refresh", () => {
  it("refreshes two minutes before the link runs out", () => {
    const exp = 1_000_000;
    expect(shouldRefreshSignedUrl(exp, exp - 3 * 60_000)).toBe(false);
    expect(shouldRefreshSignedUrl(exp, exp - 60_000)).toBe(true);
    expect(msUntilRefresh(exp, exp - 30 * 60_000)).toBe(28 * 60_000);
    expect(msUntilRefresh(exp, exp + 1)).toBe(0);
  });
});

describe("started Opportunities follow the current library video", () => {
  it("looks up by source library item, so a replacement reaches started copies", () => {
    const index = new Map([["lib-1", { label: "Old" }]]);
    expect(videoForOpportunity("lib-1", index)?.label).toBe("Old");
    index.set("lib-1", { label: "New" });
    expect(videoForOpportunity("lib-1", index)?.label).toBe("New");
    expect(videoForOpportunity(null, index)).toBeNull();
  });
});

describe("player markup", () => {
  it("renders inline-capable controls, metadata preload, poster and never autoplays", () => {
    const html = renderToStaticMarkup(createElement(VideoElement, { src: "https://x/v.mp4", poster: "/p.jpg", mime: "video/mp4", label: "Watch" }));
    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain("playsInline");
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('poster="/p.jpg"');
    expect(html).not.toContain("autoplay");
    expect(html).not.toContain("autoPlay");
  });
});
