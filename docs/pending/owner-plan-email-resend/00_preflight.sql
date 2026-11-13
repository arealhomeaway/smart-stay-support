-- Preflight for the one-time resend of two failed "Your homeowner plan is ready" emails. Changes nothing.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.owner_notifications
   WHERE id IN ('161270b0-8c30-4f32-8884-22a90275ad90'::uuid, '17890bf3-7335-4345-a746-8633013a2d74'::uuid) AND kind = 'ao_plan_ready' AND email_status = 'failed' AND NOT is_demo;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Preflight: expected 2 failed plan ready emails, found %. Nothing changed.', n;
  END IF;
  -- Never a second copy: stop if a later plan ready email for the same program already went or is going out.
  IF EXISTS (SELECT 1 FROM public.owner_notifications f JOIN public.owner_notifications o
               ON o.program_id = f.program_id AND o.kind = 'ao_plan_ready' AND o.id <> f.id AND o.created_at > f.created_at
              WHERE f.id IN ('161270b0-8c30-4f32-8884-22a90275ad90'::uuid, '17890bf3-7335-4345-a746-8633013a2d74'::uuid) AND o.email_status IN ('pending', 'sending', 'sent')) THEN
    RAISE EXCEPTION 'Preflight: a later plan ready email already reached this homeowner. Nothing changed.';
  END IF;
END $$;
