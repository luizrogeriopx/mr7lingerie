CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.site_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  site_name TEXT NOT NULL DEFAULT 'Meu Catálogo',
  tagline TEXT DEFAULT 'Peças selecionadas, entrega rápida',
  about TEXT,
  logo_url TEXT,
  whatsapp TEXT,
  email TEXT,
  instagram TEXT,
  address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id)
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER site_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.site_settings (id) VALUES (true);

CREATE TABLE public.attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.attributes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attributes TO authenticated;
GRANT ALL ON public.attributes TO service_role;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attributes public read" ON public.attributes FOR SELECT USING (true);
CREATE POLICY "attributes admin write" ON public.attributes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  color_hex TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attribute_id, value)
);
GRANT SELECT ON public.attribute_values TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attribute_values TO authenticated;
GRANT ALL ON public.attribute_values TO service_role;
ALTER TABLE public.attribute_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attr values public read" ON public.attribute_values FOR SELECT USING (true);
CREATE POLICY "attr values admin write" ON public.attribute_values FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images public read" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "images admin write" ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.product_attribute_values (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES public.attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, attribute_value_id)
);
GRANT SELECT ON public.product_attribute_values TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attribute_values TO authenticated;
GRANT ALL ON public.product_attribute_values TO service_role;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pav public read" ON public.product_attribute_values FOR SELECT USING (true);
CREATE POLICY "pav admin write" ON public.product_attribute_values FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  note TEXT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders public insert" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders admin read" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders admin update" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  options TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1
);
GRANT INSERT ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items public insert" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order items admin read" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "order items admin write" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

WITH a AS (
  INSERT INTO public.attributes (name, sort_order) VALUES ('Tamanho', 1), ('Cor', 2), ('Número', 3)
  RETURNING id, name
)
INSERT INTO public.attribute_values (attribute_id, value, color_hex, sort_order)
SELECT a.id, v.value, v.color_hex, v.sort_order FROM a
JOIN (VALUES
  ('Tamanho','P',NULL,1),('Tamanho','M',NULL,2),('Tamanho','G',NULL,3),
  ('Tamanho','GG',NULL,4),('Tamanho','EG',NULL,5),('Tamanho','EXG',NULL,6),
  ('Cor','Preto','#000000',1),('Cor','Branco','#FFFFFF',2),('Cor','Vermelho','#D22B2B',3),
  ('Cor','Azul','#2D6CDF',4),('Cor','Verde','#2E8B57',5),('Cor','Bege','#D8C3A5',6),
  ('Número','36',NULL,1),('Número','37',NULL,2),('Número','38',NULL,3),('Número','39',NULL,4),
  ('Número','40',NULL,5),('Número','41',NULL,6),('Número','42',NULL,7),('Número','43',NULL,8)
) AS v(attr, value, color_hex, sort_order) ON v.attr = a.name;

CREATE POLICY "catalog read" ON storage.objects FOR SELECT USING (bucket_id = 'catalog');
CREATE POLICY "catalog admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "catalog admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "catalog admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog' AND public.has_role(auth.uid(), 'admin'));