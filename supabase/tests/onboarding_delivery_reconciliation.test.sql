BEGIN;
ALTER TABLE approvals ADD owner_email_to text, ADD owner_email_sent_at timestamptz, ADD external_reference text;
ALTER TABLE financial_requests ADD accounting_recipient text, ADD accounting_sent_at timestamptz;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO approvals(id,status,onboarding_delivery_attempt) VALUES('99999999-9999-4999-8999-999999999999','pending','{"id":"88888888-8888-4888-8888-888888888888","state":"sending","recipient":"qa@example.invalid","attemptedAt":"2026-09-14T12:00:00Z"}');
DO $$ BEGIN
 BEGIN
  PERFORM reconcile_onboarding_delivery('approval','99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',false,'Verified no delivery');
  RAISE EXCEPTION 'active attempt released';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The attempt changed%' THEN RAISE; END IF; END;
END $$;
UPDATE approvals SET onboarding_delivery_attempt=jsonb_set(onboarding_delivery_attempt,'{state}','"uncertain"');
SELECT reconcile_onboarding_delivery('approval','99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',false,'Verified delivery failure in mailbox record QA-1');
DO $$ BEGIN
 IF (SELECT onboarding_delivery_attempt FROM approvals) IS NOT NULL THEN RAISE EXCEPTION 'claim not released'; END IF;
 IF (SELECT jsonb_array_length(onboarding_delivery_history) FROM approvals) <> 1 THEN RAISE EXCEPTION 'verification history missing'; END IF;
END $$;
UPDATE approvals SET onboarding_delivery_attempt='{"id":"88888888-8888-4888-8888-888888888888","state":"sent_unrecorded","recipient":"qa@example.invalid","attemptedAt":"2026-09-14T12:00:00Z"}';
DO $$ BEGIN
 BEGIN
  PERFORM reconcile_onboarding_delivery('approval','99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',false,'Attempted unsafe retry');
  RAISE EXCEPTION 'accepted email released';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The provider accepted%' THEN RAISE; END IF; END;
END $$;
SELECT reconcile_onboarding_delivery('approval','99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',true,'Verified sent message QA-2');
DO $$ BEGIN
 IF (SELECT owner_email_to FROM approvals) <> 'qa@example.invalid' OR (SELECT owner_email_sent_at FROM approvals) IS NULL THEN RAISE EXCEPTION 'delivery not recorded'; END IF;
 IF (SELECT jsonb_array_length(onboarding_delivery_history) FROM approvals) <> 2 THEN RAISE EXCEPTION 'history overwritten'; END IF;
END $$;

INSERT INTO financial_requests(id,status,onboarding_delivery_attempt) VALUES('77777777-7777-4777-8777-777777777777','invoiced','{"id":"66666666-6666-4666-8666-666666666666","state":"uncertain","recipient":"accounting@example.invalid","attemptedAt":"2026-09-14T12:00:00Z"}');
ALTER TABLE financial_requests ADD CONSTRAINT simulate_delivery_receipt_failure CHECK(accounting_sent_at IS NULL);
DO $$ BEGIN
 BEGIN
  PERFORM reconcile_onboarding_delivery('accounting','77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666',true,'Verified sent message QA-3');
  RAISE EXCEPTION 'receipt failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT jsonb_array_length(onboarding_delivery_history) FROM financial_requests) <> 0 THEN RAISE EXCEPTION 'partial reconciliation persisted'; END IF;
 BEGIN
  PERFORM reconcile_onboarding_delivery('accounting','77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555',false,'Stale selection QA-4');
  RAISE EXCEPTION 'stale attempt accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The attempt changed%' THEN RAISE; END IF; END;
END $$;
ALTER TABLE financial_requests DROP CONSTRAINT simulate_delivery_receipt_failure;
SELECT reconcile_onboarding_delivery('accounting','77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666',true,'Verified sent message QA-3');
DO $$ BEGIN
 IF (SELECT status FROM financial_requests) <> 'sent_to_accounting' OR (SELECT accounting_recipient FROM financial_requests) <> 'accounting@example.invalid' THEN RAISE EXCEPTION 'accounting handoff not recorded'; END IF;
END $$;
SELECT set_config('test.staff','false',true);
DO $$ BEGIN
 BEGIN
  PERFORM reconcile_onboarding_delivery('approval','99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',true,'Unauthorized action QA-5');
  RAISE EXCEPTION 'unauthorized reconciliation';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only onboarding staff%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
