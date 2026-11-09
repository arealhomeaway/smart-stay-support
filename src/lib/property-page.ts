/**
 * Property page and Properties list rules (register P1, P2, M2, A12, A1).
 * Pure, so the screens and the tests read the same rules.
 */

export const PROPERTY_TABS = [
  { id: "profile", label: "Home Profile" },
  { id: "inspections", label: "Inspections" },
  { id: "onboarding", label: "Onboarding Information" },
  { id: "house-items", label: "House Items" },
  { id: "utilities", label: "Utilities" },
  { id: "vendors", label: "Vendors" },
  { id: "owner", label: "Owner and Contacts" },
  { id: "operations", label: "Operations" },
  { id: "reviews", label: "Reviews" },
  { id: "surveys", label: "Surveys" },
  { id: "documents", label: "Documents and Media" },
  { id: "activity", label: "Activity" },
] as const;

export type PropertyTabId = (typeof PROPERTY_TABS)[number]["id"];

/**
 * Tabs a person may open (register A12): every internal staff role that opens
 * Properties sees every tab (Finance views them); homeowners and vendors never
 * open the staff property page.
 */
export function propertyTabsFor(viewer: { staff: boolean; properties: boolean }) {
  if (!viewer.staff || !viewer.properties) return [];
  return PROPERTY_TABS.map((t) => ({ ...t }));
}

/** Old tab names in links (Overview, Property details, Files, Approvals, Handoff, Contacts, Guest Surveys) still land somewhere useful. */
export function resolveTab(raw: string | undefined): PropertyTabId {
  const map: Record<string, PropertyTabId> = {
    overview: "profile",
    details: "profile",
    files: "documents",
    approvals: "onboarding",
    handoff: "onboarding",
    contacts: "owner",
  };
  if (!raw) return "profile";
  if (PROPERTY_TABS.some((t) => t.id === raw)) return raw as PropertyTabId;
  return map[raw] ?? "profile";
}

/** Stage words on a screen: Operations or Onboarding; never "active operations". */
export function stageLabel(lifecycle: string | null | undefined): string {
  if (lifecycle === "onboarding" || lifecycle === "handoff_requested" || lifecycle === "handoff_corrections")
    return "Onboarding";
  if (lifecycle === "offboarded") return "Offboarded";
  if (lifecycle === "not_onboarded") return "Not started";
  return "Operations";
}

export function isOnboardingHome(lifecycle: string | null | undefined): boolean {
  return stageLabel(lifecycle) === "Onboarding";
}

/** Which department's view a staff member sees by default. */
export function departmentFor(access: { onboardingOnly: boolean }): "operations" | "onboarding" {
  return access.onboardingOnly ? "onboarding" : "operations";
}

export type MoreMenuState = {
  staff: boolean;
  readOnly: boolean;
  onboarding: boolean;
  activeOwner: boolean;
  canMoveToOnboarding: boolean;
  canEnrollActiveOwner: boolean;
  canChangeOwner: boolean;
  canCorrectClosing: boolean;
};

export type MoreMenuItem =
  | "photos_folder"
  | "change_owner"
  | "move_to_onboarding"
  | "enroll_active_owner"
  | "correct_closing";

export const MORE_MENU_LABELS: Record<MoreMenuItem, string> = {
  photos_folder: "Open the photos folder",
  change_owner: "Change owner of record",
  move_to_onboarding: "Move to Onboarding",
  enroll_active_owner: "Enroll in Active Owner",
  correct_closing: "Correct actual closing",
};

/** The More menu, in the board's order, for this home and this person. */
export function moreMenuItems(s: MoreMenuState): MoreMenuItem[] {
  if (!s.staff) return [];
  const items: MoreMenuItem[] = ["photos_folder"];
  if (s.readOnly) return items;
  if (s.canChangeOwner) items.push("change_owner");
  if (s.canMoveToOnboarding && !s.onboarding) items.push("move_to_onboarding");
  if (s.canEnrollActiveOwner && !s.activeOwner) items.push("enroll_active_owner");
  if (s.canCorrectClosing) items.push("correct_closing");
  return items;
}

