CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- The first signed-in player to open the admin panel becomes the admin; after that nobody else can claim it.
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN public.has_role(auth.uid(), 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin');
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

ALTER TABLE public.music_tracks ADD COLUMN category text NOT NULL DEFAULT 'game' CHECK (category IN ('game','lobby'));

DROP POLICY "Signed-in can add music" ON public.music_tracks;
DROP POLICY "Signed-in can delete music" ON public.music_tracks;
CREATE POLICY "Admins add music" ON public.music_tracks FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete music" ON public.music_tracks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY "Upload music files" ON storage.objects;
DROP POLICY "Delete music files" ON storage.objects;
CREATE POLICY "Admins upload music files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'music' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete music files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'music' AND public.has_role(auth.uid(),'admin'));