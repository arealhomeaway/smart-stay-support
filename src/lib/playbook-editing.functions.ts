import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { playbookContentSchema } from "./playbook-editing";

export const savePlaybookEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), expectedUpdatedAt: z.string(), content: playbookContentSchema }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("save_playbook_draft" as never, {
      _id: data.id, _expected_updated_at: data.expectedUpdatedAt, _content: data.content,
    } as never);
    if (error) throw new Error(error.code === "PGRST202" ? "Playbook editing is not available yet. The approved setup still needs to be applied." : error.message);
    return result as unknown as { id: string; version: number; created: boolean };
  });

export const changePlaybookState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), expectedUpdatedAt: z.string(), action: z.enum(["approve", "archive", "note", "submit"]), note: z.string() }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("change_playbook_state" as never, {
      _id: data.id, _expected_updated_at: data.expectedUpdatedAt, _action: data.action, _note: data.note,
    } as never);
    if (error) throw new Error(error.code === "PGRST202" ? "Playbook editing is not available yet. The approved setup still needs to be applied." : error.message);
    return result as unknown as { id: string; version: number };
  });