/**
 * Breezeway API access (server-only).
 *
 * Auth (https://developer.breezeway.io/reference/obtain-tokens):
 *   POST https://api.breezeway.io/public/auth/v1/  { client_id, client_secret }
 *   -> { access_token, refresh_token }
 *   Every other call sends `Authorization: JWT <access_token>`.
 *
 * The client_id/client_secret pair grants FULL read/write access to the whole
 * Breezeway account. Read-only behaviour in Resolve is an application-level
 * restriction enforced here: `breezewayRequest` refuses any method other than
 * GET unless a caller explicitly opts in, and no caller does today.
 *
 * Token handling:
 *   - tokens are cached, encrypted, in `integration_tokens` so every isolate
 *     shares one token instead of authenticating per call (auth is 1 req/min)
 *   - a single in-flight promise coalesces concurrent refreshes in an isolate
 *   - the auth endpoint is never called more often than once per minute
 *
 * Request handling:
 *   - a shared limiter keeps us under our 30 req/min company ceiling, with
 *     headroom, and honours Retry-After / X-RateLimit-Reset when returned
 *   - bounded retries (max 2) on 429 and 5xx only; never on 4xx
 */
import {
  BREEZEWAY_AUTH_BASE,
  BREEZEWAY_AUTH_MIN_INTERVAL_MS,
  BREEZEWAY_EFFECTIVE_RATE_LIMIT_PER_MIN,
  BREEZEWAY_INVENTORY_BASE,
  BREEZEWAY_MAX_PAGE_SIZE,
  BREEZEWAY_PROVIDER,
  BREEZEWAY_TOKEN_SKEW_MS,
  BREEZEWAY_TOKEN_TTL_MS,
  type BreezewayPropertySummary,
} from "./breezeway";
import { decryptConnectionKey, encryptConnectionKey } from "./sharepoint-crypto.server";

export class BreezewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "BreezewayError";
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

const windowMs = 60_000;
let windowStart = 0;
let windowCount = 0;
/** Set when Breezeway tells us to back off; nothing goes out before this. */
let blockedUntil = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function takeRequestSlot() {
  for (;;) {
    const now = Date.now();
    if (now < blockedUntil) {
      await sleep(Math.min(blockedUntil - now, 5_000));
      continue;
    }
    if (now - windowStart >= windowMs) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount < BREEZEWAY_EFFECTIVE_RATE_LIMIT_PER_MIN) {
      windowCount += 1;
      return;
    }
    await sleep(windowStart + windowMs - now);
  }
}

function noteRateLimitHeaders(res: Response) {
  const retryAfter = res.headers.get("retry-after");
  const reset = res.headers.get("x-ratelimit-reset");
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) blockedUntil = Date.now() + secs * 1000;
    return;
  }
  if (reset) {
    const value = Number(reset);
    if (Number.isFinite(value)) {
      // Either a delta in seconds or an absolute epoch — treat large values as epoch.
      blockedUntil = value > 1_000_000_000 ? value * 1000 : Date.now() + value * 1000;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Token cache                                                         */
/* ------------------------------------------------------------------ */

type TokenRow = {
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  last_auth_attempt_at: string | null;
};

let inFlightToken: Promise<string> | null = null;

function credentials() {
  const clientId = process.env["BREEZEWAY_CLIENT_ID"];
  const clientSecret = process.env["BREEZEWAY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new BreezewayError(
      500,
      "Breezeway credentials are not configured. Save BREEZEWAY_CLIENT_ID and BREEZEWAY_CLIENT_SECRET first.",
    );
  }
  return { clientId, clientSecret };
}

export function breezewayCredentialsPresent() {
  return Boolean(process.env["BREEZEWAY_CLIENT_ID"] && process.env["BREEZEWAY_CLIENT_SECRET"]);
}

async function readTokenRow(): Promise<TokenRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("integration_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at, last_auth_attempt_at")
    .eq("provider", BREEZEWAY_PROVIDER)
    .maybeSingle();
  if (error) throw new BreezewayError(500, "Could not read the stored Breezeway token.");
  return (data as TokenRow | null) ?? null;
}

async function writeTokenRow(patch: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("integration_tokens")
    .upsert(
      { provider: BREEZEWAY_PROVIDER, updated_at: new Date().toISOString(), ...patch },
      { onConflict: "provider" },
    );
  if (error) console.error("[breezeway] token cache write failed:", error.message);
}

/** Records the outcome of a connection check for the admin panel. */
export async function recordBreezewayCheck(ok: boolean, company: string | null, error: string | null) {
  await writeTokenRow({
    last_check_at: new Date().toISOString(),
    last_check_ok: ok,
    last_error: error,
    ...(company ? { company_label: company } : {}),
  });
}

