/**
 * Folder independence.
 *
 * Outlook rules move mail into the folder of the team that owns it — Team A,
 * Team B, Accounting, Direct Bookings / Mid Term Leads, Deliveries, Needs
 * Triage. A Resolve trigger category must work wherever the message sits, and
 * the mailbox itself must remain the only boundary.
 */
import { describe, expect, it } from "bun:test";
import {
  assertAllowedMailbox,
  authorizedMailbox,
  inboxMessagesPath,
  mailboxMessagesPath,
  UnauthorizedMailboxError,
} from "@/lib/mailbox-allowlist.server";

describe("where Resolve is allowed to read", () => {
  it("reads the mailbox, not one folder", () => {
    expect(mailboxMessagesPath()).toBe(`/users/${encodeURIComponent(authorizedMailbox())}/messages`);
    expect(mailboxMessagesPath()).not.toContain("mailFolders");
  });

  it("still refuses any other mailbox", () => {
    for (const bad of ["someone.else@arealhomeaway.com", ""]) {
      let caught: unknown = null;
      try {
        assertAllowedMailbox(bad);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(UnauthorizedMailboxError);
    }
  });

  it("keeps the Inbox path available without making it the rule", () => {
    expect(inboxMessagesPath()).toContain("/mailFolders/Inbox/messages");
  });
});

describe("retry reporting", () => {
  it("a message already carrying the created category counts as settled, not as a failed retry", async () => {
    const { retryCategory } = await import("@/lib/mailbox.server");
    const updates: unknown[] = [];
    const db = {
      from: () => ({
        update: (v: unknown) => {
          updates.push(v);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as never;
    const outcome = await retryCategory(
      db,
      { id: "AAMk1", categories: ["Resolve: ticket created", "P1"] },
      {
        id: "row-1",
        status: "created",
        error_message: "recategorise_pending",
        entity_id: "ticket-1",
        external_id: "AAMk1",
        created_at: new Date().toISOString(),
      },
    );
    // The Graph write had already landed — reporting this as `false` was the QA defect.
    expect(outcome).toBe("cleared");
    expect(updates).toEqual([{ error_message: null }]);
  });

  it("a retry with no record on file is still a failure", async () => {
    const { retryCategory } = await import("@/lib/mailbox.server");
    const outcome = await retryCategory({} as never, { id: "AAMk2" }, {
      id: "row-2",
      status: "created",
      error_message: "recategorise_pending",
      entity_id: null,
      external_id: "AAMk2",
      created_at: new Date().toISOString(),
    });
    expect(outcome).toBe("failed");
  });
});
