import { expect, it } from "bun:test";
import { addCoOwner, CO_OWNERS_NOT_READY } from "../co-owners.server";
import { answeredByLabel, buildAttribution, loggedByLabel } from "../co-owner-attribution";

function fakes(opts: { existing?: string; staffRoles?: boolean; missing?: boolean; failSecond?: boolean } = {}) {
  const calls: { accountId: string | null; email: string }[] = [];
  let created = 0;
  let profile = opts.existing ?? null;
  const actor = {
    rpc: async (name: string, args: { _account_id: string | null; _email: string }) => {
      expect(name).toBe("add_program_co_owner");
      calls.push({ accountId: args._account_id, email: args._email });
      if (opts.missing) return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
      if (!args._account_id && !opts.existing) return { data: { needsAccount: true }, error: null };
      if (opts.failSecond) return { data: null, error: { message: "Network hiccup" } };
      return { data: { memberId: "m", userId: args._account_id ?? opts.existing, linkedExisting: !args._account_id, welcomeQueued: true, held: false }, error: null };
    },
  };
  const db = {
    from: (table: string) => {
      const q = {
        select: () => q,
        ilike: () => q,
        eq: async () => ({ data: opts.staffRoles ? [{ role: "manager" }] : [], error: null }),
        maybeSingle: async () => ({ data: profile ? { id: profile } : null, error: null }),
      };
      expect(["profiles", "user_roles"]).toContain(table);
      return q;
    },
    auth: { admin: { createUser: async () => { created += 1; profile = "new-login"; return { data: { user: { id: "new-login" } } }; } } },
  };
  return { actor, db, calls, created: () => created };
}
const input = { programId: "p", name: " Mike Shared ", email: " Mike@Example.org " };

it("links an existing owner login without creating one, using the normalized email", async () => {
  const f = fakes({ existing: "mike" });
  const r = await addCoOwner(f.db as never, f.actor as never, input);
  expect(r.userId).toBe("mike");
  expect(f.created()).toBe(0);
  expect(f.calls).toEqual([{ accountId: null, email: "mike@example.org" }]);
});

it("creates a new owner login once, only after the database asks for one", async () => {
  const f = fakes();
  const r = await addCoOwner(f.db as never, f.actor as never, input);
  expect(r).toMatchObject({ userId: "new-login", linkedExisting: false });
  expect(f.created()).toBe(1);
  expect(f.calls.map((c) => c.accountId)).toEqual([null, "new-login"]);
});

it("keeps the created login visible when linking fails, so Retry reuses it", async () => {
  const f = fakes({ failSecond: true });
  const err = await addCoOwner(f.db as never, f.actor as never, input).catch((e: Error & { accountId?: string }) => e);
  expect((err as Error & { accountId?: string }).accountId).toBe("new-login");
  const retry = fakes({ existing: "new-login" });
  await addCoOwner(retry.db as never, retry.actor as never, input);
  expect(retry.created()).toBe(0);
});

it("refuses a login that has staff roles and never links it", async () => {
  const f = fakes({ staffRoles: true });
  await expect(addCoOwner(f.db as never, f.actor as never, input)).rejects.toThrow(/staff account/);
  expect(f.calls.length).toBe(1);
});

it("says plainly when co-owner logins are not turned on, without creating a login", async () => {
  const f = fakes({ missing: true });
  await expect(addCoOwner(f.db as never, f.actor as never, input)).rejects.toThrow(CO_OWNERS_NOT_READY);
  expect(f.created()).toBe(0);
});

it("labels who logged each entry and who answered only on shared programs", () => {
  const shared = buildAttribution([
    { kind: "member", ref_id: null, user_id: "r", display_name: "Rachel" },
    { kind: "member", ref_id: null, user_id: "m", display_name: "Mike" },
    { kind: "answer", ref_id: "review-1", user_id: "m", display_name: null },
  ]);
  expect(loggedByLabel(shared, "r")).toBe("Logged by Rachel");
  expect(loggedByLabel(shared, "m")).toBe("Logged by Mike");
  expect(answeredByLabel(shared, "review-1")).toBe("Answered by Mike");
  expect(answeredByLabel(shared, "review-2")).toBe(null);
  const single = buildAttribution([{ kind: "member", ref_id: null, user_id: "r", display_name: "Rachel" }]);
  expect(loggedByLabel(single, "r")).toBe(null);
  expect(loggedByLabel(buildAttribution([]), "r")).toBe(null);
});
