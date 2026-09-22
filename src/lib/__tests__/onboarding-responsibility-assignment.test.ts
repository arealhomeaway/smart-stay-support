import { expect, it } from "bun:test";
import { resolveNewProjectAssignments } from "../onboarding-assignment.server";
import { updateProject } from "../onboarding-project.server";
import { responsibilitySeatWriter } from "../responsibility-seats.server";
import { redeemTeamInvite } from "../team-invites.server";

const pm = "00000000-0000-4000-8000-000000000003";
const director = "00000000-0000-4000-8000-000000000004";
const other = "00000000-0000-4000-8000-000000000006";
const owner = "00000000-0000-4000-8000-000000000005";
async function expectDenied(action: Promise<unknown>, message: string) {
  const error = await action.then(
    () => "",
    (e: Error) => e.message,
  );
  expect(error).toContain(message);
}
function fixture(canAssign = false, directorId: string | null = director) {
  const mutations: unknown[] = [];
  const project = {
    id: "project",
    property_id: "property",
    project_manager: pm,
    director,
    updated_at: "version",
    status: "active",
    modules: [],
    is_demo: false,
  };
  const db = {
    rpc: async (name: string, input?: { _user_id: string }) => ({
      data:
        name === "read_onboarding_assignment_authority"
          ? [{ can_assign: canAssign, director_id: directorId }]
          : name === "is_supervisor"
            ? false
            : input?._user_id !== owner,
      error: null,
    }),
    from: () => {
      let patch = {};
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => ({ data: project, error: null }),
        maybeSingle: async () => ({ data: { ...project, ...patch }, error: null }),
        update: (value: object) => {
          patch = value;
          mutations.push(value);
          return q;
        },
        insert: async (value: object) => {
          mutations.push(value);
          return { data: null, error: null };
        },
      };
      return q;
    },
  };
  return { db, mutations };
}
it("keeps ordinary Start Onboarding available with self PM and protected Director", async () => {
  const f = fixture();
  expect(
    await resolveNewProjectAssignments(f.db as never, pm, { projectManager: null, director: null }),
  ).toEqual({ projectManager: pm, director });
  expect(
    await resolveNewProjectAssignments(fixture(false, null).db as never, pm, {
      projectManager: pm,
      director: null,
    }),
  ).toEqual({ projectManager: pm, director: null });
  await expectDenied(
    resolveNewProjectAssignments(f.db as never, pm, { projectManager: other, director: null }),
    "another project manager",
  );
  await expectDenied(
    resolveNewProjectAssignments(f.db as never, pm, { projectManager: pm, director: pm }),
    "protected responsibility seat",
  );
});
it("only trusts assignment authority, not the legacy project Director or PM", async () => {
  for (const actor of [pm, director]) {
    const f = fixture();
    await expectDenied(
      updateProject(f.db as never, actor, { projectId: "project", director: other }),
      "trusted Onboarding Director",
    );
    expect(f.mutations).toEqual([]);
  }
});
it("lets trusted leadership assign eligible staff and rejects owner or malformed targets", async () => {
  const f = fixture(true);
  const result = await updateProject(f.db as never, other, {
    projectId: "project",
    projectManager: other,
  });
  expect(result.project_manager).toBe(other);
  // The project write, the property's owner field following it, and the event.
  expect(f.mutations.length).toBe(3);
  expect(f.mutations.some((m) => JSON.stringify(m).includes("onboarding_owner"))).toBe(true);
  for (const id of [owner, "A name or email"]) {
    const denied = fixture(true);
    await expectDenied(
      updateProject(denied.db as never, director, { projectId: "project", director: id }),
      "staff account",
    );
    expect(denied.mutations).toEqual([]);
  }
});
it("denies protected coverage actions before elevation and keeps administrator identity on writes", async () => {
  for (const code of ["director_onboarding", "director_ops", "ops_supervisor"]) {
    let elevated = 0;
    const db = { rpc: async () => ({ data: false, error: null }) };
    const elevate = async () => {
      elevated++;
      return {} as never;
    };
    await expectDenied(
      responsibilitySeatWriter({ supabase: db as never, userId: pm }, code, elevate),
      "platform administrator",
    );
    expect(elevated).toBe(0);
    const admin = { rpc: async () => ({ data: true, error: null }) };
    expect(
      await responsibilitySeatWriter({ supabase: admin as never, userId: director }, code, elevate),
    ).toBe(admin as never);
    expect(elevated).toBe(0);
    await responsibilitySeatWriter({ supabase: db as never, userId: pm }, "po_day", elevate);
    expect(elevated).toBe(1);
  }
});
it("redeems the ordinary staff role while leaving each protected invite seat pending without seat reads or writes", async () => {
  for (const seat of ["director_onboarding", "director_ops", "ops_supervisor"]) {
    const tables: string[] = [];
    const roleChanges: unknown[] = [];
    const db = {
      from: (table: string) => {
        tables.push(table);
        const q = {
          select: () => q,
          eq: () => q,
          is: () => q,
          update: () => q,
          maybeSingle: async () => ({
            data: {
              id: "invite",
              role: "onboarding",
              invitee_email: "person@example.test",
              expires_at: "2099-01-01",
              redeemed_by: null,
              revoked_at: null,
              seat_role_code: seat,
            },
            error: null,
          }),
        };
        return q;
      },
    };
    const result = await redeemTeamInvite(pm, "person@example.test", "ABCD-2345", {
      supabase: db as never,
      applyRole: async (...args) => {
        roleChanges.push(args);
        return { ok: true };
      },
    });
    expect(result).toEqual({ ok: true, role: "onboarding", pendingSeatAssignment: seat });
    expect(roleChanges).toEqual([[pm, "onboarding"]]);
    expect(tables).toEqual(["team_invites", "team_invites"]);
  }
});
