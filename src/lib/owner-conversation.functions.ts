import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConversationMessage } from "./owner-conversation";

const idOnly = (d: unknown) => z.object({ id: z.string().uuid() }).parse(d);

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Messages for one request. RLS limits this to staff or the enrolled homeowner. */
export const readOwnerConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idOnly)
  .handler(async ({ context, data }) => {
    const res = await context.supabase
      .from("owner_request_messages")
      .select("id, author_type, author_name, body, event, request_kind, created_at")
      .eq("work_item_id", data.id)
      .order("created_at", { ascending: true });
    fail(res.error);
    return (res.data ?? []) as ConversationMessage[];
  });

export const postOwnerConversationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1, "Type a message before sending.").max(5000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("post_owner_request_message", { _id: data.id, _body: data.body })).error);
    return { ok: true as const };
  });

/** Staff: explicitly ask the homeowner for fresh feedback or a new decision. */
export const requestOwnerResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      body: z.string().trim().min(1, "Explain what you are asking the homeowner.").max(5000),
      kind: z.enum(["feedback", "decision"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("request_owner_response", { _id: data.id, _body: data.body, _kind: data.kind })).error);
    return { ok: true as const };
  });

export const resolveOwnerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idOnly)
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("resolve_owner_request", { _id: data.id })).error);
    return { ok: true as const };
  });

export const reopenOwnerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idOnly)
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("reopen_owner_request", { _id: data.id })).error);
    return { ok: true as const };
  });
