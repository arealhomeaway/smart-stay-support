/**
 * Breezeway Public API access (server-only).
 *
 * Auth: client credentials (Client ID + Client Secret generated in Breezeway
 * under Settings -> Integrations -> API) exchanged for a short-lived bearer
 * token. Nothing sensitive ever reaches the browser.
 *
 * This module is scaffolding: it is fully wired, but every call fails with a
 * clear "not configured" message until BREEZEWAY_CLIENT_ID and
 * BREEZEWAY_CLIENT_SECRET are set.
 */

const BASE = "https://api.breezeway.io/public/inventory/v1";
const AUTH_URL = "https://api.breezeway.io/public/auth/v1/";

export class BreezewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "BreezewayError";
  }
}

export function breezewayConfigured() {
  return Boolean(process.env["BREEZEWAY_CLIENT_ID"] && process.env["BREEZEWAY_CLIENT_SECRET"]);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (!breezewayConfigured()) {
    throw new BreezewayError(
      503,
      "Breezeway is not connected yet. Add the Breezeway Client ID and Secret to turn this on.",
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env["BREEZEWAY_CLIENT_ID"],
      client_secret: process.env["BREEZEWAY_CLIENT_SECRET"],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Breezeway auth failed [${res.status}]: ${body}`);
    throw new BreezewayError(
      res.status,
      res.status === 401
        ? "Breezeway rejected the credentials. Check the Client ID and Secret."
        : `Breezeway sign-in failed (${res.status}).`,
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new BreezewayError(500, "Breezeway did not return an access token.");
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function breezewayFetch<T>(
  path: string,
  init?: { method?: string; params?: Record<string, string>; body?: unknown },
): Promise<T> {
  const token = await getToken();
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(init?.params ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? null : JSON.stringify(init.body),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Breezeway ${path} failed [${res.status}]: ${body}`);
    throw new BreezewayError(res.status, `Breezeway request failed (${res.status}). ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type BreezewayProperty = {
  id: number | string;
  name: string;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  reference_property_id?: string | null;
};

export type BreezewayTask = {
  id: number | string;
  name?: string;
  status?: string;
  type?: string;
  scheduled_date?: string | null;
  assignment_status?: string | null;
};

export async function listBreezewayProperties(): Promise<BreezewayProperty[]> {
  const out: BreezewayProperty[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await breezewayFetch<{ results?: BreezewayProperty[] }>("/property", {
      params: { page: String(page), limit: "100" },
    });
    const items = data.results ?? [];
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

export type DispatchInput = {
  breezewayPropertyId: string;
  name: string;
  description: string;
  priority: "p1" | "p2" | "p3" | "p4" | string;
  department?: string;
  scheduledDate?: string | null;
};

/** Maps our P1–P4 onto Breezeway's task priority scale. */
function breezewayPriority(priority: string) {
  switch (priority) {
    case "p1":
      return 1;
    case "p2":
      return 2;
    case "p3":
      return 3;
    default:
      return 4;
  }
}

export async function createBreezewayTask(input: DispatchInput): Promise<BreezewayTask> {
  return breezewayFetch<BreezewayTask>("/task", {
    method: "POST",
    body: {
      home_id: input.breezewayPropertyId,
      name: input.name,
      description: input.description,
      type_department: input.department ?? "maintenance",
      priority: breezewayPriority(input.priority),
      requested_date: input.scheduledDate ?? undefined,
    },
  });
}

export async function getBreezewayTask(taskId: string): Promise<BreezewayTask> {
  return breezewayFetch<BreezewayTask>(`/task/${taskId}`);
}
