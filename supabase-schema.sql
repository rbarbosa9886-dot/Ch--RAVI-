-- ==============================================================================
-- CHÁ DO RAVI — PEQUENO EXPLORADOR
-- Supabase Database Schema, Tables, RLS, Initial Seed & Atomic Functions
-- ==============================================================================

-- 1. Table: Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  display_order INT DEFAULT 0
);

INSERT INTO categories (id, name, icon, display_order) VALUES
  ('fraldas', 'Fraldas', '🍼', 1),
  ('higiene', 'Higiene', '🧴', 2),
  ('roupinhas', 'Roupinhas', '👕', 3),
  ('banho', 'Banho', '🛁', 4),
  ('quarto', 'Quarto', '🛏️', 5),
  ('outros', 'Outros', '🎁', 6)
ON CONFLICT (id) DO NOTHING;

-- 2. Table: Gifts (Presentes)
CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL REFERENCES categories(id),
  total_quantity INT NOT NULL DEFAULT 1,
  available_quantity INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available', -- 'available' | 'depleted'
  suggested_brand TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table: Reservations (Reservas)
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  gift_id TEXT NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  gift_name TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  message TEXT,
  quantity INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'cancelled'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table: Event Details
CREATE TABLE IF NOT EXISTS event_details (
  id INT PRIMARY KEY DEFAULT 1,
  baby_name TEXT NOT NULL DEFAULT 'RAVI',
  theme_title TEXT NOT NULL DEFAULT 'Chá de Fraldas do Ravi — Pequeno Explorador',
  subtitle TEXT NOT NULL DEFAULT 'Estamos contando os dias para conhecer você!',
  intro_text TEXT NOT NULL DEFAULT 'Escolha um presente para o Ravi e faça parte desse momento especial. 💙',
  event_date TEXT NOT NULL DEFAULT 'Sábado, 24 de Outubro de 2026',
  event_time TEXT NOT NULL DEFAULT '15:30h',
  event_location TEXT NOT NULL DEFAULT 'Espaço Jardim Encantado',
  event_address TEXT NOT NULL DEFAULT 'Rua das Palmeiras, 120 - Jardim das Flores',
  map_query TEXT DEFAULT 'Rua das Palmeiras, 120',
  pix_key TEXT DEFAULT 'chadoravi@email.com',
  pix_name TEXT DEFAULT 'Pais do Ravi',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed default event_details if not exists
INSERT INTO event_details (
  id, baby_name, theme_title, subtitle, intro_text,
  event_date, event_time, event_location, event_address, map_query, pix_key, pix_name
) VALUES (
  1,
  'RAVI',
  'Chá de Fraldas do Ravi — Pequeno Explorador',
  'Estamos contando os dias para conhecer você!',
  'Escolha um presente para o Ravi e faça parte desse momento especial. 💙',
  'Sábado, 24 de Outubro de 2026',
  '15:30h',
  'Espaço Jardim Encantado',
  'Rua das Palmeiras, 120 - Jardim das Flores',
  'Rua das Palmeiras, 120',
  'chadoravi@email.com',
  'Pais do Ravi'
) ON CONFLICT (id) DO NOTHING;

-- 5. ATOMIC RESERVATION STORED PROCEDURE (Supports multiple units & prevents race conditions)
CREATE OR REPLACE FUNCTION make_reservation(
  p_gift_id TEXT,
  p_guest_name TEXT,
  p_quantity INT DEFAULT 1,
  p_message TEXT DEFAULT NULL,
  p_reservation_id TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available INT;
  v_total INT;
  v_gift_name TEXT;
  v_res_id TEXT;
  v_res RECORD;
  v_new_available INT;
  v_qty INT;
BEGIN
  -- Validate quantity
  v_qty := COALESCE(p_quantity, 1);
  IF v_qty <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A quantidade solicitada deve ser de pelo menos 1 unidade.',
      'code', 'INVALID_QUANTITY'
    );
  END IF;

  -- 1 & 2. Locate gift and lock row exclusively with FOR UPDATE to prevent race conditions
  SELECT available_quantity, total_quantity, name 
  INTO v_available, v_total, v_gift_name
  FROM gifts
  WHERE id = p_gift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Presente não encontrado.',
      'code', 'NOT_FOUND'
    );
  END IF;

  -- 3. Check if any units available
  IF v_available <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Que pena! Todas as unidades deste presente já foram reservadas.',
      'code', 'OUT_OF_STOCK'
    );
  END IF;

  -- 5. Check if requested quantity exceeds available quantity
  IF v_qty > v_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Que pena! Apenas ' || v_available || ' ' || 
               CASE WHEN v_available = 1 THEN 'unidade está disponível' ELSE 'unidades estão disponíveis' END || 
               ' no momento.',
      'code', 'INSUFFICIENT_STOCK',
      'available', v_available
    );
  END IF;

  -- 6 & 7. Reduce available_quantity and set status to depleted only if available reaches 0
  v_new_available := v_available - v_qty;

  UPDATE gifts
  SET 
    available_quantity = v_new_available,
    status = CASE WHEN v_new_available <= 0 THEN 'depleted' ELSE 'available' END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_gift_id;

  -- 8. Create a single reservation record with quantity = v_qty
  v_res_id := COALESCE(p_reservation_id, 'res-' || gen_random_uuid());

  INSERT INTO reservations (id, gift_id, gift_name, guest_name, message, quantity, status)
  VALUES (v_res_id, p_gift_id, v_gift_name, TRIM(p_guest_name), TRIM(p_message), v_qty, 'confirmed')
  RETURNING * INTO v_res;

  -- 9. Return success payload
  RETURN json_build_object(
    'success', true,
    'reservation', json_build_object(
      'id', v_res_id,
      'giftId', p_gift_id,
      'giftName', v_gift_name,
      'guestName', TRIM(p_guest_name),
      'message', TRIM(p_message),
      'quantity', v_qty,
      'status', 'confirmed',
      'createdAt', v_res.created_at
    ),
    'updatedGift', json_build_object(
      'id', p_gift_id,
      'name', v_gift_name,
      'totalQuantity', v_total,
      'availableQuantity', v_new_available,
      'status', CASE WHEN v_new_available <= 0 THEN 'depleted' ELSE 'available' END
    )
  );
