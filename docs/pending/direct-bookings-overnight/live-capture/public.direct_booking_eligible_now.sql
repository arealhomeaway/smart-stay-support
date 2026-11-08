CREATE OR REPLACE FUNCTION public.direct_booking_eligible_now()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.direct_booking_on_shift(now()) u WHERE u = auth.uid())
$function$;
