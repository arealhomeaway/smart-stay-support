/**
 * My Tasks saved views and last choices, for the signed-in person only (Nov 23, item 4). Reads and
 * writes go through the caller-authenticated actions staged in docs/pending/onboarding-task-views;
 * until it is applied, reads say pending and the page keeps the last choices in the person's browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseViewSettings, type MyTasksSavedView, type MyTasksViewSettings } from "@/lib/my-tasks-saved-views";

const settings = z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length <= 4000, "That view is too large.");

type Rpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

export const getMyTasksViewsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isMissingObject } = await import("./onboarding-home.server");
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const { data, error } = await rpc("my_tasks_views");
    if (error) {
      if (isMissingObject(error)) return { pending: true, views: [] as MyTasksSavedView[], prefs: null as MyTasksViewSettings | null };
      throw new Error(error.message ?? "Saved views could not be read.");
    }
    const d = (data ?? {}) as { views?: { id: string; name: string; settings: unknown }[]; prefs?: unknown };
    const views: MyTasksSavedView[] = (d.views ?? []).map((v) => ({ id: v.id, name: v.name, settings: parseViewSettings(v.settings) }));
    const prefs: MyTasksViewSettings | null = d.prefs ? parseViewSettings(d.prefs) : null;
    return { pending: false, views, prefs };
  });

export const saveMyTasksViewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(60), settings }).parse(d))
  .handler(async ({ context, data }) => {
    const { callStaged } = await import("./onboarding-home.server");
    return callStaged<{ ok: true; id: string }>(context.supabase, "save_my_tasks_view", { _name: data.name, _settings: data.settings });
  });

export const archiveMyTasksViewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { callStaged } = await import("./onboarding-home.server");
    return callStaged<{ ok: true }>(context.supabase, "archive_my_tasks_view", { _id: data.id });
  });

/** The person's last choices (Group by home included). Pending before apply; the browser copy stays. */
export const saveMyTasksPrefsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ settings }).parse(d))
  .handler(async ({ context, data }) => {
    const { isMissingObject } = await import("./onboarding-home.server");
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const { error } = await rpc("save_my_tasks_prefs", { _settings: data.settings });
    if (error) {
      if (isMissingObject(error)) return { ok: false as const, pending: true };
      throw new Error(error.message ?? "Not saved.");
    }
    return { ok: true as const, pending: false };
  });
