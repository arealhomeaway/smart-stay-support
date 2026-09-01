CREATE UNIQUE INDEX IF NOT EXISTS breezeway_work_order_photos_photo_id_key
  ON public.breezeway_work_order_photos (breezeway_photo_id)
  WHERE breezeway_photo_id IS NOT NULL;