/**
 * Home (front door) workflow registry.
 *
 * Presentation only: every entry points at a route that already exists and is
 * gated by the same capability the destination itself enforces. Nothing here
 * grants access — it decides what is worth *showing* a person on their landing
 * page, and in what order for their role.
 */
import type { AppRole, Capability } from "@/lib/permissions";

export type WorkflowKey =
  | "tickets"
  | "work_orders"
  | "claims"
  | "recovery"
  | "leads"
  | "properties"
  | "onboarding"
  | "active_owner";

export type HomeWorkflow = {
  key: WorkflowKey;
  label: string;
  /** Plain language: what a person actually does here. */
  description: string;
  route: string;
  cta: string;
  /** Any one of these capabilities is enough to show the card. */
  capabilities: Capability[];
  /** Literal Tailwind classes so the compiler keeps them. */
  accent: {
    text: string;
    tint: string;
    bar: string;
  };
};

export const HOME_WORKFLOWS: HomeWorkflow[] = [
  {
    key: "tickets",
    label: "Tickets",
    description: "Guest and maintenance issues, from first report to a closed answer.",
    route: "/tickets",
    cta: "Open tickets",
    capabilities: ["matters_assigned", "matters_all"],
    accent: { text: "text-module-ops", tint: "bg-module-ops/10", bar: "bg-module-ops" },
  },
  {
    key: "work_orders",
    label: "Work Orders",
    description: "Repairs being executed — quotes, owner approval, vendor visits, evidence.",
    route: "/work-orders",
    cta: "Open work orders",
    capabilities: ["claims_work", "claims_oversight"],
    accent: { text: "text-module-override", tint: "bg-module-override/10", bar: "bg-module-override" },
  },
  {
    key: "claims",
    label: "Claims",
    description: "Money we are recovering from a platform, guest or insurer.",
    route: "/claims",
    cta: "Open claims",
    capabilities: ["claims_work", "claims_oversight"],
    accent: { text: "text-module-approval", tint: "bg-module-approval/10", bar: "bg-module-approval" },
  },
  {
    key: "recovery",
    label: "Guest Recovery",
    description: "Refunds, compensation and service recovery for a guest we let down.",
    route: "/recovery",
    cta: "Open recovery",
    capabilities: ["claims_work", "claims_oversight"],
    accent: { text: "text-team-a", tint: "bg-team-a/10", bar: "bg-team-a" },
  },
  {
    key: "leads",
    label: "Leads",
    description: "Tenant enquiries and follow-ups, through to a booking or a clean loss.",
    route: "/leads",
    cta: "Open leads",
    capabilities: ["matters_assigned", "matters_all"],
    accent: { text: "text-module-coverage", tint: "bg-module-coverage/10", bar: "bg-module-coverage" },
  },
  {
    key: "properties",
    label: "Properties",
    description: "Property Hub: access codes, facts, photos, warranty and history.",
    route: "/properties",
    cta: "Find a property",
    capabilities: ["properties"],
    accent: { text: "text-brand-teal", tint: "bg-brand-teal/10", bar: "bg-brand-teal" },
  },
  {
    key: "onboarding",
    label: "Onboarding",
    description: "New properties from signed agreement to guest-ready, task by task.",
    route: "/onboarding",
    cta: "Open onboarding",
    capabilities: ["onboarding_workspace"],
    accent: {
      text: "text-module-onboarding",
      tint: "bg-module-onboarding/10",
      bar: "bg-module-onboarding",
    },
  },
  {
    key: "active_owner",
    label: "Active Owner",
    description: "Owner participation hours: entries, approvals and program pace.",
    route: "/owner-programs",
    cta: "Open Active Owner",
    capabilities: ["owner_programs"],
    accent: { text: "text-module-owner", tint: "bg-module-owner/10", bar: "bg-module-owner" },
  },
];

