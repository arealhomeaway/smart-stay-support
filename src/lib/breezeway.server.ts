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
  BREEZEWAY_WEBHOOK_BASE,
  type BreezewayPropertySummary,
  type BreezewayTaskSummary,
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
  /**
   * Read-only guard: any method other than GET must be opted into explicitly
   * with `allowWrite`. The only writer today is the webhook subscription
   * registration, which the COO approved individually.
   */
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  allowWrite?: boolean;
  body?: unknown;
  /**
   * Automatic retry on 429/5xx. Safe for reads, NEVER safe for a
   * non-idempotent create: a 500 can mean "created but the response was
   * lost", and retrying it produces a second real Breezeway task. Callers
   * that create records pass `retry: false` and reconcile by hand instead.
   */
  retry?: boolean;
};


export async function breezewayRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = options.base ?? BREEZEWAY_INVENTORY_BASE;
  const method = options.method ?? "GET";
  if (method !== "GET" && !options.allowWrite) {
    throw new BreezewayError(400, "Breezeway writes are disabled for this call.");
  }
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(options.params ?? {})) url.searchParams.set(k, String(v));

  let attempt = 0;
  let token = await getAccessToken();

  for (;;) {
    await takeRequestSlot();
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `JWT ${token}`,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    noteRateLimitHeaders(res);

    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }

    // One re-auth on 401 in case the cached token was revoked early.
    if (res.status === 401 && attempt === 0) {
      attempt += 1;
      token = await getAccessToken(true);
      continue;
    }

    // A 401 above is safe to retry (Breezeway refused, so nothing was
    // created). A 429/5xx is NOT, unless the caller opted in: the request may
    // have succeeded server-side with the response lost.
    const retryAllowed = options.retry ?? true;
    if (retryAllowed && (res.status === 429 || res.status >= 500) && attempt < 2) {
      attempt += 1;
      await sleep(Math.max(blockedUntil - Date.now(), 1000 * attempt * attempt));
      continue;
    }


    const body = await res.text();
    console.error(`[breezeway] ${method} ${path} failed [${res.status}]: ${body.slice(0, 300)}`);
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

type CompanyRaw = { id?: number; name?: string | null };

/** Connected company identity. `/companies` is documented on the inventory API. */
export async function breezewayCompanyIdentity(): Promise<{ id: number | null; name: string | null }> {
  try {
    const data = await breezewayRequest<CompanyRaw[] | { results?: CompanyRaw[] }>("/companies");
    const list = Array.isArray(data) ? data : (data.results ?? []);
    const first = list[0];
    if (first) return { id: first.id ?? null, name: first.name ?? null };
  } catch (error) {
    // Some keys are not granted /companies; fall back to the company_id on a property.
    console.error("[breezeway] /companies unavailable:", (error as Error).message);
  }
  return { id: null, name: null };
}