async function authenticate(): Promise<string> {
  const { clientId, clientSecret } = credentials();

  // Auth is capped at 1 request/minute for the whole account — respect it
  // across isolates using the shared last-attempt timestamp.
  const row = await readTokenRow();
  const last = row?.last_auth_attempt_at ? Date.parse(row.last_auth_attempt_at) : 0;
  const wait = last + BREEZEWAY_AUTH_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    if (row?.access_token_enc) return decryptConnectionKey(row.access_token_enc);
    throw new BreezewayError(
      429,
      `Breezeway only allows one sign-in per minute. Try again in ${Math.ceil(wait / 1000)}s.`,
    );
  }

  await writeTokenRow({ last_auth_attempt_at: new Date().toISOString() });
  await takeRequestSlot();

  const res = await fetch(`${BREEZEWAY_AUTH_BASE}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    noteRateLimitHeaders(res);
    const body = await res.text();
    console.error(`[breezeway] auth failed [${res.status}]`);
    throw new BreezewayError(
      res.status,
      res.status === 401 || res.status === 403
        ? "Breezeway rejected the client ID or client secret."
        : res.status === 429
          ? "Breezeway sign-in is limited to one request per minute. Wait a moment and retry."
          : `Breezeway sign-in failed (${res.status}). ${body.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token) throw new BreezewayError(502, "Breezeway returned no access token.");

  const now = Date.now();
  await writeTokenRow({
    access_token_enc: encryptConnectionKey(json.access_token),
    refresh_token_enc: json.refresh_token ? encryptConnectionKey(json.refresh_token) : null,
    obtained_at: new Date(now).toISOString(),
    expires_at: new Date(now + BREEZEWAY_TOKEN_TTL_MS).toISOString(),
  });
  return json.access_token;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const row = await readTokenRow();
    const expires = row?.expires_at ? Date.parse(row.expires_at) : 0;
    if (row?.access_token_enc && expires - BREEZEWAY_TOKEN_SKEW_MS > Date.now()) {
      return decryptConnectionKey(row.access_token_enc);
    }
  }
  // Coalesce concurrent refreshes inside this isolate.
  if (!inFlightToken) {
    inFlightToken = authenticate().finally(() => {
      inFlightToken = null;
    });
  }
  return inFlightToken;
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

type RequestOptions = {
  params?: Record<string, string | number>;
  base?: string;
  /** Read-only guard: writes must be opted into explicitly. Nothing does today. */
  method?: "GET";
};

export async function breezewayRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = options.base ?? BREEZEWAY_INVENTORY_BASE;
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(options.params ?? {})) url.searchParams.set(k, String(v));

  let attempt = 0;
  let token = await getAccessToken();

  for (;;) {
    await takeRequestSlot();
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `JWT ${token}`, Accept: "application/json" },
    });
    noteRateLimitHeaders(res);

    if (res.ok) return (await res.json()) as T;

    // One re-auth on 401 in case the cached token was revoked early.
    if (res.status === 401 && attempt === 0) {
      attempt += 1;
      token = await getAccessToken(true);
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      attempt += 1;
      await sleep(Math.max(blockedUntil - Date.now(), 1000 * attempt * attempt));
      continue;
    }

    const body = await res.text();
    console.error(`[breezeway] GET ${path} failed [${res.status}]: ${body.slice(0, 300)}`);
    throw new BreezewayError(res.status, sanitizeError(res.status, path));
  }
}

/** User-facing error text: never includes tokens, credentials or raw payloads. */
export function sanitizeError(status: number, path: string) {
  if (status === 401 || status === 403) return "Breezeway refused the request (not authorized).";
  if (status === 404) return `Breezeway has no endpoint or record at ${path}.`;
  if (status === 429) return "Breezeway rate limit reached. Resolve will back off and retry.";
  if (status >= 500) return "Breezeway is returning a server error. Try again shortly.";
  return `Breezeway rejected the request (${status}).`;
}

/* ------------------------------------------------------------------ */
/* Read-only inventory                                                 */
/* ------------------------------------------------------------------ */

type BreezewayPropertyRaw = {
  id: number;
  name?: string | null;
  display?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  status?: string | null;
  company_id?: number | null;
  reference_external_property_id?: string | null;
  reference_property_id?: string | null;
};

type PropertyPage = {
  limit: number;
  page: number;
  results: BreezewayPropertyRaw[];
  total_pages: number;
  total_results: number;
};

function toSummary(p: BreezewayPropertyRaw): BreezewayPropertySummary {
  const address = [p.address1, p.address2].filter(Boolean).join(" ").trim() || null;
  return {
    id: p.id,
    name: p.name || p.display || null,
    address,
    city: p.city ?? null,
    state: p.state ?? null,
    zipcode: p.zipcode ?? null,
    status: p.status ?? null,
    referenceExternalPropertyId: p.reference_external_property_id ?? null,
    referencePropertyId: p.reference_property_id != null ? String(p.reference_property_id) : null,
  };
}

/**
 * Full paginated property inventory. Mapping fields only — no photos, notes,
 * contacts, reservations, guests or task history are requested or retained.
 */
export async function listBreezewayProperties(pageSize = 500) {
  const limit = Math.min(pageSize, BREEZEWAY_MAX_PAGE_SIZE);
  const items: BreezewayPropertySummary[] = [];
  let page = 1;
  let pagesFetched = 0;
  let companyId: number | null = null;
  let totalPages = 1;

  do {
    const data = await breezewayRequest<PropertyPage>("/property", { params: { limit, page } });
    pagesFetched += 1;
    totalPages = data.total_pages || 1;
    for (const raw of data.results ?? []) {
      if (companyId == null && raw.company_id != null) companyId = raw.company_id;
      items.push(toSummary(raw));
    }
    page += 1;
    // Hard stop so a pagination bug can never loop the account.
    if (pagesFetched >= 20) break;
  } while (page <= totalPages);

  return { items, pagesFetched, companyId };
}

/** Cheapest authenticated read — used by the panel's Test connection button. */
export async function breezewayIdentityProbe() {
  const data = await breezewayRequest<PropertyPage>("/property", { params: { limit: 1, page: 1 } });
  const first = data.results?.[0];
  return {
    companyId: first?.company_id ?? null,
    totalProperties: data.total_results ?? 0,
  };
}
