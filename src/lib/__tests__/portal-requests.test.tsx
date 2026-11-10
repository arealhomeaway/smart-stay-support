/**
 * Portal requests in Direct Bookings (Emily, Nov 9, register D8): the partner
 * portal link from the email, the no reply guard and "I answered in the
 * partner's portal". Fake message objects only; no mailbox is read.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  copyReplyText,
  findPortalLink,
  isNoReplyAddress,
  NO_REPLY_WARNING,
  PORTAL_COPY,
  portalAnswerState,
  portalLinkFrom,
  replyAddressState,
  type PortalState,
} from "@/lib/portal-requests";
import { NoReplyWarning, PartnerPortalButton, PortalAnswerPanel } from "@/components/direct-bookings/PortalAnswer";
import { createLeadFromEmail } from "@/lib/outlook-lead.server";
import { sendDirectBookingEmail } from "@/lib/direct-bookings-mail.server";
import { clockStart, replyClock, requestStatus, statusChip, viewOf } from "@/lib/direct-bookings";

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

describe("1. the partner portal link, per partner", () => {
  it("Owl Marketplace: the link in the text", () => {
    const text = "New housing request.\nView it here: https://source.owlmarketplace.com/incoming/121121\nThanks";
    expect(findPortalLink({ text })).toBe("https://source.owlmarketplace.com/incoming/121121");
  });

  it("Travelers Haven: the link hidden behind the View Details button (href only)", () => {
    const html = `<p>A new housing request is ready.</p>
      <table><tr><td><a href="https://www.travelershaven.com/portal/requests/88213?ref=email&amp;t=9" style="background:#0a5">View Details</a></td></tr></table>`;
    expect(findPortalLink({ content: html, contentType: "html", text: "A new housing request is ready. View Details" })).toBe(
      "https://www.travelershaven.com/portal/requests/88213?ref=email&t=9",
    );
  });

  it("ReloQuest and Realto (aleasetech) link shapes", () => {
    expect(findPortalLink({ content: `<a href='https://app.reloquest.com/rq/requests/RQ-5512'>Open request</a>`, contentType: "html" })).toBe(
      "https://app.reloquest.com/rq/requests/RQ-5512",
    );
    expect(findPortalLink({ content: `<a href=https://realto.aleasetech.com/inquiries/4410>Respond</a>`, contentType: "html" })).toBe(
      "https://realto.aleasetech.com/inquiries/4410",
    );
  });

  it("an unlisted host is ignored, and the first listed link is kept", () => {
    const html = `<a href="https://tracking.mailer.test/c/abc">Unsubscribe</a>
      <a href="https://owlmarketplace.com.evil.test/incoming/1">Fake</a>
      <a href="https://source.owlmarketplace.com/incoming/121121">View</a>
      <a href="https://source.owlmarketplace.com/incoming/999">Other</a>`;
    expect(findPortalLink({ content: html, contentType: "html" })).toBe("https://source.owlmarketplace.com/incoming/121121");
    expect(findPortalLink({ text: "See https://example.test/requests/5 and https://evil.test/?u=https://reloquest.com" })).toBeNull();
    expect(portalLinkFrom("javascript:alert(1)")).toBeNull();
    expect(portalLinkFrom("https://user:pw@reloquest.com/x")).toBeNull();
  });

  it("an Outlook Safe Links wrapper is opened to the partner link inside", () => {
    const wrapped = `https://nam12.safelinks.protection.outlook.com/?url=${encodeURIComponent("https://source.owlmarketplace.com/incoming/121121")}&data=05`;
    expect(findPortalLink({ content: `<a href="${wrapped.replace(/&/g, "&amp;")}">View</a>`, contentType: "html" })).toBe(
      "https://source.owlmarketplace.com/incoming/121121",
    );
  });

  it("intake stores the link on the request, and nothing when the host is not listed", async () => {
    const inserts: Record<string, unknown>[] = [];
    const fake = {
      from: (table: string) => ({
        insert: (row: Record<string, unknown>) => {
          if (table === "leads") inserts.push(row);
          return { select: () => ({ single: async () => ({ data: { id: "lead-1", contact_name: "Owl", source: "email" }, error: null }) }) };
        },
      }),
    };
    const source = {
      mailbox: "info@arealhomeaway.com", messageId: "m1", internetMessageId: null, conversationId: "c1", subject: "New request",
      fromName: "Owl Marketplace", fromAddress: "noreply@owlmarketplace.com", toRecipients: [], receivedAt: null, webLink: null,
      hasAttachments: false, attachments: [], trigger: "lead" as const,
    };
    await createLeadFromEmail(fake as never, {
      subject: "New request", body: "View Details", source,
      raw: { content: `<a href="https://source.owlmarketplace.com/incoming/121121">View Details</a>`, contentType: "html" },
    });
    await createLeadFromEmail(fake as never, {
      subject: "New request", body: "View Details", source,
      raw: { content: `<a href="https://evil.test/incoming/1">View Details</a>`, contentType: "html" },
    });
    expect(inserts[0]!["portal_link"]).toBe("https://source.owlmarketplace.com/incoming/121121");
    expect("portal_link" in inserts[1]!).toBe(false);
  });

  it("the request page button opens a new tab with no referrer, and shows nothing without a listed link", () => {
    const html = renderToStaticMarkup(<PartnerPortalButton href="https://source.owlmarketplace.com/incoming/121121" />);
    expect(html).toContain('href="https://source.owlmarketplace.com/incoming/121121"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain("Open in partner portal");
    expect(renderToStaticMarkup(<PartnerPortalButton href={null} />)).toBe("");
    expect(renderToStaticMarkup(<PartnerPortalButton href="https://evil.test/incoming/1" />)).toBe("");
  });
});

describe("2. the no reply guard", () => {
  it("recognises no reply senders and leaves real people alone", () => {
    for (const a of ["noreply@owlmarketplace.com", "no-reply@reloquest.com", "DoNotReply@travelershaven.com", "do-not-reply@x.test", "mailer-daemon@x.test", "notifications@aleasetech.com", "no_reply+req@x.test", "noreply-requests@x.test"])
      expect(isNoReplyAddress(a)).toBe(true);
    for (const a of ["jane@travelershaven.com", "replies@owlmarketplace.com", "norah@x.test", "notify-team@x.test", "", null])
      expect(isNoReplyAddress(a)).toBe(false);
  });

  it("the send buttons stay off for a no reply sender until a different, real address is typed", () => {
    const blocked = replyAddressState("noreply@owlmarketplace.com", "");
    expect(blocked).toMatchObject({ blocked: true, warning: NO_REPLY_WARNING });
    expect(replyAddressState("noreply@owlmarketplace.com", "no-reply@owlmarketplace.com").blocked).toBe(true);
    expect(replyAddressState("noreply@owlmarketplace.com", "jane@").blocked).toBe(true);
    expect(replyAddressState("noreply@owlmarketplace.com", "jane@company.test")).toMatchObject({ blocked: false, to: "jane@company.test", warning: null });
    expect(replyAddressState("jane@company.test", "")).toMatchObject({ blocked: false, to: "jane@company.test" });
  });

  it("the warning reads exactly as agreed", () => {
    expect(renderToStaticMarkup(<NoReplyWarning />)).toContain(
      "This sender does not read replies. Type the address to reply to, or answer in the partner&#x27;s portal.",
    );
  });

  it("the server refuses to send to a no reply sender with the same words", async () => {
    const attempt = sendDirectBookingEmail({} as never, {
      to: "noreply@owlmarketplace.com", cc: [], subject: "RE", body: "x", leadId: "l", threadMessageId: null, isDemo: false, sentBy: "u",
    });
    await expect(attempt).rejects.toThrow(NO_REPLY_WARNING);
    // Every send path checks before anything is sent: reply, approved reply, follow-up.
    const fns = read("src/lib/direct-bookings.functions.ts");
    expect(fns.match(/if \(isNoReplyAddress\(to\)\) throw new Error\(NO_REPLY_WARNING\);/g)).toHaveLength(2);
    expect(fns).toContain("if (isNoReplyAddress(reply.to)) throw new Error(NO_REPLY_WARNING);");
  });

  it("the request page turns Send and I sent it off while the address is blocked", () => {
    const page = read("src/routes/_authenticated/direct-bookings.$requestId.tsx");
    expect(page).toContain("disabled={busy || picked.length === 0 || !to || address.blocked}");
    expect(page).toContain("disabled={busy || address.blocked}");
    expect(page).toContain("{d.mailboxConnected && !noReply ? (");
  });
});

describe("3. I answered in the partner's portal", () => {
  const base: PortalState = { approvalRequiredNow: true, approved: false, pending: false, replySent: false, portalAnswered: false, finished: false, homesPicked: 1, note: "Quote 4471" };

  it("during the approval period only after the Supervisor has approved the quote", () => {
    expect(portalAnswerState(base)).toEqual({ allowed: false, reason: PORTAL_COPY.needsOk, needsOk: true });
    expect(portalAnswerState({ ...base, pending: true }).allowed).toBe(false);
    expect(portalAnswerState({ ...base, approved: true }).allowed).toBe(true);
  });

  it("after the period at any time, with a note and a home", () => {
    const after = { ...base, approvalRequiredNow: false };
    expect(portalAnswerState(after).allowed).toBe(true);
    expect(portalAnswerState({ ...after, note: "  " })).toMatchObject({ allowed: false, reason: PORTAL_COPY.noteNeeded });
    expect(portalAnswerState({ ...after, homesPicked: 0 })).toMatchObject({ allowed: false, reason: PORTAL_COPY.pickFirst });
    expect(portalAnswerState({ ...after, portalAnswered: true }).allowed).toBe(false);
    expect(portalAnswerState({ ...after, finished: true }).allowed).toBe(false);
  });

  it("the panel: the action is off before approval, on after, and Copy the reply is always there", () => {
    const panel = (s: PortalState) =>
      renderToStaticMarkup(<PortalAnswerPanel state={s} note={s.note} onNote={() => {}} onCopy={() => {}} onAnswer={() => {}} onAskOk={() => {}} />);
    const before = panel(base);
    expect(before).toMatch(/<button[^>]*disabled=""[^>]*data-action="portal-answer"/);
    expect(before).toContain('data-action="portal-ask-ok"');
    expect(before).toContain("Copy the reply");
    const after = panel({ ...base, approved: true });
    expect(after).not.toMatch(/<button[^>]*disabled=""[^>]*data-action="portal-answer"/);
    expect(after).toContain("I answered in the partner&#x27;s portal");
    expect(after).not.toContain('data-action="portal-ask-ok"');
  });

  it("Copy the reply copies the finished reply text", async () => {
    let copied = "";
    const text = await copyReplyText("\nHi Jane,\n\nHere are the homes we can offer:\n...\n", { writeText: async (t) => { copied = t; } });
    expect(copied).toBe("Hi Jane,\n\nHere are the homes we can offer:\n...");
    expect(text).toBe(copied);
  });

  it("the reply time is the one value: a portal answer reads exactly like an emailed reply", () => {
    const at = new Date("2026-11-10T15:10:00Z");
    const email = { created_at: "2026-11-10T15:00:00Z", reply_sent_at: "2026-11-10T15:02:30Z", reply_method: "email", owned_by: "u", outcome: null };
    const portal = { ...email, reply_method: "portal" };
    expect(replyClock(clockStart(portal), portal.reply_sent_at, at)).toEqual(replyClock(clockStart(email), email.reply_sent_at, at));
    expect(replyClock(clockStart(portal), portal.reply_sent_at, at)).toEqual({ seconds: 150, late: false, stopped: true });
    const status = requestStatus({ ...portal, pending_approval: false });
    expect(status).toBe("sent");
    expect(viewOf(status)).toBe("partner");
    expect(statusChip(status, portal, at).text).toMatch(/^Quote sent/);
  });

  it("the scorecard capture, the weekly packet and Oversight do not read the Direct Booking reply time today", () => {
    for (const f of ["src/lib/scorecard-capture.ts", "src/lib/scorecard-capture.functions.ts", "src/lib/scorecard.server.ts", "src/lib/scorecard.ts", "src/lib/oversight.ts", "src/lib/oversight-export.ts"])
      expect(read(f)).not.toMatch(/reply_sent_at|reply_method|portal_answered_at/);
  });
});
