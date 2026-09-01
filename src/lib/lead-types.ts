import type { Database } from "@/integrations/supabase/types";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
export type LeadActivityRow = Database["public"]["Tables"]["lead_activity"]["Row"];
