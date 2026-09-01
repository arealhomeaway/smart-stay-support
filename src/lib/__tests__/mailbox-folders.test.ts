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
    expect(() => assertAllowedMailbox("someone.else@arealhomeaway.com")).toThrow(UnauthorizedMailboxError);
    expect(() => assertAllowedMailbox("")).toThrow(UnauthorizedMailboxError);
  });

  it("keeps the Inbox path available without making it the rule", () => {
    expect(inboxMessagesPath()).toContain("/mailFolders/Inbox/messages");
  });
});