export type BannerInput = {
  onboarding: boolean;
  department: "operations" | "onboarding";
  missing: number;
  carriedOver: number;
};

export type Banner = { title: string; button: string; note: string | null; target: "missing" | "carry" };

/** The banner over onboarding and carried over homes. */
export function handoffBanner(b: BannerInput): Banner | null {
  const n = (count: number) => `${count} item${count === 1 ? "" : "s"}`;
  if (b.onboarding) {
    if (b.department === "onboarding")
      return { title: `Before handoff: ${n(b.missing)} still to fill in`, button: "Fill them in", note: null, target: "missing" };
    return {
      title: `Handoff review: ${n(b.missing)} ${b.missing === 1 ? "is" : "are"} still missing`,
      button: "See what is missing",
      note: "This home is still in onboarding. The onboarding team fills in missing information. You can edit if you need to, but it is not expected.",
      target: "missing",
    };
  }
  if (b.carriedOver > 0)
    return {
      title: `${n(b.carriedOver)} carried over from onboarding at handoff`,
      button: "See the carry-over items",
      note: null,
      target: "carry",
    };
  return null;
}

/** The one line under the address. */
export function headerLine(h: {
  onboarding: boolean;
  handedOffOn: string | null;
  projectManager: string | null;
  handoffOn: string | null;
  carriedOver: number;
}): string {
  const parts: string[] = [];
  if (h.onboarding) {
    parts.push("Onboarding home");
    if (h.projectManager) parts.push(`Project Manager ${h.projectManager}`);
    if (h.handoffOn) parts.push(`handoff ${h.handoffOn}`);
  } else {
    parts.push(h.handedOffOn ? `Operating home, handed off ${h.handedOffOn}` : "Operating home");
  }
  if (h.carriedOver > 0) parts.push(`${h.carriedOver} item${h.carriedOver === 1 ? "" : "s"} carried over`);
  return parts.join(" · ");
}

/** Activity: the last 30 days first, then the full history on request. */
export function splitActivity<T extends { at: string }>(rows: T[], now = new Date()) {
  const cutoff = now.getTime() - 30 * 86400_000;
  const sorted = [...rows].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const recent = sorted.filter((r) => new Date(r.at).getTime() >= cutoff);
  return { recent, older: sorted.slice(recent.length), all: sorted };
}

/* ------------------------------------------------------------------ */
/* Properties list                                                      */

export type ListFilter = {
  q?: string | undefined;
  market?: string | undefined;
  status?: "operations" | "onboarding" | undefined;
  open?: boolean | undefined;
};

export type ListHome = {
  id: string;
  lifecycle: string | null;
  market: string | null;
  openTickets: number;
  searchText: string;
};

export function filterHomes<T extends ListHome>(homes: T[], f: ListFilter): T[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return homes.filter((h) => {
    if (f.market && h.market !== f.market) return false;
    if (f.status === "operations" && stageLabel(h.lifecycle) !== "Operations") return false;
    if (f.status === "onboarding" && stageLabel(h.lifecycle) !== "Onboarding") return false;
    if (f.open && h.openTickets === 0) return false;
    if (q && !h.searchText.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function homeCountLine(n: number): string {
  return `${n} home${n === 1 ? "" : "s"}`;
}

/** Add a home: only Onboarding roles and Admin. */
export function canAddHome(access: { isAdmin: boolean; onboardingStaff: boolean; previewing?: boolean }): boolean {
  if (access.previewing) return false;
  return access.isAdmin || access.onboardingStaff;
}

/** The first import reads (30D FIRM) in a home's Notion title as the label 30-day firm. */
export function firmLabelFromTitle(title: string | null | undefined): "30-day firm" | null {
  return title && /\(30D FIRM\)/i.test(title) ? "30-day firm" : null;
}

/** Remove "(30D FIRM)" and similar from a display name now that it is a label. */
export const LABEL_CREATE_NOTE = "Only an admin can create or rename labels. You can pick from the list.";
