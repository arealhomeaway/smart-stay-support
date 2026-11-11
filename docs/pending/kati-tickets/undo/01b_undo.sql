-- Undo for 01b_review_blocker_fix.sql: run undo/01_undo.sql (it drops bulk_complete_onboarding_tasks), then this.
DROP FUNCTION IF EXISTS private.onboarding_bulk_review_blocker(uuid);
