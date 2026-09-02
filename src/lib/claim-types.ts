import type { Database } from "@/integrations/supabase/types";

export type ClaimRow = Database["public"]["Tables"]["claims"]["Row"];
export type ClaimInsert = Database["public"]["Tables"]["claims"]["Insert"];
export type ClaimUpdate = Database["public"]["Tables"]["claims"]["Update"];
export type ClaimActivityRow = Database["public"]["Tables"]["claim_activity"]["Row"];
export type EvidenceRequirementRow = Database["public"]["Tables"]["evidence_requirements"]["Row"];
