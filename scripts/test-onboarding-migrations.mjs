// Isolated PostgreSQL verification; no network or live connection is used.
// Install @electric-sql/pglite in .codex-qa.local first (see build progress).
import { readFileSync } from "node:fs";
import { PGlite } from "../.codex-qa.local/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
try {
  for (const path of [
    "supabase/tests/fixtures/onboarding_fact_review_schema.sql",
    "supabase/migrations/20260914010000_atomic_onboarding_fact_review.sql",
    "supabase/tests/onboarding_fact_review.test.sql",
    "supabase/tests/fixtures/onboarding_stage_capture_schema.sql",
    "supabase/migrations/20260914020000_versioned_onboarding_stage_capture.sql",
    "supabase/tests/onboarding_stage_capture.test.sql",
    "supabase/tests/fixtures/onboarding_financial_schema.sql",
    "supabase/migrations/20260914030000_onboarding_actual_cost.sql",
    "supabase/migrations/20260914040000_atomic_onboarding_financial_decision.sql",
    "supabase/tests/onboarding_financial_decision.test.sql",
    "supabase/tests/fixtures/onboarding_handoff_schema.sql",
    "supabase/migrations/20260914050000_atomic_onboarding_handoff_review.sql",
    "supabase/tests/onboarding_handoff_review.test.sql",
    "supabase/tests/fixtures/onboarding_approval_preparation_schema.sql",
    "supabase/migrations/20260914060000_prepare_onboarding_financial_approval.sql",
    "supabase/tests/onboarding_approval_preparation.test.sql",
    "supabase/migrations/20260914070000_onboarding_authority_policy_snapshot.sql",
    "supabase/tests/fixtures/onboarding_task_approval_schema.sql",
    "supabase/migrations/20260914080000_prepare_onboarding_task_approval.sql",
    "supabase/tests/onboarding_task_approval.test.sql",
    "supabase/tests/fixtures/onboarding_task_decision_schema.sql",
    "supabase/migrations/20260914090000_atomic_onboarding_task_decision.sql",
    "supabase/tests/onboarding_task_decision.test.sql",
    "supabase/tests/fixtures/owner_task_response_schema.sql",
    "supabase/migrations/20260914100000_atomic_owner_task_response.sql",
    "supabase/tests/owner_task_response.test.sql",
    "supabase/migrations/20260914110000_atomic_owner_financial_response.sql",
    "supabase/tests/owner_financial_response.test.sql",
    "supabase/migrations/20260914120000_onboarding_delivery_attempts.sql",
    "supabase/migrations/20260914130000_reconcile_onboarding_delivery.sql",
    "supabase/tests/onboarding_delivery_reconciliation.test.sql",
    "supabase/migrations/20260914140000_reviewed_property_assets.sql",
    "supabase/tests/onboarding_asset_review.test.sql",
    "supabase/tests/onboarding_fact_review.test.sql",
  ]) {
    await db.exec(readFileSync(path, "utf8"));
    console.log(`PASS ${path}`);
  }
} finally {
  await db.close();
}
