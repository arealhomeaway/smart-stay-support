import { beforeEach, describe, expect, it as test, mock } from "bun:test";

// Executes the real retryWelcome server function, including the real
// requireSupabaseAuth middleware. Only the framework wrapper, the request,
// the database clients and the audit writer are replaced.

type Person = { roles: string[]; director?: boolean; synthetic?: boolean };
const people: Record<string, Person> = {
  dir: { roles: ["onboarding"], director: true },
  admin: { roles: ["admin"] },
  supervisor: { roles: ["manager"] },
  opsdir: { roles: ["manager"] },
  pm: { roles: ["onboarding"] },
  owner: { roles: ["owner"] },
  qadir: { roles: ["onboarding"], director: true, synthetic: true },
};
let authHeader: string | null = null;
let rows: Record<string, Record<string, unknown>> = {};
let homes: Record<string, Record<string, unknown>> = {};
const created: string[] = [];
const enrollCalls: unknown[] = [];
const audits: unknown[] = [];

mock.module("@tanstack/react-start", () => {
  const createServerFn = () => {
    const st: { mw: Array<{ server?: unknown; options?: { server?: unknown } }>; v: (d: unknown) => unknown; h?: (a: unknown) => unknown } = { mw: [], v: (d) => d };
    const b = {
      middleware(m: typeof st.mw) { st.mw = m; return b; },
      inputValidator(v: typeof st.v) { st.v = v; return b; },
      handler(h: (a: unknown) => unknown) {
        st.h = h;
        return async (args: { data: unknown }) => {
          let context: Record<string, unknown> = {};
          // Works whether the middleware module was built by this fake or by the
          // real createMiddleware (cached by an earlier test file).
          for (const m of st.mw) {
            const run = (m.options?.server ?? m.server) as (a: unknown) => Promise<unknown>;
            await run({ next: async (o?: { context?: Record<string, unknown> }) => { context = { ...context, ...(o?.context ?? {}) }; return {}; } });
          }
          return st.h!({ context, data: st.v(args.data) });
        };
      },
    };
    return b;
  };
  return { createServerFn, createMiddleware: () => ({ server: (fn: unknown) => ({ server: fn }) }) };
});
mock.module("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://x", { headers: authHeader ? { authorization: authHeader } : {} }),
}));
mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getClaims: async (token: string) => {
        const sub = token.split(".")[1] ?? "";
        return people[sub] ? { data: { claims: { sub } }, error: null } : { data: null, error: new Error("bad") };
      },
    },
    rpc: async (name: string, a: Record<string, unknown>) => {
      const uid = sub();
      const p = uid ? people[uid] : undefined;
      const authority = !!p && (p.roles.includes("admin") || !!p.director);
      if (name === "is_onboarding_director") return { data: !!people[a["_user_id"] as string]?.director, error: null };
      if (name === "has_role") return { data: !!people[a["_user_id"] as string]?.roles.includes(a["_role"] as string), error: null };
      if (name === "enroll_active_owner") { enrollCalls.push(a); return { data: { programId: "p" }, error: null }; }
      if (name === "active_owner_may_act") return { data: authority && (!p!.synthetic || a["_is_demo"] === true), error: null };
      return { data: null, error: new Error("unexpected rpc " + name) };
    },
  }),
}));
function sub() { return authHeader ? authHeader.replace("Bearer ", "").split(".")[1] : null; }

function admin() {
  return {
    auth: { admin: { createUser: async (u: { email: string }) => { created.push(u.email); return { data: { user: { id: "new" } }, error: null }; } } },
    from: (t: string) => {
      const store = t === "properties" ? homes : t === "owner_welcome_messages" ? rows : {};
      const f: [string, unknown][] = [];
      let patch: Record<string, unknown> | null = null;
      const hit = () => Object.values(store).filter((r) => f.every(([k, v]) => r[k] === v));
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => { f.push([k, v]); return q; },
        ilike: () => q,
        update: (p: Record<string, unknown>) => { patch = p; return q; },
        maybeSingle: async () => ({ data: hit()[0] ? { ...hit()[0] } : null }),
        then: (res: (v: unknown) => void) => {
          const h = hit();
          if (patch) h.forEach((r) => Object.assign(r, patch));
          return res({ data: h.map((r) => ({ id: r["id"] })) });
        },
      };
      return q;
    },
  };
}
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: admin() }));
mock.module("../access.server", () => ({ applyRole: async () => {} }));
mock.module("../audit.server", () => ({ writeAudit: async (e: unknown) => { audits.push(e); } }));
mock.module("../email.server", () => ({ sendEmail: async () => ({ status: "sent" }), emailShell: () => "" }));

