import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Root cause of "the page itself does not prominently identify itself as
 * the Work Orders workspace": every other workspace's PageHeader `title`
 * (the large h1) matches its own sidebar nav label exactly — "My work" on
 * /tickets, "Team Queue" on /team-queue. Work Orders was the one page that
 * buried its identity in a small `eyebrow` ("Work orders") and used the
 * prominent title for something else ("Today"), which reads as a generic
 * heading rather than confirmation of which workspace this is.
 *
 * This locks in the corrected, now-consistent title.
 */
describe("work-orders.index.tsx — the page title identifies the workspace, like every sibling page", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../routes/_authenticated/work-orders.index.tsx"), "utf8");

  it('PageHeader title reads "Work Orders" — matching the sidebar nav label exactly', () => {
    expect(src).toContain('title="Work Orders"');
  });

  it("no longer hides the workspace name in a small eyebrow behind an unrelated title", () => {
    expect(src).not.toContain('eyebrow="Work Orders"');
    expect(src).not.toContain('title="Today"');
  });
});
