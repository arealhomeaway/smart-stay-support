import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  approvalStrip,
  availableFrom,
  BANNED_SCREEN_WORDS,
  boardTiles,
  CC_ROLE_LINE,
  ccRecipients,
  DB_COPY,
  DEFAULT_REPLY_SUBJECT,
  DEFAULT_REPLY_TEMPLATE,
  DEFAULT_SEARCH_DISTANCE,
  DEFAULT_SETTINGS,
  feeLines,
  fillTemplate,
  followUpDue,
  followUpDueAt,
  HOME_BOOKING_COPY,
  homeDirectBookings,
  homeTag,
  isActiveOwnerHome,
  looksLikePartnerApproval,
  moveOutFromLength,
  readSettings,
  rentFor,
  replyValues,
  requestStatus,
  statusChip,
  stayDates,
  viewCounts,
  viewOf,
  VIEWS,
  type BoardRow,
  type QuoteHome,
} from "@/lib/direct-bookings";

/** The saved referral source records (live ids, Nov 8, 2026). */
const MYMETIS = "a0e95fa9-b49b-4799-84dc-2aa77e30aaad";
const OWL = "4154beb4-84bd-4e0c-825b-3aad9d73c632";
const TRAVELERS = "5056ffce-322d-43e1-888f-c9373550a453";
const OTHERS = {
  ALE: "ebe96df6-b834-40bb-940f-8a52f42e398d",
  Sirva: "8b196da5-cf33-4f59-9a79-0ca049e9ecfe",
  "Airbnb or VRBO": "95fe10b4-4087-4931-ae4f-8277489601bc",
  "Airbnb or VRBO Extension": "d9192c61-df67-42c7-8747-9eb4294bb73d",
  Reloquest: "2ce95feb-45af-496c-8608-a3a67fa92908",
};

describe("1. rent: the 5 percent discount follows the saved referral source record", () => {
  for (const [name, id] of [["MyMetis / Stay with Oasis", MYMETIS], ["Owl Marketplace", OWL], ["Travelers Haven", TRAVELERS]] as const) {
    it(`${name}: 3 bedroom $180 a night and $5,390 a month, 4 bedroom $189 and $5,670`, () => {
      expect(rentFor(3, id, DEFAULT_SETTINGS)).toEqual({ ok: true, nightly: 180, monthly: 5390, discountPercent: 5 });
      expect(rentFor(4, id, DEFAULT_SETTINGS)).toEqual({ ok: true, nightly: 189, monthly: 5670, discountPercent: 5 });
    });
  }
  it("every other source, and no source, is $189 / $5,670 and $199 / $5,970", () => {
    for (const id of [...Object.values(OTHERS), null, undefined]) {
      expect(rentFor(3, id, DEFAULT_SETTINGS)).toEqual({ ok: true, nightly: 189, monthly: 5670, discountPercent: 0 });
      expect(rentFor(4, id, DEFAULT_SETTINGS)).toEqual({ ok: true, nightly: 199, monthly: 5970, discountPercent: 0 });
    }
  });
  it("matches the record, never a typed name", () => {
    expect(rentFor(3, "MyMetis", DEFAULT_SETTINGS)).toMatchObject({ monthly: 5670 });
    expect(rentFor(3, "MyMetis / Stay with Oasis", DEFAULT_SETTINGS)).toMatchObject({ monthly: 5670 });
  });
  it("the live settings row (names only, no record list yet) still discounts the three records", () => {
    const live = readSettings({ approvalStart: "2026-11-09", approvalEnd: "2026-11-23", nightlyRates: { "3": 189, "4": 199 }, discountPercent: 5, discountSources: ["MyMetis", "Owl Marketplace", "Travelers Haven"] });
    expect(rentFor(3, MYMETIS, live)).toMatchObject({ nightly: 180, monthly: 5390 });
    const staged = readSettings({ ...live, discountSourceIds: [MYMETIS, OWL, TRAVELERS] });
    expect(rentFor(4, OWL, staged)).toMatchObject({ nightly: 189, monthly: 5670 });
  });
  it("the staged settings change saves the same three records", () => {
    const sql = readFileSync("docs/pending/direct-bookings-fix/05_discount_sources.sql", "utf8").replace(/^--.*$/gm, "");
    for (const id of [MYMETIS, OWL, TRAVELERS]) expect(sql).toContain(id);
    expect(sql.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)).toHaveLength(3);
  });
  it("2 and 5 bedroom stay unpriced; the nightly rate is the monthly rent / 30 to the dollar", () => {
    expect(rentFor(2, MYMETIS, DEFAULT_SETTINGS).ok).toBe(false);
    expect(rentFor(5, null, DEFAULT_SETTINGS).ok).toBe(false);
    const r = rentFor(3, MYMETIS, DEFAULT_SETTINGS);
    expect(r.ok && Number.isInteger(r.nightly)).toBe(true);
  });
});

