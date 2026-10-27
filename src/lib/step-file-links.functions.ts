/**
 * Server functions for files flowing between steps (Help Ticket #55).
 * Every file list is produced by the same `listAttachments` check the source
 * Task uses, so nobody sees a file they could not already see there.
 * Until the pending database change is applied, reads return `ready: false`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildLinkedSections,
  linkedFilesAllowed,
  type LinkRow,
  type LinkTask,
  type SourceFile,
} from "@/lib/step-file-links";

type Untyped = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> & {
        is: (c: string, v: null) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  };
  rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export const readTaskFileLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const m = await import("@/lib/attachments.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    const empty = { ready: false, sections: [], candidates: [] as { id: string; title: string; stage: string }[], selectedIds: [] as string[] };
    if (!linkedFilesAllowed(viewer.roles)) return empty;

    const recv = await context.supabase
      .from("onboarding_tasks")
      .select("id, property_id, title, archived_at")
      .eq("id", data.taskId)
      .maybeSingle();
    if (recv.error || !recv.data) throw new Error("That Task could not be found.");
    const receiving = recv.data as LinkTask;

    const sb = context.supabase as unknown as Untyped;
    const links = await sb
      .from("onboarding_task_file_links")
      .select("receiving_task_id, source_task_id, property_id, removed_at")
      .eq("receiving_task_id", data.taskId)
      .is("removed_at", null);
    if (links.error) return empty; // pending database change not applied yet

    const home = await context.supabase
      .from("onboarding_tasks")
      .select("id, property_id, title, stage, archived_at, parent_task_id, sort_order")
      .eq("property_id", receiving.property_id)
      .order("sort_order");
    if (home.error) throw new Error(home.error.message);
    const homeTasks = home.data ?? [];

    const rows = (links.data ?? []) as LinkRow[];
    const sources = homeTasks.filter((t) => rows.some((r) => r.source_task_id === t.id)) as LinkTask[];
    const filesBySource = new Map<string, SourceFile[]>();
    for (const s of sources) {
      if (s.archived_at) continue;
      const listed = await m.listAttachments(viewer, "onboarding_task", s.id);
      filesBySource.set(s.id, listed.files as unknown as SourceFile[]);
    }
    return {
      ready: true,
      sections: buildLinkedSections(receiving, rows, sources, filesBySource),
      candidates: homeTasks
        .filter((t) => t.id !== receiving.id && !t.archived_at && !t.parent_task_id)
        .map((t) => ({ id: t.id, title: t.title, stage: t.stage })),
      selectedIds: rows.map((r) => r.source_task_id),
    };
  });

export const setTaskFileSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ taskId: z.string().uuid(), sourceIds: z.array(z.string().uuid()).max(20) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as unknown as Untyped;
    const r = await sb.rpc("set_onboarding_task_file_sources", { _task_id: data.taskId, _source_ids: data.sourceIds });
    if (r.error) throw new Error(r.error.message);
    return { count: r.data as number };
  });

/** Template side: which steps each step shows files from. */
export const readTemplateFileSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as unknown as Untyped;
    const r = await sb.from("onboarding_template_tasks").select("id, show_files_from").eq("template_id", data.templateId);
    if (r.error) return { ready: false, byStep: {} as Record<string, string[]> };
    const byStep: Record<string, string[]> = {};
    for (const row of (r.data ?? []) as { id: string; show_files_from: string[] | null }[]) byStep[row.id] = row.show_files_from ?? [];
    return { ready: true, byStep };
  });

export const saveTemplateFileSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ stepId: z.string().uuid(), sourceIds: z.array(z.string().uuid()).max(20) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.sourceIds.includes(data.stepId)) throw new Error("A step cannot show files from itself.");
    const sb = context.supabase as unknown as Untyped;
    const r = await sb.from("onboarding_template_tasks").update({ show_files_from: [...new Set(data.sourceIds)] }).eq("id", data.stepId);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });
