/**
 * Guided tours (Admin, Nov 16): two team tours that walk the real screens.
 * The one rule for who sees which tour, the sections and every step's wording.
 * Steps only look: the tour never creates or changes a record (src/components/tours/GuidedTour.tsx).
 */
import type { AccessSeats, AppRole } from "@/lib/permissions";

export type TourTeam = "operations" | "onboarding";

/** A CSS selector, or a button/tab/link found by the start of its visible label. */
export type TourTarget = string | { text: string; within?: string; exact?: boolean; closest?: string };

export type TourStepDef = {
  id: string;
  /** Page to open. "$ticket", "$home" and "$task" become a real record the person can already see. */
  to: string;
  /** Page shown when no record can be found (the step then shows centered). */
  fallbackTo?: string;
  page: string;
  /** Plain words for the report: what the step points at. */
  element: string;
  target: TourTarget[] | null;
  title: string;
  body: string;
};

export type TourSection = {
  id: string;
  title: string;
  /** "leads": Operations Supervisor, Director of Operations and Admin only. */
  audience?: "leads";
  steps: TourStepDef[];
};

export type TourStep = TourStepDef & { section: string; sectionId: string };
export type TourPlaceIds = { ticket: string | null; home: string | null; task: string | null };

const HELP_BUTTON: TourTarget[] = ["[data-help-feedback][aria-label='Help & Feedback']"];
const TAKE_TOUR: TourTarget[] = ["[data-tour='take-tour']"];
const needsYouNow: TourTarget = { text: "Needs you now", within: "h2, h3, header p, header div", closest: "section" };

