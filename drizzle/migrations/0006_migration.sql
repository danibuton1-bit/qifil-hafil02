-- World chat: only the last 24 hours are visible, older rows are purged on each new message.
DROP POLICY IF EXISTS "Signed-in read lobby chat" ON public.lobby_messages;
CREATE POLICY "Signed-in read last 24h lobby chat" ON public.lobby_messages
  FOR SELECT TO authenticated USING (created_at > now() - interval '24 hours');

CREATE INDEX IF NOT EXISTS lobby_messages_created_at_idx ON public.lobby_messages (created_at);

CREATE OR REPLACE FUNCTION public.purge_old_lobby_messages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.lobby_messages WHERE created_at < now() - interval '24 hours';
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS lobby_messages_purge_old ON public.lobby_messages;
CREATE TRIGGER lobby_messages_purge_old AFTER INSERT ON public.lobby_messages
  FOR EACH STATEMENT EXECUTE FUNCTION public.purge_old_lobby_messages();

-- Private chat between two players.
CREATE TABLE public.private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  recipient_name text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.private_messages TO authenticated;
GRANT ALL ON public.private_messages TO service_role;

ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own private chats" ON public.private_messages
  FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Send own private chats" ON public.private_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND recipient_id <> auth.uid());

CREATE INDEX private_messages_sender_idx ON public.private_messages (sender_id, created_at);
CREATE INDEX private_messages_recipient_idx ON public.private_messages (recipient_id, created_at);

CREATE OR REPLACE FUNCTION public.set_private_message_names()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rname text;
BEGIN
  NEW.sender_id := auth.uid();
  NEW.body := left(btrim(NEW.body), 200);
  IF NEW.body = '' THEN RAISE EXCEPTION 'Pesan kosong'; END IF;
  SELECT username INTO rname FROM public.profiles WHERE id = NEW.recipient_id;
  IF rname IS NULL THEN RAISE EXCEPTION 'Pemain tidak ditemukan'; END IF;
  NEW.recipient_name := rname;
  NEW.sender_name := COALESCE((SELECT username FROM public.profiles WHERE id = auth.uid()), 'PEMAIN');
  NEW.created_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER private_messages_set_names BEFORE INSERT ON public.private_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_private_message_names();

ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;