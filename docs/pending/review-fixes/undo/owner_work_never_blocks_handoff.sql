CREATE OR REPLACE FUNCTION public.owner_work_never_blocks_handoff()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- V2 rule: homeowner decisions and Active Owner work never block handoff.
  IF coalesce(NEW.requires_owner_approval,false)
     OR coalesce(NEW.tags,'{}'::text[]) @> ARRAY['active_owner'] THEN
    NEW.blocks_handoff := false;
  END IF;
  RETURN NEW;
END $function$
