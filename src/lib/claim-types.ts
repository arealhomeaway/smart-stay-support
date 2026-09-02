import type { Database } from "@/integrations/supabase/types";
import type { ClaimDisposition, ClaimStage, ClaimType } from "@/lib/claims";

type RawClaim = Database["public"]["Tables"]["claims"]["Row"];

/**
 * The database stores the claim vocabulary as text with check constraints, so
 * the generated row widens it to `string`. Narrowing here keeps every screen
 * honest about the closed set of types, stages and dispositions.
 */
export type ClaimRow = Omit<RawClaim, "claim_type" | "stage" | "disposition"> & {
  claim_type: ClaimType;
  stage: ClaimStage;
  disposition: ClaimDisposition | null;
};

export type ClaimInsert = Database["public"]["Tables"]["claims"]["Insert"];
export type ClaimUpdate = Database["public"]["Tables"]["claims"]["Update"];
export type ClaimActivityRow = Database["public"]["Tables"]["claim_activity"]["Row"];
export type EvidenceRequirementRow = Database["public"]["Tables"]["evidence_requirements"]["Row"];