const T0 = "2026-11-10T15:00:00Z";
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000);
const req = { created_at: T0, reply_sent_at: null };

describe("3. status chips with the clock", () => {
  it("counts down, then turns red at 3 minutes", () => {
    expect(statusChip("new", req, at(10))).toEqual({ text: "Opened just now. 3 minutes left.", tone: "brand", late: false });
    expect(statusChip("new", req, at(70))).toEqual({ text: "Opened 1 minute ago. 2 minutes left.", tone: "brand", late: false });
    expect(statusChip("working", req, at(179)).text).toBe("Opened 2 minutes ago. 1 minute left.");
    expect(statusChip("new", req, at(180))).toEqual({ text: "Waiting 3 minutes. Reply now.", tone: "escalated", late: true });
    expect(statusChip("working", req, at(4 * 60 + 5)).text).toBe("Waiting 4 minutes. Reply now.");
  });
  it("other states use the mockup words", () => {
    expect(statusChip("waiting_approval", req, at(30)).text).toBe("Waiting for a supervisor");
    const sent = { created_at: T0, reply_sent_at: T0 };
    expect(statusChip("sent", sent, at(60)).text).toBe("Quote sent. Follow up in 2 days");
    expect(statusChip("sent", sent, at(25 * 3600)).text).toBe("Quote sent. Follow up tomorrow");
    expect(statusChip("sent", sent, at(49 * 3600))).toEqual({ text: "Quote sent. Follow up now", tone: "waiting", late: false });
    expect(statusChip("sent", { ...sent, follow_up_due_at: "2026-11-20T15:00:00Z" }, at(60)).text).toBe("Quote sent. Follow up Nov 20");
    expect(statusChip("partner_approved", sent, at(60)).text).toBe("Approved by the partner");
    expect(statusChip("booked", sent, at(60)).text).toBe("Booked");
    expect(statusChip("not_booked", sent, at(60)).text).toBe("Not booked");
  });
  it("a partner approval moves a sent quote to its own status", () => {
    const base = { created_at: T0, owned_by: "u", reply_sent_at: T0, outcome: null, pending_approval: false };
    expect(requestStatus(base)).toBe("sent");
    expect(requestStatus({ ...base, partner_approved_at: T0 })).toBe("partner_approved");
    expect(requestStatus({ ...base, partner_approved_at: T0, outcome: "booked" })).toBe("booked");
  });
});

describe("4. the five views and three tiles", () => {
  const rows: BoardRow[] = [
    { status: "new", created_at: T0, reply_sent_at: null, outcome: null },
    { status: "working", created_at: "2026-11-10T15:02:00Z", reply_sent_at: null, outcome: null },
    { status: "waiting_approval", created_at: T0, reply_sent_at: null, outcome: null },
    { status: "sent", created_at: "2026-11-07T10:00:00Z", reply_sent_at: "2026-11-07T10:02:00Z", outcome: null },
    { status: "sent", created_at: T0, reply_sent_at: "2026-11-10T15:02:00Z", outcome: null },
    { status: "partner_approved", created_at: T0, reply_sent_at: "2026-11-07T10:02:00Z", outcome: null, partner_approved_at: T0 },
    { status: "booked", created_at: T0, reply_sent_at: T0, outcome: "booked" },
    { status: "not_booked", created_at: T0, reply_sent_at: T0, outcome: "not_booked" },
  ];
  it("views in order with counts", () => {
    expect(VIEWS.map((v) => v.label)).toEqual(["Open", "Waiting on the partner", "Approved", "Booked", "Not booked"]);
    expect(viewCounts(rows)).toEqual({ open: 3, partner: 2, approved: 1, booked: 1, not_booked: 1 });
    expect(viewOf("waiting_approval")).toBe("open");
  });
  it("tiles: Needs a reply, Waiting for a supervisor, Follow-ups due; red when a reply is late", () => {
    const early = boardTiles(rows, at(60));
    expect(early.map((t) => [t.label, t.value, t.red])).toEqual([
      ["Needs a reply", 2, false],
      ["Waiting for a supervisor", 1, false],
      ["Follow-ups due", 1, false],
    ]);
    const late = boardTiles(rows, at(200));
    expect(late[0]!.red).toBe(true);
    expect(late[1]!.red).toBe(true);
  });
});

