/**
 * Utilities & Accounts board (browser-safe, presentation only).
 *
 * The utility manager works across homes, not inside one project plan. This
 * module reshapes records that already exist — `utility_accounts`, linked
 * credentials, meter assets and utility documents — into one card per home and
 * utility, so nothing about furniture, staging or questionnaires is in view.
 *
 * No new schema, no writes: status changes go through the existing
 * `saveUtilityAccountFn` server function.
 */

import { UTILITY_STATUS_LABELS, utilityLabel, type UtilityStatus } from "./onboarding-finance";

/** The five services the utility manager is accountable for at every home. */
export const CORE_UTILITIES = ["electric", "gas", "water_sewer", "trash", "internet"] as const;
export type CoreUtility = (typeof CORE_UTILITIES)[number];

export const UTILITY_BOARD_STATUSES: UtilityStatus[] = [
  "needed",
  "requested",
  "pending_transfer",
  "active",
  "closed",
];

export type BoardAccount = {
  id: string;
  property_id: string;
  utility_type: string;
  provider: string;
  account_label: string;
  status: string;
  responsible: string;
  credential_id: string | null;
  service_start_on: string | null;
  notes: string | null;
};

export type BoardCredential = {
  id: string;
  label: string;
  username: string | null;
  instructions: string | null;
};

export type BoardMeter = {
  id: string;
  property_id: string;
  name: string;
  location: string | null;
  kind: string;
};

export type BoardDocument = {
  id: string;
  property_id: string | null;
  title: string;
  uploaded_at: string | null;
};

export type BoardProperty = {
  id: string;
  name: string;
  nickname: string | null;
  city: string | null;
  state: string | null;
  lifecycle_status: string;
  is_demo: boolean;
};

export type UtilityCard = {
  key: string;
  propertyId: string;
  utilityType: string;
  typeLabel: string;
  account: BoardAccount | null;
  status: UtilityStatus;
  statusLabel: string;
  provider: string | null;
  accountNumber: string | null;
  responsible: string;
  transferDate: string | null;
  setupNotes: string | null;
  credential: BoardCredential | null;
  meters: BoardMeter[];
  documents: BoardDocument[];
  /** True while ARHA still owes work on this service. */
  outstanding: boolean;
};

export type PropertyUtilities = {
  property: BoardProperty;
  title: string;
  location: string | null;
  cards: UtilityCard[];
  active: number;
  outstanding: number;
  isTest: boolean;
};

function statusOf(account: BoardAccount | null): UtilityStatus {
  const raw = (account?.status ?? "needed") as UtilityStatus;
  return raw in UTILITY_STATUS_LABELS ? raw : "needed";
}

const METER_WORDS = ["meter", "electric", "gas", "water", "sewer", "panel"];

function meterMatches(meter: BoardMeter, utilityType: string) {
  const haystack = `${meter.name} ${meter.kind} ${meter.location ?? ""}`.toLowerCase();
  if (!METER_WORDS.some((w) => haystack.includes(w))) return false;
  const words = utilityType.split("_");
  return words.some((w) => haystack.includes(w));
}

function documentMatches(doc: BoardDocument, utilityType: string, typeLabel: string) {
  const haystack = doc.title.toLowerCase();
  return (
    utilityType.split("_").some((w) => haystack.includes(w)) ||
    haystack.includes(typeLabel.toLowerCase())
  );
}

/** One card per core service at every home, plus any extra account recorded. */
export function buildUtilityBoard(input: {
  properties: BoardProperty[];
  accounts: BoardAccount[];
  credentials: BoardCredential[];
  meters: BoardMeter[];
  documents: BoardDocument[];
  testIds?: string[];
}): PropertyUtilities[] {
  const credentialById = new Map(input.credentials.map((c) => [c.id, c]));
  const testIds = new Set(input.testIds ?? []);

  return input.properties
    .map((property) => {
      const mine = input.accounts.filter((a) => a.property_id === property.id);
      const meters = input.meters.filter((m) => m.property_id === property.id);
      const docs = input.documents.filter((d) => d.property_id === property.id);
      const extras = mine
        .map((a) => a.utility_type)
        .filter((t) => !CORE_UTILITIES.includes(t as CoreUtility));
      const types = [...CORE_UTILITIES, ...[...new Set(extras)].sort()];

      const cards: UtilityCard[] = types.map((utilityType) => {
        const account = mine.find((a) => a.utility_type === utilityType) ?? null;
        const status = statusOf(account);
        const typeLabel = utilityLabel(utilityType);
        return {
          key: `${property.id}:${utilityType}`,
          propertyId: property.id,
          utilityType,
          typeLabel,
          account,
          status,
          statusLabel: UTILITY_STATUS_LABELS[status],
          provider: account?.provider?.trim() ? account.provider.trim() : null,
          accountNumber: account?.account_label?.trim() ? account.account_label.trim() : null,
          responsible: account?.responsible ?? "arha",
          transferDate: account?.service_start_on ?? null,
          setupNotes: account?.notes?.trim() ? account.notes.trim() : null,
          credential: account?.credential_id
            ? (credentialById.get(account.credential_id) ?? null)
            : null,
          meters: meters.filter((m) => meterMatches(m, utilityType)),
          documents: docs.filter((d) => documentMatches(d, utilityType, typeLabel)),
          outstanding:
            (account?.responsible ?? "arha") === "arha" &&
            status !== "active" &&
            status !== "closed",
        };
      });

      return {
        property,
        title: property.nickname?.trim() || property.name,
        location: [property.city, property.state].filter(Boolean).join(", ") || null,
        cards,
        active: cards.filter((c) => c.status === "active").length,
        outstanding: cards.filter((c) => c.outstanding).length,
        isTest: property.is_demo || testIds.has(property.id),
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding || a.title.localeCompare(b.title));
}

export type BoardFilter = {
  status?: UtilityStatus | "all" | "outstanding";
  utilityType?: string;
  find?: string;
  showTest?: boolean;
};

/** Filters cards, then drops homes with nothing left to show. */
export function filterUtilityBoard(
  homes: PropertyUtilities[],
  filter: BoardFilter,
): PropertyUtilities[] {
  const find = (filter.find ?? "").trim().toLowerCase();
  return homes
    .filter((home) => (filter.showTest ? true : !home.isTest))
    .filter(
      (home) =>
        !find ||
        home.title.toLowerCase().includes(find) ||
        (home.location ?? "").toLowerCase().includes(find) ||
        home.cards.some((c) => (c.provider ?? "").toLowerCase().includes(find)),
    )
    .map((home) => ({
      ...home,
      cards: home.cards.filter((card) => {
        if (filter.utilityType && filter.utilityType !== "all") {
          if (card.utilityType !== filter.utilityType) return false;
        }
        if (!filter.status || filter.status === "all") return true;
        if (filter.status === "outstanding") return card.outstanding;
        return card.status === filter.status;
      }),
    }))
    .filter((home) => home.cards.length > 0);
}

/** Counts used by the status chips above the board. */
export function boardSummary(homes: PropertyUtilities[]) {
  const cards = homes.flatMap((h) => h.cards);
  return {
    total: cards.length,
    outstanding: cards.filter((c) => c.outstanding).length,
    byStatus: UTILITY_BOARD_STATUSES.map((status) => ({
      status,
      label: UTILITY_STATUS_LABELS[status],
      count: cards.filter((c) => c.status === status).length,
    })),
  };
}
