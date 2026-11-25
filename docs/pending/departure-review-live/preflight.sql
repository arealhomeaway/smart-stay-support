SELECT (SELECT value FROM public.app_settings WHERE key='departure_review_live_homes') setting_now,
  to_regprocedure('public.create_departure_review_from_clean(uuid)') IS NOT NULL rule_exists,
  to_regprocedure('public.set_departure_review_live(boolean)') IS NULL switch_absent,
  (SELECT count(*) FROM public.departure_reviews WHERE NOT is_demo) real_reviews;
