import { describe, expect, it } from "bun:test";
import {
  BUILT_IN_TEMPLATE_KEY,
  builtInAsRows,
  builtInSummary,
  templateKeyFrom,
  toTemplateTasks,
  type TemplateTaskRow,
} from "../onboarding-template-catalog";
import {
  createOnboardingTemplate,
  ensureBuiltInTemplate,
  saveTemplateStep,
  deleteTemplateStep,
} from "../onboarding-template-admin.server";

function row(partial: Partial<TemplateTaskRow>): TemplateTaskRow {
  return {
    id: "step-1",
    template_id: "tpl",
    stage: "intake_identity",
    title: "Collect the onboarding form",
    role: "Project Manager",
    detail: null,
    sort_order: 10,
    blocks_handoff: false,
    requires_owner_approval: false,
    owner_approval_when_active_owner: false,
    evidence_required: false,
    schedule_anchor: null,
    offset_days: null,
    breezeway_template_id: null,
    subtasks: null,
    ...partial,
  };
}

describe("template catalog shaping", () => {
  it("orders steps and keeps only the flags that are set", () => {
    const tasks = toTemplateTasks([
      row({ id: "b", sort_order: 20, title: "Second" }),
      row({ id: "a", sort_order: 10, title: "First", evidence_required: true }),
    ]);
    expect(tasks.map((t) => t.title)).toEqual(["First", "Second"]);
    expect(tasks[0]!.evidenceRequired).toBe(true);
    expect(tasks[1]!.evidenceRequired).toBe(undefined as never);
  });

  it("only keeps a deadline when both an anchor and an offset are recorded", () => {
    const [withAnchor] = toTemplateTasks([
      row({ schedule_anchor: "actual_access", offset_days: 5 }),
    ]);
    const [withoutOffset] = toTemplateTasks([row({ schedule_anchor: "actual_access" })]);
    expect(withAnchor!.anchor).toBe("actual_access");
    expect(withAnchor!.offsetDays).toBe(5);
    expect(withoutOffset!.anchor).toBe(undefined as never);
  });

  it("drops blank subtasks", () => {
    const [task] = toTemplateTasks([row({ subtasks: ["Record in Resolve", "  ", ""] })]);
    expect(task!.subtasks).toEqual(["Record in Resolve"]);
  });

  it("copies the built-in plan faithfully", () => {
    const rows = builtInAsRows("tpl");
    expect(rows.length).toBe(builtInSummary().taskCount);
    expect(rows.every((r) => r.template_id === "tpl")).toBe(true);
  });

  it("makes a safe key from a name", () => {
    expect(templateKeyFrom("ARHA Full Furnishing (copy)")).toBe("arha_full_furnishing_copy");
    expect(templateKeyFrom("***")).toBe("template");
  });
});

function gatedDb(isSupervisor: boolean) {
  return {
    rpc: async (name: string) => {
      if (name === "is_supervisor") return { data: isSupervisor, error: null };
      if (name === "is_onboarding_staff") return { data: true, error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    },
    from: () => {
      throw new Error("A denied caller must never reach the tables");
    },
  } as never;
}

describe("only the director may change templates", () => {
  const denied = [
    () => createOnboardingTemplate(gatedDb(false), "pm", { name: "PM plan" }),
    () =>
      saveTemplateStep(gatedDb(false), "pm", {
        templateId: "tpl",
        stage: "intake_identity",
        title: "Sneak a step in",
      }),
    () => deleteTemplateStep(gatedDb(false), "pm", { templateId: "tpl", stepId: "step" }),
  ];

  for (const [i, call] of denied.entries()) {
    it(`refuses a project manager (${i})`, async () => {
      await expect(call()).rejects.toThrow("Only the onboarding director can change templates.");
    });
  }

  it("still validates the step title for a director", async () => {
    await expect(
      saveTemplateStep(gatedDb(true), "director", {
        templateId: "tpl",
        stage: "intake_identity",
        title: "no",
      }),
    ).rejects.toThrow("at least three characters");
  });
});

describe("the built-in plan is edited in place, never duplicated", () => {
  function db() {
    const templates: Record<string, unknown>[] = [];
    const steps: Record<string, unknown>[] = [];
    const client = {
      rpc: async (name: string) => {
        if (name === "is_supervisor" || name === "is_onboarding_staff")
          return { data: true, error: null };
        throw new Error(`Unexpected RPC: ${name}`);
      },
      from: (table: string) => {
        const rows = table === "onboarding_templates" ? templates : steps;
        const matches: ((r: Record<string, unknown>) => boolean)[] = [];
        const query = {
          select: () => query,
          order: () => query,
          in: () => query,
          like: () => query,
          eq: (k: string, v: unknown) => {
            matches.push((r) => r[k] === v);
            return query;
          },
          maybeSingle: async () => ({
            data: rows.find((r) => matches.every((m) => m(r))) ?? null,
            error: null,
          }),
          then: (resolve: (v: unknown) => unknown) =>
            resolve({ data: rows.filter((r) => matches.every((m) => m(r))), error: null }),
          insert: (value: Record<string, unknown> | Record<string, unknown>[]) => {
            const list = Array.isArray(value) ? value : [value];
            const created = list.map((r, i) => ({
              id: `${table}-${rows.length + i}`,
              is_default: false,
              is_archived: false,
              ...r,
            }));
            rows.push(...created);
            return {
              select: () => ({ single: async () => ({ data: created[0], error: null }) }),
              then: (resolve: (v: unknown) => unknown) => resolve({ data: created, error: null }),
            };
          },
        };
        return query;
      },
    } as never;
    return { client, templates, steps };
  }

  it("saves the shipped plan once and reuses it afterwards", async () => {
    const { client, templates, steps } = db();
    const first = await ensureBuiltInTemplate(client, "director", async () => {});
    expect(first.created).toBe(true);
    expect(templates.length).toBe(1);
    expect(templates[0]!["key"]).toBe(BUILT_IN_TEMPLATE_KEY);
    expect(steps.length).toBe(builtInSummary().taskCount);

    const second = await ensureBuiltInTemplate(client, "director", async () => {});
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(templates.length).toBe(1);
  });

  it("refuses a project manager", async () => {
    await expect(ensureBuiltInTemplate(gatedDb(false), "pm", async () => {})).rejects.toThrow(
      "Only the onboarding director can change templates.",
    );
  });
});
