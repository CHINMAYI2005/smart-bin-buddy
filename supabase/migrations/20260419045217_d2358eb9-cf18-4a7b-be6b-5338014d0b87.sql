-- Roles
CREATE TYPE public.app_role AS ENUM ('operator', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + grant operator role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bins
CREATE TYPE public.bin_status AS ENUM ('ok', 'nearly_full', 'full', 'emptied');

CREATE TABLE public.bins (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status bin_status NOT NULL DEFAULT 'ok',
  fill_percent INTEGER NOT NULL DEFAULT 0 CHECK (fill_percent BETWEEN 0 AND 100),
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators view bins" ON public.bins FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators manage bins" ON public.bins FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_bins_updated_at BEFORE UPDATE ON public.bins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Truck state (singleton)
CREATE TYPE public.truck_mode AS ENUM ('auto', 'manual');
CREATE TYPE public.truck_run_state AS ENUM ('idle', 'moving', 'dumping', 'returning', 'full');

CREATE TABLE public.truck_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode truck_mode NOT NULL DEFAULT 'manual',
  state truck_run_state NOT NULL DEFAULT 'idle',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  heading DOUBLE PRECISION DEFAULT 0,
  fill_percent INTEGER NOT NULL DEFAULT 0 CHECK (fill_percent BETWEEN 0 AND 100),
  target_bin_id TEXT REFERENCES public.bins(id) ON DELETE SET NULL,
  last_seen TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.truck_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators view truck" ON public.truck_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators update truck" ON public.truck_state FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_truck_state_updated_at BEFORE UPDATE ON public.truck_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.truck_state (id, mode, state) VALUES (1, 'manual', 'idle');

-- Commands queue
CREATE TYPE public.command_type AS ENUM ('F', 'B', 'S', 'DUMP', 'GOTO', 'RETURN');
CREATE TYPE public.command_status AS ENUM ('pending', 'sent', 'done', 'failed');

CREATE TABLE public.commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type command_type NOT NULL,
  payload JSONB,
  status command_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  acked_at TIMESTAMPTZ
);
CREATE INDEX idx_commands_pending ON public.commands(status, priority DESC, created_at);
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators view commands" ON public.commands FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators insert commands" ON public.commands FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  bin_id TEXT REFERENCES public.bins(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators view events" ON public.events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));

-- Device tokens (for ESP32)
CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators manage device tokens" ON public.device_tokens FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.truck_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commands;

-- Seed a default device token for ESP32 (user can rotate later)
INSERT INTO public.device_tokens (name, token) VALUES ('default-esp32', encode(gen_random_bytes(24), 'hex'));

-- Seed a few demo bins
INSERT INTO public.bins (id, label, lat, lng, status, fill_percent) VALUES
  ('BIN_001', 'Location A — Main St', 40.7128, -74.0060, 'ok', 20),
  ('BIN_002', 'Location B — Park Ave', 40.7138, -74.0080, 'nearly_full', 75),
  ('BIN_003', 'Location C — 5th Ave',  40.7148, -74.0040, 'full', 100);

-- Seed truck location at base
UPDATE public.truck_state SET lat = 40.7120, lng = -74.0070 WHERE id = 1;