/** Order the cards so the work a role actually does comes first. */
const ROLE_PRIORITY: Partial<Record<AppRole, WorkflowKey[]>> = {
  tech: ["tickets", "work_orders", "properties", "recovery", "claims", "leads"],
  onboarding: ["onboarding", "properties", "tickets", "active_owner"],
  manager: ["tickets", "work_orders", "claims", "recovery", "leads", "properties", "onboarding", "active_owner"],
  admin: ["tickets", "work_orders", "claims", "recovery", "leads", "properties", "onboarding", "active_owner"],
};

export function workflowsFor(
  roles: AppRole[],
  can: (capability: Capability) => boolean,
): HomeWorkflow[] {
  const allowed = HOME_WORKFLOWS.filter((w) => w.capabilities.some((c) => can(c)));
  const order = roles.map((r) => ROLE_PRIORITY[r]).find(Boolean) ?? [];
  if (order.length === 0) return allowed;
  return [...allowed].sort((a, b) => {
    const ai = order.indexOf(a.key);
    const bi = order.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export type AttentionItem = {
  key: string;
  label: string;
  count: number;
  route: string;
  /** How loudly to show it — never invented, always derived from a count. */
  tone: "urgent" | "warning" | "steady";
};

export type HomeSignals = {
  ticketsOpen?: number;
  ticketsP1?: number;
  ticketsMine?: number;
  workOrdersOpen?: number;
  workOrdersAwaitingOwner?: number;
  claimsOpen?: number;
  claimsOverdue?: number;
  recoveryOpen?: number;
  leadsOpen?: number;
  properties?: number;
};

/** Only real, non-zero counts become an attention row. */
export function attentionItems(signals: HomeSignals): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (signals.ticketsP1) {
    items.push({
      key: "p1",
      label: signals.ticketsP1 === 1 ? "P1 ticket open" : "P1 tickets open",
      count: signals.ticketsP1,
      route: "/tickets",
      tone: "urgent",
    });
  }
  if (signals.claimsOverdue) {
    items.push({
      key: "claims-overdue",
      label: "claims past their deadline",
      count: signals.claimsOverdue,
      route: "/claims",
      tone: "urgent",
    });
  }
  if (signals.workOrdersAwaitingOwner) {
    items.push({
      key: "wo-owner",
      label: "work orders waiting on an owner decision",
      count: signals.workOrdersAwaitingOwner,
      route: "/work-orders",
      tone: "warning",
    });
  }
  if (signals.recoveryOpen) {
    items.push({
      key: "recovery",
      label: "guest recoveries in flight",
      count: signals.recoveryOpen,
      route: "/recovery",
      tone: "warning",
    });
  }
  if (signals.ticketsMine) {
    items.push({
      key: "mine",
      label: "tickets assigned to you",
      count: signals.ticketsMine,
      route: "/tickets",
      tone: "steady",
    });
  }
  return items;
}

/** Short, truthful cue under a workflow card. Undefined means "say nothing". */
export function workflowCue(key: WorkflowKey, s: HomeSignals): string | undefined {
  switch (key) {
    case "tickets":
      if (s.ticketsOpen === undefined) return undefined;
      if (s.ticketsOpen === 0) return "Nothing open right now";
      return `${s.ticketsOpen} open${s.ticketsP1 ? ` · ${s.ticketsP1} at P1` : ""}`;
    case "work_orders":
      if (s.workOrdersOpen === undefined) return undefined;
      return s.workOrdersOpen === 0 ? "No open jobs" : `${s.workOrdersOpen} open`;
    case "claims":
      if (s.claimsOpen === undefined) return undefined;
      return s.claimsOpen === 0 ? "No open claims" : `${s.claimsOpen} open`;
    case "recovery":
      if (s.recoveryOpen === undefined) return undefined;
      return s.recoveryOpen === 0 ? "Nothing in flight" : `${s.recoveryOpen} in flight`;
    case "leads":
      if (s.leadsOpen === undefined) return undefined;
      return s.leadsOpen === 0 ? "No open leads" : `${s.leadsOpen} open`;
    case "properties":
      if (s.properties === undefined) return undefined;
      return `${s.properties} properties`;
    default:
      return undefined;
  }
}
