/**
 * Admin-side operations for the Breezeway task webhook pilot (server-only).
 *
 * The receiver URL contains a random secret path segment. It is assembled here
 * and sent straight to Breezeway; it is NEVER returned to the browser, written
 * to the database, or logged. Everything surfaced to admins shows the host only.
 */
import {
  PILOT_COMPANY_ID,
  PILOT_HOME_ID,
  processBreezewayWebhook,
  webhookPathToken,
  type VerifyTask,
  type WebhookOutcome,
} from "./breezeway-webhook.server";

/**
 * Stable production host. Immutable across renames, so a registered
 * subscription keeps working. Overridable if the receiver ever moves.
 */
const DEFAULT_RECEIVER_HOST = "smart-stay-support.lovable.app";

export function receiverHost() {
  return process.env["BREEZEWAY_WEBHOOK_HOST"] ?? DEFAULT_RECEIVER_HOST;
}

/** Secret-bearing URL. Server-only; never returned from a server function. */
function receiverUrl() {
  const token = webhookPathToken();
  if (!token) throw new Error("The webhook path secret is not configured.");
  return `https://${receiverHost()}/api/public/hooks/breezeway/${encodeURIComponent(token)}`;
}

/** Host + redacted path, safe for the UI and for reports. */
export function receiverUrlRedacted() {
  return `https://${receiverHost()}/api/public/hooks/breezeway/••••••••`;
}

/* ------------------------------------------------------------------ */
/* Reachability                                                        */
/* ------------------------------------------------------------------ */

export type ReachabilityResult = {
  host: string;
  urlRedacted: string;
  reachable: boolean;
  status: number | null;
  /** True when a wrong secret is refused, proving the guard is live. */
  rejectsWrongSecret: boolean;
  wrongSecretStatus: number | null;
  /** True when the response arrived without any interactive login redirect. */
  noLoginRequired: boolean;
  detail: string;
};

/**
 * Proves the deployed endpoint answers over public HTTPS with no interactive
 * login, and that a wrong secret is refused. Uses GET so nothing is processed.
 */
