-- Unapplied. Store the generated participation report in the same update as closeout.
ALTER TABLE public.owner_programs ADD COLUMN completion_report jsonb;
COMMENT ON COLUMN public.owner_programs.completion_report IS 'Participation snapshot generated before formal closeout; preserves the report used for that decision.';