const OPERATIONS: TourSection[] = [
  {
    id: "ops-home",
    title: "Home and your shift",
    steps: [
      { id: "ops-welcome", to: "/dashboard", page: "Home", element: "None (centered)", target: null, title: "Welcome to Resolve", body: "This tour walks the screens you use every shift. Press Next to move on, Back to go back, or Skip to stop." },
      { id: "ops-menu", to: "/dashboard", page: "Home", element: "Home in the left menu", target: ["[data-tour='dashboard']"], title: "Your menu", body: "The left menu holds your pages. Home is where every shift starts." },
      { id: "ops-my-shift", to: "/dashboard", page: "Home", element: "My shift card", target: ["[data-my-shift]"], title: "My shift", body: "My shift shows your hours today, your lunch time and the tickets you own. Check it when you start." },
      { id: "ops-needs-you", to: "/dashboard", page: "Home", element: "Needs you now card", target: [needsYouNow], title: "Needs you now", body: "Needs you now lists what waits on you: handoffs to accept, approvals and alerts. Clear it before you pick up new work." },
      { id: "ops-lunch", to: "/dashboard", page: "Home", element: "Before lunch prompt", target: ["[data-lunch-prompt]"], title: "Before lunch", body: "About 15 minutes before lunch, Resolve asks you to hand off any Right now or time sensitive work. Press Hand off before lunch so nothing waits while you are away." },
      { id: "ops-record", to: "/dashboard", page: "Home", element: "Record work and Record routine work buttons", target: ["[data-testid='top-bar-work-actions']", "[data-tour='log']"], title: "Record work", body: "Press Record work for every new guest message or home problem. It makes one ticket with an owner and a clock. Record routine work is for the regular checks." },
    ],
  },
  {
    id: "ops-queue",
    title: "Take a ticket from the Team Queue",
    steps: [
      { id: "ops-queue-menu", to: "/team-queue", page: "Team Queue", element: "Team Queue in the left menu", target: ["[data-tour='team-queue']"], title: "Team Queue", body: "Team Queue holds work nobody owns yet. Open it whenever you can take more." },
      { id: "ops-queue-teams", to: "/team-queue", page: "Team Queue", element: "Team chips", target: [{ text: "Team A", exact: true }, { text: "All unclaimed" }], title: "Choose a team", body: "Pick your team, or All unclaimed. The most urgent and oldest work is at the top." },
      { id: "ops-queue-wait", to: "/team-queue", page: "Team Queue", element: "Pick up work list", target: [{ text: "Pick up work", within: "h1, h2, h3" }, { text: "Take it", exact: true, closest: "li, article, [role=row], div" }], title: "Pick up work", body: "Each row shows the home, the problem and how long it has waited. A red time means it is late." },
      { id: "ops-queue-take", to: "/team-queue", page: "Team Queue", element: "Take it button", target: [{ text: "Take it", exact: true }], title: "Take it", body: "Press Take it to make the ticket yours. Its clock is now yours, so start right away." },
    ],
  },
  {
    id: "ops-ticket",
    title: "Work a ticket",
    steps: [
      { id: "ops-ticket-now", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Do this now", target: ["[data-current-work]"], title: "Do this now", body: "The top of every ticket says what to do next. Follow it one step at a time." },
      { id: "ops-ticket-urgency", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Urgency on the ticket", target: ["[data-tour='ticket-urgency']"], title: "Urgency", body: "Urgency is Right now, Today or Routine. It sets how fast you must answer. Only a Supervisor changes it, from More." },
      { id: "ops-ticket-clock", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "About this ticket (response clock inside)", target: ["[data-testid='details-about'] > summary"], title: "Response clock", body: "Open About this ticket to see the response clock. It shows how long you have to answer. Late tickets alert the Supervisor." },
      { id: "ops-ticket-guide", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Guided checklist (inside Do this now)", target: ["[data-checklist-tools]", "[data-current-work]"], title: "Guided checklist", body: "The guided checklist walks you through the problem: what to ask the guest, what to try and when to send a vendor. Tick each step as you do it." },
      { id: "ops-ticket-notes", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Activity (Add note inside)", target: ["[data-testid='details-activity'] > summary"], title: "Notes", body: "Open Activity and press Add note each time something happens. The next person reads it, so say what you did and what is next." },
      { id: "ops-ticket-files", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Evidence (photos and files inside)", target: ["[data-testid='details-evidence'] > summary", { text: "Add photos" }], title: "Photos and files", body: "Open Evidence to add photos and files. Some tickets cannot close until the proof is added." },
      { id: "ops-ticket-more", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "More button", target: [{ text: "More", exact: true }], title: "More", body: "More holds assignment, escalation and Handoffs. Use it when the ticket needs someone else." },
    ],
  },
  {
    id: "ops-breezeway",
    title: "Breezeway work orders on a ticket",
    steps: [
      { id: "ops-bw-card", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Breezeway work order card", target: ["[data-testid='breezeway-repair-link']", { text: "Does this need a field repair?" }], title: "Breezeway work order", body: "Breezeway holds every work order. Resolve makes none. When a ticket needs a repair, link its Breezeway work order here." },
      { id: "ops-bw-link", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Link work order button", target: [{ text: "Link work order" }], title: "Link work order", body: "Press Link work order and pick this home's order from the list." },
      { id: "ops-bw-linked", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Linked work order", target: ["[data-testid='linked-breezeway-order']"], title: "Follow the repair", body: "Once linked, the ticket shows the order's status, who is assigned, comments and photos. Check it before you update the guest." },
      { id: "ops-bw-close", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Do this now", target: ["[data-current-work]"], title: "Until it is fixed", body: "Keep the ticket open until the repair is done and you have checked it. Then tell the guest." },
    ],
  },
  {
    id: "ops-sources",
    title: "Arrival checks and email tickets",
    steps: [
      { id: "ops-arrival", to: "/team-queue", page: "Team Queue", element: "From OwnerRez group", target: [{ text: "From OwnerRez", within: "button, h2, h3, h4, p, span" }], title: "Arrival checks", body: "Before a guest arrives, an arrival check ticket comes in from OwnerRez. It shows in this group with its due time." },
      { id: "ops-arrival-due", to: "/team-queue", page: "Team Queue", element: "Due time on the row", target: [{ text: "Due ", within: "span, p" }], title: "Due time", body: "The due time turns red in the last 30 minutes. Take it and finish the check before the guest gets there." },
      { id: "ops-email", to: "/team-queue", page: "Team Queue", element: "From email group", target: [{ text: "From email", within: "button, h2, h3, h4, p, span" }], title: "Email tickets", body: "Emails to the team inbox become tickets here, marked Email." },
      { id: "ops-email-work", to: "/team-queue", page: "Team Queue", element: "Take it button", target: [{ text: "Take it", exact: true }], title: "Work them the same way", body: "An email ticket is a normal ticket with a clock and alerts. Press Take it and answer from the ticket." },
    ],
  },
  {
    id: "ops-handoff",
    title: "Hand off a ticket, Accept and Decline",
    steps: [
      { id: "ops-ho-more", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "More button", target: [{ text: "More", exact: true }], title: "Hand this off", body: "To pass a ticket on, open More, then Handoffs, and press Hand this off." },
      { id: "ops-ho-write", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "None (centered)", target: null, title: "Write it clearly", body: "Write what is done so far, the next step and when it is due. The person who gets it should not need to ask you anything." },
      { id: "ops-ho-still", to: "/tickets/$ticket", fallbackTo: "/team-queue", page: "A ticket", element: "Do this now", target: ["[data-current-work]"], title: "Still yours until accepted", body: "Until the other person accepts, the ticket is still yours. Keep watching it." },
      { id: "ops-ho-inbox", to: "/team-queue", page: "Team Queue", element: "Handoffs waiting for you group", target: [{ text: "Handoffs waiting for you", within: "button, h2, h3, h4, p, span" }], title: "Handoffs to you", body: "When someone hands you a ticket, it shows here and in Needs you now on Home." },
      { id: "ops-ho-accept", to: "/team-queue", page: "Team Queue", element: "Accept button", target: [{ text: "Accept", exact: true }], title: "Accept", body: "Read the notes, then press Accept. The ticket is now yours." },
      { id: "ops-ho-decline", to: "/team-queue", page: "Team Queue", element: "Decline button", target: [{ text: "Decline", exact: true }], title: "Decline", body: "If it is not yours, press Decline and write the reason. It goes back to the sender." },
    ],
  },
  {
    id: "ops-end-shift",
    title: "End my shift",
    steps: [
      { id: "ops-end-button", to: "/dashboard", page: "Home", element: "End my shift button", target: ["[data-end-shift]"], title: "End my shift", body: "Press End my shift before you sign off, every shift." },
      { id: "ops-end-list", to: "/dashboard", page: "Home", element: "My shift card", target: ["[data-my-shift]"], title: "Hand off what you own", body: "Resolve lists every ticket you still own. For each one, write done so far, next step and due, then send." },
      { id: "ops-end-nothing", to: "/dashboard", page: "Home", element: "None (centered)", target: null, title: "Nothing to hand off", body: "If you own nothing, press Nothing to hand off. The Supervisor sees who ended their shift and who did not." },
      { id: "ops-end-next", to: "/dashboard", page: "Home", element: "Needs you now card", target: [needsYouNow], title: "Next shift", body: "Your next shift starts here. Anything handed to you waits in Needs you now." },
    ],
  },
  {
    id: "ops-databases",
    title: "Databases and Tickets",
    steps: [
      { id: "ops-db-menu", to: "/databases", page: "Databases", element: "Databases in the left menu", target: ["[data-tour='databases']"], title: "Databases", body: "Databases holds every list: tickets, homes, vendors, claims and more." },
      { id: "ops-db-tickets", to: "/databases", page: "Databases", element: "Tickets card", target: [{ text: "Tickets", within: "a, button" }], title: "Tickets", body: "Open Tickets to find any ticket, open or closed." },
      { id: "ops-db-older", to: "/databases/tickets", page: "Databases, Tickets", element: "Older open tab", target: ["[data-tab='older_open']"], title: "Older open", body: "Older open holds older tickets that were still open when they came over. They are quiet: no clocks and no alerts." },
      { id: "ops-db-move", to: "/databases/tickets", page: "Databases, Tickets", element: "Move to queue button", target: [{ text: "Move ", within: "button" }], title: "Move to queue", body: "The Operations Supervisor and Director of Operations can select older tickets and press Move to queue. They then show on the Team Queue as normal work." },
    ],
  },
  {
    id: "ops-oversight",
    title: "Oversight and Shift handoffs",
    audience: "leads",
    steps: [
      { id: "ops-ov-menu", to: "/oversight", page: "Oversight", element: "Oversight in the left menu", target: ["[data-tour='oversight']"], title: "Oversight", body: "Oversight shows what is late or stuck across the team. The number on it counts waiting handoffs and missed shift ends." },
      { id: "ops-ov-esc", to: "/oversight", page: "Oversight", element: "Escalations", target: [{ text: "Escalations", within: "h2, h3, header p, header div", closest: "section" }], title: "Escalations", body: "Escalations lists tickets past their clock. Act on the oldest first." },
      { id: "ops-ov-load", to: "/oversight", page: "Oversight", element: "Workload by person", target: [{ text: "Workload by person", within: "h2, h3, header p, header div", closest: "section" }], title: "Workload", body: "Workload by person shows who carries how much, so you can share work fairly." },
      { id: "ops-sh-tab", to: "/shift-handoffs", page: "Shift handoffs", element: "Shift handoffs tab", target: [{ text: "Shift handoffs", within: "a, [role=tab]", exact: true }], title: "Shift handoffs", body: "Shift handoffs shows today's shifts, who pressed End my shift and every handoff." },
      { id: "ops-sh-top", to: "/shift-handoffs", page: "Shift handoffs", element: "Page heading", target: ["main h1"], title: "Start at the top", body: "Missed shift ends come first, then Right now handoffs waiting over 15 minutes, in red. Follow up on those first." },
      { id: "ops-sh-filters", to: "/shift-handoffs", page: "Shift handoffs", element: "Date and team filters", target: ["[data-filter='date']", "[data-filter='team']"], title: "Look back", body: "Use the date and team filters to look back up to 14 days, for Team A, Team B or both." },
    ],
  },
  {
    id: "ops-help",
    title: "Text, Call and Help",
    steps: [
      { id: "ops-text-call", to: "/dashboard", page: "Home", element: "None (centered)", target: null, title: "Text and Call", body: "Call and text guests and owners from Grasshopper, so they see the company number. Never use your personal number." },
      { id: "ops-help-button", to: "/dashboard", page: "Home", element: "? Help & Feedback button", target: HELP_BUTTON, title: "Help & Feedback", body: "The ? button is on every page. It opens Help & guides and lets you report a problem." },
      { id: "ops-help-report", to: "/dashboard", page: "Home", element: "? Help & Feedback button", target: HELP_BUTTON, title: "Send feedback", body: "Choose Report a problem or suggestion and say what happened. It goes to Help Tickets, not the Team Queue. My reports shows where it stands." },
      { id: "ops-help-replay", to: "/dashboard", page: "Home", element: "Take the tour button", target: TAKE_TOUR, title: "Replay any time", body: "Press Take the tour to see this again. The Help page lets you replay one part." },
    ],
  },
];

const ONBOARDING: TourSection[] = [
  {
    id: "onb-home",
    title: "Onboarding Home and the homes list",
    steps: [
      { id: "onb-welcome", to: "/onboarding", page: "Onboarding Home", element: "None (centered)", target: null, title: "Welcome to Resolve", body: "This tour walks the screens you use to set up a home. Press Next to move on, Back to go back, or Skip to stop." },
      { id: "onb-menu", to: "/onboarding", page: "Onboarding Home", element: "Onboarding Home in the left menu", target: ["[data-tour='onboarding-Onboarding Home']", "[data-tour='onboarding']"], title: "Onboarding Home", body: "Onboarding Home is your start point. It lists every home being set up." },
      { id: "onb-projects", to: "/onboarding", page: "Onboarding Home", element: "Active projects and All projects tabs", target: ["[aria-label='Projects']"], title: "Active and past homes", body: "Active projects shows homes in setup now. All projects also shows homes already handed off." },
      { id: "onb-views", to: "/onboarding", page: "Onboarding Home", element: "View buttons", target: [{ text: "Gallery", exact: true }, { text: "Workload", exact: true }], title: "Views", body: "Switch between the list, Gallery, By status, Gantt and Workload. Workload shows how many homes each person carries." },
      { id: "onb-list", to: "/onboarding", page: "Onboarding Home", element: "Homes list", target: ["main table"], title: "The homes list", body: "Each row is one home with its stage, team and dates. Click a home to open its page." },
    ],
  },
  {
    id: "onb-add",
    title: "Add a home",
    steps: [
      { id: "onb-add-button", to: "/onboarding", page: "Onboarding Home", element: "Add a home button", target: [{ text: "Add a home", within: "button" }], title: "Add a home", body: "Press Add a home when a new home signs. Every onboarding role can add one." },
      { id: "onb-add-find", to: "/onboarding", page: "Onboarding Home", element: "None (centered)", target: null, title: "Find the home", body: "Search OwnerRez for the home first. If it is not there yet, type the name and address." },
      { id: "onb-add-team", to: "/onboarding", page: "Onboarding Home", element: "None (centered)", target: null, title: "Team and dates", body: "Choose Under contract, or Add as Upcoming if it is not signed yet. Then pick the team and the dates." },
      { id: "onb-add-done", to: "/onboarding", page: "Onboarding Home", element: "Homes list", target: ["main table"], title: "Ready to work", body: "The home then shows in this list with its plan ready." },
    ],
  },
  {
    id: "onb-page",
    title: "A home's page",
    steps: [
      { id: "onb-tabs", to: "/onboarding/$home", fallbackTo: "/onboarding", page: "A home", element: "Home tabs", target: ["[data-testid='home-tab-bar']"], title: "One page per home", body: "Each home has tabs: Overview, Tasks, Owner, Home details, Vendors and work, Files, Budget and Activity." },
      { id: "onb-project", to: "/onboarding/$home?tab=details&section=project", fallbackTo: "/onboarding", page: "A home, Home details", element: "Project section", target: ["#home-details-project"], title: "Project", body: "Project shows the Telegram group and the LOA status. Check both early, because Operations needs them." },
      { id: "onb-owner", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "Owner tab", target: ["#owner-needs-action", "[aria-label='About the owner']"], title: "Owner", body: "The Owner tab shows what the owner still needs to do, how to reach them and their Active Owner program." },
      { id: "onb-files", to: "/onboarding/$home?tab=files", fallbackTo: "/onboarding", page: "A home, Files", element: "Folders", target: ["[aria-label='Folders']"], title: "Files and folders", body: "Files are kept in folders. Pick a folder to see its files." },
      { id: "onb-move", to: "/onboarding/$home?tab=files", fallbackTo: "/onboarding", page: "A home, Files", element: "Move to on a file", target: [{ text: "Move to" }, "[aria-label='Add files']"], title: "Move to", body: "Press Move to on a file to put it in the right folder. Nothing is deleted." },
      { id: "onb-vendors", to: "/onboarding/$home?tab=vendors", fallbackTo: "/onboarding", page: "A home, Vendors and work", element: "Vendors for this home", target: ["[aria-label='Vendors for this home']"], title: "Vendors", body: "Vendors and work lists this home's vendors. The preferred way to reach each one is marked (preferred). Use that one first." },
    ],
  },
  {
    id: "onb-tasks",
    title: "Tasks and the Task drawer",
    steps: [
      { id: "onb-tasks-tab", to: "/onboarding/$home?tab=tasks", fallbackTo: "/onboarding", page: "A home, Tasks", element: "Tasks tab", target: [{ text: "Tasks", within: "[data-testid='home-tab-bar'] a, [data-testid='home-tab-bar'] button, [role=tab]", exact: true }], title: "Tasks", body: "Tasks is the plan for this home, stage by stage. Late Tasks are summed up at the top." },
      { id: "onb-drawer", to: "/onboarding/$home?tab=tasks&task=$task", fallbackTo: "/onboarding", page: "A home, Task drawer", element: "Task drawer", target: ["[role='dialog'][data-state='open']"], title: "The Task drawer", body: "Click a Task to open its drawer. It shows what to do, who owns it and when it is due." },
      { id: "onb-drawer-assign", to: "/onboarding/$home?tab=tasks&task=$task", fallbackTo: "/onboarding", page: "A home, Task drawer", element: "Assigned to and Due date", target: ["[aria-label='Assigned to']", "[aria-label='Due date']", { text: "Assigned to", within: "[role='dialog'] p", exact: true, closest: "div.grid" }], title: "Owner and due date", body: "Check who it is assigned to and when it is due. Changes are saved with who and when." },
      { id: "onb-drawer-proof", to: "/onboarding/$home?tab=tasks&task=$task", fallbackTo: "/onboarding", page: "A home, Task drawer", element: "Mark done", target: ["[data-tour=\"task-mark-done\"]"], title: "Mark done", body: "When the work is done, press Mark done. The next steps and owner cards open by themselves." },
      { id: "onb-drawer-folder", to: "/onboarding/$home?tab=tasks&task=$task", fallbackTo: "/onboarding", page: "A home, Task drawer", element: "Folder picker for uploads", target: ["[role='dialog'] [aria-label='Folder']"], title: "Uploads go into a folder", body: "Pick one of the five folders first, then add the files. They go straight into that folder on the Files tab." },
    ],
  },
  {
    id: "onb-catch-up",
    title: "Plan catch-up",
    steps: [
      { id: "onb-cu-select", to: "/onboarding/$home?tab=tasks", fallbackTo: "/onboarding", page: "A home, Tasks", element: "Select all open", target: [{ text: "Select all open" }, "main input[type='checkbox'], main [role='checkbox']"], title: "Update many Tasks", body: "Plan catch-up updates many Tasks at once. Tick the Tasks, or press Select all open." },
      { id: "onb-cu-bar", to: "/onboarding/$home?tab=tasks", fallbackTo: "/onboarding", page: "A home, Tasks", element: "Selected Tasks bar", target: ["[aria-label='Selected Tasks'] button"], title: "The action bar", body: "A bar appears at the bottom: Mark done, Not needed for this home, Assign to and Change due date." },
      { id: "onb-cu-done", to: "/onboarding/$home?tab=tasks", fallbackTo: "/onboarding", page: "A home, Tasks", element: "None (centered)", target: null, title: "Mark done", body: "Mark done asks for one proof note. Pick Earlier for work done before today. An owner approval Task done this way is saved as Approved outside Resolve with your note, and nothing is sent to the owner." },
      { id: "onb-cu-not-needed", to: "/onboarding/$home?tab=tasks", fallbackTo: "/onboarding", page: "A home, Tasks", element: "None (centered)", target: null, title: "Not needed", body: "Not needed for this home asks for a reason. Tasks that cannot be saved are listed with the reason, and the rest are saved." },
      { id: "onb-cu-undo", to: "/onboarding/$home?tab=tasks", fallbackTo: "/onboarding", page: "A home, Tasks", element: "None (centered)", target: null, title: "Undo", body: "Made a mistake? Press Undo within 10 minutes and the Tasks go back as they were." },
    ],
  },
  {
    id: "onb-active-owner",
    title: "Active Owner cards",
    steps: [
      { id: "onb-ao-items", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "Every owner item", target: [{ text: "Every owner item" }, "[aria-label='Active Owner program']"], title: "Cards open by themselves", body: "When a Task is done, the homeowner cards linked to it open by themselves. Nobody has to send them." },
      { id: "onb-ao-due", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "Needs action", target: ["#owner-needs-action"], title: "Owner tasks", body: "The owner tasks list shows what the owner needs to do for this home, with any due dates." },
      { id: "onb-ao-late", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "Active Owner program", target: ["[aria-label='Active Owner program']"], title: "Past the due date", body: "If the owner misses the due date, ARHA takes the item over. Unlock now is only a backup." },
      { id: "onb-ao-covered", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "None (centered)", target: null, title: "Not needed covers the card", body: "When a Task is marked Not needed, its owner card is covered, so the owner never sees it." },
    ],
  },
  {
    id: "onb-chat",
    title: "Talking with the owner",
    steps: [
      { id: "onb-chat-open", to: "/onboarding/$home?chat=owner", fallbackTo: "/onboarding", page: "A home, Chat", element: "Chat panel", target: [{ text: "With the owner" }, "[aria-label='Chat']", "[aria-label^='Chats']"], title: "The home chat", body: "Each home has a chat. With the owner goes to the homeowner. Team only stays inside ARHA." },
      { id: "onb-chat-write", to: "/onboarding/$home?chat=owner", fallbackTo: "/onboarding", page: "A home, Chat", element: "Chat panel", target: ["[role='dialog'][data-state='open'] textarea", { text: "With the owner" }], title: "Write here", body: "Write to the owner here, not by personal text. Every message stays on the home." },
      { id: "onb-weekly", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "Owner updates", target: ["[aria-label='Owner updates']"], title: "Owner updates", body: "Three updates go to the owner one, two and three weeks after closing. The business day before each one, you can Edit it or Hold it." },
      { id: "onb-weekly-auto", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "Needs action", target: ["#owner-needs-action"], title: "Keep the owner posted", body: "When the owner has not heard from us for 6 days, Needs action says so. Email or a call starts with the matching owner update." },
    ],
  },
  {
    id: "onb-follow",
    title: "My homes and follow notices",
    steps: [
      { id: "onb-follow-button", to: "/onboarding/$home", fallbackTo: "/onboarding", page: "A home", element: "Add to my homes button", target: [{ text: "Add to my homes" }, { text: "Remove from my homes" }, "[aria-label^='Yours']"], title: "Add to my homes", body: "Press Add to my homes to follow a home. You then get a notice when the owner replies, a Task is done or someone comments." },
      { id: "onb-bell", to: "/onboarding/$home", fallbackTo: "/onboarding", page: "A home", element: "Notifications bell", target: ["[aria-label^='Notifications']"], title: "Your notices", body: "Notices arrive in the bell at the top. Open one to go straight to the home or Task." },
      { id: "onb-my-tasks", to: "/onboarding/my-work", page: "My Tasks", element: "My Tasks view", target: ["[aria-label='My Tasks view']", "main h1"], title: "My Tasks", body: "My Tasks lists the Tasks given to you or your role, across every home." },
      { id: "onb-my-filters", to: "/onboarding/my-work", page: "My Tasks", element: "Quick filters", target: ["[aria-label='Quick filters']", "[aria-label='My Tasks view']"], title: "Quick filters", body: "Use the quick filters to see what is late or due soon." },
    ],
  },
  {
    id: "onb-handoff",
    title: "Handoff to Operations",
    steps: [
      { id: "onb-ho-details", to: "/onboarding/$home?tab=handoff", fallbackTo: "/onboarding", page: "A home, Tasks", element: "Handoff details", target: ["#handoff", { text: "Handoff details" }], title: "Handoff details", body: "Near the end of setup, open Handoff details on the Tasks tab." },
      { id: "onb-ho-ready", to: "/onboarding/$home?tab=handoff", fallbackTo: "/onboarding", page: "A home, Tasks", element: "Mark ready for Operations", target: [{ text: "Mark ready for Operations" }, { text: "Handoff checklist" }], title: "Mark ready", body: "Go through the Handoff checklist, then press Mark ready for Operations." },
      { id: "onb-ho-carry", to: "/onboarding/$home?tab=handoff", fallbackTo: "/onboarding", page: "A home, Tasks", element: "None (centered)", target: null, title: "Carry-over items", body: "Anything not finished becomes a carry-over item with an owner role and a due date. When Operations accepts, each one becomes an Operations Ticket." },
      { id: "onb-ho-accept", to: "/onboarding/$home?tab=handoff", fallbackTo: "/onboarding", page: "A home, Tasks", element: "Accept button", target: [{ text: "Accept", exact: true }], title: "Accepted means done", body: "The handoff is done only when Operations accepts. Until then, the home stays with you." },
    ],
  },
  {
    id: "onb-help",
    title: "Text, Call and Help",
    steps: [
      { id: "onb-text-call", to: "/onboarding/$home?tab=owner", fallbackTo: "/onboarding", page: "A home, Owner", element: "Text and Call buttons", target: [{ text: "Text", within: "a" }, { text: "Call", within: "a" }], title: "Text and Call", body: "Text and Call open the phone app on your device. Set Grasshopper as that app, so the owner sees the company number." },
      { id: "onb-help-button", to: "/onboarding", page: "Onboarding Home", element: "? Help & Feedback button", target: HELP_BUTTON, title: "Help & Feedback", body: "The ? button is on every page. It opens Help & guides and lets you report a problem." },
      { id: "onb-help-report", to: "/onboarding", page: "Onboarding Home", element: "? Help & Feedback button", target: HELP_BUTTON, title: "Send feedback", body: "Choose Report a problem or suggestion and say what happened. My reports shows where it stands." },
      { id: "onb-help-replay", to: "/onboarding", page: "Onboarding Home", element: "Take the tour button", target: TAKE_TOUR, title: "Replay any time", body: "Press Take the tour to see this again. The Help page lets you replay one part." },
    ],
  },
];

export const GUIDED_TOURS: Record<TourTeam, { label: string; sections: TourSection[] }> = {
  operations: { label: "Operations tour", sections: OPERATIONS },
  onboarding: { label: "Onboarding tour", sections: ONBOARDING },
};

export type TourViewer = { roles: readonly AppRole[]; seats: AccessSeats };

const isAdmin = (v: TourViewer) => v.roles.includes("admin");
/** Operations Supervisor, Director of Operations and Admin: the Oversight section. */
export const isTourLead = (v: TourViewer) => isAdmin(v) || Boolean(v.seats.opsSupervisor || v.seats.opsDirector);

/** Which team tours a person may take. Admin may take either one. */
export function toursFor(v: TourViewer): TourTeam[] {
  if (isAdmin(v)) return ["operations", "onboarding"];
  if (v.roles.includes("onboarding") || v.seats.onboardingDirector) return ["onboarding"];
  // Property Coordinators, the Operations Supervisor and the Director of Operations; other
  // Supervisor type accounts (Finance, for one) get no tour unless Admin starts one.
  if (v.roles.includes("tech") || v.seats.opsSupervisor || v.seats.opsDirector) return ["operations"];
  return [];
}

/** The tour that starts by itself once: the person's own team. Admin picks one instead. */
export function autostartTeam(v: TourViewer): TourTeam | null {
  if (isAdmin(v)) return null;
  return toursFor(v)[0] ?? null;
}

/** Onboarding moved to v3 on Nov 22 so the corrected tour starts once more for the onboarding team. */
export const tourSeenKey = (team: TourTeam, userId: string) => `resolve.guided-tour.${team === "onboarding" ? "v3" : "v2"}.${team}.${userId}`;

export function sectionsFor(team: TourTeam, v: TourViewer): TourSection[] {
  return GUIDED_TOURS[team].sections.filter((s) => s.audience !== "leads" || isTourLead(v));
}

export function stepsFor(team: TourTeam, sectionId: string | null, v: TourViewer): TourStep[] {
  return sectionsFor(team, v)
    .filter((s) => !sectionId || s.id === sectionId)
    .flatMap((s) => s.steps.map((st) => ({ ...st, section: s.title, sectionId: s.id })));
}

/** The real page for a step; a missing record falls back to the step's list page. */
export function resolveStepHref(step: Pick<TourStepDef, "to" | "fallbackTo">, ids: TourPlaceIds): string {
  const tokens: [string, string | null][] = [["$ticket", ids.ticket], ["$home", ids.home], ["$task", ids.task]];
  let href = step.to;
  for (const [token, id] of tokens) {
    if (!href.includes(token)) continue;
    if (!id) {
      if (token === "$task") {
        href = href.replace(/[?&]task=\$task/, "");
        continue;
      }
      return step.fallbackTo ?? "/dashboard";
    }
    href = href.split(token).join(id);
  }
  return href;
}