describe("2. the Supervisor's red strip", () => {
  const pending = [{ lead_id: "b", requested_at: "2026-11-10T15:01:30Z" }, { lead_id: "a", requested_at: "2026-11-10T15:00:00Z" }];
  it("the Operations Supervisor sees every waiting quote and opens the oldest", () => {
    expect(approvalStrip(pending, { isSupervisor: true, isDirector: false }, DEFAULT_SETTINGS, at(100))).toEqual({ count: 2, text: "2 quotes are waiting for your OK", openId: "a" });
  });
  it("the Director of Operations sees quotes past the 2 minute wait", () => {
    expect(approvalStrip(pending, { isSupervisor: false, isDirector: true }, DEFAULT_SETTINGS, at(100))).toBeNull();
    expect(approvalStrip(pending, { isSupervisor: false, isDirector: true }, DEFAULT_SETTINGS, at(130))?.text).toBe("1 quote is waiting for your OK");
  });
  it("nobody else sees it", () => {
    expect(approvalStrip(pending, { isSupervisor: false, isDirector: false }, DEFAULT_SETTINGS, at(600))).toBeNull();
  });
});

describe("5. follow up due 48 hours after the quote", () => {
  const sent = { reply_sent_at: "2026-11-10T15:00:00Z", outcome: null };
  it("falls back to 48 hours after the quote or the last follow-up until the saved time exists", () => {
    expect(followUpDueAt(sent)).toBe("2026-11-12T15:00:00.000Z");
    expect(followUpDueAt({ ...sent, last_follow_up_at: "2026-11-13T09:00:00Z" })).toBe("2026-11-15T09:00:00.000Z");
    expect(followUpDueAt({ ...sent, follow_up_due_at: "2026-11-12T16:00:00Z" })).toBe("2026-11-12T16:00:00Z");
  });
  it("due only when sent, no outcome, not partner-approved, and the time has come", () => {
    expect(followUpDue(sent, new Date("2026-11-12T14:59:00Z"))).toBe(false);
    expect(followUpDue(sent, new Date("2026-11-12T15:00:00Z"))).toBe(true);
    expect(followUpDue({ ...sent, outcome: "booked" }, new Date("2026-11-20T00:00:00Z"))).toBe(false);
    expect(followUpDue({ ...sent, partner_approved_at: "2026-11-11T00:00:00Z" }, new Date("2026-11-20T00:00:00Z"))).toBe(false);
  });
  it("shows in Needs you now for the owner only", () => {
    const row = { id: "1", partner_name: "P", company: null, subject: null, created_at: "2026-11-10T14:58:00Z", reply_sent_at: "2026-11-10T15:00:00Z", owned_by: "owner", outcome: null };
    const due = new Date("2026-11-12T16:00:00Z");
    expect(homeDirectBookings([row], ["1"], "owner", due).map((r) => [r.id, r.followUp, r.waitingForStart])).toEqual([["1", true, false]]);
    expect(homeDirectBookings([row], ["1"], "someone-else", due)).toEqual([]);
    expect(homeDirectBookings([row], [], "owner", new Date("2026-11-11T16:00:00Z"))).toEqual([]);
    expect(HOME_BOOKING_COPY.followUp).toBe("Follow-up due. Check in with the partner in the same email thread.");
  });
  it("the staged functions store the due time on reply and after each follow-up", () => {
    const sql = readFileSync("docs/pending/direct-bookings-fix/02_guarded_actions.sql", "utf8");
    expect(sql.match(/follow_up_due_at = now\(\) \+ interval '48 hours'/g)).toHaveLength(2);
  });
});

const home = (o: Partial<QuoteHome> = {}): QuoteHome => ({
  name: "1200 Oak St",
  address: "1200 Oak St, Fort Worth, TX 76137",
  link: "https://example.test/oak",
  distanceMiles: 4.2,
  bedrooms: 3,
  bathrooms: 2,
  availability: "Nov 20, 2026",
  monthly: 5390,
  nightly: 180,
  ...o,
});
const fees = { cleaningFee: 350, applicationFee: 89, petFeePerDog: 250, dogs: 3, deposit: 1000 };

