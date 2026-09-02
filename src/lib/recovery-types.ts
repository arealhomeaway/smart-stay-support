import type { Database } from "@/integrations/supabase/types";
import type {
  ApprovalStatus,
  RecoveryAction,
  RecoveryOutcome,
  RecoveryStage,
} from "@/lib/guest-recovery";

type RawRecovery = Database["public"]["Tables"]["guest_recovery"]["Row"];

/**
 * The database stores the recovery vocabulary as constrained text, so the
 * generated row widens it to `string`. Narrowing here keeps every screen
 * honest about the closed sets.
 */
export type RecoveryRow = Omit<
  RawRecovery,
  "stage" | "recovery_action" | "outcome" | "approval_status"
> & {
  stage: RecoveryStage;
  recovery_action: RecoveryAction | null;
  outcome: RecoveryOutcome | null;
  approval_status: ApprovalStatus;
};

export type RecoveryUpdate = Database["public"]["Tables"]["guest_recovery"]["Update"];
export type RecoveryActivityRow = Database["public"]["Tables"]["guest_recovery_activity"]["Row"];
