-- Local only: align earlier minimal fixture policy names/grants with the
-- production baseline in 20260821043207 before exercising the actual removal.
ALTER POLICY own_review_update ON owner_reviews RENAME TO "Owners answer their own reviews";
ALTER POLICY own_review ON owner_reviews RENAME TO "Owners read their own reviews";
CREATE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql AS
 $$ SELECT public.is_internal_staff($1) $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON owner_reviews TO authenticated;
CREATE POLICY "Staff read owner reviews" ON owner_reviews
 FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY "Staff manage owner reviews" ON owner_reviews
 FOR ALL TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
