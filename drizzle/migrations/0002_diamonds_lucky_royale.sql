CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  diamonds integer NOT NULL DEFAULT 200,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own wallet read" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
INSERT INTO public.wallets (user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_wallet() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER profiles_create_wallet AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_wallet();

CREATE TABLE public.lucky_skins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  hat text NOT NULL,
  rarity text NOT NULL DEFAULT 'common',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lucky_skins TO authenticated;
GRANT ALL ON public.lucky_skins TO service_role;
ALTER TABLE public.lucky_skins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View skins" ON public.lucky_skins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins add skins" ON public.lucky_skins FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins edit skins" ON public.lucky_skins FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete skins" ON public.lucky_skins FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_skins (
  user_id uuid NOT NULL,
  skin_id uuid NOT NULL REFERENCES public.lucky_skins(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skin_id)
);
GRANT SELECT ON public.user_skins TO authenticated;
GRANT ALL ON public.user_skins TO service_role;
ALTER TABLE public.user_skins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own skins read" ON public.user_skins FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.spin_lucky() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal int; s public.lucky_skins; r float; dup boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus masuk'; END IF;
  INSERT INTO wallets (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT diamonds INTO bal FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF bal < 20 THEN RAISE EXCEPTION 'Diamond tidak cukup'; END IF;
  IF NOT EXISTS (SELECT 1 FROM lucky_skins WHERE active) THEN RAISE EXCEPTION 'Belum ada hadiah'; END IF;
  r := random();
  SELECT * INTO s FROM lucky_skins WHERE active AND rarity = CASE WHEN r < 0.05 THEN 'legendary' WHEN r < 0.20 THEN 'epic' WHEN r < 0.50 THEN 'rare' ELSE 'common' END ORDER BY random() LIMIT 1;
  IF s.id IS NULL THEN SELECT * INTO s FROM lucky_skins WHERE active ORDER BY random() LIMIT 1; END IF;
  UPDATE wallets SET diamonds = diamonds - 20, updated_at = now() WHERE user_id = auth.uid();
  dup := EXISTS (SELECT 1 FROM user_skins WHERE user_id = auth.uid() AND skin_id = s.id);
  INSERT INTO user_skins (user_id, skin_id) VALUES (auth.uid(), s.id) ON CONFLICT DO NOTHING;
  RETURN json_build_object('id', s.id, 'name', s.name, 'body', s.body, 'hat', s.hat, 'rarity', s.rarity, 'duplicate', dup, 'diamonds', bal - 20);
END $$;
REVOKE EXECUTE ON FUNCTION public.spin_lucky() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.spin_lucky() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_give_diamonds(_player_id text, _amount int) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; nm text; bal int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'Jumlah tidak valid'; END IF;
  SELECT id, username INTO uid, nm FROM profiles WHERE player_id = _player_id;
  IF uid IS NULL THEN RAISE EXCEPTION 'ID pemain tidak ditemukan'; END IF;
  INSERT INTO wallets (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  UPDATE wallets SET diamonds = diamonds + _amount, updated_at = now() WHERE user_id = uid RETURNING diamonds INTO bal;
  RETURN json_build_object('username', nm, 'diamonds', bal);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_give_diamonds(text,int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_give_diamonds(text,int) TO authenticated;