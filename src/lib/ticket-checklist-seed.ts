/**
 * Seed text for the six guided ticket checklists (Emily's "Resolve Ticket
 * Checklists: Draft for Review", Nov 4 2026). This file is only the source
 * for the pending seed data file and the tests: at runtime the app reads the
 * approved version stored on the playbook row, which Admins and the
 * Operations Director edit in Resolve.
 */
import type { ChecklistOption, ChecklistStep, ChecklistTemplate } from "@/lib/ticket-checklists";

const yes = (extra: Partial<ChecklistOption> = {}): ChecklistOption => ({ value: "yes", label: "Yes", ...extra });
const no = (extra: Partial<ChecklistOption> = {}): ChecklistOption => ({ value: "no", label: "No", ...extra });

const guestStep = (): ChecklistStep => ({
  key: "guest",
  label: "1",
  question: "Have you responded to the guest?",
  options: [
    { value: "yes", label: "Yes, responded" },
    { value: "not_yet", label: "Not yet", keepsOpen: true },
  ],
  activeGuestOnly: true,
  guestResponse: true,
  facts: ["guest"],
});

const refundStep = (label: string): ChecklistStep => ({
  key: "refund",
  label,
  question: "Does the guest need a refund or credit?",
  options: [yes({ action: "refund" }), no()],
  facts: ["refund_limits"],
});

const closeStep = (label: string, help?: string): ChecklistStep => ({
  key: "close",
  label,
  question: "Close the ticket. Is anything keeping the home from being guest-ready?",
  ...(help ? { help } : {}),
  options: [
    { value: "no", label: "No, close it", action: "close" },
    { value: "yes", label: "Yes", action: "follow_up", noteRequired: true, effect: "Opens a follow-up" },
  ],
});

