/**
 * Browser-safe Breezeway constants and types.
 *
 * Nothing here touches credentials. Every Breezeway API call runs server-side
 * in `breezeway.server.ts`; the browser only ever sees the sanitized status
 * objects declared below.
 *
 * Account-specific limits supplied by Breezeway (these override anything the
 * generic public docs advertise):
 *   - access tokens live 24 hours
 *   - the auth endpoint accepts 1 request/minute
 *   - our company key allows 30 requests/minute
 *   - list endpoints page at a maximum of 1,000 records/page
 *   - task listing requires a property filter (home_id or reference_property_id)
 */

export const BREEZEWAY_PROVIDER = "breezeway" as const;

/** Documented API hosts — https://developer.breezeway.io/ */
export const BREEZEWAY_AUTH_BASE = "https://api.breezeway.io/public/auth/v1";
export const BREEZEWAY_INVENTORY_BASE = "https://api.breezeway.io/public/inventory/v1";
export const BREEZEWAY_WEBHOOK_BASE = "https://api.breezeway.io/public/webhook/v1";

/** Our contracted ceiling. We run below it deliberately (see headroom). */
export const BREEZEWAY_RATE_LIMIT_PER_MIN = 30;
/** Headroom so a burst never trips Breezeway's counter. */
export const BREEZEWAY_EFFECTIVE_RATE_LIMIT_PER_MIN = 24;
/** Auth is 1/min; we never re-authenticate more often than this. */
export const BREEZEWAY_AUTH_MIN_INTERVAL_MS = 60_000;
/** Tokens last 24h; refresh early so an in-flight call never expires. */
export const BREEZEWAY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const BREEZEWAY_TOKEN_SKEW_MS = 30 * 60 * 1000;
/** Documented maximum page size for list endpoints. */
export const BREEZEWAY_MAX_PAGE_SIZE = 1000;

export const BREEZEWAY_SECRET_NAMES = ["BREEZEWAY_CLIENT_ID", "BREEZEWAY_CLIENT_SECRET"] as const;

export type BreezewayConnectionStatus = {
  /** Credentials present in server env. Says nothing about whether they work. */
  credentialsConfigured: boolean;
  /** Last successful authenticated call, if any. */
  apiConnected: boolean;
  /** Always false for now: no webhook subscription, no scheduled sync. */
  syncEnabled: boolean;
  connectedCompany: string | null;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
  lastError: string | null;
  /** Explicitly separate from apiConnected — never inferred from an auth test. */
  writeAccessTested: false;
};

export type BreezewayPropertySummary = {
  id: number;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  status: string | null;
  referenceExternalPropertyId: string | null;
  referencePropertyId: string | null;
};

export type MappingConfidence = "external_id" | "suggested_address" | "suggested_name" | "none";

export type BreezewayMappingRow = {
  breezewayId: number | null;
  breezewayName: string | null;
  breezewayStatus: string | null;
  resolveId: string | null;
  resolveName: string | null;
  confidence: MappingConfidence;
  note: string;
};

export type BreezewayInventoryReport = {
  connectedCompany: string | null;
  breezewayTotal: number;
  breezewayActive: number;
  breezewayInactive: number;
  breezewayOther: number;
  breezewayDuplicates: { key: string; ids: number[] }[];
  resolveTotal: number;
  resolveWithBreezewayId: number;
  matchedByExternalId: BreezewayMappingRow[];
  suggested: BreezewayMappingRow[];
  ambiguous: BreezewayMappingRow[];
  unmatchedBreezeway: BreezewayMappingRow[];
  unmatchedResolve: BreezewayMappingRow[];
  pagesFetched: number;
  requestsUsed: number;
};
