BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('88888888-8888-4888-8888-888888888888','owner@example.test',now()),
 ('77777777-7777-4777-8777-777777777777','other@example.test',now()),
 ('66666666-6666-4666-8666-666666666666','owner@example.test',NULL);
INSERT INTO property_owners(id,active) VALUES('11111111-1111-4111-8111-111111111111',true),('22222222-2222-4222-8222-222222222222',true);
INSERT INTO properties(id,owner_record_id,is_demo) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false),
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',false),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo,owner_email)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','draft',false,'preserved-contact@example.test');
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed)
 VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included',current_date-2,true),
 ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','included',current_date-1,true);
INSERT INTO owner_invites(id,program_id,code,owner_email)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd','55555555-5555-4555-8555-555555555555','OWNER-CODE',' Owner@Example.Test ');
CREATE FUNCTION expect_invite_rejected(_user uuid,_code text,_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  PERFORM redeem_owner_invite(_user,_code);
  RAISE EXCEPTION 'unsafe redemption accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE _message THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555' AND owner_user_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM owner_invites WHERE code='OWNER-CODE' AND redeemed_by IS NOT NULL)
  OR EXISTS(SELECT 1 FROM owner_invite_redemptions)
  OR EXISTS(SELECT 1 FROM owner_program_events WHERE kind='owner_linked') THEN
  RAISE EXCEPTION 'failed redemption left partial account/invitation/history linkage';
 END IF;
END $$;

-- Raw callers cannot choose a target account, grant linkage, or forge a claim.
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF has_function_privilege('authenticated','redeem_owner_invite(uuid,text)','EXECUTE') OR has_function_privilege('anon','redeem_owner_invite(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'untrusted caller has redemption execution';
 END IF;
 BEGIN
  PERFORM redeem_owner_invite('88888888-8888-4888-8888-888888888888','OWNER-CODE');
  RAISE EXCEPTION 'authenticated raw redemption accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE owner_programs SET owner_user_id='88888888-8888-4888-8888-888888888888' WHERE id='55555555-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'direct owner account linkage accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Link the owner account through the atomic invitation action.' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo,owner_user_id)
   VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','draft',false,'88888888-8888-4888-8888-888888888888');
  RAISE EXCEPTION 'direct linked program insert accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Link the owner account through the atomic invitation action.' THEN RAISE; END IF; END;
 BEGIN
  UPDATE owner_invites SET redeemed_by='88888888-8888-4888-8888-888888888888',redeemed_at=now() WHERE code='OWNER-CODE';
  RAISE EXCEPTION 'raw invitation claim accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Redeem the owner invitation through the atomic action.' THEN RAISE; END IF; END;
 UPDATE owner_programs SET notify_email=false WHERE id='55555555-5555-4555-8555-555555555555';
 INSERT INTO owner_invites(program_id,code,owner_email) VALUES('55555555-5555-4555-8555-555555555555','STAFF-CODE','owner@example.test');
 UPDATE owner_invites SET expires_at=now()+interval '1 day' WHERE code='STAFF-CODE';
 DELETE FROM owner_invites WHERE code='STAFF-CODE';
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT expect_invite_rejected(NULL,'OWNER-CODE','That code was not recognized%');
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','MISSING','That code was not recognized%');
SELECT expect_invite_rejected('66666666-6666-4666-8666-666666666666','OWNER-CODE','Sign in with an active account%');
SELECT expect_invite_rejected('77777777-7777-4777-8777-777777777777','OWNER-CODE','That code was issued to a different email address.');
RESET ROLE;
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','Sign in with an active account%');
RESET ROLE;
UPDATE auth.users SET banned_until=NULL,deleted_at=now() WHERE id='88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','Sign in with an active account%');
RESET ROLE;
UPDATE auth.users SET deleted_at=NULL WHERE id='88888888-8888-4888-8888-888888888888';
UPDATE owner_invites SET owner_email=NULL WHERE code='OWNER-CODE';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','This invitation needs an explicit recipient%');
RESET ROLE;
UPDATE owner_invites SET owner_email='owner@example.test',expires_at=now()-interval '1 second' WHERE code='OWNER-CODE';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','That code has expired%');
RESET ROLE;
UPDATE owner_invites SET expires_at=now()+interval '1 day' WHERE code='OWNER-CODE';
UPDATE owner_programs SET is_demo=true WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','This program is not available%');
RESET ROLE;
UPDATE owner_programs SET is_demo=false,archived_at=now() WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','This program is not available%');
RESET ROLE;
UPDATE owner_programs SET archived_at=NULL,status='completed' WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','This program is not available%');
RESET ROLE;
UPDATE owner_programs SET status='draft' WHERE id='55555555-5555-4555-8555-555555555555';
UPDATE property_owners SET active=false WHERE id='11111111-1111-4111-8111-111111111111';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','ARHA must confirm the active canonical Owner%');
RESET ROLE;
UPDATE property_owners SET active=true WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE properties SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','Every enrolled Property must belong%');
RESET ROLE;
UPDATE properties SET owner_record_id='11111111-1111-4111-8111-111111111111',archived_at=now() WHERE id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','Every enrolled Property must belong%');
RESET ROLE;
UPDATE properties SET archived_at=NULL,is_demo=true WHERE id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','Every enrolled Property must belong%');
RESET ROLE;
UPDATE properties SET is_demo=false WHERE id='44444444-4444-4444-8444-444444444444';
UPDATE owner_program_properties SET closing_confirmed=false WHERE property_id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','ARHA must confirm the current enrolled properties%');
RESET ROLE;
UPDATE owner_program_properties SET closing_confirmed=true,closing_date=current_date+1 WHERE property_id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','ARHA must confirm the current enrolled properties%');
RESET ROLE;
UPDATE owner_program_properties SET closing_date=current_date-1,archived_at=now() WHERE property_id='44444444-4444-4444-8444-444444444444';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','ARHA must confirm the current enrolled properties%');
RESET ROLE;
UPDATE owner_program_properties SET archived_at=NULL WHERE property_id='44444444-4444-4444-8444-444444444444';
UPDATE owner_program_properties SET inclusion_status='removed' WHERE program_id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','ARHA must include a current Property%');
RESET ROLE;
UPDATE owner_program_properties SET inclusion_status='included' WHERE program_id='55555555-5555-4555-8555-555555555555';
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','tech');
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','This account has another access role%');
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888' AND role='tech') THEN RAISE EXCEPTION 'staff was silently demoted'; END IF; END $$;
RESET ROLE;
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888';