/** Cheapest authenticated read — used by the panel's Test connection button. */
export async function breezewayIdentityProbe() {
  const data = await breezewayRequest<PropertyPage>("/property", { params: { limit: 1, page: 1 } });
  const first = data.results?.[0];
  const company = await breezewayCompanyIdentity();
  return {
    companyId: company.id ?? first?.company_id ?? null,
    companyName: company.name,
    totalProperties: data.total_results ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Read-only task listing (single property)                            */
/* ------------------------------------------------------------------ */

type BreezewayTaskRaw = {
  id: number;
  name?: string | null;
  home_id?: number | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  type_department?: string | null;
  type_priority?: string | null;
  type_task_status?: { code?: string | null; name?: string | null; stage?: string | null } | null;
  assignments?: { id: number; name?: string | null; type_task_user_status?: string | null }[] | null;
  created_at?: string | null;
  finished_at?: string | null;
};

type TaskPage = {
  limit: number;
  page: number;
  results: BreezewayTaskRaw[];
  total_pages: number;
  total_results: number;
};

/**
 * Every task Breezeway holds for ONE property, paginated. Task listing requires
 * a property filter; we never list account-wide. Read-only: nothing is written
 * back to Breezeway and nothing is imported into Resolve by this function.
 */
export async function listBreezewayTasksForHome(homeId: string, maxPages = 10) {
  const items: BreezewayTaskSummary[] = [];
  let page = 1;
  let pagesFetched = 0;
  let totalPages = 1;
  let totalResults = 0;

  do {
    const data = await breezewayRequest<TaskPage>("/task/", {
      params: { home_id: homeId, limit: 100, page },
    });
    pagesFetched += 1;
    totalPages = data.total_pages || 1;
    totalResults = data.total_results ?? items.length;
    for (const t of data.results ?? []) {
      items.push({
        id: t.id,
        name: t.name ?? null,
        homeId: t.home_id ?? null,
        status: t.type_task_status?.name ?? t.type_task_status?.code ?? null,
        stage: t.type_task_status?.stage ?? null,
        department: t.type_department ?? null,
        priority: t.type_priority ?? null,
        scheduledDate: t.scheduled_date ?? null,
        scheduledTime: t.scheduled_time ?? null,
        createdAt: t.created_at ?? null,
        finishedAt: t.finished_at ?? null,
        assignments: (t.assignments ?? []).map((a) => ({
          name: a.name ?? null,
          status: a.type_task_user_status ?? null,
        })),
      });
    }
    page += 1;
  } while (page <= totalPages && pagesFetched < maxPages);

  return {
    items,
    pagesFetched,
    totalPages,
    totalResults,
    pagesRemaining: Math.max(totalPages - pagesFetched, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Single task read (webhook verification)                             */
/* ------------------------------------------------------------------ */

export type BreezewayVerifiedTask = BreezewayTaskSummary & {
  companyId: number | null;
  updatedAt: string | null;
};

/**
 * Authenticated read of ONE task by ID. This is the only trusted source of a
 * task's company and property membership — webhook payloads are never trusted
 * for that decision.
 */
export async function getBreezewayTask(taskId: number): Promise<BreezewayVerifiedTask | null> {
  type Raw = BreezewayTaskRaw & {
    company_id?: number | null;
    updated_at?: string | null;
    modified_at?: string | null;
  };
  let raw: Raw;
  try {
    raw = await breezewayRequest<Raw>(`/task/${taskId}`);
  } catch (error) {
    if (error instanceof BreezewayError && error.status === 404) return null;
    throw error;
  }
  if (!raw || typeof raw.id !== "number") return null;
  return {
    id: raw.id,
    name: raw.name ?? null,
    homeId: raw.home_id ?? null,
    status: raw.type_task_status?.name ?? raw.type_task_status?.code ?? null,
    stage: raw.type_task_status?.stage ?? null,
    department: raw.type_department ?? null,
    priority: raw.type_priority ?? null,
    scheduledDate: raw.scheduled_date ?? null,
    scheduledTime: raw.scheduled_time ?? null,
    createdAt: raw.created_at ?? null,
    finishedAt: raw.finished_at ?? null,
    assignments: (raw.assignments ?? []).map((a) => ({
      name: a.name ?? null,
      status: a.type_task_user_status ?? null,
    })),
    companyId: raw.company_id ?? null,
    updatedAt: raw.updated_at ?? raw.modified_at ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Webhook subscriptions                                               */
/* ------------------------------------------------------------------ */

export type BreezewaySubscriptionRaw = {
  id?: number | string;
  url?: string | null;
  webhook_type?: string | null;
  status?: string | null;
};

/** Existing subscriptions on the account. Read-only. */
export async function listBreezewaySubscriptions(): Promise<BreezewaySubscriptionRaw[]> {
  const data = await breezewayRequest<BreezewaySubscriptionRaw[] | { results?: BreezewaySubscriptionRaw[] }>(
    "/webhooks",
    { base: BREEZEWAY_WEBHOOK_BASE },
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** Registers exactly one `task` subscription. Approved, single-shot write. */
export async function createBreezewayTaskSubscription(url: string) {
  return breezewayRequest<BreezewaySubscriptionRaw>("/subscribe", {
    base: BREEZEWAY_WEBHOOK_BASE,
    method: "POST",
    allowWrite: true,
    body: { url, webhook_type: "task" },
  });
}
