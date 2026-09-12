-- ==============================================================================
-- CHÁ DO RAVI — PEQUENO EXPLORADOR
-- Supabase Database Schema, Tables, RLS and Atomic Reservation Function
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
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
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
  pix_key TEXT DEFAULT 'chadoravi@email.com',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ATOMIC RESERVATION STORED PROCEDURE (Prevents simultaneous double-booking)
CREATE OR REPLACE FUNCTION make_reservation(
  p_gift_id TEXT,
  p_guest_name TEXT,
  p_message TEXT DEFAULT NULL,
  p_reservation_id TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available INT;
  v_gift_name TEXT;
  v_res_id TEXT;
  v_res RECORD;
BEGIN
  -- Lock row exclusively to prevent race conditions
  SELECT available_quantity, name INTO v_available, v_gift_name
  FROM gifts
  WHERE id = p_gift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Presente não encontrado.');
  END IF;

  IF v_available <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Desculpe, a última unidade já foi reservada!');
  END IF;

  -- Decrement safely
  UPDATE gifts
  SET 
    available_quantity = available_quantity - 1,
    status = CASE WHEN available_quantity - 1 <= 0 THEN 'depleted' ELSE 'available' END
  WHERE id = p_gift_id;

  v_res_id := COALESCE(p_reservation_id, 'res-' || gen_random_uuid());

  INSERT INTO reservations (id, gift_id, gift_name, guest_name, message, quantity, status)
  VALUES (v_res_id, p_gift_id, v_gift_name, p_guest_name, p_message, 1, 'confirmed')
  RETURNING * INTO v_res;

  RETURN json_build_object(
    'success', true,
    'reservation_id', v_res_id,
    'gift_name', v_gift_name,
    'guest_name', p_guest_name
  );
END;
$$;
