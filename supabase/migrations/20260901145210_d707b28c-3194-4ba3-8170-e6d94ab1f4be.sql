INSERT INTO public.feature_flags (key, label, description, enabled)
VALUES
  ('vendor_portal', 'Vendor Portal (management, directory, scorecards)', 'Hides vendor management pages and scorecards during the Operations beta. Vendor context on tickets and Breezeway work orders is unaffected.', false),
  ('quarterly_reviews', 'Quarterly property reviews', 'Hides the quarterly review workspace until it launches with the Vendor Portal.', false)
ON CONFLICT (key) DO NOTHING;