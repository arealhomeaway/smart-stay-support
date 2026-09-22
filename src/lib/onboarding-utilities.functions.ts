import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const utilitiesBoardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!staff) throw new Error("You do not have access to the utilities board.");
    const { loadUtilitiesBoard } = await import("./onboarding-utilities.server");
    return loadUtilitiesBoard(context.supabase);
  });
