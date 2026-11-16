CREATE TABLE public.event_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_banners TO anon;
GRANT SELECT, INSERT, DELETE ON public.event_banners TO authenticated;
GRANT ALL ON public.event_banners TO service_role;
ALTER TABLE public.event_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads events" ON public.event_banners FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins add events" ON public.event_banners FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete events" ON public.event_banners FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins upload event images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'events' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete event images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'events' AND public.has_role(auth.uid(),'admin'));