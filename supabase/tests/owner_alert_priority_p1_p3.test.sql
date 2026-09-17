-- Apply after the historical owner read boundary and the forward Operations correction.
BEGIN;

DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.read_owner_participation(text,uuid,boolean,uuid)'::regprocedure)
 INTO definition;
 IF position('''p4''' in definition)>0 THEN
  RAISE EXCEPTION 'Owner alert projection still exposes P4';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.owner_notifications'::regclass
  AND conname='owner_notifications_priority_chk') THEN
  RAISE EXCEPTION 'Owner notifications lack the P1-P3 storage constraint';
 END IF;
END $$;

CREATE TEMP TABLE owner_priority_probe (LIKE public.owner_notifications INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
INSERT INTO owner_priority_probe(id,program_id,kind,priority,title) VALUES
 ('00000000-0000-4000-9000-000000000101','00000000-0000-4000-9000-000000000201','test','p1','Synthetic'),
 ('00000000-0000-4000-9000-000000000102','00000000-0000-4000-9000-000000000201','test','p2','Synthetic'),
 ('00000000-0000-4000-9000-000000000103','00000000-0000-4000-9000-000000000201','test','p3','Synthetic');
DO $$
BEGIN
 BEGIN
  INSERT INTO owner_priority_probe(id,program_id,kind,priority,title)
  VALUES('00000000-0000-4000-9000-000000000104','00000000-0000-4000-9000-000000000201','test','p4','Synthetic');
  RAISE EXCEPTION 'P4 was accepted by the notification priority constraint';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
ROLLBACK;
