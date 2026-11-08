CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$ SELECT private.is_supervisor(_user_id) $function$