-- The pre-canonical legacy program deliberately remains unbound in fixture23.
-- A recipient match cannot infer or manufacture its canonical Owner identity.
UPDATE owner_invites SET program_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' WHERE code='OWNER-CODE';
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','ARHA must confirm the active canonical Owner%');
RESET ROLE;
UPDATE owner_invites SET program_id='55555555-5555-4555-8555-555555555555' WHERE code='OWNER-CODE';
-- Existing bindings or partially claimed legacy codes are never guessed/repaired.
INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo,owner_user_id)
 VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','draft',false,'88888888-8888-4888-8888-888888888888');
SET LOCAL ROLE service_role;
SELECT expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','This account is already linked to another program%');
RESET ROLE;
DELETE FROM owner_programs WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
UPDATE owner_invites SET redeemed_by='88888888-8888-4888-8888-888888888888',redeemed_at=now() WHERE code='OWNER-CODE';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM redeem_owner_invite('88888888-8888-4888-8888-888888888888','OWNER-CODE');
  RAISE EXCEPTION 'legacy partial claim repaired silently';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'That code was already used or its account linkage needs ARHA review.' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888')
  OR EXISTS(SELECT 1 FROM owner_invite_redemptions) THEN RAISE EXCEPTION 'legacy claim granted access'; END IF;
END $$;
RESET ROLE;
UPDATE owner_invites SET redeemed_by=NULL,redeemed_at=NULL WHERE code='OWNER-CODE';
DO $$ BEGIN
 BEGIN
  PERFORM redeem_owner_invite('88888888-8888-4888-8888-888888888888','OWNER-CODE');
  RAISE EXCEPTION 'non-service role invoked redemption';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Owner invitation redemption requires the authenticated server action.' THEN RAISE; END IF; END;
