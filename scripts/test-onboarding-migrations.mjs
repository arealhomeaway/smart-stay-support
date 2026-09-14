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
  ]) {
    await db.exec(readFileSync(path, "utf8"));
    console.log(`PASS ${path}`);
  }
} finally {
  await db.close();
}