describe("6. the reply email in the approved format", () => {
  const values = (o: Partial<Parameters<typeof replyValues>[0]> = {}) =>
    replyValues({ contactName: "Brandin Smith", senderName: "Sam Lee", subject: "Fort Worth, TX 76137 - ALE Solutions", dates: "", homes: [home()], fees, addressGiven: true, ...o });

  it("one home, with an address given", () => {
    expect(fillTemplate(DEFAULT_REPLY_TEMPLATE, values())).toBe(
      [
        "Hello Brandin,",
        "",
        // Register D5 (Emily, Nov 9): the one home sentence.
        "This is the best option we have for you right now. If you would like the chance to view more homes, please let us know.",
        "",
        "Address: 1200 Oak St, Fort Worth, TX 76137",
        "Property Link: https://example.test/oak",
        "Distance to residence address: 4.2 miles",
        "Beds: 3",
        "Baths: 2",
        "Availability: Nov 20, 2026",
        "Nightly Rate: $180",
        "Monthly Rent: $5,390",
        "",
        "One Time Fees:",
        "Cleaning fee: $350",
        "Application fee: $89 (one adult required)",
        "Pet fee: $250/dog ($750 total)",
        "Refundable deposit: $1,000",
        "",
        "Please let us know if you have any questions.",
        "",
        "Thank you,",
        "Sam",
        "",
        "Customer Service",
        "3000 E Britton Rd.",
        "Oklahoma City, OK 73131",
        "405.415.2898 Ext. 0",
        "info@arealhomeaway.com",
        "www.arealhomeaway.com",
      ].join("\n"),
    );
    expect(fillTemplate(DEFAULT_REPLY_SUBJECT, values())).toBe("RE: Fort Worth, TX 76137 - ALE Solutions");
  });
  it("several homes: the other opening line, and no distance line without an address", () => {
    const body = fillTemplate(DEFAULT_REPLY_TEMPLATE, values({ homes: [home(), home({ name: "B", address: "B St", availability: "As soon as possible" })], addressGiven: false }));
    expect(body).toContain("Here are the homes we can offer:\n\nAddress: 1200 Oak St");
    expect(body).not.toContain("Distance to residence address");
    expect(body).toContain("Monthly Rent: $5,390\n\nAddress: B St");
    expect(body).toContain("Availability: As soon as possible");
  });
  it("fees: fixed order, no $0 lines, pet total only for more than one dog", () => {
    expect(feeLines({ ...fees, dogs: 1 })).toEqual(["Cleaning fee: $350", "Application fee: $89 (one adult required)", "Pet fee: $250/dog", "Refundable deposit: $1,000"]);
    expect(feeLines({ cleaningFee: 350, applicationFee: 0, petFeePerDog: 250, dogs: 0, deposit: 0 })).toEqual(["Cleaning fee: $350"]);
    const none = fillTemplate(DEFAULT_REPLY_TEMPLATE, values({ fees: { cleaningFee: 0, applicationFee: 0, petFeePerDog: 0, dogs: 0, deposit: null } }));
    expect(none).not.toContain("One Time Fees");
    expect(none).not.toMatch(/\n\n\n/);
    expect(none).not.toContain("$0");
  });
  it("the staged saved template is exactly the approved format", () => {
    const sql = readFileSync("docs/pending/direct-bookings-fix/04_reply_template.sql", "utf8");
    const body = sql.match(/body = E'([\s\S]*?)',\n/)![1]!.replace(/\\n/g, "\n");
    expect(body).toBe(DEFAULT_REPLY_TEMPLATE);
    expect(sql).toContain(`subject = '${DEFAULT_REPLY_SUBJECT}'`);
  });
});

