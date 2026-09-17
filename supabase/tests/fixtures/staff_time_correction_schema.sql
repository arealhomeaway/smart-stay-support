-- Isolated role predicate: one supervisor, every other actor denied.
CREATE FUNCTION public.has_role(_actor uuid,_role text) RETURNS boolean LANGUAGE sql AS $$
 SELECT _actor='99999999-9999-4999-8999-999999999999'::uuid AND _role='manager'
$$;
CREATE TABLE owner_program_events(program_id uuid,entry_id uuid,review_id uuid,kind text,summary text,actor_id uuid,previous_value text,new_value text,reason text,detail jsonb);