END;
$$;

-- 6. ATOMIC CANCELLATION STORED PROCEDURE (Restores reservation.quantity to stock safely)
CREATE OR REPLACE FUNCTION cancel_reservation(
  p_reservation_id TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res RECORD;
  v_gift RECORD;
  v_new_available INT;
BEGIN
  -- 1. Find and lock reservation
  SELECT * INTO v_res
  FROM reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reserva não encontrada.');
  END IF;

  IF v_res.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Esta reserva já se encontra cancelada.');
  END IF;

  -- 2. Mark reservation as cancelled
  UPDATE reservations
  SET status = 'cancelled'
  WHERE id = p_reservation_id;

  -- 3. Lock and restore gift quantity
  SELECT * INTO v_gift
  FROM gifts
  WHERE id = v_res.gift_id
  FOR UPDATE;

  IF FOUND THEN
    -- Guarantee available_quantity never exceeds total_quantity
    v_new_available := LEAST(v_gift.total_quantity, v_gift.available_quantity + v_res.quantity);

    UPDATE gifts
    SET 
      available_quantity = v_new_available,
      status = CASE WHEN v_new_available > 0 THEN 'available' ELSE 'depleted' END,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_res.gift_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'restored_quantity', v_res.quantity,
    'new_available_quantity', v_new_available,
    'gift_id', v_res.gift_id
  );
END;
$$;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_details ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Allow public read categories" ON categories;
DROP POLICY IF EXISTS "Allow public read gifts" ON gifts;
DROP POLICY IF EXISTS "Allow public read event_details" ON event_details;
DROP POLICY IF EXISTS "Allow public read reservations" ON reservations;
DROP POLICY IF EXISTS "Allow public insert reservations" ON reservations;

-- Categories: Public read
CREATE POLICY "Allow public read categories" ON categories
  FOR SELECT USING (true);

-- Gifts: Public read
CREATE POLICY "Allow public read gifts" ON gifts
  FOR SELECT USING (true);

-- Event details: Public read
CREATE POLICY "Allow public read event_details" ON event_details
  FOR SELECT USING (true);

-- Reservations: Public read
CREATE POLICY "Allow public read reservations" ON reservations
  FOR SELECT USING (true);

-- Reservations: Public insert
CREATE POLICY "Allow public insert reservations" ON reservations
  FOR INSERT WITH CHECK (true);

-- Note: In Supabase, the backend using the SERVICE_ROLE_KEY automatically bypasses RLS
-- and has full read, insert, update and delete capabilities on all tables.