process.env["SUPABASE_URL"] = "http://db";
process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test";
const { retryWelcome, enrollActiveOwner } = await import("../owner-welcome.functions");

const REAL = "11111111-1111-4111-8111-111111111111";
const DEMO = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  audits.length = 0; created.length = 0; enrollCalls.length = 0;
  homes = { [REAL]: { id: REAL, is_demo: false }, [DEMO]: { id: DEMO, is_demo: true } };
  rows = {
    [REAL]: { id: REAL, status: "failed", is_demo: false, recipient: "owner@home.com" },
    [DEMO]: { id: DEMO, status: "failed", is_demo: true, recipient: "demo@home.com" },
  };
});
const as = (who: string | null) => { authHeader = who ? `Bearer h.${who}.s` : null; };
const retry = (id = REAL) => retryWelcome({ data: { id } } as never) as Promise<{ requeued: boolean }>;

describe("retryWelcome handler (executed)", () => {
  test("Onboarding Director: allowed, re-queued once, audited", async () => {
    as("dir");
    expect(await retry()).toEqual({ requeued: true });
    expect(rows[REAL]?.["status"]).toBe("queued");
    expect(audits.length).toBe(1);
  });
  test("Admin: allowed", async () => {
    as("admin");
    expect(await retry()).toEqual({ requeued: true });
  });
  for (const who of ["supervisor", "opsdir", "pm", "owner"]) {
    test(`${who}: refused, nothing changed`, async () => {
      as(who);
      await expect(retry()).rejects.toThrow("Only the Onboarding Director or an Admin");
      expect(rows[REAL]?.["status"]).toBe("failed");
      expect(audits.length).toBe(0);
    });
  }
  test("signed-out caller: refused by the sign-in check", async () => {
    as(null);
    await expect(retry()).rejects.toThrow("Unauthorized");
    expect(rows[REAL]?.["status"]).toBe("failed");
  });
  test("test account with Director seat: refused on a real welcome", async () => {
    as("qadir");
    await expect(retry()).rejects.toThrow("Test accounts cannot retry");
    expect(rows[REAL]?.["status"]).toBe("failed");
  });
  test("demo welcomes are never retried, even by the Director", async () => {
    as("dir");
    await expect(retry(DEMO)).rejects.toThrow("Demo welcomes are never sent");
    expect(rows[DEMO]?.["status"]).toBe("failed");
  });
});

const enroll = (propertyId: string) =>
  enrollActiveOwner({ data: { propertyId, name: "Pat Example", email: "pat@home.com" } } as never);
describe("enrollActiveOwner handler (executed): demo-only rule for test accounts", () => {
  test("test account with Director seat: real home refused before any account is created", async () => {
    as("qadir");
    await expect(enroll(REAL)).rejects.toThrow("Test accounts can only set up Active Owner on demo homes");
    expect(created.length).toBe(0);
    expect(enrollCalls.length).toBe(0);
  });
  test("test account with Director seat: demo home still allowed", async () => {
    as("qadir");
    await enroll(DEMO);
    expect(enrollCalls.length).toBe(1);
  });
  test("Supervisor: refused before any account is created", async () => {
    as("supervisor");
    await expect(enroll(REAL)).rejects.toThrow("Only the Onboarding Director or an Admin");
    expect(created.length).toBe(0);
  });
  test("Onboarding Director: real home allowed", async () => {
    as("dir");
    await enroll(REAL);
    expect(enrollCalls.length).toBe(1);
  });
});
