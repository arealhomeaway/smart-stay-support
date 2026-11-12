CREATE OR REPLACE FUNCTION public.can_view_owner_library_video(_library_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id) THEN false
    WHEN public.is_internal_staff(auth.uid()) THEN true
    WHEN public.has_role(auth.uid(), 'vendor'::app_role) THEN false
    ELSE (
      EXISTS (SELECT 1 FROM public.owner_programs p WHERE private.is_program_member(p.id, auth.uid()) AND p.status = 'active')
      AND EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id AND l.active)
    ) OR EXISTS (
      SELECT 1 FROM public.work_items w JOIN public.owner_programs p ON p.id = w.program_id
      WHERE w.library_template_id = _library_id AND w.kind = 'opportunity'
        AND private.is_program_member(p.id, auth.uid()) AND w.retired_at IS NULL AND w.status NOT IN ('archived', 'draft')
    )
  END
$function$
;

