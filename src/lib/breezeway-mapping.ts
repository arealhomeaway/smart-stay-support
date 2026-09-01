/**
 * Browser-safe types for Breezeway ↔ Resolve property mapping.
 *
 * A Resolve property may receive Breezeway writes only in the `verified`
 * state. Verification is always deterministic — home id plus the OwnerRez
 * reference id carried on the Breezeway record. Name or address similarity is
 * NEVER write authorization.
 */

export const BREEZEWAY_MAPPING_STATES = [
  "verified",
  "unmapped",
  "ambiguous",
  "inactive",
  "excluded",
] as const;

export type BreezewayMappingState = (typeof BREEZEWAY_MAPPING_STATES)[number];

export const MAPPING_STATE_LABEL: Record<BreezewayMappingState, string> = {
  verified: "Verified",
  unmapped: "Not mapped",
  ambiguous: "Ambiguous — needs a decision",
  inactive: "Inactive in Breezeway",
  excluded: "Excluded by an admin",
};

export const MAPPING_STATE_HELP: Record<BreezewayMappingState, string> = {
  verified: "Identity confirmed by Breezeway home id and OwnerRez reference. Writes are allowed.",
  unmapped: "No Breezeway home is linked to this property. Writes are refused.",
  ambiguous: "More than one Breezeway home claims this property. Writes are refused.",
  inactive: "The linked Breezeway home is not active. Writes are refused.",
  excluded: "An admin deliberately kept this property out of Breezeway. Writes are refused.",
};

export type MappingAuditCounts = Record<BreezewayMappingState, number> & {
  activeResolveProperties: number;
};

export type MappingAuditRow = {
  propertyId: string;
  propertyName: string | null;
  ownerrezPropertyId: string | null;
  breezewayHomeId: string | null;
  state: BreezewayMappingState;
  note: string | null;
};

export type MappingAuditResult = {
  counts: MappingAuditCounts;
  changed: number;
  rows: MappingAuditRow[];
  breezewayActiveHomes: number;
  breezewayTotalHomes: number;
  persisted: boolean;
};

export const EMPTY_MAPPING_COUNTS: MappingAuditCounts = {
  activeResolveProperties: 0,
  verified: 0,
  unmapped: 0,
  ambiguous: 0,
  inactive: 0,
  excluded: 0,
};