export async function checkReceiverReachable(): Promise<ReachabilityResult> {
  const base = `https://${receiverHost()}/api/public/hooks/breezeway`;
  const token = webhookPathToken();
  const out: ReachabilityResult = {
    host: receiverHost(),
    urlRedacted: receiverUrlRedacted(),
    reachable: false,
    status: null,
    rejectsWrongSecret: false,
    wrongSecretStatus: null,
    noLoginRequired: false,
    detail: "",
  };
  if (!token) {
    out.detail = "The webhook path secret is not configured.";
    return out;
  }

  try {
    const res = await fetch(`${base}/${encodeURIComponent(token)}`, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/plain" },
    });
    out.status = res.status;
    out.reachable = res.status === 200;
    out.noLoginRequired = res.status === 200 && !res.headers.get("location");

    const wrong = await fetch(`${base}/not-the-real-secret`, { method: "POST", body: "{}" });
    out.wrongSecretStatus = wrong.status;
    out.rejectsWrongSecret = wrong.status === 404;

    out.detail = out.reachable
      ? "Receiver answered over public HTTPS with no sign-in redirect."
      : `Receiver returned HTTP ${res.status}.`;
  } catch (error) {
    out.detail = error instanceof Error ? error.message : "Receiver could not be reached.";
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fixture self-test                                                   */
/* ------------------------------------------------------------------ */

export type FixtureCase = { name: string; expected: WebhookOutcome; actual: WebhookOutcome; passed: boolean };

/**
 * Exercises valid / invalid / duplicate / older payloads end to end against a
 * stubbed verifier, so nothing in Breezeway is touched and no API budget is
 * spent. Fixture rows are flagged `is_fixture` and never mix with live counts.
 */
export async function runWebhookFixtureTests(): Promise<{ cases: FixtureCase[]; allPassed: boolean }> {
  const FIXTURE_TASK_ID = 999_000_001;
  const newer = "2026-08-27T18:00:00.000Z";
  const older = "2026-08-27T12:00:00.000Z";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("breezeway_webhook_events").delete().eq("is_fixture", true);

  const verifier =
    (homeId: number, companyId: number, updatedAt: string | null): VerifyTask =>
    async (id) => ({ id, homeId, companyId, updatedAt });

  const cases: FixtureCase[] = [];
  const run = async (name: string, expected: WebhookOutcome, body: unknown, verify: VerifyTask) => {
    const result = await processBreezewayWebhook(body, { isFixture: true, verifyTask: verify });
    cases.push({ name, expected, actual: result.outcome, passed: result.outcome === expected });
  };

  const pilotVerifier = verifier(PILOT_HOME_ID, PILOT_COMPANY_ID, newer);

  await run("Valid pilot task event", "processed", { webhook_type: "task", task_id: FIXTURE_TASK_ID }, pilotVerifier);
  await run("Duplicate of the same update", "duplicate", { webhook_type: "task", task_id: FIXTURE_TASK_ID }, pilotVerifier);
  await run(
    "Older update arriving late",
    "stale",
    { webhook_type: "task", task_id: FIXTURE_TASK_ID },
    verifier(PILOT_HOME_ID, PILOT_COMPANY_ID, older),
  );
  await run("Malformed payload (no task id)", "invalid", { webhook_type: "task", foo: "bar" }, pilotVerifier);
  await run(
    "Another property's task",
    "ignored_other_property",
    { webhook_type: "task", task_id: FIXTURE_TASK_ID + 1, home_id: 1_000_001 },
    pilotVerifier,
  );
  await run(
    "Another company's task",
    "ignored_other_company",
    { webhook_type: "task", task_id: FIXTURE_TASK_ID + 2 },
    verifier(PILOT_HOME_ID, 9999, newer),
  );
  await run(
    "Task that no longer exists",
    "verify_failed",
    { webhook_type: "task", task_id: FIXTURE_TASK_ID + 3 },
    async () => null,
  );

  return { cases, allPassed: cases.every((c) => c.passed) };
}

/* ------------------------------------------------------------------ */
/* Subscription registration                                           */
/* ------------------------------------------------------------------ */

export type WebhookStatus = {
  urlRedacted: string;
  secretConfigured: boolean;
  registered: boolean;
  subscriptionId: string | null;
  webhookType: string | null;
  registeredAt: string | null;
  /** Subscriptions Breezeway already holds, with URLs reduced to hosts. */
  existing: { id: string | null; host: string | null; webhookType: string | null; mine: boolean }[];
  counts: Record<string, number>;
  liveTotal: number;
  lastEventAt: string | null;
};

function hostOf(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function eventCounts() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("breezeway_webhook_events")
    .select("outcome, received_at")
    .eq("is_fixture", false)
    .order("received_at", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as { outcome: string; received_at: string }[];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  return { counts, liveTotal: rows.length, lastEventAt: rows[0]?.received_at ?? null };
}

export async function getWebhookStatus(): Promise<WebhookStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("breezeway_webhook_subscriptions")
    .select("subscription_id, webhook_type, registered_at, active")
    .eq("active", true)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let existing: WebhookStatus["existing"] = [];
  try {
    const { listBreezewaySubscriptions } = await import("./breezeway.server");
    existing = (await listBreezewaySubscriptions()).map((s) => {
      const host = hostOf(s.url);
      return {
        id: s.id != null ? String(s.id) : null,
        host,
        webhookType: s.webhook_type ?? null,
        mine: host === receiverHost(),
      };
    });
  } catch {
    existing = [];
  }

  const row = sub as {
    subscription_id: string | null;
    webhook_type: string | null;
    registered_at: string | null;
  } | null;

  return {
    urlRedacted: receiverUrlRedacted(),
    secretConfigured: Boolean(webhookPathToken()),
    registered: Boolean(row),
    subscriptionId: row?.subscription_id ?? null,
    webhookType: row?.webhook_type ?? null,
    registeredAt: row?.registered_at ?? null,
    existing,
    ...(await eventCounts()),
  };
}

export type RegistrationResult = {
  ok: boolean;
  alreadyRegistered: boolean;
  subscriptionId: string | null;
  message: string;
};

/**
 * Registers the ONE approved `task` subscription, but only after the receiver
 * proves reachable, the fixtures pass, and no equivalent subscription already
 * exists on the account.
 */
export async function registerTaskWebhook(): Promise<RegistrationResult> {
  const reach = await checkReceiverReachable();
  if (!reach.reachable || !reach.noLoginRequired || !reach.rejectsWrongSecret) {
    return {
      ok: false,
      alreadyRegistered: false,
      subscriptionId: null,
      message: `Receiver check failed: ${reach.detail}`,
    };
  }

  const fixtures = await runWebhookFixtureTests();
  if (!fixtures.allPassed) {
    const failed = fixtures.cases.filter((c) => !c.passed).map((c) => c.name);
    return {
      ok: false,
      alreadyRegistered: false,
      subscriptionId: null,
      message: `Fixture tests failed: ${failed.join(", ")}`,
    };
  }

  const { listBreezewaySubscriptions, createBreezewayTaskSubscription } = await import("./breezeway.server");
  const existing = await listBreezewaySubscriptions();
  const dupe = existing.find(
    (s) => (s.webhook_type ?? "task") === "task" && hostOf(s.url) === receiverHost(),
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (dupe) {
    await supabaseAdmin.from("breezeway_webhook_subscriptions").upsert(
      {
        subscription_id: dupe.id != null ? String(dupe.id) : null,
        webhook_type: "task",
        receiver_host: receiverHost(),
        last_verified_at: new Date().toISOString(),
        active: true,
        note: "Existing subscription reused; nothing new registered.",
      },
      { onConflict: "id" },
    );
    return {
      ok: true,
      alreadyRegistered: true,
      subscriptionId: dupe.id != null ? String(dupe.id) : null,
      message: "A task subscription for this receiver already exists. Nothing new was registered.",
    };
  }

  const created = await createBreezewayTaskSubscription(receiverUrl());
  const subscriptionId = created?.id != null ? String(created.id) : null;

  await supabaseAdmin.from("breezeway_webhook_subscriptions").insert({
    subscription_id: subscriptionId,
    webhook_type: "task",
    receiver_host: receiverHost(),
    last_verified_at: new Date().toISOString(),
    active: true,
    note: "Fitzgerald pilot. Company-wide delivery; only company 3641 / home 1473933 retained.",
  });

  return {
    ok: true,
    alreadyRegistered: false,
    subscriptionId,
    message: "Task webhook subscription registered.",
  };
}
