-- Interruptor bot/humano por conversación.
-- Correr en el SQL Editor del proyecto "Software".
alter table public.conversaciones
  add column if not exists bot_activo boolean not null default true;

-- ──────────────────────────────────────────────────────────────
-- (OPCIONAL) Conversación de prueba para ver la Bandeja con datos.
-- Usa el último lead de "Prueba - Dr. Martinez". Borrala después si querés.
-- ──────────────────────────────────────────────────────────────
-- with l as (
--   select id, profesional_id from public.leads
--   where profesional_id = 'e89d1cb6-2cec-4546-830c-31a095699da8'
--   order by created_at desc limit 1
-- ), c as (
--   insert into public.conversaciones
--     (profesional_id, lead_id, canal, estado, ultimo_mensaje_at, bot_activo)
--   select profesional_id, id, 'whatsapp', 'abierta', now(), true from l
--   returning id, profesional_id, lead_id
-- )
-- insert into public.mensajes
--   (profesional_id, conversacion_id, lead_id, direccion, autor, tipo, contenido, estado, created_at)
-- select profesional_id, id, lead_id, 'entrante', 'lead', 'texto',
--        'Hola, quería consultar por una cita', 'recibido', now() - interval '5 min' from c
-- union all
-- select profesional_id, id, lead_id, 'saliente', 'bot', 'texto',
--        '¡Hola! Claro, ¿qué día te queda cómodo?', 'enviado', now() - interval '4 min' from c;
