/**
 * Optional Opportunity Library: reusable remote participation ideas.
 * Templates are never live Opportunities; the homeowner starting one creates
 * exactly one Opportunity on exactly one of their homes (database-enforced).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LibraryTemplate = {
  id: string;
  title: string;
  summary: string;
  what: string;
  why: string;
  how: string;
  ways_to_document: string;
  suggested_minutes: number | null;
  category: string;
  image_key: string;
  tags: string[];
  resource_label: string | null;
  resource_url: string | null;
  active: boolean;
  sort_order: number;
};

const COLUMNS =
  "id, title, summary, what, why, how, ways_to_document, suggested_minutes, category, image_key, tags, resource_label, resource_url, active, sort_order";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Active templates, in library order (owners and staff). */
export const listOptionalLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("owner_opportunity_library")
      .select(COLUMNS)
      .eq("active", true)
      .order("sort_order")
      .order("title");
    fail(error);
    return (data ?? []) as LibraryTemplate[];
  });

/** Every template including inactive ones (leadership only by RLS). */
export const manageOptionalLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("owner_opportunity_library")
      .select(COLUMNS)
      .order("sort_order")
      .order("title");
    fail(error);
    return (data ?? []) as LibraryTemplate[];
  });

const templateInput = z.object({
  id: z.string().uuid().nullable(),
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(3).max(240),
  what: z.string().trim().min(3).max(100000),
  why: z.string().trim().min(3).max(100000),
  how: z.string().trim().min(3).max(100000),
  ways_to_document: z.string().trim().min(3).max(100000),
  suggested_minutes: z.number().int().min(5).max(1440).nullable(),
  category: z.string().trim().min(2).max(40),
  image_key: z.string().trim().min(2).max(40),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  resource_label: z.string().trim().max(120).nullable(),
  resource_url: z.string().trim().url().max(1000).nullable(),
  active: z.boolean(),
});

export const saveOptionalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateInput.parse(d))
  .handler(async ({ context, data }) => {
    const { id, ...row } = data;
    if (id) {
      const { error } = await context.supabase.from("owner_opportunity_library").update(row).eq("id", id);
      fail(error);
      return { id };
    }
    const last = await context.supabase
      .from("owner_opportunity_library")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: created, error } = await context.supabase
      .from("owner_opportunity_library")
      .insert({ ...row, sort_order: (last.data?.sort_order ?? 0) + 10, created_by: context.userId })
      .select("id")
      .single();
    fail(error);
    return { id: created!.id as string };
  });

export const reorderOptionalLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    for (const [i, id] of data.ids.entries()) {
      const { error } = await context.supabase
        .from("owner_opportunity_library")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", id);
      fail(error);
    }
    return { ok: true };
  });

/** The homeowner starts one idea for one of their homes. Idempotent per home. */
export const startOptionalOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ templateId: z.string().uuid(), propertyId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: id, error } = await context.supabase.rpc("start_optional_opportunity", {
      _template_id: data.templateId,
      _property_id: data.propertyId,
    });
    fail(error);
    return { id: id as string };
  });
