CREATE TABLE public.lobby_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  username text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lobby_messages_created_idx ON public.lobby_messages (created_at DESC);

GRANT SELECT, INSERT ON public.lobby_messages TO authenticated;
GRANT ALL ON public.lobby_messages TO service_role;
ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in read lobby chat" ON public.lobby_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Send own lobby chat" ON public.lobby_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins delete lobby chat" ON public.lobby_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
GRANT DELETE ON public.lobby_messages TO authenticated;

-- Name always comes from the sender's profile so nobody can post as someone else.
CREATE OR REPLACE FUNCTION public.set_lobby_message_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.username := COALESCE((SELECT username FROM public.profiles WHERE id = auth.uid()), 'PEMAIN');
  NEW.body := btrim(NEW.body);
  NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER lobby_messages_set_name BEFORE INSERT ON public.lobby_messages
FOR EACH ROW EXECUTE FUNCTION public.set_lobby_message_name();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages;