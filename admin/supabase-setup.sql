-- =============================================================
-- Naples Estate Jewelry — Phase 1 Supabase Setup
-- Run this ONCE in your Supabase SQL Editor (supabase.com → SQL Editor)
-- =============================================================


-- =============================================================
-- 1. ADD is_admin TO PROFILES & SET YOUR ACCOUNT AS ADMIN
-- =============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE profiles
SET is_admin = true
WHERE id = 'f4bb3ae2-d783-4f3c-8729-35eb39b9dafd';


-- =============================================================
-- 2. CREATE PRODUCTS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS products (
  id                  TEXT PRIMARY KEY,
  category            TEXT NOT NULL DEFAULT 'Gold',
  title               TEXT NOT NULL,
  title_es            TEXT,
  price_label         TEXT,
  manual_price_label  TEXT,
  price_mode          TEXT NOT NULL DEFAULT 'spot-multiplier',
  purity              INTEGER,
  weight_grams        NUMERIC(8,2),
  pricing_multiplier  NUMERIC(5,3),
  status              TEXT NOT NULL DEFAULT 'Available',
  images              JSONB NOT NULL DEFAULT '[]',
  description         TEXT,
  description_es      TEXT,
  details             JSONB NOT NULL DEFAULT '[]',
  details_es          JSONB NOT NULL DEFAULT '[]',
  tags                JSONB NOT NULL DEFAULT '[]',
  tags_es             JSONB NOT NULL DEFAULT '[]',
  private_price_label TEXT,
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-stamp updated_at on every edit
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================
-- 3. ROW LEVEL SECURITY — PRODUCTS
-- =============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (including unauthenticated visitors) can browse products
CREATE POLICY "products_public_read"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write: only accounts where is_admin = true can insert/update/delete
CREATE POLICY "products_admin_all"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );


-- =============================================================
-- 4. STORAGE BUCKET: product-images
-- =============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  52428800,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read: storefront can load all product images without auth
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Admin upload
CREATE POLICY "product_images_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Admin update (rename / move)
CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Admin delete
CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );


-- =============================================================
-- 5. MIGRATE ALL 20 EXISTING PRODUCTS
--    Images keep their current local paths for now.
--    New products added via the admin panel will use
--    Supabase Storage URLs instead.
-- =============================================================

INSERT INTO products (
  id, category, title, title_es,
  price_label, manual_price_label, price_mode,
  purity, weight_grams, pricing_multiplier,
  status, images, description, description_es,
  details, details_es, tags, tags_es, sort_order
) VALUES

-- 1
(
  '18k-rectangular-anchor-link-chain-necklace-01', 'Gold',
  '18K Gold Rectangular Anchor Link Chain Necklace',
  'Collar de Cadena de Eslabón Ancla Rectangular de Oro de 18K',
  '$1,729.62', '$1,729.62', 'spot-multiplier', 18, 12.7, 1.25, 'Available',
  '["/assets/images/shop/shop-18k-rectangular-anchor-link-chain-01.png","/assets/images/shop/shop-18k-rectangular-anchor-link-chain-02.png","/assets/images/shop/shop-18k-rectangular-anchor-link-chain-03.png"]'::jsonb,
  '18K yellow gold rectangular anchor-style link chain necklace with a refined, open-link profile and excellent length for wearing alone or with a pendant. The chain measures 27.5 inches long, approximately 2.2mm wide, and weighs 12.7 grams, giving it an elegant slim presence with true 18K gold value. It secures with a distinctive hook-and-loop clasp system that feels secure while adding a unique design detail. The circular loop portion of the clasp is stamped 750.',
  'Collar de cadena de eslabón estilo ancla rectangular de oro amarillo de 18K con un perfil refinado de eslabón abierto y un largo excelente para usar solo o con un dije. La cadena mide 27.5 pulgadas de largo, aproximadamente 2.2mm de ancho, y pesa 12.7 gramos, lo que le da una presencia esbelta y elegante con el verdadero valor del oro de 18K. Se cierra con un distintivo sistema de broche de gancho y argolla que se siente seguro a la vez que añade un detalle de diseño único. La parte de la argolla circular del broche está marcada con 750.',
  '["Category: Gold","Metal: 18K yellow gold","Style: Rectangular anchor-style link chain necklace","Weight: 12.7 grams","Width: 2.2mm","Length: 27.5 inches","Pendant use: Excellent length and profile for a pendant","Clasp: Secure hook-and-loop style clasp","Mark: 750 stamped on circular clasp loop","Price: $1,729.62"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 18K","Estilo: Collar de cadena de eslabón estilo ancla rectangular","Peso: 12.7 gramos","Ancho: 2.2mm","Largo: 27.5 pulgadas","Uso con dije: Largo y perfil excelentes para un dije","Broche: Broche seguro estilo gancho y argolla","Marca: 750 grabado en la argolla circular del broche","Precio: $1,729.62"]'::jsonb,
  '["18k","750","yellow gold","gold necklace","rectangular link","anchor link","open link","hook clasp","loop clasp","hook and loop clasp","pendant chain","12.7 grams","2.2mm","27.5 inch","estate jewelry"]'::jsonb,
  '["18k","750","oro amarillo","collar de oro","eslabón rectangular","eslabón ancla","eslabón abierto","broche de gancho","broche de argolla","broche de gancho y argolla","cadena para dije","12.7 gramos","2.2mm","27.5 pulgadas","joyería de patrimonio"]'::jsonb,
  1
),

-- 2
(
  '14k-heavy-diamond-cut-cuban-link-chain-necklace-01', 'Gold',
  'Heavy Solid 14K Gold Diamond Cut Cuban Link Chain Necklace',
  'Collar de Cadena de Eslabón Cubano con Corte Diamante de Oro Sólido Pesado de 14K',
  '$2,945.46', '$2,945.46', 'spot-multiplier', 14, 27.8, 1.25, 'Available',
  '["/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-01.png","/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-02.png","/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-03.png","/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-04.png","/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-05.png","/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-06.png","/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-07.png","/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-08.png"]'::jsonb,
  'Heavy solid 14K yellow gold diamond cut Cuban link chain necklace with tight, substantial construction and a bright faceted finish. At 24 inches long, approximately 4.7mm wide, and 27.8 grams, it has the right balance for everyday wear: enough weight and presence to feel substantial, but still an easy size to wear regularly. The solid gold construction also gives it lasting intrinsic value, making it both a sharp daily chain and a strong gold investment piece. Finished with a lobster clasp and 14K marks on the end fittings.',
  'Collar de cadena de eslabón cubano con corte diamante de oro amarillo sólido pesado de 14K con una construcción ajustada y sustancial y un acabado facetado brillante. Con 24 pulgadas de largo, aproximadamente 4.7mm de ancho, y 27.8 gramos, tiene el equilibrio justo para el uso diario: suficiente peso y presencia para sentirse sustancial, pero aún de un tamaño fácil de usar regularmente.',
  '["Category: Gold","Metal: 14K yellow gold","Style: Diamond cut Cuban link chain necklace","Construction: Heavy solid gold, tight link construction","Weight: 27.8 grams","Width: 4.7mm","Length: 24 inches","Clasp: Lobster clasp","Marks: 14K on end fittings","Price: $2,945.46"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 14K","Estilo: Collar de cadena de eslabón cubano con corte diamante","Construcción: Oro sólido pesado, construcción de eslabón ajustada","Peso: 27.8 gramos","Ancho: 4.7mm","Largo: 24 pulgadas","Broche: Broche de langosta","Marcas: 14K en los herrajes de los extremos","Precio: $2,945.46"]'::jsonb,
  '["14k","yellow gold","gold necklace","cuban link","diamond cut","solid gold","heavy chain","tight construction","lobster clasp","14k mark","27.8 grams","4.7mm","24 inch","everyday wear","gold investment","estate jewelry"]'::jsonb,
  '["14k","oro amarillo","collar de oro","eslabón cubano","corte diamante","oro sólido","cadena pesada","construcción ajustada","broche de langosta","marca 14k","27.8 gramos","4.7mm","24 pulgadas","uso diario","inversión en oro","joyería de patrimonio"]'::jsonb,
  2
),

-- 3
(
  '14k-vintage-diamond-cut-figaro-chain-necklace-01', 'Gold',
  'Vintage 14K Gold Diamond Cut Figaro Link Chain Necklace',
  'Collar de Cadena de Eslabón Figaro con Corte Diamante de Oro de 14K Vintage',
  '$2,469.89', '$2,469.89', 'spot-multiplier', 14, 23.33, 1.25, 'Available',
  '["/assets/images/shop/shop-14k-vintage-diamond-cut-figaro-chain-01.png","/assets/images/shop/shop-14k-vintage-diamond-cut-figaro-chain-02.png","/assets/images/shop/shop-14k-vintage-diamond-cut-figaro-chain-03.png","/assets/images/shop/shop-14k-vintage-diamond-cut-figaro-chain-04.png"]'::jsonb,
  'Vintage solid 14K yellow gold diamond cut Figaro link chain necklace with alternating elongated links and shorter curb-style links for a classic bright-cut look. The diamond-cut surfaces catch the light nicely while the 23.33 gram weight gives the chain a substantial solid-gold feel. Measures 22 inches long and approximately 6mm wide, with a lobster clasp and 14K marks on the end fittings and clasp area.',
  'Collar de cadena de eslabón Figaro con corte diamante de oro amarillo sólido de 14K vintage con eslabones alargados alternados y eslabones más cortos estilo barbado para un aspecto clásico de corte brillante. Las superficies con corte diamante captan la luz de manera atractiva mientras que el peso de 23.33 gramos le da a la cadena una sensación sustancial de oro sólido.',
  '["Category: Gold","Era: Vintage","Metal: 14K yellow gold","Style: Diamond cut Figaro link chain necklace","Construction: Solid gold","Weight: 23.33 grams","Width: 6mm","Length: 22 inches","Clasp: Lobster clasp","Marks: 14K on end fittings and clasp area","Price: $2,469.89"]'::jsonb,
  '["Categoría: Oro","Época: Vintage","Metal: Oro amarillo de 14K","Estilo: Collar de cadena de eslabón Figaro con corte diamante","Construcción: Oro sólido","Peso: 23.33 gramos","Ancho: 6mm","Largo: 22 pulgadas","Broche: Broche de langosta","Marcas: 14K en los herrajes de los extremos y en el área del broche","Precio: $2,469.89"]'::jsonb,
  '["14k","yellow gold","gold necklace","figaro link","figueroa","diamond cut","solid gold","lobster clasp","14k mark","23.33 grams","6mm","22 inch","vintage estate jewelry"]'::jsonb,
  '["14k","oro amarillo","collar de oro","eslabón figaro","figueroa","corte diamante","oro sólido","broche de langosta","marca 14k","23.33 gramos","6mm","22 pulgadas","joyería de patrimonio vintage"]'::jsonb,
  3
),

-- 4
(
  '18k-italian-anchor-link-infinity-chain-necklace-01', 'Gold',
  'Vintage Italian 18K Gold Anchor Link Infinity Chain Necklace',
  'Collar de Cadena Infinita de Eslabón Ancla de Oro de 18K Italiano Vintage',
  '$3,891.15', '$3,891.15', 'spot-multiplier', 18, 23.8, 1.5, 'Available',
  '["/assets/images/shop/shop-18k-italian-anchor-link-infinity-chain-06.png","/assets/images/shop/shop-18k-italian-anchor-link-infinity-chain-01.png","/assets/images/shop/shop-18k-italian-anchor-link-infinity-chain-02.png","/assets/images/shop/shop-18k-italian-anchor-link-infinity-chain-03.png","/assets/images/shop/shop-18k-italian-anchor-link-infinity-chain-04.png","/assets/images/shop/shop-18k-italian-anchor-link-infinity-chain-05.png"]'::jsonb,
  'Vintage Italian 18K yellow gold continuous infinity-style chain necklace with distinctive anchor links, sometimes referred to as a Gucci-style link. This is a clasp-free design made to slip over the head, giving the necklace a clean uninterrupted look from every angle. The links have a sculptural open form and the substantial 23.8 gram weight gives the piece the feel of fine Italian craftsmanship. Measures 24 inches long and approximately 4mm wide, with one link stamped 18K 750.',
  'Collar de cadena continua estilo infinito de oro amarillo de 18K italiano vintage con distintivos eslabones ancla, a veces denominado eslabón estilo Gucci. Este es un diseño sin broche hecho para deslizarse por la cabeza, lo que le da al collar un aspecto limpio e ininterrumpido desde todos los ángulos.',
  '["Category: Gold","Origin: Italian","Era: Vintage","Metal: 18K yellow gold","Style: Anchor link / Gucci-style infinity chain necklace","Construction: Continuous clasp-free design","Weight: 23.8 grams","Width: 4mm","Length: 24 inches","Clasp: None, slips over the head","Mark: 18K 750 stamped on one link","Price: $3,891.15"]'::jsonb,
  '["Categoría: Oro","Origen: Italiano","Época: Vintage","Metal: Oro amarillo de 18K","Estilo: Collar de cadena infinita de eslabón ancla / estilo Gucci","Construcción: Diseño continuo sin broche","Peso: 23.8 gramos","Ancho: 4mm","Largo: 24 pulgadas","Broche: Ninguno, se desliza por la cabeza","Marca: 18K 750 grabado en un eslabón","Precio: $3,891.15"]'::jsonb,
  '["18k","750","yellow gold","italian gold","vintage","anchor link","gucci link","infinity chain","continuous chain","no clasp","clasp free","gold necklace","23.8 grams","4mm","24 inch","estate jewelry"]'::jsonb,
  '["18k","750","oro amarillo","oro italiano","vintage","eslabón ancla","gucci link","cadena infinita","cadena continua","sin broche","libre de broche","collar de oro","23.8 gramos","4mm","24 pulgadas","joyería de patrimonio"]'::jsonb,
  4
),

-- 5
(
  '10k-monaco-edge-cuban-link-chain-necklace-01', 'Gold',
  'Monaco Chain Edge 10K Gold Diamond Accent Cuban Link Necklace',
  'Collar de Eslabón Cubano con Acentos de Diamante de Oro de 10K Monaco Chain Edge',
  '$2,225.33', '$2,225.33', 'spot-multiplier', 10, 29.4, 1.25, 'Available',
  '["/assets/images/shop/shop-10k-monaco-edge-cuban-chain-01.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-02.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-03.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-04.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-05.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-06.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-07.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-08.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-09.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-10.png","/assets/images/shop/shop-10k-monaco-edge-cuban-chain-11.png"]'::jsonb,
  'Monaco Chain Edge 10K yellow gold Cuban link necklace with a modern geometric profile and a wide, low-slung 9mm look. The semi-hollow construction is engineered for strength and presence while keeping the chain wearable and priced far below a comparable solid-link piece. The standout feature is the low-profile double-lock spring-loaded clasp, finished with pavé-set diamond accents and a black enamel Monaco logo plaque. The reverse is marked MONACO CHAIN, Edge, and 10K. Measures 25.5 inches long, weighs 29.4 grams, and presents in good condition with no dents noted.',
  'Collar de eslabón cubano de oro amarillo de 10K Monaco Chain Edge con un perfil geométrico moderno y un aspecto ancho y bajo de 9mm. La construcción semihueca está diseñada para ofrecer resistencia y presencia a la vez que mantiene la cadena cómoda de usar.',
  '["Category: Gold","Brand: Monaco Chain","Model: Edge","Metal: 10K yellow gold","Style: Modern geometric Cuban link necklace","Construction: Semi-hollow, engineered for strength","Weight: 29.4 grams","Width: 9mm","Length: 25.5 inches","Clasp: Low-profile double-lock spring-loaded box clasp","Clasp detail: Pavé-set diamond accents with black enamel Monaco logo","Marks: MONACO CHAIN, Edge, and 10K on clasp","Condition: Good condition with no dents noted","Price: $2,225.33"]'::jsonb,
  '["Categoría: Oro","Marca: Monaco Chain","Modelo: Edge","Metal: Oro amarillo de 10K","Estilo: Collar de eslabón cubano geométrico moderno","Construcción: Semihueco, diseñado para resistencia","Peso: 29.4 gramos","Ancho: 9mm","Largo: 25.5 pulgadas","Broche: Broche de caja de bajo perfil con doble seguro y resorte","Detalle del broche: Acentos de diamantes engastados tipo pavé con logotipo de Monaco en esmalte negro","Marcas: MONACO CHAIN, Edge, y 10K en el broche","Condición: Buena condición sin abolladuras observadas","Precio: $2,225.33"]'::jsonb,
  '["10k","yellow gold","monaco chain","edge","cuban link","geometric cuban","diamond accent","pave diamonds","black enamel","box clasp","double lock","spring loaded clasp","semi hollow","29.4 grams","9mm","25.5 inch","estate jewelry"]'::jsonb,
  '["10k","oro amarillo","monaco chain","edge","eslabón cubano","cubano geométrico","acento de diamante","diamantes pavé","esmalte negro","broche de caja","doble seguro","broche con resorte","semihueco","29.4 gramos","9mm","25.5 pulgadas","joyería de patrimonio"]'::jsonb,
  5
),

-- 6
(
  '10k-hollow-cuban-link-chain-necklace-01', 'Gold',
  '10K Gold 5mm Hollow Cuban Link Chain Necklace',
  'Collar de Cadena de Eslabón Cubano Hueco de 5mm de Oro de 10K',
  '$1,003.38', '$1,003.38', 'spot-multiplier', 10, 13.27, 1.25, 'Available',
  '["/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-01.png","/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-02.png","/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-03.png","/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-04.png","/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-05.png","/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-06.png","/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-07.png","/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-08.png"]'::jsonb,
  '10K yellow gold Cuban link chain necklace with a classic curb-style profile, measuring 26 inches long and approximately 5mm wide. The chain is hollow-link / semi-solid construction, giving it the look of a wider Cuban link while keeping the weight wearable at 13.27 grams. It secures with a box clasp and double safety, and one end of the clasp is marked 10K.',
  'Collar de cadena de eslabón cubano de oro amarillo de 10K con un perfil clásico estilo barbado, que mide 26 pulgadas de largo y aproximadamente 5mm de ancho. La cadena es de construcción de eslabón hueco / semisólida.',
  '["Category: Gold","Metal: 10K yellow gold","Style: Cuban link chain necklace","Construction: Hollow link / semi-solid","Weight: 13.27 grams","Width: 5mm","Length: 26 inches","Clasp: Box clasp with double safety","Mark: 10K on one end of clasp","Price: $1,003.38"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 10K","Estilo: Collar de cadena de eslabón cubano","Construcción: Eslabón hueco / semisólido","Peso: 13.27 gramos","Ancho: 5mm","Largo: 26 pulgadas","Broche: Broche de caja con doble seguro","Marca: 10K en un extremo del broche","Precio: $1,003.38"]'::jsonb,
  '["10k","yellow gold","gold necklace","cuban link","curb link","hollow link","semi solid","box clasp","double safety","10k mark","13.27 grams","5mm","26 inch","estate jewelry"]'::jsonb,
  '["10k","oro amarillo","collar de oro","eslabón cubano","eslabón barbado","eslabón hueco","semisólido","broche de caja","doble seguro","marca 10k","13.27 gramos","5mm","26 pulgadas","joyería de patrimonio"]'::jsonb,
  6
),

-- 7
(
  '14k-oval-link-chain-necklace-01', 'Gold',
  'Vintage 14K Gold Oval Link Chain Necklace',
  'Collar de Cadena de Eslabón Ovalado de Oro de 14K Vintage',
  '$2,360.88', '$2,360.88', 'spot-multiplier', 14, 22.23, 1.25, 'Available',
  '["/assets/images/shop/shop-14k-oval-link-chain-necklace-01.png","/assets/images/shop/shop-14k-oval-link-chain-necklace-02.png","/assets/images/shop/shop-14k-oval-link-chain-necklace-03.png","/assets/images/shop/shop-14k-oval-link-chain-necklace-04.png","/assets/images/shop/shop-14k-oval-link-chain-necklace-05.png","/assets/images/shop/shop-14k-oval-link-chain-necklace-06.png","/assets/images/shop/shop-14k-oval-link-chain-necklace-07.png","/assets/images/shop/shop-14k-oval-link-chain-necklace-08.png"]'::jsonb,
  'Vintage 14K yellow gold oval link chain necklace with a classic open chain-link profile and softly textured, lightly faceted link faces that catch the light. The necklace measures 23 inches long, approximately 4.3mm wide, and weighs 22.23 grams, giving it an easy everyday scale with genuine estate character. It secures with a barrel clasp, and the clasp tongue is marked 14K.',
  'Collar de cadena de eslabón ovalado de oro amarillo de 14K vintage con un perfil clásico de eslabón abierto y caras de eslabón suavemente texturizadas y ligeramente facetadas que captan la luz.',
  '["Category: Gold","Metal: 14K yellow gold","Style: Oval chain-link necklace","Era: Vintage","Weight: 22.23 grams","Width: 4.3mm","Length: 23 inches","Clasp: Barrel clasp","Mark: 14K on clasp tongue","Price: $2,360.88"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 14K","Estilo: Collar de eslabón ovalado","Época: Vintage","Peso: 22.23 gramos","Ancho: 4.3mm","Largo: 23 pulgadas","Broche: Broche de barril","Marca: 14K en la lengüeta del broche","Precio: $2,360.88"]'::jsonb,
  '["14k","yellow gold","gold necklace","oval link","chain link","classic chain","barrel clasp","14k mark","22.23 grams","4.3mm","23 inch","vintage estate jewelry"]'::jsonb,
  '["14k","oro amarillo","collar de oro","eslabón ovalado","eslabón de cadena","cadena clásica","broche de barril","marca 14k","22.23 gramos","4.3mm","23 pulgadas","joyería de patrimonio vintage"]'::jsonb,
  7
),

-- 8
(
  '10k-cuban-link-chain-01', 'Gold',
  '10K Gold Miami Cuban Link Chain Necklace',
  'Collar de Cadena de Eslabón Cubano Miami de Oro de 10K',
  '$10,795', '$10,795', 'spot-multiplier', 10, 119.41, 1.25, 'Available',
  '["/assets/images/shop/shop-10k-cuban-chain-06.png","/assets/images/shop/shop-10k-cuban-chain-01.png","/assets/images/shop/shop-10k-cuban-chain-02.png","/assets/images/shop/shop-10k-cuban-chain-03.png","/assets/images/shop/shop-10k-cuban-chain-04.png","/assets/images/shop/shop-10k-cuban-chain-05.png"]'::jsonb,
  'Substantial solid 10K gold Miami Cuban link chain necklace with a classic flat, tightly interlocking profile and secure box clasp. At 119.41 grams, 9mm wide, and 24 inches long, this is a strong everyday statement chain with the weight and presence collectors look for in solid gold jewelry. The small mark on the clasp tongue reads 10K.',
  'Sustancial collar de cadena de eslabón cubano Miami de oro sólido de 10K con un perfil clásico plano y fuertemente entrelazado y un broche de caja seguro.',
  '["Category: Gold","Metal: 10K gold","Construction: Solid, not hollow or semi-hollow","Weight: 119.41 grams","Width: 9mm","Length: 24 inches","Mark: Small tongue mark reads 10K","Clasp: Box clasp with safety","Price: $10,795"]'::jsonb,
  '["Categoría: Oro","Metal: Oro de 10K","Construcción: Sólido, no hueco ni semihueco","Peso: 119.41 gramos","Ancho: 9mm","Largo: 24 pulgadas","Marca: La pequeña marca en la lengüeta dice 10K","Broche: Broche de caja con seguro","Precio: $10,795"]'::jsonb,
  '["10k","gold","miami cuban link","cuban link","chain","necklace","119.41 grams","9mm","24 inch","solid","estate jewelry","box clasp","tongue mark"]'::jsonb,
  '["10k","oro","eslabón cubano miami","eslabón cubano","cadena","collar","119.41 gramos","9mm","24 pulgadas","sólido","joyería de patrimonio","broche de caja","marca en la lengüeta"]'::jsonb,
  8
),

-- 9
(
  '14k-infinity-rope-chain-necklace-01', 'Gold',
  'Vintage 14K Gold 7.5mm Infinity Rope Chain Necklace',
  'Collar de Cadena tipo Cordón Infinita de 7.5mm de Oro de 14K Vintage',
  '$5,950', '$5,950', 'spot-multiplier', 14, 55.9, 1.25, 'Available',
  '["/assets/images/shop/shop-14k-infinity-rope-chain-01.png","/assets/images/shop/shop-14k-infinity-rope-chain-02.png","/assets/images/shop/shop-14k-infinity-rope-chain-03.png","/assets/images/shop/shop-14k-infinity-rope-chain-04.png","/assets/images/shop/shop-14k-infinity-rope-chain-05.png","/assets/images/shop/shop-14k-infinity-rope-chain-06.png"]'::jsonb,
  'Vintage 14K yellow gold infinity-style rope chain necklace with no clasp, designed to slip over the head. At 30 inches long, approximately 7.5mm wide, and 55.9 grams, this semi-hollow chain has a sturdy feel and strong presence without the much higher cost of a fully solid chain. Small tag is marked BB with each B inside a circle, followed by 14K.',
  'Collar de cadena tipo cordón estilo infinito de oro amarillo de 14K vintage sin broche, diseñado para deslizarse por la cabeza.',
  '["Category: Gold","Metal: 14K yellow gold","Style: Infinity-style rope chain necklace","Construction: Semi-hollow, rigid and sturdy","Weight: 55.9 grams","Width: Approx. 7.5mm","Length: 30 inches","Clasp: None, slips over the head","Mark: BB, each B inside a circle, followed by 14K","Era: Vintage","Price: $5,950"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 14K","Estilo: Collar de cadena tipo cordón estilo infinito","Construcción: Semihueco, rígido y robusto","Peso: 55.9 gramos","Ancho: Aprox. 7.5mm","Largo: 30 pulgadas","Broche: Ninguno, se desliza por la cabeza","Marca: BB, cada B dentro de un círculo, seguido de 14K","Época: Vintage","Precio: $5,950"]'::jsonb,
  '["14k","yellow gold","gold necklace","rope chain","infinity chain","claspless","no clasp","semi hollow","7.5mm","30 inch","55.9 grams","bb mark","14k mark","vintage estate jewelry","unisex"]'::jsonb,
  '["14k","oro amarillo","collar de oro","cadena tipo cordón","cadena infinita","sin broche","semihueco","7.5mm","30 pulgadas","55.9 gramos","marca bb","marca 14k","joyería de patrimonio vintage","unisex"]'::jsonb,
  9
),

-- 10
(
  '10k-semi-solid-cuban-link-6mm-chain-necklace-01', 'Gold',
  '10K Gold Semi-Solid Cuban Link Chain Necklace',
  'Collar de Cadena de Eslabón Cubano Semisólido de Oro de 10K',
  '$2,394.56', '$2,394.56', 'spot-multiplier', 10, 26, 1.25, 'Available',
  '["/assets/images/shop/shop-10k-semi-solid-cuban-link-6mm-chain-01.png","/assets/images/shop/shop-10k-semi-solid-cuban-link-6mm-chain-02.png","/assets/images/shop/shop-10k-semi-solid-cuban-link-6mm-chain-03.png","/assets/images/shop/shop-10k-semi-solid-cuban-link-6mm-chain-04.png","/assets/images/shop/shop-10k-semi-solid-cuban-link-6mm-chain-05.png","/assets/images/shop/shop-10k-semi-solid-cuban-link-6mm-chain-06.png","/assets/images/shop/shop-10k-semi-solid-cuban-link-6mm-chain-07.png"]'::jsonb,
  '10K yellow gold hollow-link / semi-solid Cuban link chain necklace measuring 24.5 inches long and approximately 6.3mm wide, weighing 26 grams. The hollow-link / semi-solid construction gives it real Cuban-link presence at a comfortable, wearable weight. It secures with a box clasp that has a double safety, and the box clasp is marked 10K.',
  'Collar de cadena de eslabón cubano de eslabón hueco / semisólido de oro amarillo de 10K que mide 24.5 pulgadas de largo y aproximadamente 6.3mm de ancho, con un peso de 26 gramos.',
  '["Category: Gold","Metal: 10K yellow gold","Style: Cuban link chain necklace","Construction: Hollow-link / semi-solid","Weight: 26 grams","Width: 6.3mm","Length: 24.5 inches","Clasp: Box clasp with double safety","Mark: 10K on box clasp","Price: $2,394.56"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 10K","Estilo: Collar de cadena de eslabón cubano","Construcción: Eslabón hueco / semisólido","Peso: 26 gramos","Ancho: 6.3mm","Largo: 24.5 pulgadas","Broche: Broche de caja con doble seguro","Marca: 10K en el broche de caja","Precio: $2,394.56"]'::jsonb,
  '["10k","yellow gold","gold necklace","cuban link","hollow link","semi solid","semi-hollow","box clasp","double safety","10k mark","26 grams","6.3mm","24.5 inch","estate jewelry"]'::jsonb,
  '["10k","oro amarillo","collar de oro","eslabón cubano","eslabón hueco","semisólido","semihueco","broche de caja","doble seguro","marca 10k","26 gramos","6.3mm","24.5 pulgadas","joyería de patrimonio"]'::jsonb,
  10
),

-- 11
(
  '14k-byzantine-link-chain-necklace-01', 'Gold',
  'Solid 14K Gold Byzantine Link Chain Necklace',
  'Collar de Cadena de Eslabón Bizantino de Oro Sólido de 14K',
  '$4,033.18', '$4,033.18', 'spot-multiplier', 14, 31.28, 1.25, 'Available',
  '["/assets/images/shop/shop-14k-byzantine-link-chain-01.png","/assets/images/shop/shop-14k-byzantine-link-chain-02.png","/assets/images/shop/shop-14k-byzantine-link-chain-03.png","/assets/images/shop/shop-14k-byzantine-link-chain-04.png","/assets/images/shop/shop-14k-byzantine-link-chain-05.png","/assets/images/shop/shop-14k-byzantine-link-chain-06.png"]'::jsonb,
  'Solid 14K gold Byzantine link chain necklace, sometimes called a fancy link, with the dense, intricately woven texture that gives Byzantine chains their distinctive look. The solid gold construction gives it real heft and lasting intrinsic value. It measures 21.5 inches long and approximately 4.3mm wide, weighing 31.28 grams for a substantial solid-gold feel. It secures with a barrel clasp marked 14K on the tongue.',
  'Collar de cadena de eslabón bizantino de oro sólido de 14K, a veces llamado eslabón fantasía, con la textura densa e intrincadamente tejida que les da a las cadenas bizantinas su aspecto distintivo.',
  '["Category: Gold","Metal: 14K gold","Style: Byzantine (fancy) link chain necklace","Construction: Solid gold","Weight: 31.28 grams","Width: 4.3mm","Length: 21.5 inches","Clasp: Barrel clasp","Mark: 14K on clasp tongue","Price: $4,033.18"]'::jsonb,
  '["Categoría: Oro","Metal: Oro de 14K","Estilo: Collar de cadena de eslabón bizantino (fantasía)","Construcción: Oro sólido","Peso: 31.28 gramos","Ancho: 4.3mm","Largo: 21.5 pulgadas","Broche: Broche de barril","Marca: 14K en la lengüeta del broche","Precio: $4,033.18"]'::jsonb,
  '["14k","yellow gold","gold necklace","byzantine link","byzantine chain","fancy link","solid gold","solid","barrel clasp","14k mark","tongue mark","31.28 grams","4.3mm","21.5 inch","estate jewelry"]'::jsonb,
  '["14k","oro amarillo","collar de oro","eslabón bizantino","cadena bizantina","eslabón fantasía","oro sólido","sólido","broche de barril","marca 14k","marca en la lengüeta","31.28 gramos","4.3mm","21.5 pulgadas","joyería de patrimonio"]'::jsonb,
  11
),

-- 12
(
  'new-listing-01', 'Gold',
  'Italian 14K Two-Tone Cuban Link & Ring Station Necklace',
  'Collar de Eslabón Cubano y Estaciones de Anillo de Oro de 14K de Dos Tonos Italiano',
  '$5,766.10', '$5,766.10', 'spot-multiplier', 14, 44.72, 1.25, 'Available',
  '["/assets/images/shop/shop-new-listing-01-01.png","/assets/images/shop/shop-new-listing-01-02.png","/assets/images/shop/shop-new-listing-01-03.png","/assets/images/shop/shop-new-listing-01-04.png","/assets/images/shop/shop-new-listing-01-05.png"]'::jsonb,
  'Italian-made 14K two-tone gold fancy link necklace that combines polished yellow-gold Cuban link sections with ribbed white-gold bar accents and bold twisted-gold double ring station connectors. The mix of yellow and white gold and the recurring ring stations give it a distinctive, high-design look that wears well at its full 30 inch length. The Cuban link sections measure about 5.5mm wide and the large double ring connectors are about 13mm wide, with a total weight of 44.72 grams. It secures with a lobster clasp and is marked 14K Italy on one of the end connectors, alongside a second, illegible maker''s mark.',
  'Collar de eslabón fancy de oro de dos tonos de 14K hecho en Italia que combina secciones de eslabón cubano de oro amarillo pulido con acentos de barra estriada de oro blanco y llamativos conectores de estación de anillo doble de oro trenzado.',
  '["Category: Gold","Origin: Italy","Metal: 14K two-tone (yellow & white) gold","Style: Cuban link necklace with twisted ring station connectors","Weight: 44.72 grams","Cuban link width: Approx. 5.5mm","Ring connector width: Approx. 13mm","Length: 30 inches","Clasp: Lobster clasp","Marks: 14K Italy on an end connector, plus an illegible maker''s mark","Price: $5,766.10"]'::jsonb,
  '["Categoría: Oro","Origen: Italia","Metal: Oro de dos tonos (amarillo y blanco) de 14K","Estilo: Collar de eslabón cubano con conectores de estación de anillo trenzado","Peso: 44.72 gramos","Ancho del eslabón cubano: Aprox. 5.5mm","Ancho del conector de anillo: Aprox. 13mm","Largo: 30 pulgadas","Broche: Broche de langosta","Marcas: 14K Italy en un conector de extremo, más una marca de fabricante ilegible","Precio: $5,766.10"]'::jsonb,
  '["14k","two tone","yellow gold","white gold","italy","italian","gold necklace","cuban link","ring station","fancy link","lobster clasp","14k italy mark","44.72 grams","5.5mm","13mm","30 inch","estate jewelry"]'::jsonb,
  '["14k","dos tonos","oro amarillo","oro blanco","italia","italiano","collar de oro","eslabón cubano","estación de anillo","eslabón fancy","broche de langosta","marca 14k italy","44.72 gramos","5.5mm","13mm","30 pulgadas","joyería de patrimonio"]'::jsonb,
  12
),

-- 13
(
  'new-listing-02', 'Gold',
  '14K Gold Round Box Link Chain Necklace',
  'Collar de Cadena de Eslabón Box Redondo de Oro de 14K',
  '$2,218.76', '$2,218.76', 'spot-multiplier', 14, 14.34, 1.5, 'Available',
  '["/assets/images/shop/shop-new-listing-02-01.png","/assets/images/shop/shop-new-listing-02-02.png","/assets/images/shop/shop-new-listing-02-03.png","/assets/images/shop/shop-new-listing-02-04.png","/assets/images/shop/shop-new-listing-02-05.png"]'::jsonb,
  '14K yellow gold fancy box link chain necklace, sometimes called a rolo or round box chain, with smooth rounded links that give it a soft, substantial look while staying lightweight and comfortable to wear. It measures 24 inches long and approximately 3mm wide, with a total weight of 14.34 grams. It secures with a lobster clasp marked LXG 14K.',
  'Collar de cadena de eslabón box fancy de oro amarillo de 14K, a veces llamada cadena rolo o box redondo, con eslabones redondeados y suaves que le dan un aspecto delicado y sustancial.',
  '["Category: Gold","Metal: 14K yellow gold","Style: Round box / rolo link chain necklace","Weight: 14.34 grams","Width: 3mm","Length: 24 inches","Clasp: Lobster clasp","Mark: LXG 14K on clasp","Price: $2,218.76"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 14K","Estilo: Collar de cadena de eslabón box redondo / rolo","Peso: 14.34 gramos","Ancho: 3mm","Largo: 24 pulgadas","Broche: Broche de langosta","Marca: LXG 14K en el broche","Precio: $2,218.76"]'::jsonb,
  '["14k","yellow gold","gold necklace","box link","round box","rolo chain","fancy link","lobster clasp","lxg 14k mark","14.34 grams","3mm","24 inch","estate jewelry"]'::jsonb,
  '["14k","oro amarillo","collar de oro","eslabón box","box redondo","cadena rolo","eslabón fancy","broche de langosta","marca lxg 14k","14.34 gramos","3mm","24 pulgadas","joyería de patrimonio"]'::jsonb,
  13
),

-- 14
(
  'new-listing-03', 'Gold',
  '10K Gold Monaco Cuban Link Necklace',
  'Collar de Eslabón Cubano Monaco de Oro de 10K',
  '$1,146.63', '$1,146.63', 'spot-multiplier', 10, 12.45, 1.25, 'Available',
  '["/assets/images/shop/shop-new-listing-03-01.png","/assets/images/shop/shop-new-listing-03-02.png","/assets/images/shop/shop-new-listing-03-03.png","/assets/images/shop/shop-new-listing-03-04.png","/assets/images/shop/shop-new-listing-03-05.png","/assets/images/shop/shop-new-listing-03-06.png","/assets/images/shop/shop-new-listing-03-07.png"]'::jsonb,
  '10K yellow gold hollow-link / semi-solid Monaco-style Cuban link chain necklace with a sleek modern profile and a low-profile box clasp connector set with pavé diamonds. The hollow-link / semi-solid construction keeps it lightweight while the tight Monaco link work gives it an ultra-strong, contemporary look. It measures 20.5 inches long and approximately 5mm wide, with a total weight of 12.45 grams.',
  'Collar de cadena de eslabón cubano estilo Monaco de eslabón hueco / semisólido de oro amarillo de 10K con un perfil moderno y elegante y un conector de broche de caja de bajo perfil engastado con diamantes pavé.',
  '["Category: Gold","Metal: 10K yellow gold","Style: Monaco-style Cuban link chain necklace","Construction: Hollow-link / semi-solid","Weight: 12.45 grams","Width: 5mm","Length: 20.5 inches","Clasp: Low-profile box clasp connector set with pavé diamonds","Price: $1,146.63"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 10K","Estilo: Collar de cadena de eslabón cubano estilo Monaco","Construcción: Eslabón hueco / semisólido","Peso: 12.45 gramos","Ancho: 5mm","Largo: 20.5 pulgadas","Broche: Conector de broche de caja de bajo perfil engastado con diamantes pavé","Precio: $1,146.63"]'::jsonb,
  '["10k","yellow gold","gold necklace","monaco chain","cuban link","hollow link","semi solid","pave diamond clasp","diamond clasp","box clasp","12.45 grams","5mm","20.5 inch","modern","estate jewelry"]'::jsonb,
  '["10k","oro amarillo","collar de oro","cadena monaco","eslabón cubano","eslabón hueco","semisólido","broche de diamantes pavé","broche de diamantes","broche de caja","12.45 gramos","5mm","20.5 pulgadas","moderno","joyería de patrimonio"]'::jsonb,
  14
),

-- 15
(
  'new-listing-04', 'Gold',
  '14K Gold Rope Chain Necklace',
  'Collar de Cadena de Cuerda de Oro de 14K',
  '$1,609.14', '$1,609.14', 'spot-multiplier', 14, 12.48, 1.25, 'Available',
  '["/assets/images/shop/shop-new-listing-04-01.png","/assets/images/shop/shop-new-listing-04-02.png","/assets/images/shop/shop-new-listing-04-03.png","/assets/images/shop/shop-new-listing-04-04.png"]'::jsonb,
  '14K yellow gold rope chain necklace with the classic twisted, light-catching rope texture that works well on its own or as a pendant chain. It measures 25 inches long and approximately 2.5mm wide, with a total weight of 12.48 grams. It secures with a lobster clasp and is marked 14K on the end links.',
  'Collar de cadena de cuerda de oro amarillo de 14K con la clásica textura de cuerda trenzada que capta la luz y que funciona muy bien por sí sola o como cadena para dije.',
  '["Category: Gold","Metal: 14K yellow gold","Style: Rope chain necklace","Weight: 12.48 grams","Width: 2.5mm","Length: 25 inches","Clasp: Lobster clasp","Mark: 14K on end links","Price: $1,609.14"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 14K","Estilo: Collar de cadena de cuerda","Peso: 12.48 gramos","Ancho: 2.5mm","Largo: 25 pulgadas","Broche: Broche de langosta","Marca: 14K en los eslabones de los extremos","Precio: $1,609.14"]'::jsonb,
  '["14k","yellow gold","gold necklace","rope chain","lobster clasp","14k mark","pendant chain","12.48 grams","2.5mm","25 inch","estate jewelry"]'::jsonb,
  '["14k","oro amarillo","collar de oro","cadena de cuerda","broche de langosta","marca 14k","cadena para dije","12.48 gramos","2.5mm","25 pulgadas","joyería de patrimonio"]'::jsonb,
  15
),

-- 16
(
  'new-listing-05', 'Gold',
  '10K Gold Rope Chain Necklace',
  'Collar de Cadena de Cuerda de Oro de 10K',
  '$1,398.98', '$1,398.98', 'spot-multiplier', 10, 15.19, 1.25, 'Available',
  '["/assets/images/shop/shop-new-listing-05-01.png","/assets/images/shop/shop-new-listing-05-02.png","/assets/images/shop/shop-new-listing-05-03.png","/assets/images/shop/shop-new-listing-05-04.png","/assets/images/shop/shop-new-listing-05-05.png"]'::jsonb,
  '10K yellow gold rope chain necklace with a classic twisted rope texture and a great everyday length. It measures 25 inches long and approximately 2.6mm wide, with a total weight of 15.19 grams. It secures with a lobster clasp and the end links are marked ALI 417 for 10K gold.',
  'Collar de cadena de cuerda de oro amarillo de 10K con la clásica textura de cuerda trenzada y un largo excelente para el uso diario.',
  '["Category: Gold","Metal: 10K yellow gold","Style: Rope chain necklace","Weight: 15.19 grams","Width: 2.6mm","Length: 25 inches","Clasp: Lobster clasp","Mark: ALI 417 (10K) on end links","Price: $1,398.98"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 10K","Estilo: Collar de cadena de cuerda","Peso: 15.19 gramos","Ancho: 2.6mm","Largo: 25 pulgadas","Broche: Broche de langosta","Marca: ALI 417 (10K) en los eslabones de los extremos","Precio: $1,398.98"]'::jsonb,
  '["10k","417","yellow gold","gold necklace","rope chain","lobster clasp","ali 417 mark","15.19 grams","2.6mm","25 inch","estate jewelry"]'::jsonb,
  '["10k","417","oro amarillo","collar de oro","cadena de cuerda","broche de langosta","marca ali 417","15.19 gramos","2.6mm","25 pulgadas","joyería de patrimonio"]'::jsonb,
  16
),

-- 17
(
  'new-listing-06', 'Gold',
  '14K Gold Semi-Solid Cuban Link Chain Necklace',
  'Collar de Cadena de Eslabón Cubano Semisólido de Oro de 14K',
  '$1,299.69', '$1,299.69', 'spot-multiplier', 14, 9, 1.4, 'Available',
  '["/assets/images/shop/shop-new-listing-06-01.png","/assets/images/shop/shop-new-listing-06-02.png","/assets/images/shop/shop-new-listing-06-03.png","/assets/images/shop/shop-new-listing-06-04.jpg","/assets/images/shop/shop-new-listing-06-05.jpg"]'::jsonb,
  '14K yellow gold hollow-link / semi-solid Cuban link chain necklace in a subtle, everyday-friendly width. At 24 inches long and approximately 3.7mm wide, it is a nice size for daily wear with an understated look, and the hollow-link / semi-solid construction keeps it light at a 9 gram total weight. It secures with a lobster clasp and is marked 14K on each end link.',
  'Collar de cadena de eslabón cubano de eslabón hueco / semisólido de oro amarillo de 14K en un ancho sutil y cómodo para el uso diario.',
  '["Category: Gold","Metal: 14K yellow gold","Style: Cuban link chain necklace","Construction: Hollow-link / semi-solid","Weight: 9 grams","Width: 3.7mm","Length: 24 inches","Clasp: Lobster clasp","Mark: 14K on each end link","Price: $1,299.69"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 14K","Estilo: Collar de cadena de eslabón cubano","Construcción: Eslabón hueco / semisólido","Peso: 9 gramos","Ancho: 3.7mm","Largo: 24 pulgadas","Broche: Broche de langosta","Marca: 14K en cada eslabón de los extremos","Precio: $1,299.69"]'::jsonb,
  '["14k","yellow gold","gold necklace","cuban link","hollow link","semi solid","lobster clasp","14k mark","daily wear","9 grams","3.7mm","24 inch","estate jewelry"]'::jsonb,
  '["14k","oro amarillo","collar de oro","eslabón cubano","eslabón hueco","semisólido","broche de langosta","marca 14k","uso diario","9 gramos","3.7mm","24 pulgadas","joyería de patrimonio"]'::jsonb,
  17
),

-- 18
(
  '18k-heraldic-cross-band-ring-01', 'Gold',
  '18K Gold Heraldic Cross Motif Band Ring',
  'Anillo de Banda con Motivo de Cruz Heráldica de Oro de 18K',
  '$2,495', '$2,495', 'spot-multiplier', 18, 16, 1.25, 'Available',
  '["/assets/images/shop/shop-18k-heraldic-cross-ring-01.png","/assets/images/shop/shop-18k-heraldic-cross-ring-02.png"]'::jsonb,
  'Vintage early 20th century heavy solid 18K gold band ring with a raised repeating cross motif framed by rope-style borders. The pattern reads as a stylized heraldic or Greek-key-inspired cross design, giving the band a bold architectural look with strong estate jewelry character. The interior mark reads U.S. with a copyright symbol and 18K.',
  'Anillo de banda de oro sólido pesado de 18K vintage de principios del siglo XX con un motivo de cruz repetido en relieve enmarcado por bordes estilo cordón.',
  '["Category: Gold","Era: Vintage early 20th century","Metal: 18K gold","Construction: Solid gold band","Weight: 16 grams","Width: 8.1mm","Ring size: 11","Design: Repeating heraldic or Greek-key-inspired cross motif","Mark: U.S. with copyright symbol and 18K","Price: $2,495"]'::jsonb,
  '["Categoría: Oro","Época: Vintage de principios del siglo XX","Metal: Oro de 18K","Construcción: Banda de oro sólido","Peso: 16 gramos","Ancho: 8.1mm","Talla del anillo: 11","Diseño: Motivo de cruz repetido de inspiración heráldica o de greca griega","Marca: U.S. con símbolo de copyright y 18K","Precio: $2,495"]'::jsonb,
  '["18k","gold","solid gold","ring","band","vintage","early 20th century","16 grams","8.1mm","size 11","heraldic cross","cross motif","greek key","estate jewelry","u.s. mark","copyright mark"]'::jsonb,
  '["18k","oro","oro sólido","anillo","banda","vintage","principios del siglo XX","16 gramos","8.1mm","talla 11","cruz heráldica","motivo de cruz","greca griega","joyería de patrimonio","marca u.s.","marca de copyright"]'::jsonb,
  18
),

-- 19
(
  '14k-mens-curb-link-bracelet-01', 'Gold',
  'Vintage 14K Gold Men''s 8mm Cuban Link Bracelet',
  'Pulsera de Eslabón Cubano de 8mm para Hombre de Oro de 14K Vintage',
  '$2,425', '$2,425', 'spot-multiplier', 14, 22.75, 1.25, 'Available',
  '["/assets/images/shop/shop-14k-curb-link-bracelet-01.png","/assets/images/shop/shop-14k-curb-link-bracelet-02.png","/assets/images/shop/shop-14k-curb-link-bracelet-03.png","/assets/images/shop/shop-14k-curb-link-bracelet-04.png","/assets/images/shop/shop-14k-curb-link-bracelet-05.png","/assets/images/shop/shop-14k-curb-link-bracelet-06.png","/assets/images/shop/shop-14k-curb-link-bracelet-07.png","/assets/images/shop/shop-14k-curb-link-bracelet-08.png","/assets/images/shop/shop-14k-curb-link-bracelet-09.png","/assets/images/shop/shop-14k-curb-link-bracelet-10.png"]'::jsonb,
  'Good vintage estate 14K yellow gold men''s 8mm Cuban link bracelet with semi-hollow construction and a box clasp marked K14. The bracelet has a wearable clasped length of approximately 7 3/4 inches and wears around a 7 inch inner circumference. It weighs 22.75 grams and shows a few very minor dents, typical for this style of semi-hollow vintage link bracelet.',
  'Buena pulsera de eslabón cubano de 8mm para hombre de oro amarillo de 14K vintage de patrimonio con construcción semihueca y un broche de caja marcado K14.',
  '["Category: Gold","Metal: 14K yellow gold","Mark: K14","Construction: Semi-hollow Cuban links","Weight: 22.75 grams","Width: 8mm","Wearable length: Approx. 7 3/4 inches clasped","Fit: Wears around a 7 inch inner circumference","Clasp: Box clasp with safety","Condition: Good vintage estate condition with a few very minor dents","Price: $2,425"]'::jsonb,
  '["Categoría: Oro","Metal: Oro amarillo de 14K","Marca: K14","Construcción: Eslabones cubanos semihuecos","Peso: 22.75 gramos","Ancho: 8mm","Largo utilizable: Aprox. 7 3/4 pulgadas abrochada","Ajuste: Se ajusta alrededor de una circunferencia interior de 7 pulgadas","Broche: Broche de caja con seguro","Condición: Buena condición vintage de patrimonio con algunas abolladuras muy menores","Precio: $2,425"]'::jsonb,
  '["14k","k14","yellow gold","gold bracelet","mens bracelet","men''s bracelet","cuban link","8mm","semi hollow","box clasp","22.75 grams","7.75 inch","7 inch inner circumference","vintage estate jewelry"]'::jsonb,
  '["14k","k14","oro amarillo","pulsera de oro","pulsera para hombre","eslabón cubano","8mm","semihueco","broche de caja","22.75 gramos","7.75 pulgadas","circunferencia interior de 7 pulgadas","joyería de patrimonio vintage"]'::jsonb,
  19
),

-- 20
(
  'david-yurman-sterling-14k-articulated-bangle-bracelet-01', 'Silver',
  'David Yurman Sterling Silver & 14K Gold Articulated Bangle Bracelet',
  'Pulsera Articulada David Yurman de Plata Esterlina y Oro de 14K',
  '$0.00', '$0.00', 'manual', 925, 44.3, NULL, 'Available',
  '["/assets/shoppics/IMG_5132.webp","/assets/shoppics/IMG_5132 (Product Staging).webp","/assets/shoppics/IMG_5132 (Product Staging) 2.webp"]'::jsonb,
  'Unisex David Yurman sterling silver and 14K yellow gold articulated bangle bracelet featuring alternating silver and gold links. Lobster clasp marked ''D Y ©'' and ''925 585''. Fits approximately a 6½ inch wrist. Weighs 44.3 grams with 7mm-wide links. Good condition with normal signs of wear.',
  'Pulsera articulada unisex de David Yurman en plata esterlina y oro amarillo de 14K con eslabones alternados de plata y oro. Cierre de langosta marcado ''D Y ©'' y ''925 585''. Se ajusta aproximadamente a una muñeca de 6½ pulgadas.',
  '["Category: Silver","Brand: David Yurman","Metals: Sterling silver (925) and 14K yellow gold (585)","Marks: D Y ©, 925, 585","Style: Articulated bangle bracelet","Weight: 44.3 grams","Width: 7mm","Fit: Wears approximately 6½ inches around the wrist","Clasp: Lobster clasp","Condition: Good with normal signs of wear","Price: $0.00"]'::jsonb,
  '["Categoría: Plata","Marca: David Yurman","Metales: Plata esterlina (925) y oro amarillo de 14K (585)","Marcas: D Y ©, 925, 585","Estilo: Pulsera articulada tipo bangle","Peso: 44.3 gramos","Ancho: 7mm","Ajuste: Se ajusta aproximadamente a una circunferencia de muñeca de 6½ pulgadas","Broche: Cierre de langosta","Condición: Buena con signos normales de uso","Precio: $0.00"]'::jsonb,
  '["sterling silver","925","14k","585","david yurman","dy","articulated","bangle","bracelet","silver bracelet","gold and silver","two tone","unisex","44.3 grams","7mm","6.5 inch","lobster clasp","designer","estate jewelry"]'::jsonb,
  '["plata esterlina","925","14k","585","david yurman","dy","articulada","bangle","pulsera","pulsera de plata","plata y oro","dos tonos","unisex","44.3 gramos","7mm","6.5 pulgadas","cierre de langosta","diseñador","joyería de patrimonio"]'::jsonb,
  20
)

ON CONFLICT (id) DO NOTHING;


-- =============================================================
-- DONE. Verify with:
--   SELECT id, title, status FROM products ORDER BY sort_order;
--   SELECT id, is_admin FROM profiles WHERE is_admin = true;
-- =============================================================