export const SEED_TEMPLATES: ChecklistTemplate[] = [
  {
    category: "lockout",
    title: "Lockout or access problem",
    sopUrl: null,
    priority: { activeGuest: "p1", otherwise: "p2" },
    steps: [
      guestStep(),
      {
        key: "problem",
        label: "2",
        question: "Which problem?",
        options: [
          { value: "code", label: "Code not working" },
          { value: "dead", label: "Lock dead or offline" },
          { value: "wrong_code", label: "Lost or wrong code sent" },
          { value: "hardware", label: "Door or hardware broken" },
        ],
      },
      {
        key: "remote_fix",
        label: "3",
        question: "Try the remote fix on {lock_system}: resend the correct code, send the backup code, or reset the lock. Did it work?",
        options: [yes(), no()],
        facts: ["lock_system"],
      },
      {
        key: "inside",
        label: "3a",
        question: "Guest confirmed they're inside?",
        options: [yes({ goto: "lock_cause" })],
        showIf: { step: "remote_fix", answers: ["yes"] },
      },
      {
        key: "vendor",
        label: "4",
        question: "Send a vendor: locksmith or handyman from the vendor list, then Send to Breezeway or Email the work order.",
        options: [{ value: "sent", label: "Vendor sent" }],
        action: "fix_flow",
        showIf: { step: "remote_fix", answers: ["no"] },
      },
      {
        key: "vendor_wait",
        label: "5",
        question: "Waiting on vendor: appointment time set? Guest told when help is coming?",
        options: [yes()],
        showIf: { step: "remote_fix", answers: ["no"] },
      },
      {
        key: "lock_cause",
        label: "6",
        question: "Was the lock or code the cause?",
        options: [yes({ effect: "Flags the home for a lock check" }), no()],
      },
      refundStep("7"),
      closeStep("8"),
    ],
  },
  {
    category: "cleaning",
    title: "Cleaning complaint",
    sopUrl: null,
    priority: null,
    steps: [
      guestStep(),
      {
        key: "photos",
        label: "2",
        question: "Get photos or video from the guest.",
        options: [
          { value: "attached", label: "Attached" },
          { value: "wont_send", label: "Guest won't send" },
        ],
      },
      {
        key: "cleaner_notes",
        label: "3",
        question: "Check the cleaner's notes in Breezeway: marked clean? Dirty status left from a cancelled booking?",
        options: [{ value: "checked", label: "Notes checked" }],
        facts: ["last_stay"],
      },
      {
        key: "reclean",
        label: "4",
        question: "Offer a re-clean. Did they accept?",
        help: "A re-clean offer is required before a cleaning-fee refund.",
        options: [yes(), { value: "no", label: "No, refusal recorded", noteRequired: true }],
        facts: ["next_clean"],
      },
      {
        key: "reclean_done",
        label: "4a",
        question: "Schedule the re-clean through Breezeway. Done and guest satisfied?",
        options: [yes({ goto: "item" })],
        showIf: { step: "reclean", answers: ["yes"] },
      },
      {
        key: "fee_refund",
        label: "5",
        question: "Refund the cleaning fee first.",
        help: "Choose \"Cleaning fee\" in the refund form.",
        options: [{ value: "logged", label: "Refund logged", action: "refund" }],
        showIf: { step: "reclean", answers: ["no"] },
        facts: ["refund_limits"],
      },
      {
        key: "rent_comp",
        label: "6",
        question: "If still unhappy: escalate to rent compensation (refund limits apply).",
        options: [
          { value: "satisfied", label: "Guest is satisfied" },
          { value: "escalated", label: "Escalated to rent compensation", action: "refund" },
        ],
        showIf: { step: "reclean", answers: ["no"] },
        facts: ["refund_limits"],
      },
      {
        key: "item",
        label: "7",
        question: "Specific item cleaning hasn't fixed (stain, odor, damaged linen)?",
        options: [
          no(),
          { value: "repair", label: "Yes, open a work order", action: "fix_flow" },
          { value: "buy", label: "Yes, buy a replacement", action: "purchase" },
        ],
      },
      {
        key: "repeat",
        label: "8",
        question: "Repeat complaint for the same cleaner? If so, flag the cleaning team lead.",
        options: [{ value: "checked", label: "Checked" }],
      },
      closeStep("9"),
    ],
  },
  {
    category: "maintenance",
    title: "Maintenance or repair",
    sopUrl: null,
    priority: null,
    steps: [
      {
        key: "what",
        label: "1",
        question: "What's broken?",
        options: [
          { value: "hvac", label: "HVAC" },
          { value: "plumbing", label: "Plumbing" },
          { value: "electrical", label: "Electrical" },
          { value: "appliance", label: "Appliance" },
          { value: "handyman", label: "Handyman" },
          { value: "other", label: "Other" },
        ],
        fields: [{ key: "line", label: "One line", required: true, kind: "text" }],
      },
      { ...guestStep(), label: "2", facts: ["guest", "next_arrival"] },
      {
        key: "emergency",
        label: "3",
        question: "Emergency? (active leak, no heat or AC in extreme weather, safety hazard)",
        options: [yes({ noteRequired: true, effect: "Proceed now and record why. Owner approval can follow." }), no()],
      },
      {
        key: "vendor",
        label: "4",
        question: "Choose the vendor (suggested approved vendors for the trade and market).",
        options: [{ value: "chosen", label: "Vendor chosen" }],
        action: "fix_flow",
      },
      {
        key: "quote",
        label: "5",
        question: "Quote or estimated cost.",
        help: "Thresholds are per issue and cumulative.",
        options: [{ value: "saved", label: "Save" }],
        fields: [{ key: "amount", label: "Quote or estimate ($)", required: true, kind: "money" }],
        facts: ["repair_band"],
      },
      {
        key: "dispatch",
        label: "6",
        question: "Dispatch: Send to Breezeway or Email the work order.",
        options: [{ value: "sent", label: "Sent" }],
        action: "fix_flow",
      },
      {
        key: "owner_email",
        label: "7",
        question: "Owner email sent within 1 business day, CC Micah Sinor and James Miller?",
        options: [yes()],
        showIfApproval: { step: "quote", field: "amount", emergencyStep: "emergency" },
      },
      {
        key: "calendar",
        label: "8",
        question: "Calendar block needed?",
        options: [yes({ action: "calendar_block", effect: "Block in OwnerRez and notify the owner" }), no()],
      },
      {
        key: "done",
        label: "9",
        question: "Work done? Upload vendor photo or invoice.",
        options: [{ value: "uploaded", label: "Uploaded" }],
        action: "work_order",
      },
      {
        key: "after",
        label: "10",
        question: "Anything else to schedule after this fix (maintenance, staging, cleaner)? Anything keeping the home from guest-ready?",
        options: [no(), yes({ action: "follow_up", noteRequired: true, effect: "Opens a follow-up" })],
      },
      closeStep("11"),
    ],
  },
  {
    category: "other_complaint",
    title: "Other guest complaint",
    sopUrl: null,
    priority: null,
    steps: [
      guestStep(),
      {
        key: "about",
        label: "2",
        question: "About?",
        options: [
          { value: "wifi_tv", label: "Wi-Fi or TV" },
          { value: "missing", label: "Missing item or amenity" },
          { value: "noise", label: "Noise or neighbor" },
          { value: "listing", label: "Listing didn't match" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "remote",
        label: "3",
        question: "Fixed remotely?",
        options: [
          yes(),
          { value: "visit", label: "No, someone needs to go to the home", action: "fix_flow" },
          { value: "buy", label: "No, something needs buying", action: "purchase" },
        ],
      },
      {
        key: "safety",
        label: "4",
        question: "Noise or neighbor: safety concern?",
        options: [yes({ action: "escalate", effect: "Escalate to the Supervisor now" }), no()],
        showIf: { step: "about", answers: ["noise"] },
      },
      {
        key: "resolved",
        label: "5",
        question: "Guest confirmed resolved?",
        options: [yes(), { value: "not_yet", label: "Not yet", keepsOpen: true }],
        fields: [{ key: "next_update", label: "Next update time", required: false, kind: "datetime" }],
      },
      { ...refundStep("6"), question: "Refund or credit?" },
      {
        key: "listing",
        label: "7",
        question: "Listing or house manual change needed?",
        options: [yes({ noteRequired: true }), no()],
      },
      closeStep("8"),
    ],
  },
  {
    category: "damage",
    title: "Damage and claim",
    sopUrl: null,
    priority: null,
    steps: [
      {
        key: "what",
        label: "1",
        question: "What was damaged? Description and photos are required.",
        options: [{ value: "attached", label: "Photos attached" }],
        fields: [{ key: "description", label: "Description", required: true, kind: "text" }],
      },
      {
        key: "stay",
        label: "2",
        question: "Which stay caused it?",
        options: [
          { value: "confirmed", label: "Confirmed" },
          { value: "different", label: "A different stay", noteRequired: true },
        ],
        facts: ["last_stay"],
      },
      {
        key: "blocks",
        label: "3",
        question: "Stops the next check-in?",
        options: [yes({ action: "fix_flow", effect: "Urgent: opens the repair. Check whether a calendar block is needed." }), no()],
        facts: ["next_arrival"],
      },
      {
        key: "cost",
        label: "4",
        question: "Repair or replace: quote or receipt.",
        options: [{ value: "saved", label: "Save" }],
        fields: [{ key: "amount", label: "Amount ($)", required: true, kind: "money" }],
      },
      {
        key: "payer",
        label: "5",
        question: "Who pays? You propose; the Supervisor confirms only when the owner or ARHA pays.",
        options: [
          { value: "platform", label: "Guest via Airbnb or Vrbo claim", action: "claim" },
          { value: "deposit", label: "Security deposit", action: "claim" },
          { value: "owner", label: "Owner", action: "escalate", effect: "Supervisor confirms" },
          { value: "arha", label: "ARHA absorbs", action: "escalate", effect: "Supervisor confirms" },
        ],
      },
      {
        key: "filed",
        label: "6",
        question: "Claim filed? Record the platform deadline.",
        options: [{ value: "filed", label: "Filed", action: "claim" }],
        fields: [{ key: "deadline", label: "Platform deadline", required: true, kind: "datetime" }],
      },
      {
        key: "result",
        label: "7",
        question: "Received or denied?",
        options: [
          { value: "received", label: "Received" },
          { value: "denied", label: "Denied", action: "escalate", effect: "Goes to the Supervisor" },
          { value: "waiting", label: "Still waiting", keepsOpen: true },
        ],
      },
      closeStep("8", "Finance sees the result."),
    ],
  },
  {
    category: "booking",
    title: "Booking or reservation issue",
    sopUrl: null,
    priority: null,
    steps: [
      guestStep(),
      {
        key: "request",
        label: "2",
        question: "Request?",
        options: [
          { value: "dates", label: "Change dates" },
          { value: "early_late", label: "Early check-in or late checkout" },
          { value: "extend", label: "Extend stay" },
          { value: "cancel", label: "Cancel" },
          { value: "double", label: "Double booking" },
          { value: "payment", label: "Payment problem" },
        ],
      },
      {
        key: "free",
        label: "3",
        question: "Is the home free?",
        options: [yes(), no()],
        facts: ["reservation", "next_arrival"],
      },
      {
        key: "clean_ok",
        label: "3a",
        question: "Does the cleaning schedule allow it?",
        options: [yes({ effect: "Tell the cleaner" }), no()],
        showIf: { step: "request", answers: ["early_late"] },
        facts: ["next_clean"],
      },
      {
        key: "policy",
        label: "4",
        question: "Fits policy?",
        help: "Until a written rule exists, anything not plainly free on the calendar is an exception for the Supervisor.",
        options: [
          { value: "within", label: "Within policy" },
          { value: "exception", label: "Needs exception", action: "escalate" },
        ],
      },
      {
        key: "double",
        label: "5",
        question: "Double booking (P1). Which stay keeps the home?",
        help: "Relocation needs the Director regardless of cost.",
        options: [
          { value: "decided", label: "Decided" },
          { value: "relocate", label: "Relocation needed", action: "escalate", effect: "Needs the Director" },
        ],
        fields: [{ key: "keeps", label: "Stay that keeps the home", required: true, kind: "text" }],
        showIf: { step: "request", answers: ["double"] },
      },
      {
        key: "changed",
        label: "6",
        question: "Made the change in OwnerRez?",
        options: [yes()],
      },
      { ...refundStep("7"), question: "Refund or credit?" },
      closeStep("8"),
    ],
  },
];