describe("7. copies: always the two roles, never the COO", () => {
  it("the screen shows the two role names as fixed text", () => {
    expect(CC_ROLE_LINE).toBe("Operations Supervisor, Director of Operations");
  });
  it("sends to every holder of the two roles and never a COO holder", () => {
    expect(
      ccRecipients([
        { email: "Sup@x.test", roles: ["ops_supervisor"] },
        { email: "dir@x.test", roles: ["director_ops"] },
        { email: "coo@x.test", roles: ["coo"] },
        { email: "both@x.test", roles: ["director_ops", "coo"] },
        { email: "pc@x.test", roles: ["ge_day"] },
        { email: null, roles: ["ops_supervisor"] },
      ]),
    ).toEqual(["dir@x.test", "sup@x.test"]);
  });
  it("the server functions take no Cc from the screen", () => {
    const src = readFileSync("src/lib/direct-bookings.functions.ts", "utf8");
    const reply = src.slice(src.indexOf("const replyInput"), src.indexOf("type Reply ="));
    expect(reply).not.toMatch(/\bcc\b/);
    const follow = src.slice(src.indexOf("export const sendDirectBookingFollowUp"), src.indexOf("export const markDirectBookingPartnerApproved"));
    expect(follow).not.toMatch(/cc: z\./);
    expect(follow).toMatch(/cc: await ccEmails\(db\)/);
    expect(src.slice(src.indexOf("async function sendAndRecord"), src.indexOf("/** Sends to a supervisor"))).toMatch(/cc: await ccEmails\(db\)/);
  });
});

describe("8. the map and cards", () => {
  it("starts at 20 miles", () => {
    expect(DEFAULT_SEARCH_DISTANCE).toBe(20);
  });
  it("tags name the 30-day firm and short stay cases", () => {
    expect(homeTag("firm30", 0, null)).toBe("30-day firm home. Free for the whole stay.");
    expect(homeTag("free", 0, null)).toBe("Free for the whole stay.");
    expect(homeTag("shortStays", 2, "2026-11-22")).toBe("2 short stays in the way. Free from Nov 22.");
  });
  it("availability is the date the home becomes free, or the requested start", () => {
    expect(availableFrom("2026-11-20", [])).toBe("2026-11-20");
    expect(availableFrom("2026-11-20", [{ arrival: "2026-11-18", departure: "2026-11-22" }, { arrival: "2026-11-22", departure: "2026-11-24" }])).toBe("2026-11-24");
    expect(availableFrom("2026-11-20", [{ arrival: "2026-12-01", departure: "2026-12-04" }])).toBe("2026-11-20");
  });
});

describe("9. Section 1: as soon as possible and length of stay", () => {
  it("as soon as possible searches from today for the length given", () => {
    expect(stayDates({ desired_move_in: null, desired_check_out: null, asap: true, stay_length: "3 months" }, "2026-11-10")).toEqual({ checkIn: "2026-11-10", checkOut: "2027-02-10" });
    expect(stayDates({ desired_move_in: "2026-11-20", desired_check_out: null, asap: false, stay_length: "6 weeks" }, "2026-11-10")).toEqual({ checkIn: "2026-11-20", checkOut: "2027-01-01" });
    expect(stayDates({ desired_move_in: "2026-11-20", desired_check_out: "2027-01-20", asap: true, stay_length: "1 month" }, "2026-11-10")).toEqual({ checkIn: "2026-11-20", checkOut: "2027-01-20" });
    expect(stayDates({ desired_move_in: null, desired_check_out: null, asap: false, stay_length: "3 months" }, "2026-11-10")).toEqual({ checkIn: null, checkOut: null });
  });
  it("reads plain lengths and refuses anything else", () => {
    expect(moveOutFromLength("2026-01-31", "1 month")).toBe("2026-02-28");
    expect(moveOutFromLength("2026-11-10", "45 days")).toBe("2026-12-25");
    expect(moveOutFromLength("2026-11-10", "a while")).toBeNull();
  });
});

