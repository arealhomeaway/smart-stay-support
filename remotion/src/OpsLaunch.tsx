import { AbsoluteFill, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Carlito";
import { Cap, Shot } from "./components/Shot";
import { LaunchIntro } from "./scenes/LaunchIntro";
import { SectionCard } from "./scenes/SectionCard";
import { LaunchOutro } from "./scenes/LaunchOutro";
import { C } from "./theme";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });

type Item =
  | { kind: "intro"; d: number }
  | { kind: "outro"; d: number }
  | { kind: "section"; d: number; n: string; title: string; line?: string }
  | {
      kind: "shot";
      d: number;
      src: string;
      chip: string;
      fx?: number;
      fy?: number;
      z0?: number;
      z1?: number;
      caps: Cap[];
    };

const cap = (at: number, dur: number, text: string, strong = false): Cap => ({ at, dur, text, strong });

export const ITEMS: Item[] = [
  { kind: "intro", d: 230 },

  // 1 — Operations queue
  { kind: "section", d: 130, n: "01", title: "The Operations Queue", line: "One place to see the work." },
  {
    kind: "shot",
    d: 250,
    src: "q-mine",
    chip: "Operations queue",
    fx: 0.32,
    fy: 0.22,
    z0: 1.02,
    z1: 1.14,
    caps: [
      cap(10, 100, "My work — everything you personally own."),
      cap(125, 105, "Clear queue? Then you check the team queue."),
    ],
  },
  {
    kind: "shot",
    d: 230,
    src: "q-team",
    chip: "Operations queue",
    fx: 0.36,
    fy: 0.24,
    z0: 1.04,
    z1: 1.16,
    caps: [cap(10, 95, "Team queue — every open Ticket across the portfolio."), cap(115, 95, "Nothing hides in someone's inbox.")],
  },
  {
    kind: "shot",
    d: 190,
    src: "q-unassigned",
    chip: "Operations queue",
    fx: 0.36,
    fy: 0.24,
    z0: 1.04,
    z1: 1.14,
    caps: [cap(10, 150, "Unassigned — nobody has picked it up yet.")],
  },
  {
    kind: "shot",
    d: 210,
    src: "q-escalated",
    chip: "Operations queue",
    fx: 0.42,
    fy: 0.26,
    z0: 1.04,
    z1: 1.16,
    caps: [cap(10, 170, "Escalated & breached — past a response standard.")],
  },
  {
    kind: "shot",
    d: 250,
    src: "q-all",
    chip: "Priorities",
    fx: 0.62,
    fy: 0.3,
    z0: 1.06,
    z1: 1.3,
    caps: [
      cap(10, 105, "Three priorities. That's it."),
      cap(120, 120, "P1 Critical · P2 High · P3 Standard", true),
    ],
  },

  // 2 — Working a ticket
  { kind: "section", d: 130, n: "02", title: "Working a Ticket", line: "Everything about the issue lives here." },
  {
    kind: "shot",
    d: 280,
    src: "t-top",
    chip: "Ticket",
    fx: 0.44,
    fy: 0.22,
    z0: 1.04,
    z1: 1.18,
    caps: [
      cap(10, 110, "Property, guest, priority and status — up top."),
      cap(130, 130, "The response standard tells you how fast this one moves."),
    ],
  },
  {
    kind: "shot",
    d: 240,
    src: "t-top",
    chip: "Ticket",
    fx: 0.88,
    fy: 0.72,
    z0: 1.2,
    z1: 1.45,
    caps: [cap(10, 200, "Guest and reservation context comes across automatically.")],
  },
  {
    kind: "shot",
    d: 250,
    src: "t-scroll0",
    chip: "Ticket",
    fx: 0.35,
    fy: 0.45,
    z0: 1.05,
    z1: 1.2,
    caps: [cap(10, 100, "The playbook lists what this type of work requires."), cap(120, 110, "Steps, evidence, and what 'done' means.")],
  },
  {
    kind: "shot",
    d: 240,
    src: "t-scroll1",
    chip: "Ticket",
    fx: 0.3,
    fy: 0.55,
    z0: 1.06,
    z1: 1.22,
    caps: [cap(10, 100, "Dispatch a vendor without leaving the Ticket."), cap(120, 105, "Blocked on someone else? Mark it waiting.")],
  },
  {
    kind: "shot",
    d: 250,
    src: "t-scroll2",
    chip: "Ticket",
    fx: 0.42,
    fy: 0.45,
    z0: 1.06,
    z1: 1.22,
    caps: [cap(10, 110, "Closing asks for the outcome, the summary and the evidence."), cap(130, 105, "Resolve won't close on a guess.")],
  },
  {
    kind: "shot",
    d: 270,
    src: "t-scroll3",
    chip: "Ticket",
    fx: 0.42,
    fy: 0.5,
    z0: 1.05,
    z1: 1.2,
    caps: [
      cap(10, 100, "Notes, photos, files and the full activity log."),
      cap(120, 135, "No more hunting through multiple systems.", true),
    ],
  },

  // 3 — Ownership and handoffs
  { kind: "section", d: 130, n: "03", title: "Ownership & Handoffs", line: "Work never falls between people." },
  {
    kind: "shot",
    d: 250,
    src: "t-scroll0",
    chip: "Ownership",
    fx: 0.88,
    fy: 0.78,
    z0: 1.18,
    z1: 1.4,
    caps: [cap(10, 100, "Every Ticket has one owner at a time."), cap(120, 110, "Assignment follows priority and time of day.")],
  },
  {
    kind: "shot",
    d: 250,
    src: "t-scroll1",
    chip: "Handoff",
    fx: 0.3,
    fy: 0.18,
    z0: 1.1,
    z1: 1.32,
    caps: [
      cap(10, 105, "Hand it off when it's genuinely someone else's next step."),
      cap(125, 110, "A handoff isn't done until it's accepted.", true),
    ],
  },
  {
    kind: "shot",
    d: 210,
    src: "ov-night2",
    chip: "Supervisor view",
    fx: 0.4,
    fy: 0.35,
    z0: 1.08,
    z1: 1.24,
    caps: [cap(10, 170, "Supervisors see anything that stalls — including unaccepted handoffs.")],
  },

  // 4 — Breezeway
  { kind: "section", d: 140, n: "04", title: "Breezeway Work Orders", line: "Inside Resolve." },
  {
    kind: "shot",
    d: 250,
    src: "h-ops",
    chip: "Breezeway",
    fx: 0.45,
    fy: 0.55,
    z0: 1.04,
    z1: 1.18,
    caps: [cap(10, 105, "Open a home, open Operations."), cap(125, 110, "Current Breezeway Work Orders, live at this property.")],
  },
  {
    kind: "shot",
    d: 270,
    src: "h-ops-list",
    chip: "Breezeway",
    fx: 0.55,
    fy: 0.4,
    z0: 1.06,
    z1: 1.26,
    caps: [
      cap(10, 110, "Create, update, close, reopen and approve — from here."),
      cap(130, 120, "Work in Resolve. Breezeway stays connected behind the scenes.", true),
    ],
  },
  {
    kind: "shot",
    d: 280,
    src: "h-photos",
    chip: "Breezeway photos",
    fx: 0.4,
    fy: 0.86,
    z0: 1.1,
    z1: 1.34,
    caps: [cap(10, 110, "Vendor photos from Breezeway show up in Resolve."), cap(130, 130, "No second tab, no second login.")],
  },
  {
    kind: "shot",
    d: 260,
    src: "h-comments",
    chip: "Breezeway comments",
    fx: 0.45,
    fy: 0.3,
    z0: 1.06,
    z1: 1.24,
    caps: [cap(10, 105, "Task and vendor comments come through too."), cap(125, 115, "Read the thread where the work lives.")],
  },
  {
    kind: "shot",
    d: 250,
    src: "h-comments2",
    chip: "Breezeway comments",
    fx: 0.55,
    fy: 0.45,
    z0: 1.08,
    z1: 1.28,
    caps: [cap(10, 100, "Reply straight back to the Work Order."), cap(120, 110, "Your name goes with the message.")],
  },

  // 5 — Evidence quality
  { kind: "section", d: 140, n: "05", title: "Evidence Quality", line: "Proof the work happened." },
  {
    kind: "shot",
    d: 260,
    src: "h-evidence",
    chip: "Evidence",
    fx: 0.45,
    fy: 0.35,
    z0: 1.06,
    z1: 1.24,
    caps: [cap(10, 110, "Resolve keeps its own proof for the work."), cap(130, 110, "Uploaded doesn't automatically mean verified.", true)],
  },
  {
    kind: "shot",
    d: 280,
    src: "h-evidence-ask",
    chip: "Evidence",
    fx: 0.5,
    fy: 0.5,
    z0: 1.25,
    z1: 1.45,
    caps: [
      cap(10, 115, "Ask for exactly the photo you need."),
      cap(140, 125, "If we can't verify it, Resolve asks for a better photo.", true),
    ],
  },
  {
    kind: "shot",
    d: 240,
    src: "an-top",
    chip: "Evidence",
    fx: 0.4,
    fy: 0.9,
    z0: 1.1,
    z1: 1.3,
    caps: [
      cap(10, 105, "Blurry, dark or wrong-subject photos come back with a reason."),
      cap(125, 105, "A supervisor can still accept with exception."),
    ],
  },

  // 6 — Oversight & after hours
  { kind: "section", d: 140, n: "06", title: "Oversight & After Hours", line: "Nothing sits quietly." },
  {
    kind: "shot",
    d: 270,
    src: "ov-top",
    chip: "Oversight",
    fx: 0.35,
    fy: 0.28,
    z0: 1.04,
    z1: 1.2,
    caps: [cap(10, 110, "Oversight shows exceptions only — what needs attention."), cap(130, 120, "Who's on call right now sits at the top.")],
  },
  {
    kind: "shot",
    d: 250,
    src: "ov-night",
    chip: "After hours",
    fx: 0.35,
    fy: 0.3,
    z0: 1.08,
    z1: 1.26,
    caps: [cap(10, 105, "After hours runs 10 p.m. to 8 a.m. Central."), cap(125, 110, "Overnight work is waiting for you in the morning.")],
  },
  {
    kind: "shot",
    d: 250,
    src: "ov-night2",
    chip: "After hours",
    fx: 0.4,
    fy: 0.45,
    z0: 1.06,
    z1: 1.24,
    caps: [
      cap(10, 110, "Grasshopper is still the after-hours phone line."),
      cap(130, 110, "Resolve keeps track of the work that comes from the call.", true),
    ],
  },

  // 7 — Property Hub
  { kind: "section", d: 130, n: "07", title: "The Property Hub", line: "Context stays with the home." },
  {
    kind: "shot",
    d: 240,
    src: "p-top",
    chip: "Property Hub",
    fx: 0.4,
    fy: 0.25,
    z0: 1.04,
    z1: 1.18,
    caps: [cap(10, 100, "Every home has a hub."), cap(115, 110, "Overview, details, contacts, onboarding, operations, files.")],
  },
  {
    kind: "shot",
    d: 220,
    src: "h-ops2",
    chip: "Property Hub",
    fx: 0.45,
    fy: 0.4,
    z0: 1.06,
    z1: 1.22,
    caps: [cap(10, 175, "Tickets and Work Orders stay attached to the property.")],
  },

  // 8 — Analytics
  { kind: "section", d: 130, n: "08", title: "Operations Analytics", line: "How the work is actually going." },
  {
    kind: "shot",
    d: 260,
    src: "an-top",
    chip: "Analytics",
    fx: 0.42,
    fy: 0.2,
    z0: 1.04,
    z1: 1.2,
    caps: [cap(10, 110, "Volume, response and resolution — at a glance."), cap(130, 115, "Clean reporting baseline from September 2.")],
  },
  {
    kind: "shot",
    d: 240,
    src: "an-top",
    chip: "Analytics",
    fx: 0.42,
    fy: 0.62,
    z0: 1.12,
    z1: 1.32,
    caps: [cap(10, 105, "Contribution shows where the work landed."), cap(125, 105, "It's a record of the work — not a scoreboard.")],
  },

  { kind: "outro", d: 300 },
];

export const OPS_LAUNCH_TOTAL = ITEMS.reduce((a, b) => a + b.d, 0);

export const OpsLaunch: React.FC = () => {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily, ["--brand-font" as string]: fontFamily }}>
      {ITEMS.map((it, i) => {
        const from = at;
        at += it.d;
        return (
          <Sequence key={i} from={from} durationInFrames={it.d}>
            {it.kind === "intro" ? (
              <LaunchIntro />
            ) : it.kind === "outro" ? (
              <LaunchOutro />
            ) : it.kind === "section" ? (
              <SectionCard n={it.n} title={it.title} line={it.line} />
            ) : (
              <Shot
                src={it.src}
                dur={it.d}
                chip={it.chip}
                fx={it.fx}
                fy={it.fy}
                z0={it.z0}
                z1={it.z1}
                caps={it.caps}
              />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
