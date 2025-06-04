-- Inserir configurações padrão do restaurante se não existirem
INSERT INTO restaurant_settings (
  name,
  address,
  cnpj,
  phone,
  email,
  logo_url,
  primary_color,
  secondary_color,
  currency,
  timezone,
  service_charge_percentage,
  accepts_cash,
  accepts_pix,
  accepts_card,
  delivery_available,
  takeaway_available,
  opening_hours
) 
SELECT
  'Restaurante QR Menu',
  'Rua das Flores, 123 - Centro',
  '12.345.678/0001-90',
  '(11) 9999-9999',
  'contato@restauranteqrmenu.com.br',
  '',
  '#1976d2',
  '#dc004e',
  'BRL',
  'America/Sao_Paulo',
  10.0,
  true,
  true,
  true,
  true,
  true,
  '{"monday":{"open":"11:00","close":"23:00","closed":false},"tuesday":{"open":"11:00","close":"23:00","closed":false},"wednesday":{"open":"11:00","close":"23:00","closed":false},"thursday":{"open":"11:00","close":"23:00","closed":false},"friday":{"open":"11:00","close":"23:00","closed":false},"saturday":{"open":"11:00","close":"23:00","closed":false},"sunday":{"open":"11:00","close":"23:00","closed":false}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM restaurant_settings);