describe("10. wording", () => {
  it("buttons and help texts match the mockup", () => {
    expect(DB_COPY.startQuote).toBe("Start the quote");
    expect(DB_COPY.sendForOk).toBe("Send to a supervisor for OK");
    expect(DB_COPY.sendReply).toBe("Send reply");
    expect(DB_COPY.sendForOkHelp).toBe("A supervisor gets an alert and answers right away. It sends the moment they approve.");
    expect(DB_COPY.pickFirst).toBe("Pick at least one home first.");
    expect(DB_COPY.approvalSupervisor).toBe("Check the homes and the reply below. The clock is running.");
    expect(DB_COPY.approvalOthers).toBe("A supervisor has been alerted and is answering now. If there is no answer in 2 minutes, the director is alerted. It sends the moment they approve.");
    expect(DB_COPY.lostHint).toBe("A reason is required. We use these to see what we are losing.");
    expect(DB_COPY.followHint).toBe("It has been quiet. This goes in the same email thread. Cc: Operations Supervisor, Director of Operations");
    expect(DB_COPY.noHomes).toBe("No homes are free inside this distance. Try a wider distance.");
  });
  const screens = ["direct-bookings.index.tsx", "direct-bookings.$requestId.tsx", "direct-bookings.settings.tsx"].map((f) => readFileSync(`src/routes/_authenticated/${f}`, "utf8"));
  it("every button and field on the Direct Bookings screens is at least 44px tall", () => {
    for (const s of screens) {
      expect(s).not.toMatch(/size="sm"/);
      expect(s).not.toMatch(/\bh-(8|9|10)\b/);
      for (const tag of s.match(/<(Button|Input|select)\b[^>]*>/g) ?? []) {
        if (tag.includes('variant="ghost"')) continue;
        expect({ tag, tall: /min-h-1[12]|min-h-\[52px\]|h-11|\{FIELD|\{BTN|\{BIG|cn\((FIELD|BTN|BIG)/.test(tag) }).toEqual({ tag, tall: true });
      }
    }
  });
  it("no seat, Hit or Median, and no em dash in new on-screen words", () => {
    const copy = Object.values(DB_COPY).map((v) => (typeof v === "function" ? v("Partner") : v)).join(" ");
    for (const w of BANNED_SCREEN_WORDS) expect(copy).not.toMatch(w);
    expect(copy).not.toContain("—");
  });
});

describe("11. no person names", () => {
  const list = readFileSync("src/routes/_authenticated/direct-bookings.index.tsx", "utf8");
  const page = readFileSync("src/routes/_authenticated/direct-bookings.$requestId.tsx", "utf8");
  const fns = readFileSync("src/lib/direct-bookings.functions.ts", "utf8");
  it("the list and the request page never read names", () => {
    for (const s of [list, page]) {
      expect(s).not.toMatch(/\.names\b|owner_name|full_name/);
    }
    expect(DB_COPY.someoneElseOwns).toBe("A coordinator already owns this request.");
  });
  it("Start never hands a name to the screen", () => {
    const start = fns.slice(fns.indexOf("export const startDirectBooking"), fns.indexOf("export const saveDirectBookingDetails"));
    expect(start).toMatch(/return \{ won: r\.won \}/);
    expect(fns).not.toMatch(/async function names\(/);
  });
});

describe("13. Active Owner homes", () => {
  it("one rule: in the program or a 7D MAX home", () => {
    expect(isActiveOwnerHome("Oak 7D MAX", false)).toBe(true);
    expect(isActiveOwnerHome("Oak", true)).toBe(true);
    expect(isActiveOwnerHome("Oak 30D FIRM", false)).toBe(false);
  });
  it("the server refuses at send and at approval", () => {
    const fns = readFileSync("src/lib/direct-bookings.functions.ts", "utf8");
    const submit = fns.slice(fns.indexOf("export const submitDirectBookingReply"), fns.indexOf("export const decideDirectBookingApproval"));
    expect(submit.indexOf("assertNoActiveOwner")).toBeGreaterThan(-1);
    expect(submit.indexOf("assertNoActiveOwner") < submit.indexOf("request_direct_booking_approval")).toBe(true);
    const decide = fns.slice(fns.indexOf("export const decideDirectBookingApproval"), fns.indexOf("export const checkDirectBookingApprovals"));
    expect(decide.indexOf("assertNoActiveOwner") < decide.indexOf("decide_direct_booking_approval")).toBe(true);
    expect(DB_COPY.activeOwnerRefused).toBe("A home you picked is in the Active Owner program and cannot be offered. Remove it and pick another home.");
  });
});

describe("4. partner approval suggestion", () => {
  it("reads approvals and ignores not-yet replies", () => {
    expect(looksLikePartnerApproval("Good news, the adjuster approved the home. The family will call.")).toBe(true);
    expect(looksLikePartnerApproval("Please go ahead and send the lease.")).toBe(true);
    expect(looksLikePartnerApproval("This is not approved yet.")).toBe(false);
    expect(looksLikePartnerApproval("Waiting for the adjuster to approve.")).toBe(false);
    expect(looksLikePartnerApproval("Thanks, we will review.")).toBe(false);
  });
});
