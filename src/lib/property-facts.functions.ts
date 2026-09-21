import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { unknownFacts, type PropertyFacts } from "./property-facts";

export type PropertyFactsResult = {
  facts: PropertyFacts;
  unavailableReason: string | null;
  linked: boolean;
};

export const getPropertyFactsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PropertyFactsResult> => {
    const { data: row, error } = await context.supabase
      .from("properties")
      .select("ownerrez_property_id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const ownerRezId = row?.ownerrez_property_id ? String(row.ownerrez_property_id) : null;
    if (!ownerRezId) {
      return { facts: unknownFacts(), unavailableReason: null, linked: false };
    }
    const { ownerRezFacts } = await import("./property-facts.server");
    const read = await ownerRezFacts(ownerRezId);
    return { facts: read.facts, unavailableReason: read.unavailableReason, linked: true };
  });
