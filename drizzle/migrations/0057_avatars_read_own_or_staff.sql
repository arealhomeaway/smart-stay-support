DROP POLICY IF EXISTS "Signed-in people can view avatars" ON storage.objects;
CREATE POLICY "Own avatar or staff can view avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.is_staff(auth.uid()))
  );