END $$;
-- The whole link, role, claim, receipt, and report version roll back on history failure.
CREATE FUNCTION fail_invite_link_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='owner_linked' THEN RAISE EXCEPTION 'forced owner linkage history failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fail_invite_link_history BEFORE INSERT ON owner_program_events FOR EACH ROW EXECUTE FUNCTION fail_invite_link_history();
SET LOCAL ROLE service_role;
DO $$ DECLARE seen uuid; BEGIN
 SELECT report_version INTO seen FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555';
 PERFORM expect_invite_rejected('88888888-8888-4888-8888-888888888888','OWNER-CODE','forced owner linkage history failure');
 IF EXISTS(SELECT 1 FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888')
  OR NOT EXISTS(SELECT 1 FROM owner_programs WHERE id='55555555-5555-4555-8555-555555555555' AND report_version=seen) THEN
  RAISE EXCEPTION 'history failure left role or version write';
 END IF;
END $$;
RESET ROLE;
DROP TRIGGER fail_invite_link_history ON owner_program_events;

SET LOCAL ROLE service_role;
DO $$ DECLARE linked uuid; version_after uuid; BEGIN
 linked:=redeem_owner_invite('88888888-8888-4888-8888-888888888888',' owner-code ');
 IF linked IS DISTINCT FROM '55555555-5555-4555-8555-555555555555'::uuid OR NOT EXISTS(SELECT 1 FROM owner_programs WHERE id=linked
  AND owner_user_id='88888888-8888-4888-8888-888888888888' AND owner_record_id='11111111-1111-4111-8111-111111111111'
  AND owner_email='preserved-contact@example.test' AND started_on IS NULL AND ends_on IS NULL AND status='draft' AND notify_email=false) THEN
  RAISE EXCEPTION 'redemption changed clock, contact identity, preferences, or canonical Owner';
 END IF;
 IF (SELECT count(*) FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888' AND role='owner')<>1
  OR NOT EXISTS(SELECT 1 FROM owner_invite_redemptions WHERE invite_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   AND user_id='88888888-8888-4888-8888-888888888888' AND owner_record_id='11111111-1111-4111-8111-111111111111' AND cardinality(property_ids)=2
   AND recipient_email='owner@example.test' AND email_verified_at IS NOT NULL)
  OR (SELECT count(*) FROM owner_program_events WHERE kind='owner_linked' AND actor_id='88888888-8888-4888-8888-888888888888')<>1 THEN
  RAISE EXCEPTION 'redemption did not persist role, canonical receipt, and history';
 END IF;
 SELECT report_version INTO version_after FROM owner_programs WHERE id=linked;
 PERFORM redeem_owner_invite('88888888-8888-4888-8888-888888888888','OWNER-CODE');
 IF (SELECT count(*) FROM owner_program_events WHERE kind='owner_linked')<>1
  OR NOT EXISTS(SELECT 1 FROM owner_programs WHERE id=linked AND report_version=version_after) THEN RAISE EXCEPTION 'retry was not idempotent'; END IF;
END $$;
RESET ROLE;
-- A second account with a valid recipient cannot win another code for the same program.
INSERT INTO owner_invites(program_id,code,owner_email) VALUES('55555555-5555-4555-8555-555555555555','OTHER-CODE','other@example.test');
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM redeem_owner_invite('77777777-7777-4777-8777-777777777777','OTHER-CODE');
  RAISE EXCEPTION 'competing account replaced owner';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This program is already linked to another owner account.' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
-- A removed owner role must not be silently re-granted by an idempotent retry.
DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM redeem_owner_invite('88888888-8888-4888-8888-888888888888','OWNER-CODE');
  RAISE EXCEPTION 'retry silently regranted removed owner role';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'That code was already used or its account linkage needs ARHA review.' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888') THEN RAISE EXCEPTION 'retry restored role'; END IF;
END $$;
RESET ROLE;
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','owner');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  UPDATE owner_programs SET owner_user_id='77777777-7777-4777-8777-777777777777' WHERE id='55555555-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'direct account transfer accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Link the owner account through the atomic invitation action.' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
-- Preserve the exact receipt and linkage event, including against service maintenance.
DO $$ BEGIN
 BEGIN UPDATE owner_invite_redemptions SET recipient_email='edited@example.test'; RAISE EXCEPTION 'receipt edited';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Owner invitation redemption receipts are immutable.' THEN RAISE; END IF; END;
 BEGIN DELETE FROM owner_invite_redemptions; RAISE EXCEPTION 'receipt deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Owner invitation redemption receipts are immutable.' THEN RAISE; END IF; END;
 BEGIN UPDATE owner_invites SET redeemed_by=NULL,redeemed_at=NULL WHERE code='OWNER-CODE'; RAISE EXCEPTION 'claim reset';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'A redeemed owner invitation is immutable.' THEN RAISE; END IF; END;
 BEGIN DELETE FROM owner_invites WHERE code='OWNER-CODE'; RAISE EXCEPTION 'claim deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'A redeemed owner invitation is immutable.' THEN RAISE; END IF; END;
 BEGIN UPDATE owner_program_events SET summary='edited' WHERE kind='owner_linked'; RAISE EXCEPTION 'event edited';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Owner invitation linkage history is immutable.' THEN RAISE; END IF; END;
 BEGIN DELETE FROM owner_program_events WHERE kind='owner_linked'; RAISE EXCEPTION 'event deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Owner invitation linkage history is immutable.' THEN RAISE; END IF; END;
END $$;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM owner_invite_redemptions) THEN RAISE EXCEPTION 'external owner read internal invitation receipt'; END IF;
 BEGIN
  INSERT INTO owner_program_events(program_id,kind,summary,actor_id,detail) VALUES('55555555-5555-4555-8555-555555555555','owner_linked','Forged receipt',auth.uid(),'{"source":"atomic_invite_redemption"}');
  RAISE EXCEPTION 'owner forged linkage history';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Record owner linkage history through the atomic action.' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
ROLLBACK;
